-- Add contract_type to knowledge_projects (mirrors projects table)
ALTER TABLE knowledge_projects
  ADD COLUMN IF NOT EXISTS contract_type text
    CHECK (contract_type IN ('design_build', 'design_bid_build'));
