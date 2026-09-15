-- Harbor Language learner app schema (idempotent).
-- The API applies this automatically on cold start (api/_lib/db.js -> migrate()).
-- No credentials live here; the app connects via the DATABASE_URL env var.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS app_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  email         citext UNIQUE NOT NULL,
  password_hash text NOT NULL,
  -- 'learner' is the only role a public flow can create.
  -- 'admin' is only ever granted by an existing admin, or once via the
  -- guarded bootstrap endpoint while zero admins exist.
  role          text NOT NULL DEFAULT 'learner' CHECK (role IN ('learner','admin')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token      text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

-- Matches the documented persistence contract in
-- data/learner-progress-prior-state.json (learnerId / promptId / status).
CREATE TABLE IF NOT EXISTS learner_progress (
  learner_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  prompt_id  text NOT NULL,
  status     text NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','completed')),
  plays      integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (learner_id, prompt_id)
);

-- Append-only audit/activity log. Powers the admin Interactions screen.
CREATE TABLE IF NOT EXISTS interactions (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid REFERENCES app_users(id) ON DELETE SET NULL,
  type       text NOT NULL,  -- register|login|logout|play|progress_update|role_change|export|bootstrap
  prompt_id  text,
  language   text,
  detail     jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS interactions_user_idx ON interactions (user_id);
CREATE INDEX IF NOT EXISTS interactions_type_idx ON interactions (type);
CREATE INDEX IF NOT EXISTS interactions_prompt_idx ON interactions (prompt_id);
CREATE INDEX IF NOT EXISTS interactions_created_idx ON interactions (created_at DESC);

-- Audio coverage: source of truth for the runtime manifest (api/manifest.js).
CREATE TABLE IF NOT EXISTS audio_assets (
  spoken_key text PRIMARY KEY,
  prompt_id  text NOT NULL,
  language   text NOT NULL,
  text       text NOT NULL,
  src        text,      -- null when status = 'unavailable'
  status     text NOT NULL CHECK (status IN ('available','unavailable')),
  reason     text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed from the 2026-09-15 audit of data/curriculum.json against the files
-- actually present in public/audio/. Idempotent (ON CONFLICT DO NOTHING), so
-- operator UPDATEs applied after re-recordings are never overwritten by this.
INSERT INTO audio_assets (spoken_key, prompt_id, language, text, src, status, reason) VALUES
  ('es.buenos-dias','es-01','es','Buenos días','/audio/es/buenos-dias.wav','available',NULL),
  ('es.como-estas','es-02','es','¿Cómo estás?','/audio/es/como-estas.wav','available',NULL),
  ('es.me-llamo-ana','es-03','es','Me llamo Ana','/audio/es/me-llamo-ana.wav','available',NULL),
  ('es.gracias','es-04','es','Gracias','/audio/es/gracias.wav','available',NULL),
  ('es.por-favor','es-05','es','Por favor','/audio/es/por-favor.wav','available',NULL),
  ('es.hasta-manana','es-06','es','Hasta mañana','/audio/es/hasta-manana.wav','available',NULL),
  ('es.no-entiendo','es-07','es','No entiendo','/audio/es/no-entiendo.wav','available',NULL),
  ('es.donde-esta-estacion','es-08','es','¿Dónde está la estación?',NULL,'unavailable','recording_missing'),
  ('fr.bonjour','fr-01','fr','Bonjour','/audio/fr/bonjour.wav','available',NULL),
  ('fr.comment-ca-va','fr-02','fr','Comment ça va?','/audio/fr/comment-ca-va.wav','available',NULL),
  ('fr.je-mappelle-luc','fr-03','fr','Je m''appelle Luc','/audio/fr/je-mappelle-luc.wav','available',NULL),
  ('fr.merci-beaucoup','fr-04','fr','Merci beaucoup','/audio/fr/merci.wav','available',NULL),
  ('fr.sil-vous-plait','fr-05','fr','S''il vous plaît','/audio/fr/sil-vous-plait.wav','available',NULL),
  ('fr.a-demain','fr-06','fr','À demain','/audio/fr/a-demain.wav','available',NULL),
  ('fr.je-ne-comprends-pas','fr-07','fr','Je ne comprends pas',NULL,'unavailable','recording_missing'),
  ('fr.ou-est-la-gare','fr-08','fr','Où est la gare?',NULL,'unavailable','recording_missing'),
  ('ja.ohayo-gozaimasu','ja-01','ja','おはようございます','/audio/ja/ohayo-gozaimasu.wav','available',NULL),
  ('ja.genki-desu-ka','ja-02','ja','元気ですか','/audio/ja/genki-desu-ka.wav','available',NULL),
  ('ja.watashi-wa-yuki','ja-03','ja','私はユキです','/audio/ja/watashi-yuki.wav','available',NULL),
  ('ja.arigato-gozaimasu','ja-04','ja','ありがとうございます','/audio/ja/arigato-gozaimasu.wav','available',NULL),
  ('ja.onegai-shimasu','ja-05','ja','お願いします','/audio/ja/onegai-shimasu.wav','available',NULL),
  ('ja.mata-ashita','ja-06','ja','また明日','/audio/ja/mata-ashita.wav','available',NULL),
  ('ja.wakarimasen','ja-07','ja','わかりません','/audio/ja/wakarimasen.wav','available',NULL),
  ('ja.eki-wa-doko','ja-08','ja','駅はどこ?',NULL,'unavailable','recording_missing'),
  ('de.guten-morgen','de-01','de','Guten Morgen','/audio/de/guten-morgen.wav','available',NULL),
  ('de.wie-geht-es-dir','de-02','de','Wie geht es dir?','/audio/de/wie-geht-es-dir.wav','available',NULL),
  ('de.ich-heisse-mia','de-03','de','Ich heiße Mia','/audio/de/ich-heisse-mia.wav','available',NULL),
  ('de.vielen-dank','de-04','de','Vielen Dank','/audio/de/vielen-dank.wav','available',NULL),
  ('de.bitte','de-05','de','Bitte','/audio/de/bitte.wav','available',NULL),
  ('de.bis-morgen','de-06','de','Bis morgen','/audio/de/bis-morgen.wav','available',NULL),
  ('de.ich-verstehe-nicht','de-07','de','Ich verstehe nicht','/audio/de/ich-verstehe-nicht.wav','available',NULL),
  ('de.wo-ist-bahnhof','de-08','de','Wo ist der Bahnhof?',NULL,'unavailable','recording_missing')
ON CONFLICT (spoken_key) DO NOTHING;
