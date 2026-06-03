import { auth } from "@clerk/nextjs/server";
import { NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import path from "path";
import {
  getKnowledgeRegistry,
  readKnowledgeFile,
  readKnowledgeFileAsync,
  getRegistrySummary,
  SYSTEM_PROMPT_CHAR_LIMIT,
  PRIMARY_SYSTEM_PROMPT,
  HARDCODED_LAYER1_PATH,
  UPRITE_KNOWLEDGE,
  detectBuildingType,
  shouldLoadRenovationMatrix,
  shouldLoadPriceList,
} from "@/lib/knowledge";
import { searchKnowledgeBase } from "@/lib/knowledge-base-search";
import { getAllChunks, truncateAtChunkBoundary } from "@/lib/rag";
import { ESTIMATION_STALE_MS } from "@/lib/types";
import { normalizeCsiDivisionsToTarget, sanitizeCsiDivisions } from "@/lib/csi";
import { detailEstimateInvalidation } from "@/lib/project-invalidation";
import {
  mergeConfirmedInfoPreservingUser,
  normalizeConfirmedInfo,
} from "@/lib/confirmed-info";
import { anchorMonteCarloToRough } from "@/lib/estimate-anchor";
import {
  applyProjectCreationDefaults,
  buildCaseDatabaseGuardBlock,
  buildPrevailingWageEstimateBlock,
  isPrevailingWageEnabled,
} from "@/lib/project-creation-fields";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

async function getGCProfile(userId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from("gc_profiles")
      .select(
        "company_name, company_address, contingency_rate, gc_fee_rate, logo_url"
      )
      .eq("clerk_user_id", userId)
      .single();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

export const maxDuration = 800; // ~13 minutes (Vercel Pro max)

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const phase: "overview" | "detail" | "final" = body.phase ?? "overview";

  // Load the project
  const { data: project, error: projErr } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (projErr || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Concurrency guard: reject if a non-stale estimation is already running
  if (project.estimating_phase && project.estimating_started_at) {
    const elapsed = Date.now() - new Date(project.estimating_started_at).getTime();
    if (elapsed < ESTIMATION_STALE_MS) {
      return NextResponse.json(
        { error: "An estimation is already in progress" },
        { status: 409 }
      );
    }
  }

  // Mark estimation in progress, clear any previous error.
  // Overview re-runs invalidate stale detail/final numbers derived from old inputs.
  await supabaseAdmin
    .from("projects")
    .update({
      estimating_phase: phase,
      estimating_started_at: new Date().toISOString(),
      estimating_error: null,
      ...(phase === "overview" ? detailEstimateInvalidation() : {}),
    })
    .eq("id", id)
    .eq("user_id", userId);

  // Run all estimation work in the background after the 202 is sent.
  // This keeps the HTTP connection short (no client-side timeout) while
  // the function continues running under maxDuration.
  after(async () => {
    const failEstimating = async (message: string) => {
      try {
        await supabaseAdmin
          .from("projects")
          .update({ estimating_phase: null, estimating_started_at: null, estimating_error: message })
          .eq("id", id)
          .eq("user_id", userId);
      } catch (dbErr) {
        console.error("[Estimate API] Failed to write error state to DB:", dbErr);
      }
    };

  try {

  // Reload project so background work uses the latest saved overview inputs
  const { data: latestProject, error: reloadErr } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (reloadErr || !latestProject) {
    await failEstimating("Project not found");
    return;
  }
  const project = latestProject;

  const effectiveConfirmedInfo = applyProjectCreationDefaults(
    normalizeConfirmedInfo(project.confirmed_info || {}),
    {
      contractType: project.contract_type,
      prevailingWage: project.prevailing_wage,
    }
  );
  const prevailingWageEnabled = isPrevailingWageEnabled(effectiveConfirmedInfo);
  const prevailingWageBlock = buildPrevailingWageEstimateBlock(prevailingWageEnabled);
  const caseDatabaseGuard = buildCaseDatabaseGuardBlock(prevailingWageEnabled);

  // Load GC profile
  const gcProfile = await getGCProfile(userId);

  // Load RAG context
  let ragContext = "";
  if (project.conversation_id) {
    const chunks = await getAllChunks(project.conversation_id);
    const MAX_RAG = 300000;
    ragContext = truncateAtChunkBoundary(chunks, MAX_RAG);
  }

  // Build knowledge layers (replicating chat/route.ts logic)
  const registry = getKnowledgeRegistry();
  const systemFragments: string[] = [];

  if (PRIMARY_SYSTEM_PROMPT) {
    systemFragments.push(
      `--- PRIMARY SYSTEM INSTRUCTIONS ---\n${PRIMARY_SYSTEM_PROMPT}`
    );
  }

  const confirmedStr = JSON.stringify(effectiveConfirmedInfo);
  const combinedText = confirmedStr.toLowerCase();

  const renovPath = path.join(process.cwd(), "Data", "RENOVATION_COST_FACTOR_MATRIX_v1.1.yaml");
  const priceListPath = path.join(process.cwd(), "References", "ESTIMAIT_California_Real_Price_List_v1.0.md.docx");
  const formulaPath = path.join(process.cwd(), "References", "CA_Estimation_Formula_Updates_v1.0.md");
  const multiStatePath = path.join(process.cwd(), "References", "MULTI_STATE_COST_RATES_v1.0.md");

  // Load all knowledge files in parallel
  const [layer1Content, renovContent, priceListContent, formulaContent, multiStateContent] = await Promise.all([
    readKnowledgeFileAsync(HARDCODED_LAYER1_PATH),
    shouldLoadRenovationMatrix(combinedText) ? readKnowledgeFileAsync(renovPath) : Promise.resolve(null),
    shouldLoadPriceList(combinedText) ? readKnowledgeFileAsync(priceListPath) : Promise.resolve(null),
    readKnowledgeFileAsync(formulaPath),
    readKnowledgeFileAsync(multiStatePath),
  ]);

  if (layer1Content) systemFragments.push(`--- LAYER 1: Core Methodology ---\n${layer1Content}`);
  if (renovContent) systemFragments.push(`--- DATA: Renovation Cost Factor Matrix ---\n${renovContent}`);
  if (priceListContent) systemFragments.push(`--- REFERENCE: California Real Price List 2025 ---\n${priceListContent}`);
  if (formulaContent) systemFragments.push(`--- CA ESTIMATION FORMULA UPDATES ---\n${formulaContent}`);
  if (multiStateContent) systemFragments.push(`--- MULTI-STATE COST RATES ---\n${multiStateContent}`);

  const buildingType =
    effectiveConfirmedInfo.building_type?.value ||
    project.extracted_info?.building_type ||
    detectBuildingType(combinedText);

  if (buildingType) {
    const typeKey = String(buildingType).toUpperCase();
    const layer2Domain = registry?.LAYER2?.[typeKey];
    if (layer2Domain) {
      const kb = layer2Domain.KNOWLEDGE?.[0];
      if (kb?.local_path) {
        const kbContent = readKnowledgeFile(kb.local_path);
        if (kbContent)
          systemFragments.push(
            `--- LAYER 2: ${typeKey} Knowledge ---\n${kbContent.slice(0, 2000)}`
          );
      }
      const matrix = layer2Domain.DECISION_MATRIX?.[0];
      if (matrix?.local_path) {
        const mc = readKnowledgeFile(matrix.local_path);
        if (mc)
          systemFragments.push(
            `--- LAYER 2: ${typeKey} Matrix ---\n${mc.slice(0, 1500)}`
          );
      }
    }
  }

  systemFragments.push(caseDatabaseGuard);

  const registrySummary = getRegistrySummary(registry);

  // Build phase-specific user prompt
  let userPrompt = "";
  const confirmedInfo = effectiveConfirmedInfo;
  const confirmedSummary = Object.entries(confirmedInfo)
    .map(([k, v]: [string, any]) => `- ${k}: ${v.value} (confidence: ${v.confidence})`)
    .join("\n");

  if (phase === "overview") {
    // Include user's QA decisions so re-estimation respects exclusions / scope changes
    const overviewQA: any[] = project.overview_qa || [];
    const answeredQA = overviewQA.filter((q: any) => q.answered && q.answer);
    const qaSection = answeredQA.length > 0
      ? `\nUSER DECISIONS (confirmed during overview Q&A):
${answeredQA.map((q: any) => `- ${q.item_title || q.question}: ${q.answer}`).join("\n")}

IMPORTANT: Respect these user decisions when estimating. If the user says an item is "provided by owner", "not in scope", or "excluded", do NOT include that item's cost in the estimate. These decisions should REDUCE the total, not increase it.\n`
      : "";

    const bidFormItems: any[] = project.bid_form_items || [];
    const bidFormLines = bidFormItems.flatMap((section: any) =>
      (section.items || []).map(
        (item: any) =>
          `- [${section.section_title || "Section"}] ${item.item_no || ""} ${item.description || ""} (${item.unit || "LS"}, qty: ${item.qty ?? "TBD"})`
      )
    );
    const bidFormSection = bidFormLines.length > 0
      ? `\nBID FORM SCOPE (from BOD/RFP — include ALL items in your estimate):
${bidFormLines.join("\n")}
IMPORTANT: This is a Design-Bid-Build project. Your rough estimate must account for the FULL bid form scope above, including specialty divisions (e.g. Division 11 process equipment/piping).\n`
      : "";

    userPrompt = `Based on the uploaded project documents and extracted information below, provide a rough cost estimate range.

${prevailingWageBlock}

COST DEFINITION (MANDATORY — same as Detail phase):
- rough_estimate must be Level B Total Project Budget: hard costs + soft costs combined.
- Derive from: GFA × unit cost rates × complexity/regional/prevailing-wage multipliers.
- Use California Real Price List, RSMeans, or regional benchmarks from the knowledge base.
- Do NOT output hard-cost-only (Level A) figures.

PROJECT INFO:
${confirmedSummary || JSON.stringify(project.extracted_info, null, 2)}
${bidFormSection}${qaSection}
Return your response as JSON with this exact structure:
{
  "rough_estimate": { "min": <number>, "max": <number>, "per_sf_min": <number>, "per_sf_max": <number> },
  "updated_fields": { "<field_name>": { "value": "<value>", "confidence": "high"|"low", "source": "ai" } }
}
Use delivery_method for delivery method updates only — never delivery_method_assumption.`;
  } else if (phase === "detail") {
    // Build overview context so detail estimate is anchored to user-confirmed decisions
    const rough = project.rough_estimate;
    const pwLabel = prevailingWageEnabled ? "YES" : "NO";
    const roughSection = rough
      ? `\nOVERVIEW ROUGH ESTIMATE (user-confirmed through Q&A — Prevailing Wage = ${pwLabel}):
  Range: $${rough.min?.toLocaleString()} – $${rough.max?.toLocaleString()}
  Per SF: $${rough.per_sf_min?.toLocaleString()} – $${rough.per_sf_max?.toLocaleString()}

MANDATORY ANCHOR: monte_carlo.mid MUST fall within the overview range above (±35% max).
Do NOT replace this with historical case database totals (CASE_002, Advantech, KB project finals).
If a similar past project exists in the knowledge base, use it for unit-rate calibration ONLY after adjusting for PW status and GFA.\n`
      : "";

    const overviewQA: any[] = project.overview_qa || [];
    const answeredQA = overviewQA.filter((q: any) => q.answered && q.answer);
    const qaSection = answeredQA.length > 0
      ? `\nOVERVIEW DECISIONS (user confirmed):\n${answeredQA.map((q: any) => `- ${q.item_title || q.question}: ${q.answer}`).join("\n")}\n`
      : "";

    userPrompt = `Based on the confirmed project information below, perform a full construction cost estimation.

${prevailingWageBlock}

CONFIRMED PROJECT INFO:
${confirmedSummary}
${roughSection}${qaSection}
SELECTED SCENARIO: ${project.selected_scenario || "mid"}

Provide the following in a single JSON response (CSI divisions will be requested separately):

1. Monte Carlo simulation with triangular distribution (±15% variance):
   - conservative (P80), mid (P50), optimistic (P10) TOTAL project costs (hard + soft combined)

2. Top 5 risk factors ranked by impact

3. AI guesses (items estimated without document evidence) and AI evidence (items backed by uploaded documents)

4. Hard/soft cost ratio

Return as JSON:
{
  "monte_carlo": { "conservative": <number>, "mid": <number>, "optimistic": <number> },
  "risks": [{ "title": "<str>", "probability": "HIGH"|"MEDIUM"|"LOW", "cost_impact": "<str>", "mitigation": "<str>", "rank": <int> }],
  "ai_guesses": [{ "item": "<str>", "value": "<str>", "reasoning": "<str>", "confidence": "high"|"low" }],
  "ai_evidence": [{ "item": "<str>", "value": "<str>", "source_doc": "<str>", "page_ref": "<str>" }],
  "hard_soft_ratio": { "hard_pct": <number>, "soft_pct": <number> }
}`;
  } else {
    userPrompt = `Finalize the cost estimate for this project.

${prevailingWageBlock}

CONFIRMED PROJECT INFO:
${confirmedSummary}

SELECTED SCENARIO: ${project.selected_scenario || "mid"}

CSI DIVISIONS (user-edited):
${JSON.stringify(project.csi_divisions, null, 2)}

HARD/SOFT RATIO: ${JSON.stringify(project.hard_soft_ratio)}

RULES:
- Generate a final_cost_summary row for EVERY CSI division listed above. Do not skip any.
- Every row MUST have ALL fields filled with calculated values: category, hq_building, aasc_building, total, per_sf, confidence.
- "total" = hq_building + aasc_building for each row.
- "per_sf" = total / GFA (use project GFA from confirmed info).
- If the project has only one building, set hq_building = total amount and aasc_building = 0.
- final_hard_cost + final_soft_cost must equal final_total_cost.
- Use "Div XX <description>" format for category names (e.g. "Div 01 General Conditions").

Respond as JSON:
{
  "final_hard_cost": <number>,
  "final_soft_cost": <number>,
  "final_total_cost": <number>,
  "final_cost_summary": [{ "category": "<str>", "hq_building": <number>, "aasc_building": <number>, "total": <number>, "per_sf": <number>, "confidence": "high"|"low" }]
}`;
  }

  // Knowledge Base: search similar past projects for detail calibration (exclude project name to avoid exact case copy)
  let kbContext = "";
  if (phase === "detail") {
    const kbQuery = [
      effectiveConfirmedInfo.building_type?.value,
      effectiveConfirmedInfo.location?.value,
      effectiveConfirmedInfo.gfa_sqft?.value,
      effectiveConfirmedInfo.project_subtype?.value,
      effectiveConfirmedInfo.construction_type?.value,
    ]
      .filter(Boolean)
      .join(" ");

    if (kbQuery) {
      const detectedType = combinedText.includes("public work") ? "public" as const : undefined;
      kbContext = await searchKnowledgeBase(userId, kbQuery, {
        maxChars: 8000,
        matchCount: 10,
        minSimilarity: 0.65,
        projectType: detectedType,
        prevailingWage: prevailingWageEnabled,
      });
    }
  }

  const kbInjection = kbContext
    ? `\n== KNOWLEDGE BASE: Similar Past Projects ==\n${kbContext}\nUse for unit-rate calibration ONLY. Never copy historical totals.\n== END KNOWLEDGE BASE ==\n`
    : "";

  const systemPrompt = `
You are Estimait, an advanced AI system for construction estimation.
You MUST respond with ONLY valid JSON. No markdown, no commentary, no code fences.

${ragContext ? `== DOCUMENT CONTEXT ==\n${ragContext}\n== END CONTEXT ==\n` : ""}
${phase === "detail" ? kbInjection : ""}
${gcProfile ? `== GC PROFILE ==\nCompany: ${gcProfile.company_name || "N/A"}\nAddress: ${gcProfile.company_address || "N/A"}\nContingency: ${gcProfile.contingency_rate ?? 10}%\nGC Fee: ${gcProfile.gc_fee_rate ?? 5}%\n` : ""}

== KNOWLEDGE BASE ==
${registrySummary}

${systemFragments.join("\n\n")}

== COST JUSTIFICATION RULES ==
For every cost figure, derive from: GFA x unit cost rates x multipliers.
Use California Real Price List, RSMeans, or regional benchmarks.
Flag assumptions with confidence: "low".

${prevailingWageBlock}
${caseDatabaseGuard}
`;


  // Log system prompt fragment sizes for debugging
  console.log(`[Estimate API] System prompt fragments:`, systemFragments.map((f, i) => {
    const label = f.slice(0, 60).replace(/\n/g, " ");
    return `  [${i}] ${f.length.toLocaleString()} chars — ${label}…`;
  }).join("\n"));
  console.log(`[Estimate API] Total system prompt: ${systemPrompt.length.toLocaleString()} chars (limit: ${SYSTEM_PROMPT_CHAR_LIMIT.toLocaleString()})`);

  const cappedSystem =
    systemPrompt.length > SYSTEM_PROMPT_CHAR_LIMIT
      ? (() => {
          console.error(`[Estimate API] ⚠️ System prompt TRUNCATED: ${systemPrompt.length.toLocaleString()} → ${SYSTEM_PROMPT_CHAR_LIMIT.toLocaleString()} chars. Last ${(systemPrompt.length - SYSTEM_PROMPT_CHAR_LIMIT).toLocaleString()} chars dropped.`);
          return systemPrompt.slice(0, SYSTEM_PROMPT_CHAR_LIMIT) + "\n[TRUNCATED]";
        })()
      : systemPrompt;

  // Build CSI prompt upfront so both detail calls can run in parallel
  let csiPrompt = "";
  let csiSystemPrompt = "";
  if (phase === "detail") {
    const rough = project.rough_estimate;
    const roughHardPct = project.hard_soft_ratio?.hard_pct ?? 85;
    const roughMid = rough ? (rough.min + rough.max) / 2 : 0;
    const prelimTarget = Math.round(roughMid * roughHardPct / 100);

    // Check if a bid form was detected from the BOD/RFP
    const bidFormItems: any[] = project.bid_form_items || [];
    const hasBidForm = bidFormItems.length > 0;

    const bidFormSection = hasBidForm ? `
== REQUIRED BID FORM FORMAT ==
This is a Design-Bid-Build project with a REQUIRED Bid Form from the BOD/RFP.
Your CSI divisions MUST follow this EXACT bid form structure. Each bid item in the form below must appear as a separate CSI division line item.

IMPORTANT — HOW TO USE THE BID FORM DATA:
- "qty": If a qty value is provided for an item, use it AS-IS — do NOT change it. If qty is null/missing, estimate it from project scope.
- "unit": Use the unit EXACTLY as specified — do NOT change it.
- "amount": The bid form dollar amounts are ALL $0.00 placeholders. COMPLETELY IGNORE THEM. You MUST estimate your own realistic market-rate "rate" and calculate amount = qty × rate.
- Never output $0 for any amount unless the scope is genuinely zero-cost.

REQUIRED BID FORM ITEMS:
${JSON.stringify(bidFormItems, null, 2)}

MAPPING RULES:
- Map each bid form item to the closest CSI division code
- Use the bid form item number as part of the description (e.g., "Item 1 - Earthwork - Grading and Excavation")
- Use the unit EXACTLY as specified in the bid form
- Use qty from bid form if provided; otherwise estimate from project scope
- Derive rate from RSMeans, regional benchmarks, or market data — never $0

` : "";

    csiPrompt = `Based on the confirmed project information below, generate a complete CSI Division breakdown${hasBidForm ? " following the REQUIRED BID FORM structure below" : " for HARD COST ONLY"}.

${prevailingWageBlock}

CONFIRMED PROJECT INFO:
${confirmedSummary}
${rough ? `\nOVERVIEW ROUGH ESTIMATE:\n  Range: $${rough.min?.toLocaleString()} – $${rough.max?.toLocaleString()}\n` : ""}
PRELIMINARY TARGET HARD COST: $${prelimTarget.toLocaleString()} (amounts will be normalized to actual monte carlo result)
${bidFormSection}
RULES:
${hasBidForm
  ? `- CRITICAL: You MUST output EVERY SINGLE bid form item listed above — including ALL sub-sections of Division 11 (Process Equipment, Process Piping, Process Accessories, Air Exhaust Room Equipment) and any other specialty divisions. The bid form IS the complete scope definition; do NOT filter out items as "OFE" or "owner-furnished" — include them all with estimated market prices.
- Each bid form item (including every sub-item with a unit and quantity) must be a separate line in csi_divisions.
- Multiple sections that share the same CSI code (e.g. multiple "11 00 00" sections) must each appear as separate entries — distinguish them via csi_description.
- Allocate amounts proportionally across ALL bid form items to total approximately $${prelimTarget.toLocaleString()}.`
  : `- Cover all relevant CSI divisions for this project type.
- Allocate amounts proportionally across divisions to total approximately $${prelimTarget.toLocaleString()}.`}
- Columns: csi_code, csi_description, description, qty, unit, rate, amount, per_sf, confidence ("high"|"low"), confidence_reason, ai_source, ai_benchmark, ai_gc_actions
- rate and amount must ALWAYS be >= 0. Never use negative values to represent exclusions; use amount = 0 for excluded scope.

FIELD RULES:
- ai_source: ONLY reference documents from the DOCUMENT CONTEXT provided by the user (e.g., "Construction plan section 8.6", "GC bid package — Division 26"). If no user document was used for this item, set to null. NEVER include RSMeans, internal benchmarks, AI knowledge, or any internal database references here.
- ai_benchmark: Market benchmark ranges derived from RSMeans, regional cost data, or industry standards (e.g., "$6–$9/SF for conduit and wire, high-tech manufacturing TX").
- ai_gc_actions: For low-confidence items only — list 1–3 specific documents the GC should provide for THIS particular scope (e.g., "Electrical sub quote — itemized pricing for conduit, wire, and panels|Electrical drawings — panel schedules and single-line diagrams"). Format as pipe-separated "Title — description" pairs. For high-confidence items, set to null.

Return as JSON:
{
  "csi_divisions": [{ "id": "<uuid>", "csi_code": "<str>", "csi_description": "<str>", "description": "<str>", "qty": <number|null>, "unit": "<str>", "rate": <number|null>, "amount": <number>, "per_sf": <number>, "confidence": "high"|"low", "confidence_reason": "<str>", "ai_source": "<str|null>", "ai_benchmark": "<str>", "ai_gc_actions": "<str|null>" }]
}`;

    const rawCsiSystem = [
      `You are Estimait, an advanced AI system for construction cost estimation.\nYou MUST respond with ONLY valid JSON. No markdown, no commentary, no code fences.`,
      hasBidForm ? `== CRITICAL: BID FORM COMPLIANCE ==\nThis project has a REQUIRED Bid Form from the BOD/RFP documents. Your CSI divisions MUST follow the exact structure provided in the user prompt. Every bid item — including ALL Division 11 sub-sections (Process Equipment, Process Piping, Process Accessories, Air Exhaust Room Equipment) — MUST appear as separate line items. Do NOT omit any division on grounds of it being "owner-furnished" or "not GC scope"; if it is in the Bid Form, it must be in your output.\n\nCRITICAL — QTY, UNIT, AND AMOUNT RULES:\n- qty: Use the exact qty from the bid form if provided. Never change it.\n- unit: Use the exact unit from the bid form. Never change it.\n- rate & amount: The bid form shows $0.00 for ALL items — these are blank template placeholders. NEVER copy $0 as your output. You MUST estimate a realistic market rate for every item and compute amount = qty × rate. Outputting $0 for any item is a critical error.` : "",
      ragContext ? `== DOCUMENT CONTEXT ==\n${ragContext}\n== END CONTEXT ==` : "",
      gcProfile ? `== GC PROFILE ==\nCompany: ${gcProfile.company_name || "N/A"}\nContingency: ${gcProfile.contingency_rate ?? 10}%\nGC Fee: ${gcProfile.gc_fee_rate ?? 5}%` : "",
      priceListContent ? `--- REFERENCE: California Real Price List 2025 ---\n${priceListContent}` : "",
      multiStateContent ? `--- MULTI-STATE COST RATES ---\n${multiStateContent}` : "",
      kbContext ? `--- KNOWLEDGE BASE: Similar Past Projects ---\n${kbContext}\nUse for unit-rate calibration ONLY. Never copy historical totals.` : "",
      `== COST JUSTIFICATION RULES ==\nFor every cost figure, derive from: GFA x unit cost rates x multipliers.\nUse California Real Price List, RSMeans, or regional benchmarks.\nFlag assumptions with confidence: "low".`,
      prevailingWageBlock,
      caseDatabaseGuard,
    ].filter(Boolean).join("\n\n");

    console.log(`[Estimate API] CSI system prompt: ${rawCsiSystem.length.toLocaleString()} chars (limit: ${SYSTEM_PROMPT_CHAR_LIMIT.toLocaleString()})`);
    csiSystemPrompt = rawCsiSystem.length > SYSTEM_PROMPT_CHAR_LIMIT
      ? (() => {
          console.error(`[Estimate API] ⚠️ CSI system prompt TRUNCATED: ${rawCsiSystem.length.toLocaleString()} → ${SYSTEM_PROMPT_CHAR_LIMIT.toLocaleString()} chars. Last ${(rawCsiSystem.length - SYSTEM_PROMPT_CHAR_LIMIT).toLocaleString()} chars dropped.`);
          return rawCsiSystem.slice(0, SYSTEM_PROMPT_CHAR_LIMIT) + "\n[TRUNCATED]";
        })()
      : rawCsiSystem;
  }

  const parseJson = (raw: string) => {
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    return JSON.parse(cleaned);
  };

    const maxTokens = phase === "overview" ? 8192 : 16384;
    let parsed: any;

    if (phase === "detail") {
      // Run summary and CSI calls in parallel to cut total time roughly in half
      const [summaryMsg, csiMsg] = await Promise.all([
        anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: maxTokens,
          system: cappedSystem,
          messages: [{ role: "user", content: userPrompt }],
          temperature: 0.1,
        }).finalMessage(),
        anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 32768,
          system: csiSystemPrompt,
          messages: [{ role: "user", content: csiPrompt }],
          temperature: 0.1,
        }).finalMessage(),
      ]);

      const summaryText = summaryMsg.content[0].type === "text" ? summaryMsg.content[0].text : "";
      const csiText = csiMsg.content[0].type === "text" ? csiMsg.content[0].text : "";

      if (summaryMsg.stop_reason === "max_tokens") {
        console.error(`[Estimate API] Summary response truncated at ${maxTokens} tokens`);
        await failEstimating("AI response was truncated. Please try again."); return;
      }
      if (csiMsg.stop_reason === "max_tokens") {
        console.error(`[Estimate API] CSI response truncated at 32768 tokens`);
        await failEstimating("AI response was truncated. Please try again."); return;
      }

      try {
        parsed = parseJson(summaryText);
      } catch {
        console.error("[Estimate API] Failed to parse summary response:", summaryText.slice(0, 200));
        await failEstimating("Failed to parse AI response."); return;
      }
      try {
        const csiParsed = parseJson(csiText);
        parsed.csi_divisions = csiParsed.csi_divisions;
      } catch {
        console.error("[Estimate API] Failed to parse CSI response:", csiText.slice(0, 200));
        await failEstimating("Failed to parse CSI divisions response."); return;
      }

    } else {
      const response = await anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens,
        system: cappedSystem,
        messages: [{ role: "user", content: userPrompt }],
        temperature: 0.1,
      }).finalMessage();

      const text = response.content[0].type === "text" ? response.content[0].text : "";

      if (response.stop_reason === "max_tokens") {
        console.error(`[Estimate API] Response truncated at ${maxTokens} tokens for phase: ${phase}`);
        await failEstimating("AI response was truncated. Please try again."); return;
      }

      try {
        parsed = parseJson(text);
      } catch {
        console.error("[Estimate API] Failed to parse response:", text.slice(0, 200));
        await failEstimating("Failed to parse AI response."); return;
      }
    }

    // Save results to the project based on phase
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
      estimating_phase: null,
      estimating_started_at: null,
    };

    if (phase === "overview") {
      updates.rough_estimate = parsed.rough_estimate;
      // Keep Q&A multiplier base aligned with the displayed authoritative estimate.
      if (parsed.rough_estimate) {
        updates.base_estimate = parsed.rough_estimate;
      }
      if (parsed.updated_fields) {
        const baseWithDefaults = applyProjectCreationDefaults(
          normalizeConfirmedInfo(project.confirmed_info || {}),
          {
            contractType: project.contract_type,
            prevailingWage: project.prevailing_wage,
          }
        );
        updates.confirmed_info = normalizeConfirmedInfo(
          applyProjectCreationDefaults(
            mergeConfirmedInfoPreservingUser(
              baseWithDefaults,
              parsed.updated_fields
            ),
            {
              contractType: project.contract_type,
              prevailingWage: project.prevailing_wage,
            }
          )
        );
      }
      updates.status = "overview";
    } else if (phase === "detail") {
      const rough = project.rough_estimate;
      if (rough && parsed.monte_carlo) {
        parsed.monte_carlo = anchorMonteCarloToRough(parsed.monte_carlo, rough);
      }
      updates.monte_carlo = parsed.monte_carlo;
      updates.risks = parsed.risks;
      updates.ai_guesses = parsed.ai_guesses;
      updates.ai_evidence = parsed.ai_evidence;
      if (parsed.hard_soft_ratio) {
        updates.hard_soft_ratio = parsed.hard_soft_ratio;
      }

      // Normalize CSI divisions so their sum equals monte_carlo.mid × hard_pct%
      // Scale rate (not amount) so that amount = qty × rate stays consistent.
      const hardPct = (parsed.hard_soft_ratio?.hard_pct ?? project.hard_soft_ratio?.hard_pct ?? 85) / 100;
      const targetHardCost = (parsed.monte_carlo?.mid ?? 0) * hardPct;
      const csiDivisions: any[] = sanitizeCsiDivisions(parsed.csi_divisions || []);
      const rawCsiTotal = csiDivisions.reduce((s: number, d: any) => s + (d.amount || 0), 0);
      const normGfa = parseFloat(String(
        effectiveConfirmedInfo.gfa_sqft?.value ||
        project.extracted_info?.gfa_sqft?.value || 0
      ));

      if (rawCsiTotal > 0 && targetHardCost > 0) {
        updates.csi_divisions = normalizeCsiDivisionsToTarget(
          csiDivisions,
          targetHardCost,
          normGfa
        );
      } else {
        updates.csi_divisions = csiDivisions;
      }

      updates.status = "detail";
    } else {
      // Ensure all cost summary rows have complete data
      const finalGfa = parseFloat(String(
        effectiveConfirmedInfo.gfa_sqft?.value ||
        project.extracted_info?.gfa_sqft?.value || 0
      ));
      if (parsed.final_cost_summary && Array.isArray(parsed.final_cost_summary)) {
        parsed.final_cost_summary = parsed.final_cost_summary.map((row: any) => {
          const hq = row.hq_building || 0;
          const aasc = row.aasc_building || 0;
          const total = row.total || (hq + aasc);
          return {
            category: row.category || "Unknown",
            hq_building: hq,
            aasc_building: aasc,
            total,
            per_sf: row.per_sf || (finalGfa > 0 ? total / finalGfa : 0),
            confidence: row.confidence === "high" || row.confidence === "low" ? row.confidence : "low",
          };
        });
      }
      updates.final_hard_cost = parsed.final_hard_cost;
      updates.final_soft_cost = parsed.final_soft_cost;
      updates.final_total_cost = parsed.final_total_cost;
      updates.final_cost_summary = parsed.final_cost_summary;
      updates.status = "final";
    }

    await supabaseAdmin
      .from("projects")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId);

  } catch (err: any) {
    console.error("[Estimate API] Error:", err);
    let message = err.message || "Estimation failed";
    try {
      const jsonMatch = message.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const p = JSON.parse(jsonMatch[0]);
        if (p?.error?.message) message = p.error.message;
      }
    } catch {}
    await failEstimating(message);
  }

  }); // end after()

  return NextResponse.json({ ok: true }, { status: 202 });
}
