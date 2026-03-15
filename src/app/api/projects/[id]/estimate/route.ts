import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
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

  const layer1Content = await readKnowledgeFileAsync(HARDCODED_LAYER1_PATH);
  if (layer1Content) {
    systemFragments.push(`--- LAYER 1: Core Methodology ---\n${layer1Content}`);
  }

  const confirmedStr = JSON.stringify(project.confirmed_info || {});
  const combinedText = confirmedStr.toLowerCase();

  if (shouldLoadRenovationMatrix(combinedText)) {
    const rp = path.join(
      process.cwd(),
      "Data",
      "RENOVATION_COST_FACTOR_MATRIX_v1.1.yaml"
    );
    const rc = await readKnowledgeFileAsync(rp);
    if (rc)
      systemFragments.push(
        `--- DATA: Renovation Cost Factor Matrix ---\n${rc}`
      );
  }

  if (shouldLoadPriceList(combinedText)) {
    const pp = path.join(
      process.cwd(),
      "References",
      "ESTIMAIT_California_Real_Price_List_v1.0.md.docx"
    );
    const pc = await readKnowledgeFileAsync(pp);
    if (pc)
      systemFragments.push(
        `--- REFERENCE: California Real Price List 2025 ---\n${pc}`
      );
  }

  const formulaPath = path.join(
    process.cwd(),
    "References",
    "CA_Estimation_Formula_Updates_v1.0.md"
  );
  const formulaContent = await readKnowledgeFileAsync(formulaPath);
  if (formulaContent)
    systemFragments.push(
      `--- CA ESTIMATION FORMULA UPDATES ---\n${formulaContent}`
    );

  const multiStatePath = path.join(
    process.cwd(),
    "References",
    "MULTI_STATE_COST_RATES_v1.0.md"
  );
  const multiStateContent = await readKnowledgeFileAsync(multiStatePath);
  if (multiStateContent)
    systemFragments.push(
      `--- MULTI-STATE COST RATES ---\n${multiStateContent}`
    );

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
    userPrompt = `Based on the uploaded project documents and extracted information below, provide a rough cost estimate range.

PROJECT INFO:
${confirmedSummary || JSON.stringify(project.extracted_info, null, 2)}

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

You must provide ALL of the following in a single JSON response:

1. Monte Carlo simulation with triangular distribution (±15% variance):
   - conservative (P80), mid (P50), optimistic (P10) total project costs

2. Top 5 risk factors ranked by impact

3. CSI Division breakdown with these exact columns for each division:
   csi_code, csi_description, description, qty, unit, rate, amount, per_sf, confidence ("high"|"low"), confidence_reason, ai_source, ai_benchmark

4. AI guesses (items estimated without document evidence) and AI evidence (items backed by uploaded documents)

Return as JSON:
{
  "monte_carlo": { "conservative": <number>, "mid": <number>, "optimistic": <number> },
  "risks": [{ "title": "<str>", "probability": "HIGH"|"MEDIUM"|"LOW", "cost_impact": "<str>", "mitigation": "<str>", "rank": <int> }],
  "csi_divisions": [{ "id": "<uuid>", "csi_code": "<str>", "csi_description": "<str>", "description": "<str>", "qty": <number|null>, "unit": "<str>", "rate": <number|null>, "amount": <number>, "per_sf": <number>, "confidence": "high"|"low", "confidence_reason": "<str>", "ai_source": "<str>", "ai_benchmark": "<str>" }],
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
      ? systemPrompt.slice(0, SYSTEM_PROMPT_CHAR_LIMIT) +
        "\n[TRUNCATED]"
      : systemPrompt;

  try {
    const maxTokens = phase === "overview" ? 8192 : 16384;
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system: cappedSystem,
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.1,
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    if (response.stop_reason === "max_tokens") {
      console.error(`[Estimate API] Response truncated at ${maxTokens} tokens for phase: ${phase}`);
      return NextResponse.json(
        { error: "AI response was truncated. Please try again." },
        { status: 500 }
      );
    }

    // Parse the JSON response (strip potential markdown fences)
    const cleaned = text
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI response", raw: text },
        { status: 500 }
      );
    }

    // Save results to the project based on phase
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
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
      updates.csi_divisions = parsed.csi_divisions;
      updates.ai_guesses = parsed.ai_guesses;
      updates.ai_evidence = parsed.ai_evidence;
      if (parsed.hard_soft_ratio) {
        updates.hard_soft_ratio = parsed.hard_soft_ratio;
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

    return NextResponse.json({ success: true, data: parsed });
  } catch (err: any) {
    console.error("[Estimate API] Error:", err);
    return NextResponse.json(
      { error: err.message || "Estimation failed" },
      { status: 500 }
    );
  }
}
