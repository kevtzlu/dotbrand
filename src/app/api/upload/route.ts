import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export const maxDuration = 60;

export async function GET(): Promise<Response> {
    return new Response('Upload endpoint ready', { status: 200 });
}

export async function POST(request: Request): Promise<Response> {
    try {
        const { pathname, callbackUrl } = await request.json();
        
        const clientToken = await generateClientTokenFromReadWriteToken({
            token: process.env.BLOB_READ_WRITE_TOKEN!,
            pathname,
            onUploadCompleted: callbackUrl ? {
                callbackUrl,
            } : undefined,
            allowedContentTypes: [
                'application/pdf',
                'image/jpeg',
                'image/png',
                'image/jpg',
                'image/gif',
                'image/webp',
                'text/plain',
                'text/markdown',
                'text/csv',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            ],
            maximumSizeInBytes: 100 * 1024 * 1024,
        });
        
        return NextResponse.json({ 
            type: 'blob.generate-client-token',
            clientToken 
        });
    } catch (error) {
        console.error('[Upload] Error:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
}
