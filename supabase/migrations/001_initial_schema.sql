-- Themys (ToS Scanner) — Initial Database Schema
-- Supabase Migration: 001_initial_schema
-- Run this in the Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
--
-- 7 tables: users, scans, clauses, blocklist_items, tos_cache, explanations_cache, credit_packs
-- All tables use UUID primary keys, RLS enabled, created_at/updated_at timestamps

-- ============================================================
-- 1. USERS
-- Synced from Clerk auth. Plan: free | base | advanced | lifetime
-- ============================================================
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id    TEXT UNIQUE NOT NULL,           -- Clerk user ID (e.g. user_xxxxx)
  email       TEXT NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'free'    -- free | base | advanced | lifetime
              CHECK (plan IN ('free', 'base', 'advanced', 'lifetime')),
  stripe_customer_id TEXT,                    -- Stripe customer ID (cus_xxxxx)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_clerk_id ON users(clerk_id);
CREATE INDEX idx_users_stripe ON users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- ============================================================
-- 2. SCANS
-- One row per ToS scan. Links to user and cached text.
-- ============================================================
CREATE TABLE scans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url           TEXT,                          -- Original URL scanned
  domain        TEXT,                          -- Extracted domain (e.g. "google.com")
  title         TEXT,                          -- Page title or auto-detected name
  risk_score    NUMERIC(3,1),                  -- Aggregated risk score 1.0-10.0
  clause_count  INTEGER DEFAULT 0,             -- Total clauses found
  flagged_count INTEGER DEFAULT 0,             -- Clauses that matched blocklist
  raw_text_hash TEXT,                          -- SHA256 of extracted text (for L2 cache)
  source        TEXT DEFAULT 'web'             -- web | extension | paste
                CHECK (source IN ('web', 'extension', 'paste')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scans_user ON scans(user_id, created_at DESC);
CREATE INDEX idx_scans_domain ON scans(domain);
CREATE INDEX idx_scans_text_hash ON scans(raw_text_hash) WHERE raw_text_hash IS NOT NULL;

-- ============================================================
-- 3. CLAUSES
-- Individual clauses extracted from a scan. Each has a risk score.
-- ============================================================
CREATE TABLE clauses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id         UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  text            TEXT NOT NULL,               -- The actual clause text
  category        TEXT,                        -- e.g. "data_sharing", "arbitration", "auto_renewal"
  risk_score      NUMERIC(3,1),                -- Individual clause risk 1.0-10.0
  risk_level      TEXT                         -- green | yellow | red
                  CHECK (risk_level IN ('green', 'yellow', 'red')),
  position        INTEGER,                     -- Position in the original document
  is_flagged      BOOLEAN DEFAULT false,       -- Matched user's blocklist
  is_ai_explained BOOLEAN DEFAULT false,       -- Explanation was LLM-generated
  explanation     TEXT,                        -- Plain English explanation
  why_it_matters  TEXT,                        -- Why the user should care
  confidence      NUMERIC(3,2),                -- Classification confidence 0.00-1.00
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clauses_scan ON clauses(scan_id, position);
CREATE INDEX idx_clauses_category ON clauses(category);
CREATE INDEX idx_clauses_flagged ON clauses(scan_id) WHERE is_flagged = true;

-- ============================================================
-- 4. BLOCKLIST_ITEMS
-- User's red-flag keywords. Mix of defaults + custom.
-- ============================================================
CREATE TABLE blocklist_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  keyword    TEXT NOT NULL,                    -- The keyword or phrase to flag
  category   TEXT,                             -- Maps to clause category
  is_custom  BOOLEAN DEFAULT false,            -- true = user added, false = system default
  is_active  BOOLEAN DEFAULT true,             -- User can toggle items on/off
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, keyword)                     -- No duplicate keywords per user
);

CREATE INDEX idx_blocklist_user ON blocklist_items(user_id) WHERE is_active = true;

-- ============================================================
-- 5. TOS_CACHE (L1 Cache)
-- Caches extracted ToS text by URL hash. TTL: 7 days.
-- ============================================================
CREATE TABLE tos_cache (
  url_hash       TEXT PRIMARY KEY,             -- SHA256(url)
  url            TEXT NOT NULL,
  domain         TEXT NOT NULL,
  extracted_text TEXT NOT NULL,                -- Clean extracted ToS text
  word_count     INTEGER,                      -- Length of extracted text
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tos_cache_domain ON tos_cache(domain);
CREATE INDEX idx_tos_cache_expires ON tos_cache(expires_at);

-- ============================================================
-- 6. EXPLANATIONS_CACHE (L3 Cache)
-- Caches LLM-generated explanations by clause hash. TTL: 30 days.
-- ============================================================
CREATE TABLE explanations_cache (
  clause_hash   TEXT PRIMARY KEY,              -- SHA256(clause_text + category)
  category      TEXT NOT NULL,
  explanation   TEXT NOT NULL,                 -- Plain English explanation
  why_it_matters TEXT,                         -- Why the user should care
  model         TEXT,                          -- Which LLM generated it (e.g. "gpt-4o-mini")
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_explanations_cache_category ON explanations_cache(category);
CREATE INDEX idx_explanations_cache_expires ON explanations_cache(expires_at);

-- ============================================================
-- 7. CREDIT_PACKS
-- Tracks credit purchases and consumption.
-- 1 credit = 1 AI explanation or 1 extra scan beyond plan limits.
-- Credits roll over for 12 months from purchase.
-- ============================================================
CREATE TABLE credit_packs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pack_size         INTEGER NOT NULL,          -- Original pack size (10, 50, 200)
  credits_remaining INTEGER NOT NULL,           -- Decremented on use
  price_paid        NUMERIC(6,2) NOT NULL,     -- Amount charged (1.99, 7.99, 24.99)
  stripe_payment_id TEXT,                       -- Stripe payment intent or charge ID
  purchased_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '12 months')
);

