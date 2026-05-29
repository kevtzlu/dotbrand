import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ projects: data ?? [] });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const record = {
    user_id: userId,
    title: body.title ?? null,
    status: body.status ?? "uploading",
    extracted_info: body.extracted_info ?? {},
    confirmed_info: body.confirmed_info ?? {},
    uploaded_files: body.uploaded_files ?? [],
    conversation_id: body.conversation_id ?? null,
    chat_messages: body.chat_messages ?? [],
    contract_type: body.contract_type ?? null,
    prevailing_wage: body.prevailing_wage ?? false,
  };

  const { data, error } = await supabaseAdmin
    .from("projects")
    .insert(record)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ project: data });
}
