-- Add optional "other files" slot to knowledge_projects
-- This column stores an array of UploadedFile objects [{name, url, size, type}, ...]
-- It does NOT affect is_complete (only the 5 standard slots count)
ALTER TABLE knowledge_projects
  ADD COLUMN IF NOT EXISTS doc_other_files jsonb;
