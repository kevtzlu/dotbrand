import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export const maxDuration = 60;

const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://5a334bf1b88c7d352c016d4c4f0a89a7.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
});

export async function POST(request: Request): Promise<Response> {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const pathname = formData.get('pathname') as string;

        if (!file || !pathname) {
            return NextResponse.json({ error: 'Missing file or pathname' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        
        await r2.send(new PutObjectCommand({
            Bucket: process.env.R2_BUCKET!,
            Key: pathname,
            Body: buffer,
            ContentType: file.type || 'application/octet-stream',
        }));

        const url = `https://pub-0d6e93fd73b24c139cec0a4b23adcf30.r2.dev/${pathname}`;
        return NextResponse.json({ url });
    } catch (error) {
        console.error('[Upload] Error:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
