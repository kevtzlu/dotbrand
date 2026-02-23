import { NextResponse } from "next/server";
import { getKnowledgeRegistry } from "@/lib/knowledge";

export async function GET() {
    try {
        const registry = getKnowledgeRegistry();
        return NextResponse.json({ success: true, registry });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
