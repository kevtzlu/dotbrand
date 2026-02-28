export const runtime = 'nodejs';
export const maxDuration = 300;
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

    // Null checks before use — prevent TypeError if fields are missing
    const safeConversationId = conversationId ? conversationId.toString() : null;
    const safeFileName = fileName ? fileName.toString() : null;

    if (!blobUrl) {
      return NextResponse.json({ error: 'Missing blobUrl' }, { status: 400 });
    }
    if (!safeConversationId) {
      return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 });
    }
    if (!safeFileName) {
      return NextResponse.json({ error: 'Missing fileName' }, { status: 400 });
    }

    const response = await fetch(blobUrl);
    const buffer = Buffer.from(await response.arrayBuffer());

    console.log('[RAG] Starting PDF parse for:', safeFileName, 'blob size check...');
    const { extractText } = await import('unpdf');
    const { text: textPages } = await extractText(new Uint8Array(buffer), { mergePages: true });
    // String(textPages) is equivalent to .toString() — add null guard
    const fullText = typeof textPages === 'string' ? textPages : (textPages as string[]).join("\n\n");
    console.log('[RAG] Extracted text length:', fullText.length, 'chars from:', fileName);

    // After extracting text with unpdf, check if result is too short
    if (!fullText || fullText.trim().length < 100) {
      console.warn('[RAG] PDF text extraction returned minimal content, file may have font encoding issues');
      // Return success but log warning - don't fail silently
      return NextResponse.json({ 
        success: false, 
        error: 'PDF text extraction failed - insufficient content extracted',
        chunks: 0 
      }, { status: 200 });
    }

    const text = fullText;
    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'No text extracted' }, { status: 400 });
    }

    await supabase
      .from('document_chunks')
      .delete()
      .eq('conversation_id', safeConversationId)
      .eq('file_name', safeFileName);

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
        conversation_id: safeConversationId,
        file_name: safeFileName,
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
