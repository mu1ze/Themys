-- A refunded reservation represents a failed attempt, not a completed replay.
-- Reusing its idempotency key must reserve quota again before retrying work.
CREATE OR REPLACE FUNCTION reserve_usage_slots(
  p_bucket_key TEXT,
  p_limit INTEGER,
  p_window_end TIMESTAMPTZ,
  p_amount INTEGER DEFAULT 1,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS TABLE(
  allowed BOOLEAN,
  current_count INTEGER,
  reservation_id UUID,
  is_replay BOOLEAN
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_reservation usage_reservations%ROWTYPE;
BEGIN
  IF p_limit < 1 OR p_amount < 1 OR p_amount > p_limit THEN
    RAISE EXCEPTION 'Invalid usage reservation';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_bucket_key, 0));

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_reservation
      FROM usage_reservations
      WHERE bucket_key = p_bucket_key
        AND idempotency_key = p_idempotency_key
      FOR UPDATE;
    IF FOUND AND v_reservation.status IN ('reserved', 'committed') THEN
      SELECT COALESCE(request_count, 0) INTO v_count
        FROM api_rate_limits WHERE bucket_key = p_bucket_key;
      RETURN QUERY SELECT TRUE, COALESCE(v_count, 0), v_reservation.id, TRUE;
      RETURN;
    END IF;
  END IF;

  SELECT COALESCE(request_count, 0) INTO v_count
    FROM api_rate_limits WHERE bucket_key = p_bucket_key;
  v_count := COALESCE(v_count, 0);
  IF v_count + p_amount > p_limit THEN
    RETURN QUERY SELECT FALSE, v_count, NULL::UUID, FALSE;
    RETURN;
  END IF;

  INSERT INTO api_rate_limits (bucket_key, request_count, window_end)
  VALUES (p_bucket_key, p_amount, p_window_end)
  ON CONFLICT (bucket_key) DO UPDATE
    SET request_count = api_rate_limits.request_count + p_amount,
        window_end = EXCLUDED.window_end,
        updated_at = NOW()
  RETURNING request_count INTO v_count;

  IF v_reservation.id IS NOT NULL AND v_reservation.status = 'refunded' THEN
    UPDATE usage_reservations
      SET status = 'reserved',
          amount = p_amount,
          window_end = p_window_end,
          settled_at = NULL
      WHERE id = v_reservation.id;
  ELSE
    INSERT INTO usage_reservations (bucket_key, idempotency_key, amount, window_end)
    VALUES (p_bucket_key, p_idempotency_key, p_amount, p_window_end)
    RETURNING id INTO v_reservation.id;
  END IF;

  RETURN QUERY SELECT TRUE, v_count, v_reservation.id, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION reserve_usage_slots(TEXT, INTEGER, TIMESTAMPTZ, INTEGER, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reserve_usage_slots(TEXT, INTEGER, TIMESTAMPTZ, INTEGER, TEXT)
  TO service_role;
