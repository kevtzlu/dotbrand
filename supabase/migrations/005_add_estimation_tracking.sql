-- Track estimation progress so it persists across page navigations
ALTER TABLE projects
  ADD COLUMN estimating_phase text DEFAULT NULL
    CHECK (estimating_phase IN ('overview', 'detail', 'final')),
  ADD COLUMN estimating_started_at timestamptz DEFAULT NULL;
