import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";

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

  const prompt = `You are an expert construction cost estimator AI. Based on the following project information and uploaded documents, generate a list of strategic clarification questions that a General Contractor (GC) needs to answer to refine the cost estimate.

PROJECT INFO (extracted so far):
${JSON.stringify(confirmedInfo, null, 2)}

${docContext ? `DOCUMENT CONTEXT:\n${docContext}\n` : ""}

RULES:
- Generate 3-7 strategic questions depending on the complexity and missing info.
- Each question should focus on a decision that significantly affects the cost estimate.
- For each question, provide 2-3 concrete options for the GC to choose from, plus reasoning.
- Mark one option as "recommended" if the AI has a strong opinion based on available data.
- Each question must list which confirmed_info fields it affects.
- Questions should be ordered by impact (most impactful first).
- IMPORTANT: Keep responses concise. ai_insight should be 2-3 sentences max. strategic_context should be 1-2 sentences max. Option descriptions should be 1-2 sentences max. Do NOT write paragraphs.

RESPOND IN VALID JSON with this exact structure (no markdown, no code fences):
{
  "questions": [
    {
      "id": "q1",
      "item_title": "ITEM 01: [short topic]",
      "question": "[the full question text]",
      "ai_insight": "[2-3 sentence AI analysis/reasoning about this topic based on the documents]",
      "strategic_context": "[why this decision matters for cost estimation]",
      "options": [
        { "id": "a", "label": "[option label]", "description": "[brief explanation]", "recommended": true },
        { "id": "b", "label": "[option label]", "description": "[brief explanation]" }
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
