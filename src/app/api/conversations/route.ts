import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
        .from("conversations")
        .select("id, title, timestamp, messages, share_token")
        .eq("clerk_user_id", userId)
        .order("timestamp", { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ conversations: data ?? [] });
}

export async function POST(req: Request) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, title, timestamp, messages } = body;

    if (!id) {
        return NextResponse.json({ error: "Missing conversation id" }, { status: 400 });
    }

    const { error } = await supabase
        .from("conversations")
        .upsert(
            {
                id,
                clerk_user_id: userId,
                title: title ?? "",
                timestamp: timestamp ?? Date.now(),
                messages: messages ?? [],
                updated_at: new Date().toISOString(),
            },
            { onConflict: "id" }
        );

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
        return NextResponse.json({ error: "Missing conversation id" }, { status: 400 });
    }

    const { error } = await supabase
        .from("conversations")
        .delete()
        .eq("id", id)
        .eq("clerk_user_id", userId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
