-- Deterministic, auditable usage accounting for DVL-79 and atomic monitor
-- limits for DVL-77. All functions are callable only by service_role.

CREATE TABLE IF NOT EXISTS usage_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_key TEXT NOT NULL,
  idempotency_key TEXT,
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'committed', 'refunded')),
  window_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ,
  UNIQUE (bucket_key, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_usage_reservations_created_at
  ON usage_reservations(created_at);
ALTER TABLE usage_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON usage_reservations FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS credit_usage_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credit_pack_id UUID NOT NULL REFERENCES credit_packs(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('scan_overflow', 'ai_overflow')),
  status TEXT NOT NULL DEFAULT 'consumed' CHECK (status IN ('consumed', 'refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_credit_usage_reservations_user_created
  ON credit_usage_reservations(user_id, created_at DESC);
ALTER TABLE credit_usage_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON credit_usage_reservations FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_hash TEXT NOT NULL,
  client_type TEXT NOT NULL CHECK (client_type IN ('web', 'extension', 'api_key', 'cron')),
  operation TEXT NOT NULL,
  outcome TEXT NOT NULL,
  cached BOOLEAN NOT NULL DEFAULT FALSE,
  scan_slots INTEGER NOT NULL DEFAULT 0,
  ai_slots INTEGER NOT NULL DEFAULT 0,
  credits INTEGER NOT NULL DEFAULT 0,
  idempotency_key_hash TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON usage_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_actor_created ON usage_events(actor_hash, created_at DESC);
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON usage_events FROM anon, authenticated;

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
        AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
      SELECT COALESCE(request_count, 0) INTO v_count
        FROM api_rate_limits WHERE bucket_key = p_bucket_key;
      RETURN QUERY SELECT TRUE, COALESCE(v_count, 0), v_reservation.id, TRUE;
      RETURN;
    END IF;
  END IF;

  SELECT COALESCE(request_count, 0) INTO v_count
    FROM api_rate_limits WHERE bucket_key = p_bucket_key;
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

  INSERT INTO usage_reservations (bucket_key, idempotency_key, amount, window_end)
  VALUES (p_bucket_key, p_idempotency_key, p_amount, p_window_end)
  RETURNING id INTO v_reservation.id;

  RETURN QUERY SELECT TRUE, v_count, v_reservation.id, FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION settle_usage_reservation(
  p_reservation_id UUID,
  p_commit BOOLEAN
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_reservation usage_reservations%ROWTYPE;
  v_count INTEGER;
BEGIN
  SELECT * INTO v_reservation FROM usage_reservations
    WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usage reservation not found';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_reservation.bucket_key, 0));

  IF v_reservation.status <> 'reserved' THEN
    SELECT COALESCE(request_count, 0) INTO v_count
      FROM api_rate_limits WHERE bucket_key = v_reservation.bucket_key;
    RETURN COALESCE(v_count, 0);
  END IF;

  IF p_commit THEN
    UPDATE usage_reservations
      SET status = 'committed', settled_at = NOW()
      WHERE id = p_reservation_id;
  ELSE
    UPDATE api_rate_limits
      SET request_count = GREATEST(0, request_count - v_reservation.amount),
          updated_at = NOW()
      WHERE bucket_key = v_reservation.bucket_key
      RETURNING request_count INTO v_count;
    UPDATE usage_reservations
      SET status = 'refunded', settled_at = NOW()
      WHERE id = p_reservation_id;
  END IF;

  IF v_count IS NULL THEN
    SELECT COALESCE(request_count, 0) INTO v_count
      FROM api_rate_limits WHERE bucket_key = v_reservation.bucket_key;
  END IF;
  RETURN COALESCE(v_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION consume_user_credit(
  p_clerk_id TEXT,
  p_idempotency_key TEXT,
  p_purpose TEXT
) RETURNS TABLE(consumed BOOLEAN, remaining INTEGER, is_replay BOOLEAN)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_pack_id UUID;
  v_remaining INTEGER;
BEGIN
  IF p_purpose NOT IN ('scan_overflow', 'ai_overflow') THEN
    RAISE EXCEPTION 'Invalid credit purpose';
  END IF;
  SELECT id INTO v_user_id FROM users WHERE clerk_id = p_clerk_id;
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, FALSE;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::TEXT, 0));
  IF EXISTS (
    SELECT 1 FROM credit_usage_reservations
    WHERE user_id = v_user_id AND idempotency_key = p_idempotency_key
  ) THEN
    SELECT COALESCE(SUM(credits_remaining), 0)::INTEGER INTO v_remaining
      FROM credit_packs
      WHERE user_id = v_user_id AND credits_remaining > 0 AND expires_at > NOW();
    RETURN QUERY SELECT EXISTS (
      SELECT 1 FROM credit_usage_reservations
      WHERE user_id = v_user_id
        AND idempotency_key = p_idempotency_key
        AND status = 'consumed'
    ), v_remaining, TRUE;
    RETURN;
  END IF;

  SELECT id INTO v_pack_id FROM credit_packs
    WHERE user_id = v_user_id AND credits_remaining > 0 AND expires_at > NOW()
    ORDER BY purchased_at ASC
    LIMIT 1 FOR UPDATE;
  IF v_pack_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, FALSE;
    RETURN;
  END IF;

  UPDATE credit_packs SET credits_remaining = credits_remaining - 1
    WHERE id = v_pack_id;
  INSERT INTO credit_usage_reservations (user_id, credit_pack_id, idempotency_key, purpose)
    VALUES (v_user_id, v_pack_id, p_idempotency_key, p_purpose);
  SELECT COALESCE(SUM(credits_remaining), 0)::INTEGER INTO v_remaining
    FROM credit_packs
    WHERE user_id = v_user_id AND credits_remaining > 0 AND expires_at > NOW();
  RETURN QUERY SELECT TRUE, v_remaining, FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION refund_user_credit(
  p_clerk_id TEXT,
  p_idempotency_key TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_reservation credit_usage_reservations%ROWTYPE;
BEGIN
  SELECT id INTO v_user_id FROM users WHERE clerk_id = p_clerk_id;
  IF v_user_id IS NULL THEN RETURN FALSE; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::TEXT, 0));
  SELECT * INTO v_reservation FROM credit_usage_reservations
    WHERE user_id = v_user_id AND idempotency_key = p_idempotency_key
    FOR UPDATE;
  IF NOT FOUND OR v_reservation.status <> 'consumed' THEN RETURN FALSE; END IF;
  UPDATE credit_packs SET credits_remaining = credits_remaining + 1
    WHERE id = v_reservation.credit_pack_id;
  UPDATE credit_usage_reservations SET status = 'refunded'
    WHERE id = v_reservation.id;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION subscribe_monitoring_with_limit(
  p_user_id UUID,
  p_url TEXT,
  p_domain TEXT,
  p_title TEXT,
  p_frequency TEXT,
  p_limit INTEGER
) RETURNS monitoring_subscriptions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_existing monitoring_subscriptions%ROWTYPE;
  v_result monitoring_subscriptions%ROWTYPE;
  v_count INTEGER;
BEGIN
  IF p_limit < 1 OR p_frequency NOT IN ('daily', 'weekly', 'monthly') THEN
    RAISE EXCEPTION 'Invalid monitoring subscription parameters';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::TEXT, 0));
  SELECT * INTO v_existing FROM monitoring_subscriptions
    WHERE user_id = p_user_id AND url = p_url;
  IF NOT FOUND THEN
    SELECT COUNT(*)::INTEGER INTO v_count FROM monitoring_subscriptions
      WHERE user_id = p_user_id AND is_active = TRUE;
    IF v_count >= p_limit THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'monitor_limit_reached';
    END IF;
  END IF;

  INSERT INTO monitoring_subscriptions (user_id, url, domain, title, frequency, is_active)
  VALUES (p_user_id, p_url, p_domain, p_title, p_frequency, TRUE)
  ON CONFLICT (user_id, url) DO UPDATE
    SET domain = EXCLUDED.domain,
        title = EXCLUDED.title,
        frequency = EXCLUDED.frequency,
        is_active = TRUE
  RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION reserve_usage_slots(TEXT, INTEGER, TIMESTAMPTZ, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION settle_usage_reservation(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION consume_user_credit(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION refund_user_credit(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION subscribe_monitoring_with_limit(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reserve_usage_slots(TEXT, INTEGER, TIMESTAMPTZ, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION settle_usage_reservation(UUID, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION consume_user_credit(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION refund_user_credit(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION subscribe_monitoring_with_limit(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER) TO service_role;
