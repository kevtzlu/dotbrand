import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";
import { getAllChunks, truncateAtChunkBoundary } from "@/lib/rag";
import { normalizeConfirmedInfo, mergeConfirmedInfoPreservingUser } from "@/lib/confirmed-info";
import { applyProjectCreationDefaults } from "@/lib/project-creation-fields";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

export const maxDuration = 120;

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

  const conversationId = project.conversation_id || id;
  const ragContext = truncateAtChunkBoundary(
    await getAllChunks(conversationId),
    300000
  );

  if (!ragContext.trim()) {
    return NextResponse.json(
      { error: "No document context found to rescan." },
      { status: 400 }
    );
  }

  const isDesignBidBuild = project.contract_type === "design_bid_build";
  const bidFormInstruction = isDesignBidBuild
    ? `
CRITICAL — BID FORM DETECTION (Design-Bid-Build / Public Works):
Carefully scan ALL uploaded documents for any section titled "Bid Form", "Bid Schedule", "Bid Proposal", "Schedule of Bid Items", "Bid Item List", or similar required pricing format.

If a Bid Form is found:
1. Extract the COMPLETE structure across ALL pages and sections.
2. Keep repeated CSI codes as separate section entries when section titles differ.
3. Extract exact qty and unit as printed.
4. Ignore template $0.00 placeholders.
5. Return structure under "bid_form".

If NO Bid Form is found, return: "bid_form": { "found": false, "sections": [] }`
    : "";

  const prompt = `Scan all uploaded project documents and extract project information.
Return JSON only:
{
  "title": "...",
  "fields": {
    "project_name": { "value": "...", "confidence": "high|low", "source": "document|ai" }
  },
  "bid_form": { "found": false, "sections": [] }
}

Rules:
- Extract: project name, location/zip code, building type, total GFA (sf), floors, occupancy class, target date, project type, prevailing wage, construction type, delivery method.
- Use the single key "delivery_method" only.
- Keep output concise and deterministic.
${bidFormInstruction}

DOCUMENT CONTEXT:
${ragContext}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      temperature: 0.1,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse scan response" }, { status: 500 });
    }
    const parsed = JSON.parse(jsonMatch[0]);
    const normalizedFields = normalizeConfirmedInfo(parsed.fields || {});
    const baseWithDefaults = applyProjectCreationDefaults(
      normalizeConfirmedInfo(project.confirmed_info || {}),
      {
        contractType: project.contract_type,
        prevailingWage: project.prevailing_wage,
      }
    );
    const mergedConfirmed = normalizeConfirmedInfo(
      applyProjectCreationDefaults(
        mergeConfirmedInfoPreservingUser(baseWithDefaults, normalizedFields),
        {
          contractType: project.contract_type,
          prevailingWage: project.prevailing_wage,
        }
      )
    );

    const updates: Record<string, any> = {
      extracted_info: normalizedFields,
      confirmed_info: mergedConfirmed,
      updated_at: new Date().toISOString(),
    };
    if (parsed?.title) updates.title = parsed.title;
    if (isDesignBidBuild && parsed?.bid_form?.found && parsed?.bid_form?.sections?.length > 0) {
      updates.bid_form_items = parsed.bid_form.sections;
    }

    const { error: updateError } = await supabaseAdmin
      .from("projects")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, fields: normalizedFields });
  } catch (err: any) {
    console.error("Rescan overview failed:", err);
    return NextResponse.json(
      { error: err?.message || "Rescan failed" },
      { status: 500 }
    );
  }
}
