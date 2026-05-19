import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  KNOWLEDGE_DOC_SLOTS,
  KNOWLEDGE_REQUIRED_DOC_SLOTS,
  computeKnowledgeIsComplete,
  type KnowledgeDocSlot,
} from "@/lib/types";

const DOC_FIELD_KEYS = KNOWLEDGE_DOC_SLOTS.map((s) => s.key) as KnowledgeDocSlot[];

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

  const { id: _id, user_id: _uid, created_at: _ca, ...updates } = body;

  const hasDocUpdate = DOC_FIELD_KEYS.some((slot) => slot in updates);
  if (hasDocUpdate) {
    const selectFields = [...KNOWLEDGE_REQUIRED_DOC_SLOTS].join(", ");
    const { data: current } = await supabaseAdmin
      .from("knowledge_projects")
      .select(selectFields)
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (current) {
      const merged = {
        ...(current as unknown as Record<string, unknown>),
        ...updates,
      };
      updates.is_complete = computeKnowledgeIsComplete(merged);
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
