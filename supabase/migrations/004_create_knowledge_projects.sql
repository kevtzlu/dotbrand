-- Knowledge Base: per-user historical project repository for AI calibration
CREATE TABLE IF NOT EXISTS knowledge_projects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text NOT NULL,
  name            text NOT NULL,
  project_type    text NOT NULL CHECK (project_type IN ('public', 'private')),
  start_date      date,
  end_date        date,
  prevailing_wage boolean NOT NULL DEFAULT false,

  -- Document slots (each stores {name, url, size, type} or null)
  doc_bod         jsonb,   -- BOD or RFP
  doc_google_maps jsonb,   -- site screenshot/image or link
  doc_drawings    jsonb,   -- engineering drawings / blueprints
  doc_initial_est jsonb,   -- initial estimate (Excel/PDF)
  doc_final_est   jsonb,   -- final estimate (Excel/PDF)

  -- true when all 5 doc slots are non-null
  is_complete     boolean NOT NULL DEFAULT false,

  -- Links to document_chunks table for RAG (prefixed kb-)
  conversation_id text NOT NULL,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_projects_user_id ON knowledge_projects (user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_projects_complete ON knowledge_projects (user_id, is_complete);

-- Row-level security (same pattern as projects table)
ALTER TABLE knowledge_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY knowledge_projects_select ON knowledge_projects
  FOR SELECT USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY knowledge_projects_insert ON knowledge_projects
  FOR INSERT WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY knowledge_projects_update ON knowledge_projects
  FOR UPDATE USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY knowledge_projects_delete ON knowledge_projects
  FOR DELETE USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- RPC: search knowledge base document chunks across multiple conversation IDs
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding vector(1536),
  kb_conversation_ids text[],
  match_count int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  conversation_id text,
  file_name text,
  chunk_index int,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.conversation_id,
    dc.file_name,
    dc.chunk_index,
    dc.content,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  WHERE dc.conversation_id = ANY(kb_conversation_ids)
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
