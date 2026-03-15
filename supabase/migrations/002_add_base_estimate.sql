-- Add base_estimate column for instant client-side estimate computation
ALTER TABLE projects ADD COLUMN IF NOT EXISTS base_estimate jsonb DEFAULT NULL;
