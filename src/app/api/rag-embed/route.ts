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

    const { blobUrl, fileName, conversationId, chunkOffset = 0, clearMatchingParts = false, originalFileName } = await req.json();

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

    console.log('[RAG] Starting PDF parse for:', safeFileName, 'using pdfjs-dist...');
    let fullText = '';
    try {
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs' as any);
      // Disable web worker — running in Node.js server environment
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';
      const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        useWorkerFetch: false,
        isEvalSupported: false,
        disableFontFace: true,
      }).promise;
      console.log('[RAG] PDF loaded, total pages:', pdf.numPages);
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: any) => item.str).join(' ');
        if (pageText.trim()) fullText += pageText + '\n\n';
      }
    } catch (pdfErr: any) {
      console.error('[RAG] pdfjs-dist failed, falling back to unpdf:', pdfErr.message);
      // Fallback to unpdf if pdfjs-dist fails
      const { extractText } = await import('unpdf');
      const { text: textPages } = await extractText(new Uint8Array(buffer), { mergePages: true });
      fullText = typeof textPages === 'string' ? textPages : (textPages as string[]).join('\n\n');
    }
    console.log('[RAG] Extracted text length:', fullText.length, 'chars from:', fileName);

    if (!fullText || fullText.trim().length < 100) {
      console.warn('[RAG] PDF text extraction returned minimal content, file may be image-based (scanned PDF)');
      return NextResponse.json({
        success: false,
        error: 'PDF text extraction failed - insufficient content extracted (possibly a scanned/image-based PDF)',
        chunks: 0,
      }, { status: 200 });
    }

    const text = fullText;
    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'No text extracted' }, { status: 400 });
    }

    if (clearMatchingParts && originalFileName) {
      const prefix = `${originalFileName}_part`;
      await supabase
        .from('document_chunks')
        .delete()
        .eq('conversation_id', safeConversationId)
        .like('file_name', `${prefix}%`);
      console.log(`[RAG] Cleared old parts for: ${originalFileName}`);
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
        chunk_index: chunkOffset + i + j,
        content,
        embedding: embeddingResponse.data[j].embedding,
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
