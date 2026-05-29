ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS prevailing_wage boolean NOT NULL DEFAULT false;
