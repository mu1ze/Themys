-- Docs feedback table
-- Stores user feedback on documentation pages

CREATE TABLE IF NOT EXISTS docs_feedback (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT NOT NULL,           -- doc page slug (e.g. "quick-start")
  helpful    BOOLEAN NOT NULL,        -- true = helpful, false = not helpful
  comment    TEXT,                     -- optional comment (only for negative feedback)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_docs_feedback_slug ON docs_feedback(slug);
CREATE INDEX IF NOT EXISTS idx_docs_feedback_created ON docs_feedback(created_at DESC);

-- RLS: anyone can insert (feedback is anonymous), no reads via client
ALTER TABLE docs_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous feedback insert"
  ON docs_feedback
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- No SELECT policy — feedback is only readable via service role (admin)
