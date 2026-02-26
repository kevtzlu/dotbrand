export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim()) chunks.push(chunk);
    i += chunkSize - overlap;
  }
  return chunks;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const { blobUrl, fileName, conversationId } = await req.json();

    const response = await fetch(blobUrl);
    const buffer = Buffer.from(await response.arrayBuffer());

    const { extractText } = await import('unpdf');
    const { text: textPages } = await extractText(new Uint8Array(buffer));
    const text = Array.isArray(textPages) ? textPages.join("\n") : String(textPages);
    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'No text extracted' }, { status: 400 });
    }

    await supabase
      .from('document_chunks')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('file_name', fileName);

    const chunks = chunkText(text, 500, 50);
    console.log(`[RAG] ${fileName}: ${chunks.length} chunks`);

    const batchSize = 20;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: batch,
      });

      const rows = batch.map((content, j) => ({
        conversation_id: conversationId,
        file_name: fileName,
        chunk_index: i + j,
        content,
        embedding: embeddingResponse.data[j].embedding, // ✅ 直接傳 array，不 JSON.stringify
      }));

      const { error } = await supabase.from('document_chunks').insert(rows);
      if (error) console.error('[RAG] Supabase insert error:', error);
    }

    return NextResponse.json(
      { success: true, chunks: chunks.length },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (error: any) {
    console.error('[RAG] Embed error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
