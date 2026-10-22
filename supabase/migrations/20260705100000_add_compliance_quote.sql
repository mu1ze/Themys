-- DVL-65: Add quote column to clause_compliance_tags
-- Stores the verbatim text that violates or potentially violates a regulation.

ALTER TABLE clause_compliance_tags ADD COLUMN IF NOT EXISTS quote TEXT;
