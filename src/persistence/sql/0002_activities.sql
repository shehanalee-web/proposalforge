CREATE TABLE IF NOT EXISTS activities (
  id               TEXT PRIMARY KEY,
  company_id       TEXT NOT NULL,
  schema_version   INTEGER NOT NULL DEFAULT 1,
  subject_type     TEXT NOT NULL,
  subject_id       TEXT NOT NULL,
  origin           TEXT NOT NULL,
  kind             TEXT NOT NULL,
  type             TEXT NOT NULL,
  audience         TEXT NOT NULL,
  occurred_at      TIMESTAMPTZ NOT NULL,
  recorded_at      TIMESTAMPTZ NOT NULL,
  actor_id         TEXT,
  actor_kind       TEXT NOT NULL,
  actor_display_name TEXT,
  subject_line     TEXT NOT NULL DEFAULT '',
  body             TEXT NOT NULL DEFAULT '',
  attributes       JSONB NOT NULL DEFAULT '{}'::jsonb,
  state            TEXT,
  participants     JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_domain    TEXT NOT NULL,
  source_entity_type TEXT NOT NULL,
  source_entity_id TEXT NOT NULL,
  source_event_id  TEXT NOT NULL,
  idempotency_key  TEXT,
  created_at       TIMESTAMPTZ NOT NULL,
  updated_at       TIMESTAMPTZ NOT NULL,
  archived_at      TIMESTAMPTZ,
  CONSTRAINT activities_kind_check CHECK (kind IN ('note', 'call', 'meeting', 'email')),
  CONSTRAINT activities_origin_check CHECK (origin IN ('user', 'agent')),
  CONSTRAINT activities_audience_check CHECK (audience IN ('internal', 'client')),
  CONSTRAINT activities_state_null_check CHECK (state IS NULL)
);

CREATE INDEX IF NOT EXISTS activities_company_occurred_idx
  ON activities (company_id, occurred_at DESC, recorded_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS activities_company_subject_occurred_idx
  ON activities (company_id, subject_type, subject_id, occurred_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS activities_company_idempotency_uidx
  ON activities (company_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
