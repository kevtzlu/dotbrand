import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 300;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

function buildProjectContext(project: any): string {
  const sections: string[] = [];

  // Confirmed info
  const info = project.confirmed_info || {};
  const infoLines = Object.entries(info)
    .map(([k, v]: [string, any]) => `  ${k}: ${v.value} (confidence: ${v.confidence}, source: ${v.source})`)
    .join("\n");
  if (infoLines) {
    sections.push(`CONFIRMED PROJECT INFO:\n${infoLines}`);
  }

  // Rough estimate
  const rough = project.rough_estimate;
  if (rough) {
    sections.push(`ROUGH ESTIMATE (from overview Q&A):\n  Range: $${rough.min?.toLocaleString()} – $${rough.max?.toLocaleString()}\n  Per SF: $${rough.per_sf_min?.toLocaleString()} – $${rough.per_sf_max?.toLocaleString()}`);
  }

  // Overview Q&A
  const qa: any[] = project.overview_qa || [];
  const answeredQA = qa.filter((q: any) => q.answered && q.answer);
  if (answeredQA.length > 0) {
    sections.push(`OVERVIEW DECISIONS:\n${answeredQA.map((q: any) => `  Q: ${q.question}\n  A: ${q.answer}\n  AI Insight: ${q.ai_insight}`).join("\n\n")}`);
  }

  // Monte Carlo
  const mc = project.monte_carlo;
  if (mc) {
    sections.push(`MONTE CARLO ESTIMATES:\n  Conservative (P80): $${mc.conservative?.toLocaleString()}\n  Mid (P50): $${mc.mid?.toLocaleString()}\n  Optimistic (P10): $${mc.optimistic?.toLocaleString()}`);
  }

  // Hard/Soft ratio
  const ratio = project.hard_soft_ratio;
  if (ratio) {
    sections.push(`HARD/SOFT COST RATIO: Hard ${ratio.hard_pct}% / Soft ${ratio.soft_pct}%`);
  }

  // CSI Divisions
  const csi: any[] = project.csi_divisions || [];
  if (csi.length > 0) {
    const csiLines = csi.map((d: any) =>
      `  ${d.csi_code} ${d.csi_description}: $${d.amount?.toLocaleString()} ($${d.per_sf}/SF) [${d.confidence}] — ${d.confidence_reason || ""}`
    ).join("\n");
    sections.push(`CSI DIVISIONS (Hard Cost Breakdown):\n${csiLines}`);
  }

  // Risks
  const risks: any[] = project.risks || [];
  if (risks.length > 0) {
    sections.push(`RISK FACTORS:\n${risks.map((r: any) => `  ${r.rank}. ${r.title} (${r.probability}) — Impact: ${r.cost_impact}`).join("\n")}`);
  }

  // AI Guesses
  const guesses: any[] = project.ai_guesses || [];
  if (guesses.length > 0) {
    sections.push(`AI GUESSES (no document evidence):\n${guesses.map((g: any) => `  ${g.item}: ${g.value} — ${g.reasoning} [${g.confidence}]`).join("\n")}`);
  }

  // AI Evidence
  const evidence: any[] = project.ai_evidence || [];
  if (evidence.length > 0) {
    sections.push(`AI EVIDENCE (from documents):\n${evidence.map((e: any) => `  ${e.item}: ${e.value} — Source: ${e.source_doc} p.${e.page_ref}`).join("\n")}`);
  }

  return sections.join("\n\n");
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { messages } = await req.json();

  // Fetch project
  const { data: project, error: projErr } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (projErr || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const projectContext = buildProjectContext(project);

  const systemPrompt = `You are an estimation review assistant helping the team understand and improve AI cost estimation decisions.

YOUR ROLE:
- Explain WHY specific cost values, assumptions, or decisions were made
- Point out which data came from uploaded documents vs AI assumptions
- Accept feedback on how to improve estimation logic
- Be specific — reference CSI division codes, dollar amounts, and confidence levels
- When the user suggests a better approach, acknowledge it and explain how it would change the estimate
- Respond in the same language the user uses (Chinese or English)

PROJECT DATA:
${projectContext}

RULES:
- Always cite specific data points when explaining decisions
- Distinguish between "AI guess" (no document evidence) and "AI evidence" (document-backed)
- If asked about a specific CSI division, reference its amount, confidence level, and reasoning
- Be concise but thorough — use bullet points and tables when helpful
- If you don't have enough info to answer, say so clearly`;

  // Convert to Anthropic message format with file attachments
  const anthropicMessages = (messages || []).map((m: any) => {
    // Simple text-only message
    if (!m.attachments || m.attachments.length === 0) {
      return {
        role: m.role as "user" | "assistant",
        content: m.content,
      };
    }

    // Message with attachments → use content blocks
    const contentBlocks: any[] = [];

    for (const att of m.attachments) {
      const ext = att.name.toLowerCase().split(".").pop() || "";

      if (att.type === "application/pdf" || ext === "pdf") {
        // PDF → Anthropic document type
        contentBlocks.push({
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: att.data,
          },
        });
      } else if (
        att.type.startsWith("image/") ||
        ["png", "jpg", "jpeg", "gif", "webp"].includes(ext)
      ) {
        // Images → Anthropic image type
        const mediaType =
          ext === "png"
            ? "image/png"
            : ext === "gif"
            ? "image/gif"
            : ext === "webp"
            ? "image/webp"
            : "image/jpeg";
        contentBlocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: mediaType,
            data: att.data,
          },
        });
      } else {
        // Text-based files (xlsx, csv, docx, txt) → decode and inject as text
        try {
          const decoded = Buffer.from(att.data, "base64").toString("utf-8");
          contentBlocks.push({
            type: "text",
            text: `[File: ${att.name}]\n${decoded}`,
          });
        } catch {
          contentBlocks.push({
            type: "text",
            text: `[File: ${att.name} — unable to decode content]`,
          });
        }
      }
    }

    // Add user text after attachments
    if (m.content) {
      contentBlocks.push({ type: "text", text: m.content });
    }

    return {
      role: m.role as "user" | "assistant",
      content: contentBlocks,
    };
  });

  try {
    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: systemPrompt,
      messages: anthropicMessages,
      temperature: 0.3,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const data = JSON.stringify({
                type: "delta",
                text: event.delta.text,
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
          );
        } catch (err: any) {
          const errData = JSON.stringify({
            type: "error",
            message: err.message || "Stream error",
          });
          controller.enqueue(encoder.encode(`data: ${errData}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: any) {
    console.error("Debug chat error:", err);
    return NextResponse.json(
      { error: err.message || "Chat failed" },
      { status: 500 }
    );
  }
}
