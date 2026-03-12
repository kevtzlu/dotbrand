-- Estimait V2: projects table
CREATE TABLE IF NOT EXISTS projects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text NOT NULL,
  title           text,
  status          text NOT NULL DEFAULT 'overview'
                  CHECK (status IN ('uploading','overview','detail','final','completed')),

  -- AI-extracted raw info from uploaded documents
  extracted_info  jsonb DEFAULT '{}',

  -- User-confirmed info (each field has value, confidence, source, edited_at)
  confirmed_info  jsonb DEFAULT '{}',

  -- Overview tab Q&A log
  overview_qa     jsonb DEFAULT '[]',

  -- Rough estimate from Overview
  rough_estimate  jsonb,

  -- Detail tab: Monte Carlo results
  monte_carlo     jsonb,
  selected_scenario text CHECK (selected_scenario IN ('conservative','mid','optimistic')),

  -- Detail tab: risks
  risks           jsonb DEFAULT '[]',

  -- Detail tab: hard/soft cost ratio
  hard_soft_ratio jsonb DEFAULT '{"hard_pct": 85, "soft_pct": 15}',

  -- Detail tab: CSI division line items
  csi_divisions   jsonb DEFAULT '[]',

  -- Detail tab: AI guesses vs document evidence
  ai_guesses      jsonb DEFAULT '[]',
  ai_evidence     jsonb DEFAULT '[]',

  -- Final tab
  final_hard_cost   numeric,
  final_soft_cost   numeric,
  final_total_cost  numeric,
  final_cost_summary jsonb DEFAULT '[]',

  -- Uploaded files metadata
  uploaded_files  jsonb DEFAULT '[]',

  -- Link to RAG document_chunks via conversation_id
  conversation_id text,

  -- Full edit history across all tabs
  edit_history    jsonb DEFAULT '[]',

  -- Chat messages for the Overview AI sidebar
  chat_messages   jsonb DEFAULT '[]',

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects (user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects (status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects (created_at DESC);

-- Row-level security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY projects_select ON projects
  FOR SELECT USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY projects_insert ON projects
  FOR INSERT WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY projects_update ON projects
  FOR UPDATE USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY projects_delete ON projects
  FOR DELETE USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
