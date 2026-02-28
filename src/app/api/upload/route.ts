import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export const maxDuration = 60;

export async function GET(): Promise<Response> {
    return new Response('Upload endpoint ready', { status: 200 });
}

export async function POST(request: Request): Promise<Response> {
    const body = (await request.json()) as HandleUploadBody;
    
    try {
        const jsonResponse = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async (pathname) => {
                return {
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
                    addRandomSuffix: false,
                };
            },
            onUploadCompleted: async ({ blob }) => {
                console.log('[Upload] Completed:', blob.url);
            },
        });
        return NextResponse.json(jsonResponse);
    } catch (error) {
        console.error('[Upload] Error:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
}
