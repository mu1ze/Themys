-- Keep the two most frequent authenticated list queries on index-only paths.
CREATE INDEX IF NOT EXISTS idx_scans_active_user_created
  ON public.scans (user_id, created_at DESC)
  WHERE is_deleted = false;
