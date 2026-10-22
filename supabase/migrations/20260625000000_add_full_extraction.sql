-- Full Extraction: store comprehensive ToS breakdown per scan
-- Each scan gets multiple sections, each with multiple key points

CREATE TABLE IF NOT EXISTS full_extraction_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '📄',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS full_extraction_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES full_extraction_sections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  quote TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Efficient lookup indexes
CREATE INDEX IF NOT EXISTS idx_full_extraction_sections_scan ON full_extraction_sections(scan_id);
CREATE INDEX IF NOT EXISTS idx_full_extraction_points_section ON full_extraction_points(section_id);

-- Row Level Security
ALTER TABLE full_extraction_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE full_extraction_points ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (our server-side admin client)
DO $$ BEGIN
  CREATE POLICY "service_role_full_extraction_sections" ON full_extraction_sections
    FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_full_extraction_points" ON full_extraction_points
    FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
