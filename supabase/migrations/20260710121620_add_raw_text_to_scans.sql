-- Add raw_text to scans table to support the Side-by-Side view

ALTER TABLE scans ADD COLUMN raw_text TEXT;

-- Drop and recreate the recent_scans view to include raw_text if needed, but it's probably better to keep recent_scans lightweight.
-- Wait, we should not include raw_text in recent_scans view as it's large and only needed for the single scan view.
