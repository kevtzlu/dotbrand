import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  KNOWLEDGE_DOC_SLOTS,
  computeKnowledgeIsComplete,
  type KnowledgeDocSlot,
} from "@/lib/types";

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

const DOC_FIELD_KEYS = KNOWLEDGE_DOC_SLOTS.map((s) => s.key) as KnowledgeDocSlot[];

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const conversationId = `kb-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const docFields = Object.fromEntries(
    DOC_FIELD_KEYS.map((key) => [key, body[key] ?? null])
  ) as Partial<Record<KnowledgeDocSlot, unknown>>;

  const is_complete = computeKnowledgeIsComplete(docFields);

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
