import { NextResponse } from 'next/server';
import { createHmac, createHash } from 'crypto';

export const maxDuration = 60;

function hmac(key: Buffer | string, data: string): Buffer {
    return createHmac('sha256', key).update(data).digest();
}

function sha256hex(data: string): string {
    return createHash('sha256').update(data).digest('hex');
}

export async function GET(): Promise<Response> {
    return new Response('Upload endpoint ready', { status: 200 });
}

export async function POST(request: Request): Promise<Response> {
    try {
        const { pathname } = await request.json();

        const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
        const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;
        const bucket = process.env.R2_BUCKET!;
        const accountId = '5a334bf1b88c7d352c016d4c4f0a89a7';

        const host = `${bucket}.${accountId}.r2.cloudflarestorage.com`;
        const method = 'PUT';

        const now = new Date();
        const datestamp = now.toISOString().slice(0, 10).replace(/-/g, '');
        const amzdate = now.toISOString().replace(/[:-]/g, '').slice(0, 15) + 'Z';

        const encodedKey = pathname.split('/').map(encodeURIComponent).join('/');
        const credentialScope = `${datestamp}/auto/s3/aws4_request`;
        const credential = `${accessKeyId}/${credentialScope}`;

        const queryParams = [
            `X-Amz-Algorithm=AWS4-HMAC-SHA256`,
            `X-Amz-Credential=${encodeURIComponent(credential)}`,
            `X-Amz-Date=${amzdate}`,
            `X-Amz-Expires=3600`,
            `X-Amz-SignedHeaders=host`,
        ].join('&');

        const canonicalHeaders = `host:${host}\n`;
        const canonicalRequest = [method, `/${encodedKey}`, queryParams, canonicalHeaders, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
        const stringToSign = ['AWS4-HMAC-SHA256', amzdate, credentialScope, sha256hex(canonicalRequest)].join('\n');
        const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, datestamp), 'auto'), 's3'), 'aws4_request');
        const signature = hmac(signingKey, stringToSign).toString('hex');

        const presignedUrl = `https://${host}/${encodedKey}?${queryParams}&X-Amz-Signature=${signature}`;
        const publicUrl = `https://pub-0d6e93fd73b24c139cec0a4b23adcf30.r2.dev/${encodedKey}`;

        return NextResponse.json({ presignedUrl, url: publicUrl });
    } catch (error) {
        console.error('[Upload] Error:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
}
