-- Store estimation errors so background job failures can surface in the UI
ALTER TABLE projects
  ADD COLUMN estimating_error text DEFAULT NULL;
