import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
        .from("gc_profiles")
        .select("*")
        .eq("clerk_user_id", userId)
        .single();

    if (error && error.code !== "PGRST116") {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Normalize field names for the frontend
    const profile = data ? {
        company_name: data.company_name || "",
        hq_address: data.company_address || "",
        logo_url: data.logo_url || "",
        contingency_pct: data.contingency_rate ?? 10,
        fee_pct: data.gc_fee_rate ?? 5,
    } : null;

    return NextResponse.json({ profile });
}

export async function POST(req: Request) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { company_name, hq_address, logo_url, contingency_pct, fee_pct } = body;

    const { data, error } = await supabase
        .from("gc_profiles")
        .upsert(
            {
                clerk_user_id: userId,
                company_name,
                company_address: hq_address,
                logo_url,
                contingency_rate: contingency_pct,
                gc_fee_rate: fee_pct,
                updated_at: new Date().toISOString(),
            },
            { onConflict: "clerk_user_id" }
        )
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
