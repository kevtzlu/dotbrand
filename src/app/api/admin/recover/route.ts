import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAdminUserId } from "@/lib/admin";

// GET /api/admin/recover?conversation_id=xxx
// 以 conversation_id 查詢對話（不限 ownership），回傳預覽資料
export async function GET(req: Request) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminUserId(userId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversation_id");

    if (!conversationId) {
        return NextResponse.json({ error: "Missing conversation_id" }, { status: 400 });
    }

    const { data, error } = await supabase
        .from("conversations")
        .select("id, title, timestamp, messages, clerk_user_id, stage_snapshots")
        .eq("id", conversationId)
        .single();

    if (error || !data) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    return NextResponse.json({
        conversation: {
            id: data.id,
            title: data.title,
            timestamp: data.timestamp,
            messageCount: Array.isArray(data.messages) ? data.messages.length : 0,
            currentUserId: data.clerk_user_id ?? null,
            stageSnapshotCount: Array.isArray(data.stage_snapshots) ? data.stage_snapshots.length : 0,
        },
    });
}

// PATCH /api/admin/recover
// { conversation_id, user_id } — 將對話的 clerk_user_id 更新為指定的 user_id
export async function PATCH(req: Request) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminUserId(userId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { conversation_id, user_id } = body;

    if (!conversation_id) {
        return NextResponse.json({ error: "Missing conversation_id" }, { status: 400 });
    }
    if (!user_id) {
        return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
    }

    // 確認對話存在
    const { data: existing, error: fetchError } = await supabase
        .from("conversations")
        .select("id, clerk_user_id")
        .eq("id", conversation_id)
        .single();

    if (fetchError || !existing) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const { error: updateError } = await supabase
        .from("conversations")
        .update({
            clerk_user_id: user_id,
            updated_at: new Date().toISOString(),
        })
        .eq("id", conversation_id);

    if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
        success: true,
        conversation_id,
        assigned_to: user_id,
        previous_user_id: existing.clerk_user_id ?? null,
    });
}
