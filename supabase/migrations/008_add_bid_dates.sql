-- Add bid tracking fields to projects
ALTER TABLE projects
  ADD COLUMN bid_award_date date DEFAULT NULL,
  ADD COLUMN construction_start_date date DEFAULT NULL,
  ADD COLUMN bid_result text DEFAULT NULL
    CHECK (bid_result IN ('won', 'lost')),
  ADD COLUMN bid_followup_dismissed boolean DEFAULT false;
