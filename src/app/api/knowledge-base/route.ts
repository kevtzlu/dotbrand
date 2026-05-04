import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("knowledge_projects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ projects: data ?? [] });
}

const DOC_SLOTS = ["doc_bod", "doc_google_maps", "doc_drawings", "doc_initial_est", "doc_final_est"] as const;

function slotHasFiles(val: unknown): boolean {
  if (!val) return false;
  if (Array.isArray(val)) return (val as unknown[]).length > 0;
  return true;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const conversationId = `kb-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const docFields = {
    doc_bod: body.doc_bod ?? null,
    doc_google_maps: body.doc_google_maps ?? null,
    doc_drawings: body.doc_drawings ?? null,
    doc_initial_est: body.doc_initial_est ?? null,
    doc_final_est: body.doc_final_est ?? null,
    doc_other_files: body.doc_other_files ?? null,
  };

  const is_complete = DOC_SLOTS.every((slot) => slotHasFiles(docFields[slot]));

  const record = {
    user_id: userId,
    name: body.name,
    project_type: body.project_type,
    contract_type: body.contract_type ?? null,
    start_date: body.start_date || null,
    end_date: body.end_date || null,
    prevailing_wage: body.prevailing_wage ?? false,
    conversation_id: conversationId,
    ...docFields,
    is_complete,
  };

  const { data, error } = await supabaseAdmin
    .from("knowledge_projects")
    .insert(record)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ project: data });
}
