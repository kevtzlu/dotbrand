CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text UNIQUE NOT NULL,
  email         text NOT NULL,
  first_name    text,
  last_name     text,
  avatar_url    text,
  last_sign_in  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_clerk_user_id ON users (clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
