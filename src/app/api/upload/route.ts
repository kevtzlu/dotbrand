import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
        }

        const blob = await put(file.name, file, {
            access: "public",
            token: process.env.BLOB_READ_WRITE_TOKEN,
        });

        return NextResponse.json({ success: true, url: blob.url, name: file.name, size: file.size });
    } catch (error: any) {
        console.error("[Upload] Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
