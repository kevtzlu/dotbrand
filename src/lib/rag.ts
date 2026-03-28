import { supabaseAdmin } from "@/lib/supabase";

const CHUNK_SEPARATOR = "\n\n---\n\n";

/**
 * Truncate a chunk-separated string at a chunk boundary, never mid-chunk.
 * Returns the truncated string with a notice appended if truncation occurred.
 */
export function truncateAtChunkBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  const chunks = text.split(CHUNK_SEPARATOR);
  let result = "";

  for (const chunk of chunks) {
    const next = result ? result + CHUNK_SEPARATOR + chunk : chunk;
    if (next.length > maxChars) break;
    result = next;
  }

  if (result.length < text.length) {
    result += "\n\n[RAG context truncated to fit budget]";
  }

  return result;
}

/**
 * Load all document chunks for a conversation, ordered by chunk_index.
 * Returns a formatted string with file name headers and chunk separators.
 */
export async function getAllChunks(conversationId: string): Promise<string> {
  try {
    const { data, error } = await supabaseAdmin
      .from("document_chunks")
      .select("file_name, chunk_index, content")
      .eq("conversation_id", conversationId)
      .order("chunk_index", { ascending: true });

    if (error || !data || data.length === 0) return "";

    return data
      .map(
        (chunk: any) =>
          `[${chunk.file_name} - chunk ${chunk.chunk_index}]\n${chunk.content}`
      )
      .join("\n\n---\n\n");
  } catch {
    return "";
  }
}
