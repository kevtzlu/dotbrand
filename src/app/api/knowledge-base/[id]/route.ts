import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const DOC_SLOTS = ["doc_bod", "doc_google_maps", "doc_drawings", "doc_initial_est", "doc_final_est"] as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("knowledge_projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json({ project: data });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  // Remove fields that should not be overwritten directly
  const { id: _id, user_id: _uid, created_at: _ca, ...updates } = body;

  // Recompute is_complete if any doc slot is being updated
  const hasDocUpdate = DOC_SLOTS.some((slot) => slot in updates);
  if (hasDocUpdate) {
    // Fetch current state to merge with updates
    const { data: current } = await supabaseAdmin
      .from("knowledge_projects")
      .select("doc_bod, doc_google_maps, doc_drawings, doc_initial_est, doc_final_est")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (current) {
      const merged = { ...current, ...updates };
      updates.is_complete = DOC_SLOTS.every((slot) => merged[slot] != null);
    }
  }

  const { data, error } = await supabaseAdmin
    .from("knowledge_projects")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ project: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Get conversation_id to clean up document chunks
  const { data: project } = await supabaseAdmin
    .from("knowledge_projects")
    .select("conversation_id")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (project?.conversation_id) {
    await supabaseAdmin
      .from("document_chunks")
      .delete()
      .eq("conversation_id", project.conversation_id);
  }

  const { error } = await supabaseAdmin
    .from("knowledge_projects")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
