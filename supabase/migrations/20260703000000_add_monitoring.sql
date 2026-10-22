-- Themys (ToS Scanner) — ToS Change Monitoring
-- Supabase Migration: DVL-63
-- 3 new tables: monitoring_subscriptions, tos_snapshots, monitoring_alerts
-- + 2 new columns on existing scans table

-- ============================================================
-- 1. MONITORING_SUBSCRIPTIONS
-- User subscriptions to monitor a URL for ToS changes
-- ============================================================
CREATE TABLE monitoring_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  domain          TEXT NOT NULL,
  title           TEXT,
  frequency       TEXT NOT NULL DEFAULT 'weekly'
                  CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  last_changed_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, url)
);

-- Active subscriptions by user
CREATE INDEX idx_monitoring_subscriptions_user_active
  ON monitoring_subscriptions(user_id) WHERE is_active = true;

-- Lookups by domain for the monitoring scheduler
CREATE INDEX idx_monitoring_subscriptions_domain
  ON monitoring_subscriptions(domain);

-- Scheduler query: find subscriptions due for checking
CREATE INDEX idx_monitoring_subscriptions_check_due
  ON monitoring_subscriptions(last_checked_at, frequency) WHERE is_active = true;

-- ============================================================
-- 2. TOS_SNAPSHOTS
-- Point-in-time snapshots of ToS text hashes and analysis metadata
-- ============================================================
CREATE TABLE tos_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url             TEXT NOT NULL,
  domain          TEXT NOT NULL,
  text_hash       TEXT NOT NULL,
  word_count      INTEGER,
  risk_score      NUMERIC(3,1),
  flagged_count   INTEGER DEFAULT 0,
  clause_count    INTEGER DEFAULT 0,
  categories_json JSONB,
  scan_id         UUID REFERENCES scans(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Look up recent snapshots by domain
CREATE INDEX idx_tos_snapshots_domain_created
  ON tos_snapshots(domain, created_at DESC);

-- Detect duplicate content
CREATE INDEX idx_tos_snapshots_text_hash
  ON tos_snapshots(text_hash);

-- Look up snapshots by URL, newest first
CREATE INDEX idx_tos_snapshots_url_created
  ON tos_snapshots(url, created_at DESC);

-- ============================================================
-- 3. MONITORING_ALERTS
-- Alerts generated when a monitored URL's ToS changes
-- ============================================================
CREATE TABLE monitoring_alerts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  UUID NOT NULL REFERENCES monitoring_subscriptions(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_snapshot_id  UUID REFERENCES tos_snapshots(id),
  new_snapshot_id  UUID NOT NULL REFERENCES tos_snapshots(id),
  change_type      TEXT NOT NULL DEFAULT 'text_change'
                   CHECK (change_type IN ('text_change', 'risk_increase', 'new_flags', 'all')),
  risk_delta       NUMERIC(4,1),
  summary          TEXT,
  is_read          BOOLEAN NOT NULL DEFAULT false,
  is_email_sent    BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User's alert feed, unread first
CREATE INDEX idx_monitoring_alerts_user_read
  ON monitoring_alerts(user_id, is_read, created_at DESC);

-- Alerts by subscription
CREATE INDEX idx_monitoring_alerts_subscription
  ON monitoring_alerts(subscription_id, created_at DESC);

-- ============================================================
-- 4. ALTER EXISTING SCANS TABLE
-- Add columns to support monitoring-driven scans
-- ============================================================
ALTER TABLE scans ADD COLUMN is_monitoring_scan BOOLEAN DEFAULT false;
ALTER TABLE scans ADD COLUMN previous_scan_id UUID REFERENCES scans(id);

-- ============================================================
-- 5. RLS POLICIES
-- ============================================================

-- monitoring_subscriptions: users manage their own
ALTER TABLE monitoring_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own monitoring subscriptions"
    ON monitoring_subscriptions FOR SELECT
    USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.jwt()->>'sub'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own monitoring subscriptions"
    ON monitoring_subscriptions FOR INSERT
    WITH CHECK (user_id IN (SELECT id FROM users WHERE clerk_id = auth.jwt()->>'sub'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own monitoring subscriptions"
    ON monitoring_subscriptions FOR UPDATE
    USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.jwt()->>'sub'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own monitoring subscriptions"
    ON monitoring_subscriptions FOR DELETE
    USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.jwt()->>'sub'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- tos_snapshots: authenticated read (shared data), write via service role only
ALTER TABLE tos_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can read tos_snapshots"
    ON tos_snapshots FOR SELECT
    USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- monitoring_alerts: users read and update own alerts
ALTER TABLE monitoring_alerts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own monitoring alerts"
    ON monitoring_alerts FOR SELECT
    USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.jwt()->>'sub'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own monitoring alerts"
    ON monitoring_alerts FOR UPDATE
    USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.jwt()->>'sub'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 6. UPDATED_AT TRIGGER FOR monitoring_subscriptions
-- ============================================================

CREATE TRIGGER monitoring_subscriptions_updated_at
  BEFORE UPDATE ON monitoring_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
