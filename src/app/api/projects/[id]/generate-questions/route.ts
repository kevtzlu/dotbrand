import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";
import {
  detectBuildingType,
  getKnowledgeRegistry,
  readKnowledgeFile,
  shouldLoadRenovationMatrix,
} from "@/lib/knowledge";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

export const maxDuration = 120;

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

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const confirmedInfo = project.confirmed_info || {};
  const conversationId = project.conversation_id || id;

  let docContext = "";
  try {
    docContext = await getAllChunks(conversationId);
    if (docContext.length > 200_000) {
      docContext = docContext.substring(0, 200_000);
    }
  } catch {
    // non-fatal
  }

  // Detect building type from confirmed info, extracted info, or document context
  const buildingTypeValue = String(
    confirmedInfo?.building_type?.value ||
      project.extracted_info?.building_type?.value ||
      ""
  );
  const detectedType =
    detectBuildingType(buildingTypeValue) ||
    detectBuildingType(docContext.substring(0, 5000));

  const isRenovation =
    shouldLoadRenovationMatrix(buildingTypeValue) ||
    shouldLoadRenovationMatrix(docContext.substring(0, 5000));

  // Load building-type-specific decision matrix for context
  let decisionMatrixContext = "";
  try {
    const registry = getKnowledgeRegistry();
    if (detectedType && registry.LAYER2?.[detectedType]) {
      const layer2 = registry.LAYER2[detectedType];
      const matrixEntry = layer2.DECISION_MATRIX?.[0];
      if (matrixEntry?.local_path) {
        decisionMatrixContext = readKnowledgeFile(matrixEntry.local_path) || "";
        if (decisionMatrixContext.length > 3000) {
          decisionMatrixContext = decisionMatrixContext.substring(0, 3000);
        }
      }
    }
  } catch (e) {
    console.warn("[Questions] Failed to load decision matrix:", e);
  }

  const gfaSqft = confirmedInfo?.gfa_sqft?.value
    ? Number(confirmedInfo.gfa_sqft.value)
    : null;

  const prompt = `You are an expert construction cost estimator AI. Your job is to:
1. Provide a BASE ROUGH ESTIMATE for this project (assuming recommended/default options).
2. Identify the TOP 5 critical decisions that a General Contractor (GC) must confirm before the cost estimate can be accurate.

These questions should target the HIGHEST-IMPACT forks — decisions where the wrong assumption could cause 10-50%+ cost variance. Every project type has specific decision points that cause the largest price swings.

PROJECT TYPE: ${detectedType || "UNKNOWN"}${isRenovation ? " (RENOVATION)" : ""}
${decisionMatrixContext ? `\nDECISION MATRIX FOR THIS PROJECT TYPE:\n${decisionMatrixContext}\n` : ""}
PROJECT INFO (extracted so far):
${JSON.stringify(confirmedInfo, null, 2)}
${gfaSqft ? `\nGFA (for per-SF calculation): ${gfaSqft} SF` : ""}

${docContext ? `DOCUMENT CONTEXT:\n${docContext}\n` : ""}

EXAMPLES OF HIGH-IMPACT DECISIONS BY PROJECT TYPE (use as inspiration, not as a template):
- Warehouse: general warehouse vs cold storage vs tech/data center ($75/SF vs $300+/SF); clear height & floor loading; dock configuration
- Renovation: scope of work — foundation rework? structural modification? exterior envelope only? interior gut vs cosmetic? phased vs full shutdown? ($150/SF vs $600+/SF)
- Geotechnical: if site documents mention swamp, wetland, fill soil, or seismic zone → foundation reinforcement can add 15-30% to structural costs
- Healthcare: OSHPD jurisdiction? behavioral health anti-ligature requirements? cleanroom class? infection control during construction?
- Commercial: high-rise vs mid-rise MEP complexity? curtain wall vs precast? raised floor vs slab-on-grade? generator/UPS requirements?
- ⛔ Public Works / Bridge / Waterway: if documents mention Creek, Canal, River, Bypass, Waterway, Culvert, Bridge over water, Channel, Levee, Floodplain → standard excavation ($28-$45/CY) DOES NOT APPLY. Waterway excavation is $350-$500/CY due to cofferdam, dewatering, environmental protection. Ask about: cofferdam type, dewatering needs, fish/wildlife restrictions, environmental permits. Also: concrete must be priced by structure type (general $2,400/CY vs culvert $2,900/CY vs bridge deck $3,200-$3,500/CY). Check for special compliance items: Concrete Barrier Type 836, Bird Exclusion, Lead Compliance, Environmental Monitoring.
- ⛔ High-Tech Manufacturing TI: if documents mention photonics, optics, laser assembly, ESD flooring, N₂/CDA piping, T-GRID ceiling, 100+ workstations → this is NOT standard industrial TI ($60-120/SF). Use $200-250/SF base. Key cost forks: T-GRID ceiling type (C1=$27/SF vs C2=$18/SF, ceiling area can be 2x GFA), process gas piping scope (N₂ SS pipe $130-454/LF), electrical density ($45/SF vs $15-20/SF standard). "No structural work" means no shell mods — interior ceiling joists/framing still applies ($8-12/SF).

RULES:
- Provide a base_estimate object with min/max total cost and per-SF cost, assuming the recommended option for each question.
- Generate exactly 5 questions, ordered by cost impact (most impactful first).
- Each question must target a SPECIFIC decision that creates a COST FORK — not generic info gathering.
- For each question, provide 2-3 concrete options. Each option description should include an estimated cost implication (e.g., "adds ~$15/SF" or "saves 10-15%").
- Each option MUST include a "cost_adjustment" multiplier. The base_estimate ALREADY accounts for all information visible in the uploaded documents. Adjustments are ADDITIVE (each applied independently to the base, not compounded). So:
  * The recommended option (matching document evidence) MUST have cost_adjustment = 1.0 (no change from base).
  * Non-recommended options represent DEVIATIONS from the document-based baseline.
  * Each option's delta (cost_adjustment - 1.0) is added together: e.g. three answers at 1.15, 1.10, 0.90 → total = 1.0 + 0.15 + 0.10 - 0.10 = 1.15x.
  * Multipliers must be between 0.7 and 1.5.
- Mark one option as "recommended" if you have evidence from the documents. If no evidence, do NOT mark any option as recommended and set all options to non-1.0 adjustments relative to your base assumption.
- Each question must list which confirmed_info fields it affects.
- Do NOT ask about information that is already confirmed in PROJECT INFO above.
- IMPORTANT: Keep responses concise. ai_insight should be 2-3 sentences max. strategic_context should be 1-2 sentences max. Option descriptions should be 1-2 sentences max. Do NOT write paragraphs.

RESPOND IN VALID JSON with this exact structure (no markdown, no code fences):
{
  "base_estimate": { "min": <total_min_cost>, "max": <total_max_cost>, "per_sf_min": <cost_per_sf_min>, "per_sf_max": <cost_per_sf_max> },
  "questions": [
    {
      "id": "q1",
      "item_title": "ITEM 01: [short topic]",
      "question": "[the full question text]",
      "ai_insight": "[2-3 sentence AI analysis based on the documents — cite specific findings]",
      "strategic_context": "[why this decision matters for cost — mention the cost delta]",
      "options": [
        { "id": "a", "label": "[option label]", "description": "[brief explanation with cost implication]", "recommended": true, "cost_adjustment": 1.0 },
        { "id": "b", "label": "[option label]", "description": "[brief explanation with cost implication]", "cost_adjustment": 1.15 }
      ],
      "affected_fields": ["field_key_1", "field_key_2"]
    }
  ]
}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 16384,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    if (response.stop_reason === "max_tokens") {
      console.error("AI response truncated due to max_tokens limit");
      return NextResponse.json(
        { error: "AI response was truncated. Please try again." },
        { status: 500 }
      );
    }

    let questions;
    let baseEstimate = null;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      const parsed = JSON.parse(jsonMatch[0]);
      questions = parsed.questions;

      // Extract and validate base_estimate
      if (parsed.base_estimate) {
        const be = parsed.base_estimate;
        baseEstimate = {
          min: Number(be.min) || 0,
          max: Number(be.max) || 0,
          per_sf_min: Number(be.per_sf_min) || 0,
          per_sf_max: Number(be.per_sf_max) || 0,
        };
      }
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI response", raw: text },
        { status: 500 }
      );
    }

    const overviewQA = questions.map((q: any) => ({
      id: q.id,
      item_title: q.item_title,
      question: q.question,
      ai_insight: q.ai_insight,
      strategic_context: q.strategic_context || "",
      options: (q.options || []).map((o: any) => ({
        id: o.id,
        label: o.label,
        description: o.description || "",
        recommended: o.recommended || false,
        cost_adjustment: Math.min(3.0, Math.max(0.5, Number(o.cost_adjustment) || 1.0)),
      })),
      affected_fields: q.affected_fields || [],
      answered: false,
      answer: "",
      timestamp: Date.now(),
    }));

    // Try update with base_estimate; if column doesn't exist, fall back without it
    let updatePayload: Record<string, any> = {
      overview_qa: overviewQA,
      base_estimate: baseEstimate,
      rough_estimate: baseEstimate,
      updated_at: new Date().toISOString(),
    };

    let { error: updateError } = await supabaseAdmin
      .from("projects")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", userId);

    // Fallback: if base_estimate column doesn't exist yet, save without it
    if (updateError) {
      console.warn("[Questions] Update with base_estimate failed, retrying without:", updateError.message);
      ({ error: updateError } = await supabaseAdmin
        .from("projects")
        .update({
          overview_qa: overviewQA,
          rough_estimate: baseEstimate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", userId));

      if (updateError) {
        console.error("[Questions] DB update failed:", updateError.message);
        return NextResponse.json(
          { error: "Failed to save questions", detail: updateError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ questions: overviewQA, base_estimate: baseEstimate });
  } catch (err: any) {
    console.error("Generate questions error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
