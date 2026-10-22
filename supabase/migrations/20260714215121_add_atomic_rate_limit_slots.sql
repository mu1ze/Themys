DROP FUNCTION IF EXISTS consume_api_rate_limit(TEXT, INTEGER, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION consume_api_rate_limit_slots(
  p_bucket_key TEXT,
  p_limit INTEGER,
  p_window_end TIMESTAMPTZ,
  p_amount INTEGER DEFAULT 1
) RETURNS TABLE(allowed BOOLEAN, current_count INTEGER)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_limit < 1 OR p_amount < 1 OR p_amount > p_limit THEN
    RAISE EXCEPTION 'Invalid rate-limit reservation';
  END IF;

  INSERT INTO api_rate_limits (bucket_key, request_count, window_end)
  VALUES (p_bucket_key, p_amount, p_window_end)
  ON CONFLICT (bucket_key) DO UPDATE
    SET request_count = api_rate_limits.request_count + p_amount,
        window_end = EXCLUDED.window_end,
        updated_at = NOW()
    WHERE api_rate_limits.request_count + p_amount <= p_limit
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

CREATE OR REPLACE FUNCTION refund_api_rate_limit_slots(
  p_bucket_key TEXT,
  p_amount INTEGER
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_amount < 1 THEN
    RAISE EXCEPTION 'Refund amount must be positive';
  END IF;
  UPDATE api_rate_limits
  SET request_count = GREATEST(0, request_count - p_amount),
      updated_at = NOW()
  WHERE bucket_key = p_bucket_key
  RETURNING request_count INTO v_count;
  RETURN COALESCE(v_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION consume_api_rate_limit_slots(TEXT, INTEGER, TIMESTAMPTZ, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION refund_api_rate_limit_slots(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION consume_api_rate_limit_slots(TEXT, INTEGER, TIMESTAMPTZ, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION refund_api_rate_limit_slots(TEXT, INTEGER) TO service_role;
