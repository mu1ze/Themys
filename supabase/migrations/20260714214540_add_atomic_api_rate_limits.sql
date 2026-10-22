-- Atomic quota counters replace Cloudflare KV read-then-write bookkeeping.
CREATE TABLE IF NOT EXISTS api_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  window_end TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_window_end ON api_rate_limits(window_end);
ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON api_rate_limits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION consume_api_rate_limit(
  p_bucket_key TEXT,
  p_limit INTEGER,
  p_window_end TIMESTAMPTZ
) RETURNS TABLE(allowed BOOLEAN, current_count INTEGER)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_limit < 1 THEN
    RAISE EXCEPTION 'Rate limit must be positive';
  END IF;

  INSERT INTO api_rate_limits (bucket_key, request_count, window_end)
  VALUES (p_bucket_key, 1, p_window_end)
  ON CONFLICT (bucket_key) DO UPDATE
    SET request_count = api_rate_limits.request_count + 1,
        window_end = EXCLUDED.window_end,
        updated_at = NOW()
    WHERE api_rate_limits.request_count < p_limit
  RETURNING request_count INTO v_count;

  IF v_count IS NULL THEN
    SELECT r.request_count INTO v_count
    FROM api_rate_limits r
    WHERE r.bucket_key = p_bucket_key;
    RETURN QUERY SELECT FALSE, COALESCE(v_count, p_limit);
    RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, v_count;
END;
$$;

CREATE OR REPLACE FUNCTION get_api_rate_limit_status(p_bucket_key TEXT)
RETURNS TABLE(current_count INTEGER)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT request_count FROM api_rate_limits WHERE bucket_key = p_bucket_key),
    0
  )::INTEGER;
$$;

REVOKE ALL ON FUNCTION consume_api_rate_limit(TEXT, INTEGER, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_api_rate_limit_status(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION consume_api_rate_limit(TEXT, INTEGER, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION get_api_rate_limit_status(TEXT) TO service_role;
