-- Canonical API-key ownership uses users.id UUID; Clerk IDs are resolved server-side.
-- This migration upgrades the original Clerk-id TEXT schema without rewriting history.

DROP POLICY IF EXISTS "Users can view own api keys" ON api_keys;
DROP POLICY IF EXISTS "Users can insert own api keys" ON api_keys;
DROP POLICY IF EXISTS "Users can update own api keys" ON api_keys;
DROP POLICY IF EXISTS "Users can delete own api keys" ON api_keys;
DROP POLICY IF EXISTS "Users can view own api usage logs" ON api_usage_logs;

-- Production may already have UUID ownership even when this migration is not in
-- the migration ledger. Only rebuild the column when upgrading a legacy TEXT
-- schema; otherwise validate the canonical UUID ownership in place.
DO $$
DECLARE
  current_user_id_type REGTYPE;
BEGIN
  SELECT a.atttypid::REGTYPE
  INTO current_user_id_type
  FROM pg_attribute a
  WHERE a.attrelid = 'public.api_keys'::REGCLASS
    AND a.attname = 'user_id'
    AND NOT a.attisdropped;

  IF current_user_id_type = 'uuid'::REGTYPE THEN
    IF EXISTS (
      SELECT 1
      FROM public.api_keys k
      LEFT JOIN public.users u ON u.id = k.user_id
      WHERE u.id IS NULL
    ) THEN
      RAISE EXCEPTION 'Cannot reconcile API keys with unresolved UUID owners';
    END IF;

    -- Clean up a helper column left by an interrupted legacy conversion.
    ALTER TABLE public.api_keys DROP COLUMN IF EXISTS owner_user_id;
  ELSIF current_user_id_type IN ('text'::REGTYPE, 'character varying'::REGTYPE) THEN
    ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS owner_user_id UUID;

    UPDATE public.api_keys k
    SET owner_user_id = u.id
    FROM public.users u
    WHERE k.owner_user_id IS NULL
      AND (k.user_id::TEXT = u.clerk_id OR k.user_id::TEXT = u.id::TEXT);

    IF EXISTS (SELECT 1 FROM public.api_keys WHERE owner_user_id IS NULL) THEN
      RAISE EXCEPTION 'Cannot migrate API keys with unresolved owners';
    END IF;

    DROP INDEX IF EXISTS public.idx_api_keys_user;
    ALTER TABLE public.api_keys DROP COLUMN user_id;
    ALTER TABLE public.api_keys RENAME COLUMN owner_user_id TO user_id;
  ELSE
    RAISE EXCEPTION 'Unsupported api_keys.user_id type: %', current_user_id_type;
  END IF;
END $$;

ALTER TABLE public.api_keys ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_user_id_fkey;
ALTER TABLE public.api_keys
  ADD CONSTRAINT api_keys_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON public.api_keys(user_id);

ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_scopes_allowed;
ALTER TABLE public.api_keys
  ADD CONSTRAINT api_keys_scopes_allowed
  CHECK (scopes <@ ARRAY['extract', 'analyze']::TEXT[]);

DO $$
DECLARE
  current_user_id_type REGTYPE;
BEGIN
  SELECT a.atttypid::REGTYPE
  INTO current_user_id_type
  FROM pg_attribute a
  WHERE a.attrelid = 'public.api_usage_logs'::REGCLASS
    AND a.attname = 'user_id'
    AND NOT a.attisdropped;

  IF current_user_id_type = 'uuid'::REGTYPE THEN
    IF EXISTS (
      SELECT 1
      FROM public.api_usage_logs l
      LEFT JOIN public.users u ON u.id = l.user_id
      WHERE u.id IS NULL
    ) THEN
      RAISE EXCEPTION 'Cannot reconcile API usage logs with unresolved UUID owners';
    END IF;

    ALTER TABLE public.api_usage_logs DROP COLUMN IF EXISTS owner_user_id;
  ELSIF current_user_id_type IN ('text'::REGTYPE, 'character varying'::REGTYPE) THEN
    ALTER TABLE public.api_usage_logs ADD COLUMN IF NOT EXISTS owner_user_id UUID;

    UPDATE public.api_usage_logs l
    SET owner_user_id = k.user_id
    FROM public.api_keys k
    WHERE l.api_key_id = k.id AND l.owner_user_id IS NULL;

    IF EXISTS (SELECT 1 FROM public.api_usage_logs WHERE owner_user_id IS NULL) THEN
      RAISE EXCEPTION 'Cannot migrate API usage logs with unresolved owners';
    END IF;

    DROP INDEX IF EXISTS public.idx_api_usage_user_date;
    ALTER TABLE public.api_usage_logs DROP COLUMN user_id;
    ALTER TABLE public.api_usage_logs RENAME COLUMN owner_user_id TO user_id;
  ELSE
    RAISE EXCEPTION 'Unsupported api_usage_logs.user_id type: %', current_user_id_type;
  END IF;
END $$;

ALTER TABLE public.api_usage_logs ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.api_usage_logs DROP CONSTRAINT IF EXISTS api_usage_logs_user_id_fkey;
ALTER TABLE public.api_usage_logs
  ADD CONSTRAINT api_usage_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE api_usage_logs ADD COLUMN IF NOT EXISTS message TEXT;
CREATE INDEX IF NOT EXISTS idx_api_usage_user_date
  ON public.api_usage_logs(user_id, created_at DESC);

DROP INDEX IF EXISTS idx_api_keys_hash;
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash) WHERE is_active = true;

CREATE OR REPLACE FUNCTION record_api_key_usage(
  p_api_key_id UUID,
  p_endpoint TEXT,
  p_status_code INT,
  p_response_time_ms INT,
  p_message TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  UPDATE api_keys
  SET request_count = request_count + 1,
      last_used_at = NOW(),
      updated_at = NOW()
  WHERE id = p_api_key_id AND is_active = true
  RETURNING user_id INTO v_user_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'API key is inactive or missing';
  END IF;

  INSERT INTO api_usage_logs (
    api_key_id, user_id, endpoint, status_code, response_time_ms, message
  ) VALUES (
    p_api_key_id, v_user_id, p_endpoint, p_status_code, p_response_time_ms, p_message
  );
END;
$$;

REVOKE ALL ON FUNCTION record_api_key_usage(UUID, TEXT, INT, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_api_key_usage(UUID, TEXT, INT, INT, TEXT) TO service_role;

CREATE POLICY "Users can view own api keys"
  ON api_keys FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = api_keys.user_id AND u.clerk_id = auth.jwt()->>'sub'
  ));
CREATE POLICY "Users can view own api usage logs"
  ON api_usage_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = api_usage_logs.user_id AND u.clerk_id = auth.jwt()->>'sub'
  ));
