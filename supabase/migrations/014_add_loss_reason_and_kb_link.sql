-- Add loss reason text and KB link to projects
ALTER TABLE projects
  ADD COLUMN loss_reason text DEFAULT NULL,
  ADD COLUMN kb_project_id uuid DEFAULT NULL;
