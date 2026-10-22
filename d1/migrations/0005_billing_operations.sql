-- Billing cases survive account deletion for accounting and dispute handling.
-- User identity is removed by the existing account-deletion flow.
ALTER TABLE credit_packs ADD COLUMN refund_hold INTEGER NOT NULL DEFAULT 0 CHECK (refund_hold IN (0, 1));

CREATE TABLE purchase_acceptances (
  stripe_session_id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  clerk_id TEXT,
  stripe_customer_id TEXT,
  stripe_payment_id TEXT,
  stripe_invoice_id TEXT,
  stripe_subscription_id TEXT,
  price_id TEXT NOT NULL,
  product_kind TEXT NOT NULL CHECK (product_kind IN ('subscription', 'credit_pack')),
  amount_minor INTEGER,
  currency TEXT,
  terms_version TEXT NOT NULL,
  privacy_version TEXT NOT NULL,
  refund_version TEXT NOT NULL,
  acknowledgement_version TEXT NOT NULL,
  commercial_terms TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  livemode INTEGER NOT NULL CHECK (livemode IN (0, 1)),
  accepted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_purchase_acceptances_user ON purchase_acceptances(user_id, accepted_at DESC);
CREATE INDEX idx_purchase_acceptances_payment ON purchase_acceptances(stripe_payment_id);
CREATE INDEX idx_purchase_acceptances_invoice ON purchase_acceptances(stripe_invoice_id);

CREATE TABLE billing_cases (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('refund_request', 'unrecognized_charge', 'duplicate_charge', 'billing_error', 'cancellation_problem', 'missing_entitlement', 'payment_dispute')),
  priority TEXT NOT NULL CHECK (priority IN ('P1', 'P2', 'P3')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'triaged', 'awaiting_customer', 'under_review', 'approved', 'denied', 'refund_pending', 'refunded', 'closed')),
  invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
  stripe_payment_id TEXT,
  stripe_invoice_id TEXT,
  stripe_dispute_id TEXT UNIQUE,
  reason TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  decision_note TEXT,
  assigned_to TEXT,
  response_due_at TEXT NOT NULL,
  decision_due_at TEXT,
  livemode INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_billing_cases_queue ON billing_cases(status, priority, response_due_at);
CREATE INDEX idx_billing_cases_user ON billing_cases(user_id, created_at DESC);
CREATE INDEX idx_billing_cases_payment ON billing_cases(stripe_payment_id);
CREATE UNIQUE INDEX idx_billing_cases_open_refund ON billing_cases(user_id, invoice_id, kind)
  WHERE kind = 'refund_request' AND invoice_id IS NOT NULL
    AND status NOT IN ('denied', 'refunded', 'closed');

CREATE TABLE billing_case_events (
  id TEXT PRIMARY KEY NOT NULL,
  case_id TEXT NOT NULL REFERENCES billing_cases(id) ON DELETE CASCADE,
  event_key TEXT UNIQUE,
  event_type TEXT NOT NULL,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('customer', 'operator', 'stripe', 'system')),
  actor_id TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_billing_case_events_case ON billing_case_events(case_id, created_at);

CREATE TABLE payment_refunds (
  stripe_refund_id TEXT PRIMARY KEY NOT NULL,
  case_id TEXT REFERENCES billing_cases(id) ON DELETE SET NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  stripe_payment_id TEXT,
  stripe_charge_id TEXT,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT,
  failure_reason TEXT,
  credit_adjustment TEXT NOT NULL DEFAULT 'not_applicable' CHECK (credit_adjustment IN ('not_applicable', 'held', 'revoked', 'manual_review')),
  livemode INTEGER NOT NULL CHECK (livemode IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_payment_refunds_payment ON payment_refunds(stripe_payment_id);
CREATE INDEX idx_payment_refunds_case ON payment_refunds(case_id);

CREATE TABLE payment_disputes (
  stripe_dispute_id TEXT PRIMARY KEY NOT NULL,
  case_id TEXT REFERENCES billing_cases(id) ON DELETE SET NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  stripe_payment_id TEXT,
  stripe_charge_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  evidence_due_at TEXT,
  evidence_submitted INTEGER NOT NULL DEFAULT 0 CHECK (evidence_submitted IN (0, 1)),
  funds_state TEXT NOT NULL DEFAULT 'unknown' CHECK (funds_state IN ('unknown', 'withdrawn', 'reinstated')),
  credit_adjustment TEXT NOT NULL DEFAULT 'not_applicable' CHECK (credit_adjustment IN ('not_applicable', 'held', 'revoked', 'manual_review')),
  livemode INTEGER NOT NULL CHECK (livemode IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_payment_disputes_deadline ON payment_disputes(status, evidence_due_at);

CREATE TABLE billing_notifications (
  id TEXT PRIMARY KEY NOT NULL,
  template TEXT NOT NULL CHECK (template IN ('purchase_confirmation', 'case_received', 'case_updated', 'urgent_case_alert', 'refund_result', 'dispute_alert', 'cancellation_confirmation', 'resume_confirmation')),
  reference_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_error TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_billing_notifications_due ON billing_notifications(status, next_attempt_at);
