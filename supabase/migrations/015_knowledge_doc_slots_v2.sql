-- Knowledge Base: 8 document slots; required = owner bid + estimating only

-- Normalize jsonb slot value (single object or array) to a jsonb array
CREATE OR REPLACE FUNCTION kb_normalize_files(val jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN val IS NULL THEN '[]'::jsonb
    WHEN jsonb_typeof(val) = 'array' THEN val
    ELSE jsonb_build_array(val)
  END;
$$;

-- Merge two slot values into one array (dedupe by url)
CREATE OR REPLACE FUNCTION kb_merge_files(a jsonb, b jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_agg(elem ORDER BY (elem->>'url'))
      FROM (
        SELECT DISTINCT ON (elem->>'url') elem
        FROM jsonb_array_elements(kb_normalize_files(a) || kb_normalize_files(b)) AS elem
        WHERE elem->>'url' IS NOT NULL
      ) sub
    ),
    '[]'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION kb_slot_has_files(val jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN val IS NULL THEN false
    WHEN jsonb_typeof(val) = 'array' THEN jsonb_array_length(val) > 0
    ELSE true
  END;
$$;

-- New columns
ALTER TABLE knowledge_projects
  ADD COLUMN IF NOT EXISTS doc_contract jsonb,
  ADD COLUMN IF NOT EXISTS doc_design_drawings jsonb,
  ADD COLUMN IF NOT EXISTS doc_specifications jsonb,
  ADD COLUMN IF NOT EXISTS doc_site_info jsonb,
  ADD COLUMN IF NOT EXISTS doc_estimating jsonb,
  ADD COLUMN IF NOT EXISTS doc_owner_bid jsonb,
  ADD COLUMN IF NOT EXISTS doc_field_reports jsonb;

-- Migrate from legacy columns (if they still exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_projects' AND column_name = 'doc_bod'
  ) THEN
    UPDATE knowledge_projects
    SET doc_owner_bid = doc_bod
    WHERE doc_bod IS NOT NULL AND (doc_owner_bid IS NULL OR kb_slot_has_files(doc_owner_bid) = false);

    UPDATE knowledge_projects
    SET doc_site_info = doc_google_maps
    WHERE doc_google_maps IS NOT NULL AND (doc_site_info IS NULL OR kb_slot_has_files(doc_site_info) = false);

    UPDATE knowledge_projects
    SET doc_design_drawings = doc_drawings
    WHERE doc_drawings IS NOT NULL AND (doc_design_drawings IS NULL OR kb_slot_has_files(doc_design_drawings) = false);

    UPDATE knowledge_projects
    SET doc_estimating = kb_merge_files(doc_initial_est, doc_final_est)
    WHERE (doc_initial_est IS NOT NULL OR doc_final_est IS NOT NULL)
      AND (doc_estimating IS NULL OR kb_slot_has_files(doc_estimating) = false);

    ALTER TABLE knowledge_projects
      DROP COLUMN doc_bod,
      DROP COLUMN doc_google_maps,
      DROP COLUMN doc_drawings,
      DROP COLUMN doc_initial_est,
      DROP COLUMN doc_final_est;
  END IF;
END $$;

-- Recompute completion: Owner Bid + Estimating required
UPDATE knowledge_projects
SET is_complete = kb_slot_has_files(doc_owner_bid) AND kb_slot_has_files(doc_estimating);

COMMENT ON COLUMN knowledge_projects.doc_owner_bid IS 'Owner/client bid package (BOD, RFP, ITB)';
COMMENT ON COLUMN knowledge_projects.doc_estimating IS 'GC estimating documents (bid worksheets, takeoffs)';
