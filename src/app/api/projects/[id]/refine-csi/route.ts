import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";
import { getAllChunks, truncateAtChunkBoundary } from "@/lib/rag";
import { sanitizeCsiDivision, sanitizeCsiDivisions } from "@/lib/csi";
import {
  applyProjectCreationDefaults,
  buildPrevailingWageEstimateBlock,
  isPrevailingWageEnabled,
} from "@/lib/project-creation-fields";
import { normalizeConfirmedInfo } from "@/lib/confirmed-info";
import type { CSIDivision } from "@/lib/types";
import { divisionIdsForDocRefine } from "@/lib/csi-doc-match";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

export const maxDuration = 120;

function parseJson(raw: string) {
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  return JSON.parse(cleaned);
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
  const body = await req.json().catch(() => ({}));
  const uploadedFilenames: string[] = Array.isArray(body.uploaded_filenames)
    ? body.uploaded_filenames.filter((n: unknown) => typeof n === "string")
    : [];
  const primaryDivisionId =
    typeof body.primary_division_id === "string" ? body.primary_division_id : null;
  const extraDivisionIds: string[] = Array.isArray(body.division_ids)
    ? body.division_ids.filter((x: unknown) => typeof x === "string")
    : [];

  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const divisions: CSIDivision[] = project.csi_divisions || [];
  if (divisions.length === 0) {
    return NextResponse.json(
      { error: "No CSI divisions to refine. Run detail estimation first." },
      { status: 400 }
    );
  }

  const targetIds = divisionIdsForDocRefine(divisions, {
    primaryDivisionId,
    uploadedFilenames,
    extraDivisionIds,
  });

  if (targetIds.length === 0) {
    return NextResponse.json(
      { error: "No divisions selected for refinement." },
      { status: 400 }
    );
  }

  const conversationId = project.conversation_id || `conv-${id}`;
  const ragContext = truncateAtChunkBoundary(
    await getAllChunks(conversationId),
    200000
  );

  if (!ragContext.trim()) {
    return NextResponse.json(
      {
        error:
          "Document text is not indexed yet. Wait a few seconds and try again, or re-upload the file.",
      },
      { status: 400 }
    );
  }

  const rowsToRefine = divisions.filter((d) => targetIds.includes(d.id));
  if (rowsToRefine.length === 0) {
    return NextResponse.json(
      { error: "Selected division IDs were not found on this project." },
      { status: 400 }
    );
  }

  const effectiveConfirmedInfo = applyProjectCreationDefaults(
    normalizeConfirmedInfo(project.confirmed_info || {}),
    {
      contractType: project.contract_type,
      prevailingWage: project.prevailing_wage,
    }
  );
  const confirmedSummary = Object.entries(effectiveConfirmedInfo)
    .map(([k, v]: [string, any]) => `- ${k}: ${v.value}`)
    .join("\n");
  const prevailingWageBlock = buildPrevailingWageEstimateBlock(
    isPrevailingWageEnabled(effectiveConfirmedInfo)
  );

  const gfa = parseFloat(
    String(
      effectiveConfirmedInfo.gfa_sqft?.value ||
        project.extracted_info?.gfa_sqft?.value ||
        0
    )
  );

  const filesLine =
    uploadedFilenames.length > 0
      ? `Newly uploaded file(s): ${uploadedFilenames.join(", ")}`
      : "Use the most recently added content in DOCUMENT CONTEXT.";

  const userPrompt = `The GC uploaded supporting documents. Refine ONLY the CSI line items listed below using evidence from those documents.

${filesLine}

CONFIRMED PROJECT INFO:
${confirmedSummary}
${prevailingWageBlock ? `\n${prevailingWageBlock}\n` : ""}
${gfa > 0 ? `GFA: ${gfa.toLocaleString()} SF\n` : ""}

ROWS TO REFINE (return one object per row, same "id" for each):
${JSON.stringify(rowsToRefine, null, 2)}

RULES:
- Update qty, rate, amount, per_sf, confidence, confidence_reason, ai_source, ai_benchmark, ai_gc_actions based on the uploaded documents.
- Set confidence to "high" when the new document adequately supports this line item.
- Remove fulfilled items from ai_gc_actions (pipe-separated "Title — description" pairs); use null when nothing else is needed.
- ai_source: cite user documents only (e.g. geotechnical report section), or null if not document-based.
- amount = qty × rate when both are set; never negative.
- Do NOT change rows that are not listed above.
- Do NOT change project totals or other divisions.

Return JSON only:
{
  "csi_divisions": [{ "id": "<same uuid>", "csi_code": "...", "csi_description": "...", "description": "...", "qty": <number|null>, "unit": "...", "rate": <number|null>, "amount": <number>, "per_sf": <number>, "confidence": "high"|"low", "confidence_reason": "<str>", "ai_source": "<str|null>", "ai_benchmark": "<str>", "ai_gc_actions": "<str|null>" }]
}`;

  const systemPrompt = `You are Estimait, a construction cost estimator.
Respond with ONLY valid JSON. No markdown.
${ragContext ? `\n== DOCUMENT CONTEXT ==\n${ragContext}\n== END CONTEXT ==` : ""}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.1,
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    if (response.stop_reason === "max_tokens") {
      return NextResponse.json(
        { error: "AI response was truncated. Try fewer divisions at once." },
        { status: 502 }
      );
    }

    const parsed = parseJson(text);
    const refined: CSIDivision[] = sanitizeCsiDivisions(
      (parsed.csi_divisions || []).filter((d: CSIDivision) =>
        targetIds.includes(d.id)
      )
    );

    if (refined.length === 0) {
      return NextResponse.json(
        { error: "AI did not return any matching division updates." },
        { status: 502 }
      );
    }

    const refinedById = new Map(refined.map((d) => [d.id, d]));
    const merged = divisions.map((d) => {
      const updated = refinedById.get(d.id);
      if (!updated) return d;
      return sanitizeCsiDivision({
        ...d,
        ...updated,
        id: d.id,
      });
    });

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("projects")
      .update({
        csi_divisions: merged,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (updateErr || !updated) {
      console.error("[refine-csi] DB update failed:", updateErr);
      return NextResponse.json(
        { error: "Failed to save refined divisions." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      project: updated,
      refined_ids: refined.map((d) => d.id),
    });
  } catch (err) {
    console.error("[refine-csi] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Refinement failed" },
      { status: 500 }
    );
  }
}
