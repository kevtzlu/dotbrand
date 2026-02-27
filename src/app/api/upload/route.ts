import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const rawConvId = formData.get('conversationId');
        console.log(`[RAG] raw conversationId from form: "${rawConvId}"`);
        const conversationId = (rawConvId as string) || 'default';
        const fileName = formData.get('fileName') as string || file?.name;

        if (!file) {
            return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
        }

        const blob = await put(file.name, file, {
            access: "public",
            allowOverwrite: true,
            token: process.env.BLOB_READ_WRITE_TOKEN,
        });

        const blobUrl = blob.url;

        // Fire-and-forget: trigger RAG embedding for PDFs without blocking the upload response
        if (fileName.toLowerCase().endsWith('.pdf') && conversationId) {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.estimait.io';
            const embedUrl = `${baseUrl}/api/rag-embed`;
            console.log(`[RAG] Triggering embed (non-blocking): ${embedUrl} for ${fileName}, conversationId=${conversationId}`);
            fetch(embedUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ blobUrl, fileName, conversationId }),
            }).catch(err => console.error('[Upload] RAG embed failed:', err));
        }

        return NextResponse.json({ success: true, url: blobUrl, name: file.name, size: file.size });
    } catch (error: any) {
        console.error("[Upload] Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
