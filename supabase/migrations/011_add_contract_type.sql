-- Add contract_type and bid_form_items columns to projects table

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS contract_type text
    CHECK (contract_type IN ('design_build', 'design_bid_build')),
  ADD COLUMN IF NOT EXISTS bid_form_items jsonb DEFAULT '[]';
