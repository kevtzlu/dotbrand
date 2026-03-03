import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET /api/share?token=xxx  — public, no auth required
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
        return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const { data, error } = await supabase
        .from("conversations")
        .select("id, title, timestamp, messages, stage_snapshots")
        .eq("share_token", token)
        .single();

    if (error || !data) {
        return NextResponse.json({ error: "Shared conversation not found" }, { status: 404 });
    }

    return NextResponse.json({
        conversation: {
            id: data.id,
            title: data.title,
            timestamp: data.timestamp,
            messages: data.messages,
            stageSnapshots: (data as any).stage_snapshots ?? [],
        },
    });
}

// POST /api/share  — authenticated, generates or returns existing share token
export async function POST(req: Request) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await req.json();
    if (!id) {
        return NextResponse.json({ error: "Missing conversation id" }, { status: 400 });
    }

    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
        .from("conversations")
        .select("id, share_token")
        .eq("id", id)
        .eq("clerk_user_id", userId)
        .single();

    if (fetchError || !existing) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Return existing token if already shared
    if (existing.share_token) {
        return NextResponse.json({ token: existing.share_token });
    }

    // Generate a new random token
    const token = Array.from(crypto.getRandomValues(new Uint8Array(18)))
        .map(b => b.toString(36).padStart(2, "0"))
        .join("")
        .slice(0, 24);

    const { error: updateError } = await supabase
        .from("conversations")
        .update({ share_token: token })
        .eq("id", id)
        .eq("clerk_user_id", userId);

    if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ token });
}

// DELETE /api/share  — revoke sharing
export async function DELETE(req: Request) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await req.json();
    if (!id) {
        return NextResponse.json({ error: "Missing conversation id" }, { status: 400 });
    }

    const { error } = await supabase
        .from("conversations")
        .update({ share_token: null })
        .eq("id", id)
        .eq("clerk_user_id", userId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
