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

  const prompt = `You are an expert construction cost estimator AI. Your job is to identify the TOP 5 critical decisions that a General Contractor (GC) must confirm before the cost estimate can be accurate.

These questions should target the HIGHEST-IMPACT forks — decisions where the wrong assumption could cause 10-50%+ cost variance. Every project type has specific decision points that cause the largest price swings.

PROJECT TYPE: ${detectedType || "UNKNOWN"}${isRenovation ? " (RENOVATION)" : ""}
${decisionMatrixContext ? `\nDECISION MATRIX FOR THIS PROJECT TYPE:\n${decisionMatrixContext}\n` : ""}
PROJECT INFO (extracted so far):
${JSON.stringify(confirmedInfo, null, 2)}

${docContext ? `DOCUMENT CONTEXT:\n${docContext}\n` : ""}

EXAMPLES OF HIGH-IMPACT DECISIONS BY PROJECT TYPE (use as inspiration, not as a template):
- Warehouse: general warehouse vs cold storage vs tech/data center ($75/SF vs $300+/SF); clear height & floor loading; dock configuration
- Renovation: scope of work — foundation rework? structural modification? exterior envelope only? interior gut vs cosmetic? phased vs full shutdown? ($150/SF vs $600+/SF)
- Geotechnical: if site documents mention swamp, wetland, fill soil, or seismic zone → foundation reinforcement can add 15-30% to structural costs
- Healthcare: OSHPD jurisdiction? behavioral health anti-ligature requirements? cleanroom class? infection control during construction?
- Commercial: high-rise vs mid-rise MEP complexity? curtain wall vs precast? raised floor vs slab-on-grade? generator/UPS requirements?

RULES:
- Generate exactly 5 questions, ordered by cost impact (most impactful first).
- Each question must target a SPECIFIC decision that creates a COST FORK — not generic info gathering.
- For each question, provide 2-3 concrete options. Each option description should include an estimated cost implication (e.g., "adds ~$15/SF" or "saves 10-15%").
- Mark one option as "recommended" if you have evidence from the documents.
- Each question must list which confirmed_info fields it affects.
- Do NOT ask about information that is already confirmed in PROJECT INFO above.
- IMPORTANT: Keep responses concise. ai_insight should be 2-3 sentences max. strategic_context should be 1-2 sentences max. Option descriptions should be 1-2 sentences max. Do NOT write paragraphs.

RESPOND IN VALID JSON with this exact structure (no markdown, no code fences):
{
  "questions": [
    {
      "id": "q1",
      "item_title": "ITEM 01: [short topic]",
      "question": "[the full question text]",
      "ai_insight": "[2-3 sentence AI analysis based on the documents — cite specific findings]",
      "strategic_context": "[why this decision matters for cost — mention the cost delta]",
      "options": [
        { "id": "a", "label": "[option label]", "description": "[brief explanation with cost implication]", "recommended": true },
        { "id": "b", "label": "[option label]", "description": "[brief explanation with cost implication]" }
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
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      const parsed = JSON.parse(jsonMatch[0]);
      questions = parsed.questions;
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
      })),
      affected_fields: q.affected_fields || [],
      answered: false,
      answer: "",
      timestamp: Date.now(),
    }));

    await supabaseAdmin
      .from("projects")
      .update({
        overview_qa: overviewQA,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId);

    return NextResponse.json({ questions: overviewQA });
  } catch (err: any) {
    console.error("Generate questions error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
