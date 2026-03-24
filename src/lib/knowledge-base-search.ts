import { supabaseAdmin } from "@/lib/supabase";
import OpenAI from "openai";

const MAX_KB_CONTEXT_CHARS = 20000;

/**
 * Search the user's completed knowledge base projects for relevant historical data.
 * Returns formatted context string for injection into AI system prompts.
 */
export async function searchKnowledgeBase(
  userId: string,
  query: string,
  projectType?: "public" | "private"
): Promise<string> {
  try {
    // 1. Get all completed KB projects for this user
    let q = supabaseAdmin
      .from("knowledge_projects")
      .select("id, name, project_type, start_date, end_date, prevailing_wage, conversation_id")
      .eq("user_id", userId)
      .eq("is_complete", true);

    if (projectType) {
      q = q.eq("project_type", projectType);
    }

    const { data: kbProjects, error } = await q;

    if (error || !kbProjects || kbProjects.length === 0) {
      return "";
    }

    // 2. Collect conversation IDs
    const conversationIds = kbProjects.map((p) => p.conversation_id);

    // 3. Create embedding for the query
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // 4. Search relevant chunks across all KB projects
    const { data: chunks, error: rpcError } = await supabaseAdmin.rpc(
      "match_knowledge_chunks",
      {
        query_embedding: queryEmbedding,
        kb_conversation_ids: conversationIds,
        match_count: 20,
      }
    );

    if (rpcError || !chunks || chunks.length === 0) {
      return "";
    }

    // 5. Build context with project metadata headers
    const projectMap = new Map(
      kbProjects.map((p) => [p.conversation_id, p])
    );

    let context = "";
    let currentConvId = "";

    for (const chunk of chunks) {
      // Add project header when switching to a new project's chunks
      if (chunk.conversation_id !== currentConvId) {
        currentConvId = chunk.conversation_id;
        const proj = projectMap.get(currentConvId);
        if (proj) {
          context += `\n[KB Project: ${proj.name} | Type: ${proj.project_type} | Prevailing Wage: ${proj.prevailing_wage ? "Yes" : "No"}`;
          if (proj.start_date) context += ` | Start: ${proj.start_date}`;
          if (proj.end_date) context += ` | End: ${proj.end_date}`;
          context += "]\n";
        }
      }
      context += `[${chunk.file_name} - chunk ${chunk.chunk_index}]\n${chunk.content}\n\n---\n\n`;

      if (context.length > MAX_KB_CONTEXT_CHARS) {
        context += "[Knowledge base context truncated to fit budget]\n";
        break;
      }
    }

    console.log(
      `[KB] Found ${chunks.length} relevant chunks from ${kbProjects.length} KB projects (${context.length} chars)`
    );

    return context;
  } catch (e) {
    console.error("[KB] Search error:", e);
    return "";
  }
}
