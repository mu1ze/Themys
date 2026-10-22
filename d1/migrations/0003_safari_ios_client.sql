-- Expand usage_events.client_type so Safari iOS overlay traffic is not stored as "extension".
-- SQLite cannot ALTER a CHECK constraint in place.

PRAGMA foreign_keys=OFF;

CREATE TABLE usage_events_new (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  actor_hash TEXT NOT NULL,
  client_type TEXT NOT NULL CHECK (client_type IN ('web', 'extension', 'safari-ios', 'api_key', 'cron')),
  operation TEXT NOT NULL,
  outcome TEXT NOT NULL,
  cached INTEGER NOT NULL DEFAULT 0 CHECK (cached IN (0, 1)),
  scan_slots INTEGER NOT NULL DEFAULT 0,
  ai_slots INTEGER NOT NULL DEFAULT 0,
  credits INTEGER NOT NULL DEFAULT 0,
  idempotency_key_hash TEXT,
  metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO usage_events_new (
  id, actor_hash, client_type, operation, outcome, cached, scan_slots, ai_slots, credits,
  idempotency_key_hash, metadata, created_at
)
SELECT
  id, actor_hash, client_type, operation, outcome, cached, scan_slots, ai_slots, credits,
  idempotency_key_hash, metadata, created_at
FROM usage_events;

DROP TABLE usage_events;
ALTER TABLE usage_events_new RENAME TO usage_events;

CREATE INDEX idx_usage_events_created_at ON usage_events(created_at DESC);
CREATE INDEX idx_usage_events_actor_created ON usage_events(actor_hash, created_at DESC);

PRAGMA foreign_keys=ON;
