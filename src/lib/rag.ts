import { supabaseAdmin } from "@/lib/supabase";

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
