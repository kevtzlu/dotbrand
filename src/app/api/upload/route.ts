import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextResponse } from 'next/server';

export const maxDuration = 60;

const r2 = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
});

export async function GET(): Promise<Response> {
    return new Response('Upload endpoint ready', { status: 200 });
}

export async function POST(request: Request): Promise<Response> {
    try {
        const { pathname, contentType } = await request.json();

        const command = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET!,
            Key: pathname,
            ContentType: contentType || 'application/octet-stream',
        });

        const presignedUrl = await getSignedUrl(r2, command, { expiresIn: 3600 });

        return NextResponse.json({ presignedUrl, url: `${process.env.R2_ENDPOINT}/${process.env.R2_BUCKET}/${pathname}` });
    } catch (error) {
        console.error('[Upload] Error:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
}
