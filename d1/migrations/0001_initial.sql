PRAGMA defer_foreign_keys = true;

CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  clerk_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'base', 'advanced', 'lifetime')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT
    CHECK (subscription_status IS NULL OR subscription_status IN ('active', 'canceling', 'canceled', 'past_due', 'trialing', 'incomplete')),
  subscription_ends_at TEXT,
  country TEXT,
  state TEXT,
  target_clauses TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(target_clauses)),
  strict_mode INTEGER NOT NULL DEFAULT 0 CHECK (strict_mode IN (0, 1)),
  playbook_id TEXT NOT NULL DEFAULT 'consumer_app'
    CHECK (playbook_id IN ('consumer_app', 'saas_vendor', 'contractor')),
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  landing_page TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_users_clerk_id ON users(clerk_id);
CREATE INDEX idx_users_stripe ON users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_users_subscription ON users(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

CREATE TABLE scans (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT,
  domain TEXT,
  title TEXT,
  jurisdiction_country TEXT,
  jurisdiction_state TEXT,
  risk_score REAL,
  clause_count INTEGER NOT NULL DEFAULT 0,
  flagged_count INTEGER NOT NULL DEFAULT 0,
  raw_text_hash TEXT,
  raw_text TEXT,
  document_object_key TEXT,
  source TEXT NOT NULL DEFAULT 'web'
    CHECK (source IN ('web', 'extension', 'paste', 'upload')),
  decision TEXT NOT NULL DEFAULT 'open'
    CHECK (decision IN ('open', 'sign', 'negotiate', 'walk_away')),
  is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  is_monitoring_scan INTEGER NOT NULL DEFAULT 0 CHECK (is_monitoring_scan IN (0, 1)),
  previous_scan_id TEXT REFERENCES scans(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL DEFAULT 'unknown'
    CHECK (document_type IN (
      'terms_of_service', 'terms_of_use', 'terms_and_conditions',
      'privacy_policy', 'acceptable_use_policy', 'cookie_policy',
      'eula', 'other', 'unknown'
    )),
  document_type_confidence REAL
    CHECK (document_type_confidence IS NULL OR document_type_confidence BETWEEN 0 AND 1),
  document_type_source TEXT,
  document_type_evidence TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(document_type_evidence)),
  document_identity_key TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_scans_user ON scans(user_id, created_at DESC);
CREATE INDEX idx_scans_domain ON scans(domain);
CREATE INDEX idx_scans_text_hash ON scans(raw_text_hash) WHERE raw_text_hash IS NOT NULL;
CREATE INDEX idx_scans_user_active_created ON scans(user_id, created_at DESC) WHERE is_deleted = 0;
CREATE INDEX idx_scans_user_domain_active_created ON scans(user_id, domain, created_at DESC) WHERE is_deleted = 0;
CREATE INDEX idx_scans_user_document_identity_created ON scans(user_id, document_identity_key, created_at DESC)
  WHERE is_deleted = 0 AND document_identity_key IS NOT NULL;
CREATE INDEX idx_scans_user_decision ON scans(user_id, decision) WHERE decision = 'open';

CREATE TABLE clauses (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  scan_id TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  category TEXT,
  risk_score REAL,
  risk_level TEXT CHECK (risk_level IS NULL OR risk_level IN ('green', 'yellow', 'red')),
  position INTEGER,
  is_flagged INTEGER NOT NULL DEFAULT 0 CHECK (is_flagged IN (0, 1)),
  is_ai_explained INTEGER NOT NULL DEFAULT 0 CHECK (is_ai_explained IN (0, 1)),
  is_standard_practice INTEGER NOT NULL DEFAULT 0 CHECK (is_standard_practice IN (0, 1)),
  is_target_clause INTEGER NOT NULL DEFAULT 0 CHECK (is_target_clause IN (0, 1)),
  explanation TEXT,
  why_it_matters TEXT,
  recommended_action TEXT,
  confidence REAL CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_clauses_scan ON clauses(scan_id, position);
CREATE INDEX idx_clauses_category ON clauses(category);
CREATE INDEX idx_clauses_flagged ON clauses(scan_id) WHERE is_flagged = 1;

CREATE TABLE blocklist_items (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  category TEXT,
  is_custom INTEGER NOT NULL DEFAULT 0 CHECK (is_custom IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(user_id, keyword)
);

CREATE INDEX idx_blocklist_user ON blocklist_items(user_id) WHERE is_active = 1;

CREATE TABLE tos_cache (
  url_hash TEXT PRIMARY KEY NOT NULL,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  extracted_text TEXT NOT NULL,
  word_count INTEGER,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_tos_cache_domain ON tos_cache(domain);
CREATE INDEX idx_tos_cache_expires ON tos_cache(expires_at);

CREATE TABLE explanations_cache (
  clause_hash TEXT PRIMARY KEY NOT NULL,
  category TEXT NOT NULL,
  explanation TEXT NOT NULL,
  why_it_matters TEXT,
  recommended_action TEXT,
  model TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_explanations_cache_category ON explanations_cache(category);
CREATE INDEX idx_explanations_cache_expires ON explanations_cache(expires_at);

CREATE TABLE credit_packs (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pack_size INTEGER NOT NULL CHECK (pack_size > 0),
  credits_remaining INTEGER NOT NULL CHECK (credits_remaining >= 0),
  price_paid REAL NOT NULL,
  stripe_payment_id TEXT,
  purchased_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL
);

CREATE INDEX idx_credit_packs_user ON credit_packs(user_id, credits_remaining) WHERE credits_remaining > 0;
CREATE INDEX idx_credit_packs_expires ON credit_packs(expires_at);
CREATE UNIQUE INDEX credit_packs_stripe_payment_id_unique ON credit_packs(stripe_payment_id)
  WHERE stripe_payment_id IS NOT NULL;

CREATE TABLE invoices (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT UNIQUE,
  stripe_payment_id TEXT,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL CHECK (status IN ('paid', 'pending', 'failed', 'refunded')),
  description TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_invoices_user ON invoices(user_id, paid_at DESC);
CREATE UNIQUE INDEX invoices_stripe_payment_id_unique ON invoices(stripe_payment_id)
  WHERE stripe_payment_id IS NOT NULL;

CREATE TABLE stripe_events (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  livemode INTEGER NOT NULL CHECK (livemode IN (0, 1)),
  received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE full_extraction_sections (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  scan_id TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '📄',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE full_extraction_points (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  section_id TEXT NOT NULL REFERENCES full_extraction_sections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  quote TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_full_extraction_sections_scan ON full_extraction_sections(scan_id);
CREATE INDEX idx_full_extraction_points_section ON full_extraction_points(section_id);

CREATE TABLE docs_feedback (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  slug TEXT NOT NULL CHECK (slug IN (
    'account', 'api-analyze', 'api-batch', 'api-extract', 'api-keys',
    'api-overview', 'changelog', 'extraction', 'faq', 'installation',
    'monitoring', 'quick-start', 'risk-scoring', 'security-privacy',
    'understanding-results', 'usage-accounting', 'webhooks'
  )),
  helpful INTEGER NOT NULL CHECK (helpful IN (0, 1)),
  comment TEXT CHECK (comment IS NULL OR length(comment) <= 1000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_docs_feedback_slug ON docs_feedback(slug);
CREATE INDEX idx_docs_feedback_created ON docs_feedback(created_at DESC);

CREATE TABLE monitoring_subscriptions (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  title TEXT,
  frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  last_checked_at TEXT,
  last_changed_at TEXT,
  document_type TEXT NOT NULL DEFAULT 'unknown'
    CHECK (document_type IN (
      'terms_of_service', 'terms_of_use', 'terms_and_conditions',
      'privacy_policy', 'acceptable_use_policy', 'cookie_policy',
      'eula', 'other', 'unknown'
    )),
  document_type_confidence REAL
    CHECK (document_type_confidence IS NULL OR document_type_confidence BETWEEN 0 AND 1),
  document_type_source TEXT,
  document_type_evidence TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(document_type_evidence)),
  document_identity_key TEXT,
  verification_status TEXT NOT NULL DEFAULT 'needs_review'
    CHECK (verification_status IN ('active', 'needs_review', 'mismatch')),
  verification_message TEXT,
  email_notifications_enabled INTEGER NOT NULL DEFAULT 1 CHECK (email_notifications_enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(user_id, url)
);

CREATE INDEX idx_monitoring_subscriptions_user_active ON monitoring_subscriptions(user_id) WHERE is_active = 1;
CREATE INDEX idx_monitoring_subscriptions_domain ON monitoring_subscriptions(domain);
CREATE INDEX idx_monitoring_subscriptions_check_due ON monitoring_subscriptions(last_checked_at, frequency) WHERE is_active = 1;
CREATE INDEX idx_monitoring_subscriptions_document_identity ON monitoring_subscriptions(user_id, document_identity_key)
  WHERE is_active = 1 AND document_identity_key IS NOT NULL;

CREATE TABLE tos_snapshots (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  word_count INTEGER,
  risk_score REAL,
  flagged_count INTEGER NOT NULL DEFAULT 0,
  clause_count INTEGER NOT NULL DEFAULT 0,
  categories_json TEXT CHECK (categories_json IS NULL OR json_valid(categories_json)),
  scan_id TEXT REFERENCES scans(id) ON DELETE SET NULL,
  subscription_id TEXT REFERENCES monitoring_subscriptions(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL DEFAULT 'unknown'
    CHECK (document_type IN (
      'terms_of_service', 'terms_of_use', 'terms_and_conditions',
      'privacy_policy', 'acceptable_use_policy', 'cookie_policy',
      'eula', 'other', 'unknown'
    )),
  document_identity_key TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_tos_snapshots_domain_created ON tos_snapshots(domain, created_at DESC);
CREATE INDEX idx_tos_snapshots_text_hash ON tos_snapshots(text_hash);
CREATE INDEX idx_tos_snapshots_url_created ON tos_snapshots(url, created_at DESC);
CREATE INDEX idx_tos_snapshots_subscription_created ON tos_snapshots(subscription_id, created_at DESC)
  WHERE subscription_id IS NOT NULL;

CREATE TABLE monitoring_alerts (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  subscription_id TEXT NOT NULL REFERENCES monitoring_subscriptions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_snapshot_id TEXT REFERENCES tos_snapshots(id) ON DELETE SET NULL,
  new_snapshot_id TEXT NOT NULL REFERENCES tos_snapshots(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL DEFAULT 'text_change'
    CHECK (change_type IN ('text_change', 'risk_increase', 'new_flags', 'all')),
  risk_delta REAL,
  summary TEXT,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  is_email_sent INTEGER NOT NULL DEFAULT 0 CHECK (is_email_sent IN (0, 1)),
  email_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (email_status IN ('pending', 'sending', 'sent', 'failed', 'disabled')),
  email_attempts INTEGER NOT NULL DEFAULT 0 CHECK (email_attempts >= 0),
  email_last_attempt_at TEXT,
  email_next_attempt_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  email_last_error TEXT,
  email_idempotency_key TEXT UNIQUE,
  email_sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_monitoring_alerts_user_read ON monitoring_alerts(user_id, is_read, created_at DESC);
CREATE INDEX idx_monitoring_alerts_subscription ON monitoring_alerts(subscription_id, created_at DESC);
CREATE INDEX idx_monitoring_alerts_email_due ON monitoring_alerts(email_next_attempt_at, created_at)
  WHERE email_status IN ('pending', 'failed');

CREATE TRIGGER monitoring_alerts_email_key
AFTER INSERT ON monitoring_alerts
WHEN NEW.email_idempotency_key IS NULL
BEGIN
  UPDATE monitoring_alerts SET email_idempotency_key = NEW.id WHERE id = NEW.id;
END;

CREATE TABLE regulations (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  category TEXT NOT NULL,
  articles TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(articles)),
  effective_date TEXT,
  url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_regulations_jurisdiction ON regulations(jurisdiction);
CREATE INDEX idx_regulations_code ON regulations(code);

CREATE TABLE clause_compliance_tags (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  clause_id TEXT NOT NULL REFERENCES clauses(id) ON DELETE CASCADE,
  regulation_id TEXT NOT NULL REFERENCES regulations(id) ON DELETE RESTRICT,
  article_id TEXT NOT NULL,
  article_title TEXT,
  relevance REAL NOT NULL DEFAULT 0.8 CHECK (relevance BETWEEN 0 AND 1),
  confidence REAL NOT NULL DEFAULT 0.7 CHECK (confidence BETWEEN 0 AND 1),
  quote TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(clause_id, regulation_id, article_id)
);

CREATE INDEX idx_clause_compliance_clause ON clause_compliance_tags(clause_id);
CREATE INDEX idx_clause_compliance_regulation ON clause_compliance_tags(regulation_id);

CREATE TABLE api_keys (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Default API Key',
  scopes TEXT NOT NULL DEFAULT '["extract","analyze"]' CHECK (json_valid(scopes)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  last_used_at TEXT,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash) WHERE is_active = 1;
CREATE INDEX idx_api_keys_user ON api_keys(user_id);

CREATE TABLE api_usage_logs (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  api_key_id TEXT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_api_usage_key_date ON api_usage_logs(api_key_id, created_at);
CREATE INDEX idx_api_usage_user_date ON api_usage_logs(user_id, created_at DESC);

CREATE TABLE api_rate_limits (
  bucket_key TEXT PRIMARY KEY NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  window_end TEXT NOT NULL,
  last_attempt_token TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_api_rate_limits_window_end ON api_rate_limits(window_end);

CREATE TABLE usage_reservations (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  bucket_key TEXT NOT NULL,
  idempotency_key TEXT,
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('pending', 'reserved', 'committed', 'refunded')),
  window_end TEXT NOT NULL,
  attempt_token TEXT,
  settle_token TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  settled_at TEXT,
  UNIQUE(bucket_key, idempotency_key)
);

CREATE INDEX idx_usage_reservations_created_at ON usage_reservations(created_at);
CREATE INDEX idx_usage_reservations_bucket ON usage_reservations(bucket_key);

CREATE TABLE credit_usage_reservations (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credit_pack_id TEXT NOT NULL REFERENCES credit_packs(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('scan_overflow', 'ai_overflow')),
  status TEXT NOT NULL DEFAULT 'consumed' CHECK (status IN ('consumed', 'refunded')),
  refund_token TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(user_id, idempotency_key)
);

CREATE INDEX idx_credit_usage_reservations_user_created ON credit_usage_reservations(user_id, created_at DESC);

CREATE TABLE usage_events (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  actor_hash TEXT NOT NULL,
  client_type TEXT NOT NULL CHECK (client_type IN ('web', 'extension', 'api_key', 'cron')),
  operation TEXT NOT NULL,
  outcome TEXT NOT NULL,
  cached INTEGER NOT NULL DEFAULT 0 CHECK (cached IN (0, 1)),
  scan_slots INTEGER NOT NULL DEFAULT 0,
  ai_slots INTEGER NOT NULL DEFAULT 0,
  credits INTEGER NOT NULL DEFAULT 0,
  idempotency_key_hash TEXT,
  metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_usage_events_created_at ON usage_events(created_at DESC);
CREATE INDEX idx_usage_events_actor_created ON usage_events(actor_hash, created_at DESC);

CREATE VIEW user_credit_balance AS
SELECT user_id, COALESCE(SUM(credits_remaining), 0) AS total_credits
FROM credit_packs
WHERE credits_remaining > 0
  AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
GROUP BY user_id;

CREATE VIEW recent_scans AS
SELECT id, user_id, url, domain, title, risk_score, clause_count,
  flagged_count, source, created_at
FROM scans
WHERE is_deleted = 0
ORDER BY created_at DESC;