CREATE INDEX idx_credit_packs_user ON credit_packs(user_id, credits_remaining)
  WHERE credits_remaining > 0;
CREATE INDEX idx_credit_packs_expires ON credit_packs(expires_at);

-- ============================================================
-- HELPER VIEWS
-- ============================================================

-- User's total available credits (sum of all non-expired pack remainders)
CREATE VIEW user_credit_balance AS
SELECT
  user_id,
  COALESCE(SUM(credits_remaining), 0) AS total_credits
FROM credit_packs
WHERE credits_remaining > 0
  AND expires_at > now()
GROUP BY user_id;

-- Recent scans with clause counts (for dashboard)
CREATE VIEW recent_scans AS
SELECT
  s.id,
  s.user_id,
  s.url,
  s.domain,
  s.title,
  s.risk_score,
  s.clause_count,
  s.flagged_count,
  s.source,
  s.created_at
FROM scans s
ORDER BY s.created_at DESC;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Users can only access their own data.
-- Service role bypasses RLS (for backend API routes).
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE clauses ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tos_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE explanations_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_packs ENABLE ROW LEVEL SECURITY;

-- Users: can read/update own profile
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (clerk_id = auth.jwt()->>'sub');

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (clerk_id = auth.jwt()->>'sub');

-- Scans: CRUD own scans
CREATE POLICY "Users can view own scans"
  ON scans FOR SELECT
  USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.jwt()->>'sub'));

CREATE POLICY "Users can create own scans"
  ON scans FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM users WHERE clerk_id = auth.jwt()->>'sub'));

CREATE POLICY "Users can delete own scans"
  ON scans FOR DELETE
  USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.jwt()->>'sub'));

-- Clauses: read own clauses (created/deleted via cascade from scans)
CREATE POLICY "Users can view own clauses"
  ON clauses FOR SELECT
  USING (scan_id IN (
    SELECT id FROM scans WHERE user_id IN (
      SELECT id FROM users WHERE clerk_id = auth.jwt()->>'sub'
    )
  ));

-- Blocklist: full CRUD own items
CREATE POLICY "Users can manage own blocklist"
  ON blocklist_items FOR ALL
  USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.jwt()->>'sub'));

-- TOS cache: shared read (any authenticated user), write via service role only
CREATE POLICY "Authenticated users can read tos_cache"
  ON tos_cache FOR SELECT
  USING (auth.role() = 'authenticated');

-- Explanations cache: shared read, write via service role only
CREATE POLICY "Authenticated users can read explanations_cache"
  ON explanations_cache FOR SELECT
  USING (auth.role() = 'authenticated');

-- Credit packs: users can view own packs, insert via service role (Stripe webhook)
CREATE POLICY "Users can view own credit packs"
  ON credit_packs FOR SELECT
  USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.jwt()->>'sub'));

-- ============================================================
-- UPDATED_AT TRIGGER
-- Auto-update updated_at on users table
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tos_cache_updated_at
  BEFORE UPDATE ON tos_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- AUTO-CREATE USER PROFILE ON CLERK AUTH
-- This trigger fires when a new JWT is detected.
-- In practice, you'll create the user row from your API route
-- after Clerk signup, but this is a safety net.
-- ============================================================

-- Note: Supabase doesn't natively sync with Clerk.
-- User creation should happen in your Next.js API route:
--   POST /api/auth/sync-user (called after Clerk signup/signin)
--   → upsert into users table with clerk_id, email from Clerk session
--
-- The RLS policies above use auth.jwt()->>'sub' which maps to
-- the Clerk user ID when using Clerk's Supabase integration.

-- ============================================================
-- SEED: Default blocklist categories
-- These are inserted per-user during onboarding, not globally.
-- Listed here for reference:
-- ============================================================
-- 1. data_sharing     — "Data sharing with third parties"
-- 2. arbitration      — "Mandatory arbitration"
-- 3. auto_renewal     — "Auto-renewal without notice"
-- 4. content_license  — "Broad license to user content"
-- 5. no_opt_out       — "No opt-out for data collection"
-- 6. class_waiver     — "Waiver of class action rights"
-- 7. termination      — "Account termination without cause"
-- 8. location_tracking — "Location tracking"
-- 9. biometric        — "Biometric data collection"
