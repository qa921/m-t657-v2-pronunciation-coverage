'use strict';
const { Pool } = require('pg');

// DATABASE_URL is provided via Vercel environment variables only.
// It is never committed to the repository.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
  max: 3,
});

const SCHEMA = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email citext UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'learner' CHECK (role IN ('learner','admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);
CREATE TABLE IF NOT EXISTS learner_progress (
  learner_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  prompt_id text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','completed')),
  plays integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (learner_id, prompt_id)
);
CREATE TABLE IF NOT EXISTS interactions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  type text NOT NULL,
  prompt_id text,
  language text,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS interactions_user_idx ON interactions (user_id);
CREATE INDEX IF NOT EXISTS interactions_type_idx ON interactions (type);
CREATE INDEX IF NOT EXISTS interactions_prompt_idx ON interactions (prompt_id);
CREATE INDEX IF NOT EXISTS interactions_created_idx ON interactions (created_at DESC);
`;

let migrated;
function migrate() {
  if (!migrated) {
    migrated = pool.query(SCHEMA).catch(function (err) {
      migrated = null;
      throw err;
    });
  }
  return migrated;
}

module.exports = { pool, migrate };
