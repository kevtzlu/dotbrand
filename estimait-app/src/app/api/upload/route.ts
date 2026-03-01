import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<NextResponse> {
  // Allow both authenticated users and public access
  // (Clerk middleware already handles route-level auth)
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Optional: verify user is authenticated before allowing upload
        // If you want to restrict uploads to logged-in users only, uncomment:
        // const { userId } = await auth();
        // if (!userId) throw new Error('Unauthorized');

        return {
          allowedContentTypes: [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
          ],
          maximumSizeInBytes: 50 * 1024 * 1024, // 50MB
          tokenPayload: JSON.stringify({
            pathname,
            timestamp: Date.now(),
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Called after Vercel Blob has confirmed the upload
        // The RAG embed is triggered separately by the client (chat-interface.tsx)
        // so we don't need to do anything here
        console.log('[Upload] Completed:', blob.url, '| payload:', tokenPayload);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error('[Upload] Error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
