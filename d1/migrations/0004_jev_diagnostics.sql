CREATE TABLE IF NOT EXISTS scan_jev_diagnostics (
  scan_id TEXT PRIMARY KEY NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  model_version TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  decisions_json TEXT NOT NULL CHECK (json_valid(decisions_json)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
