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

async function getAllChunks(conversationId: string): Promise<string> {
  try {
    const { data, error } = await supabaseAdmin
      .from("document_chunks")
      .select("file_name, chunk_index, content")
      .eq("conversation_id", conversationId)
      .order("chunk_index", { ascending: true });
    if (error || !data || data.length === 0) return "";
    return data
      .map(
        (chunk: any) =>
          `[${chunk.file_name} - chunk ${chunk.chunk_index}]\n${chunk.content}`
      )
      .join("\n\n---\n\n");
  } catch {
    return "";
  }
}

export const maxDuration = 300;

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
    if (elapsed < 360_000) {
      return NextResponse.json(
        { error: "An estimation is already in progress" },
        { status: 409 }
      );
    }
  }

  // Mark estimation in progress, clear any previous error
  await supabaseAdmin
    .from("projects")
    .update({
      estimating_phase: phase,
      estimating_started_at: new Date().toISOString(),
      estimating_error: null,
    })
    .eq("id", id)
    .eq("user_id", userId);

  // Run all estimation work in the background after the 202 is sent.
  // This keeps the HTTP connection short (no client-side timeout) while
  // the function continues running under maxDuration.
  after(async () => {
    const failEstimating = async (message: string) => {
      await supabaseAdmin
        .from("projects")
        .update({ estimating_phase: null, estimating_started_at: null, estimating_error: message })
        .eq("id", id)
        .eq("user_id", userId);
    };

  try {

  // Load GC profile
  const gcProfile = await getGCProfile(userId);

  // Load RAG context
  let ragContext = "";
  if (project.conversation_id) {
    const chunks = await getAllChunks(project.conversation_id);
    const MAX_RAG = 300000;
    ragContext =
      chunks.length > MAX_RAG
        ? chunks.substring(0, MAX_RAG) +
          "\n\n[RAG context truncated to fit budget]"
        : chunks;
  }

  // Build knowledge layers (replicating chat/route.ts logic)
  const registry = getKnowledgeRegistry();
  const systemFragments: string[] = [];

  if (PRIMARY_SYSTEM_PROMPT) {
    systemFragments.push(
      `--- PRIMARY SYSTEM INSTRUCTIONS ---\n${PRIMARY_SYSTEM_PROMPT}`
    );
  }

  const confirmedStr = JSON.stringify(project.confirmed_info || {});
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
    project.confirmed_info?.building_type?.value ||
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

  systemFragments.push(`
== CASE DATABASE USAGE RULES (MANDATORY) ==
The case database contains historical project data for CALIBRATION ONLY.
NEVER output case database cost figures directly as the estimate.
ALWAYS re-derive costs using: GFA x unit cost rates x applicable multipliers.
`);

  const registrySummary = getRegistrySummary(registry);

  // Build phase-specific user prompt
  let userPrompt = "";
  const confirmedInfo = project.confirmed_info || {};
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

    userPrompt = `Based on the uploaded project documents and extracted information below, provide a rough cost estimate range.

PROJECT INFO:
${confirmedSummary || JSON.stringify(project.extracted_info, null, 2)}
${qaSection}
Return your response as JSON with this exact structure:
{
  "rough_estimate": { "min": <number>, "max": <number>, "per_sf_min": <number>, "per_sf_max": <number> },
  "updated_fields": { "<field_name>": { "value": "<value>", "confidence": "high"|"low", "source": "ai" } }
}`;
  } else if (phase === "detail") {
    // Build overview context so detail estimate is anchored to user-confirmed decisions
    const rough = project.rough_estimate;
    const roughSection = rough
      ? `\nOVERVIEW ROUGH ESTIMATE (user-confirmed through Q&A):
  Range: $${rough.min?.toLocaleString()} – $${rough.max?.toLocaleString()}
  Per SF: $${rough.per_sf_min?.toLocaleString()} – $${rough.per_sf_max?.toLocaleString()}\n`
      : "";

    const overviewQA: any[] = project.overview_qa || [];
    const answeredQA = overviewQA.filter((q: any) => q.answered && q.answer);
    const qaSection = answeredQA.length > 0
      ? `\nOVERVIEW DECISIONS (user confirmed):\n${answeredQA.map((q: any) => `- ${q.item_title || q.question}: ${q.answer}`).join("\n")}\n`
      : "";

    userPrompt = `Based on the confirmed project information below, perform a full construction cost estimation.

CONFIRMED PROJECT INFO:
${confirmedSummary}
${roughSection}${qaSection}${roughSection ? `IMPORTANT: The rough estimate above reflects user-confirmed decisions during the overview phase. Your monte_carlo mid estimate should be consistent with this range. Only deviate if CSI-level analysis reveals a clear reason, and briefly explain why.\n` : ""}
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

  const systemPrompt = `
You are Estimait, an advanced AI system for construction estimation.
You MUST respond with ONLY valid JSON. No markdown, no commentary, no code fences.

${ragContext ? `== DOCUMENT CONTEXT ==\n${ragContext}\n== END CONTEXT ==\n` : ""}
${gcProfile ? `== GC PROFILE ==\nCompany: ${gcProfile.company_name || "N/A"}\nAddress: ${gcProfile.company_address || "N/A"}\nContingency: ${gcProfile.contingency_rate ?? 10}%\nGC Fee: ${gcProfile.gc_fee_rate ?? 5}%\n` : ""}

== KNOWLEDGE BASE ==
${registrySummary}

${systemFragments.join("\n\n")}

== COST JUSTIFICATION RULES ==
For every cost figure, derive from: GFA x unit cost rates x multipliers.
Use California Real Price List, RSMeans, or regional benchmarks.
Flag assumptions with confidence: "low".
`;


  const cappedSystem =
    systemPrompt.length > SYSTEM_PROMPT_CHAR_LIMIT
      ? systemPrompt.slice(0, SYSTEM_PROMPT_CHAR_LIMIT) + "\n[TRUNCATED]"
      : systemPrompt;

  // Knowledge Base: search similar past projects for CSI calibration (detail phase only)
  let kbContext = "";
  if (phase === "detail") {
    const kbQuery = [
      project.confirmed_info?.building_type?.value,
      project.confirmed_info?.location?.value,
      project.confirmed_info?.project_name?.value,
      project.title,
    ].filter(Boolean).join(" ");

    if (kbQuery) {
      const detectedType = combinedText.includes("public work") ? "public" as const : undefined;
      kbContext = await searchKnowledgeBase(userId, kbQuery, {
        maxChars: 8000,
        matchCount: 10,
        minSimilarity: 0.65,
        projectType: detectedType,
      });
    }
  }

  // Build CSI prompt upfront so both detail calls can run in parallel
  let csiPrompt = "";
  let csiSystemPrompt = "";
  if (phase === "detail") {
    const rough = project.rough_estimate;
    const roughHardPct = project.hard_soft_ratio?.hard_pct ?? 85;
    const roughMid = rough ? (rough.min + rough.max) / 2 : 0;
    const prelimTarget = Math.round(roughMid * roughHardPct / 100);

    csiPrompt = `Based on the confirmed project information below, generate a complete CSI Division breakdown for HARD COST ONLY.

CONFIRMED PROJECT INFO:
${confirmedSummary}
${rough ? `\nOVERVIEW ROUGH ESTIMATE:\n  Range: $${rough.min?.toLocaleString()} – $${rough.max?.toLocaleString()}\n` : ""}
PRELIMINARY TARGET HARD COST: $${prelimTarget.toLocaleString()} (amounts will be normalized to actual monte carlo result)

RULES:
- Cover all relevant CSI divisions for this project type.
- Allocate amounts proportionally across divisions to total approximately $${prelimTarget.toLocaleString()}.
- Columns: csi_code, csi_description, description, qty, unit, rate, amount, per_sf, confidence ("high"|"low"), confidence_reason, ai_source, ai_benchmark

Return as JSON:
{
  "csi_divisions": [{ "id": "<uuid>", "csi_code": "<str>", "csi_description": "<str>", "description": "<str>", "qty": <number|null>, "unit": "<str>", "rate": <number|null>, "amount": <number>, "per_sf": <number>, "confidence": "high"|"low", "confidence_reason": "<str>", "ai_source": "<str>", "ai_benchmark": "<str>" }]
}`;

    const rawCsiSystem = [
      `You are Estimait, an advanced AI system for construction cost estimation.\nYou MUST respond with ONLY valid JSON. No markdown, no commentary, no code fences.`,
      ragContext ? `== DOCUMENT CONTEXT ==\n${ragContext}\n== END CONTEXT ==` : "",
      gcProfile ? `== GC PROFILE ==\nCompany: ${gcProfile.company_name || "N/A"}\nContingency: ${gcProfile.contingency_rate ?? 10}%\nGC Fee: ${gcProfile.gc_fee_rate ?? 5}%` : "",
      priceListContent ? `--- REFERENCE: California Real Price List 2025 ---\n${priceListContent}` : "",
      multiStateContent ? `--- MULTI-STATE COST RATES ---\n${multiStateContent}` : "",
      kbContext ? `--- KNOWLEDGE BASE: Similar Past Projects ---\n${kbContext}\nUse these historical projects for CALIBRATION only. Never copy costs directly; re-derive from GFA × unit rates × multipliers.` : "",
      `== COST JUSTIFICATION RULES ==\nFor every cost figure, derive from: GFA x unit cost rates x multipliers.\nUse California Real Price List, RSMeans, or regional benchmarks.\nFlag assumptions with confidence: "low".`,
    ].filter(Boolean).join("\n\n");

    csiSystemPrompt = rawCsiSystem.length > SYSTEM_PROMPT_CHAR_LIMIT
      ? rawCsiSystem.slice(0, SYSTEM_PROMPT_CHAR_LIMIT) + "\n[TRUNCATED]"
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
      if (parsed.updated_fields) {
        updates.confirmed_info = {
          ...project.confirmed_info,
          ...parsed.updated_fields,
        };
      }
      updates.status = "overview";
    } else if (phase === "detail") {
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
      const csiDivisions: any[] = parsed.csi_divisions || [];
      const rawCsiTotal = csiDivisions.reduce((s: number, d: any) => s + (d.amount || 0), 0);
      const normGfa = parseFloat(String(
        project.confirmed_info?.gfa_sqft?.value ||
        project.extracted_info?.gfa_sqft?.value || 0
      ));

      if (rawCsiTotal > 0 && targetHardCost > 0) {
        const normFactor = targetHardCost / rawCsiTotal;
        const normalized = csiDivisions.map((d: any) => {
          let newRate: number | null;
          let newAmount: number;

          if (d.qty != null && d.qty > 0 && d.rate != null) {
            // Normal: scale rate, derive amount
            newRate = Math.round(d.rate * normFactor * 100) / 100;
            newAmount = Math.round(d.qty * newRate);
          } else if (d.qty != null && d.qty > 0) {
            // rate null → scale amount, back-calculate rate
            newAmount = Math.round((d.amount || 0) * normFactor);
            newRate = Math.round((newAmount / d.qty) * 100) / 100;
          } else {
            // qty null/zero → scale amount directly
            newAmount = Math.round((d.amount || 0) * normFactor);
            newRate = d.rate != null ? Math.round(d.rate * normFactor * 100) / 100 : null;
          }

          return {
            ...d,
            rate: newRate,
            amount: newAmount,
            per_sf: normGfa > 0 ? Math.round((newAmount / normGfa) * 100) / 100 : 0,
          };
        });

        // Rounding correction: adjust largest row so total matches target exactly
        const normTotal = normalized.reduce((s: number, d: any) => s + d.amount, 0);
        const delta = Math.round(targetHardCost) - normTotal;
        if (delta !== 0 && normalized.length > 0) {
          const largest = normalized.reduce((max: any, d: any) => d.amount > max.amount ? d : max, normalized[0]);
          largest.amount += delta;
          if (largest.qty != null && largest.qty > 0) {
            largest.rate = Math.round((largest.amount / largest.qty) * 100) / 100;
          }
          if (normGfa > 0) {
            largest.per_sf = Math.round((largest.amount / normGfa) * 100) / 100;
          }
        }

        updates.csi_divisions = normalized;
      } else {
        updates.csi_divisions = csiDivisions;
      }

      updates.status = "detail";
    } else {
      // Ensure all cost summary rows have complete data
      const finalGfa = parseFloat(String(
        project.confirmed_info?.gfa_sqft?.value ||
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
