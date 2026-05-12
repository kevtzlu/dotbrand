ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_shown boolean NOT NULL DEFAULT false;
