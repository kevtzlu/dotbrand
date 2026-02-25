export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    const { blobUrl, fileName, conversationId } = await req.json();

    // Fetch PDF from blob storage
    const response = await fetch(blobUrl);
    const buffer = Buffer.from(await response.arrayBuffer());

    // Dynamic import to avoid build-time static analysis
    const pdfParse = (await import('pdf-parse')).default;
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text;

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'No text extracted' }, { status: 400 });
    }

    // Delete old chunks for this file in this conversation
    await supabase
      .from('document_chunks')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('file_name', fileName);

    // Chunk the text
    const chunks = chunkText(text, 500, 50);
    console.log(`[RAG] ${fileName}: ${chunks.length} chunks`);

    // Embed and store in batches
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
        embedding: embeddingResponse.data[i + j] ? 
          JSON.stringify(embeddingResponse.data[j].embedding) : null,
      }));

      await supabase.from('document_chunks').insert(rows);
    }

    return NextResponse.json({ success: true, chunks: chunks.length });
  } catch (error: any) {
    console.error('[RAG] Embed error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
