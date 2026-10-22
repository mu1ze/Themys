import "server-only"

import type Stripe from "stripe"

import { getDatabaseBinding } from "@/lib/database"
import { getStripe } from "@/lib/stripe"

export type BillingCaseKind =
  | "refund_request"
  | "unrecognized_charge"
  | "duplicate_charge"
  | "billing_error"
  | "cancellation_problem"
  | "missing_entitlement"
  | "payment_dispute"

export type BillingCase = {
  id: string
  user_id: string | null
  email: string | null
  kind: BillingCaseKind
  priority: "P1" | "P2" | "P3"
  status: string
  invoice_id: string | null
  stripe_payment_id: string | null
  stripe_invoice_id: string | null
  stripe_dispute_id: string | null
  reason: string
  details: string
  decision_note: string | null
  response_due_at: string
  decision_due_at: string | null
  created_at: string
  updated_at: string
  amount: number | null
  currency: string | null
  description: string | null
  terms_version: string | null
  refund_version: string | null
  commercial_terms: string | null
}

function stripeId(value: string | { id: string } | null | undefined): string | null {
  return typeof value === "string" ? value : value?.id ?? null
}

function dueInBusinessDays(days: number): string {
  const date = new Date()
  let remaining = days
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1)
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) remaining--
  }
  return date.toISOString()
}

const RELEASE_CREDIT_HOLD_SQL = `UPDATE credit_packs SET refund_hold = 0 WHERE stripe_payment_id = ?
  AND NOT EXISTS (SELECT 1 FROM payment_disputes
    WHERE stripe_payment_id = ? AND status NOT IN ('won', 'lost', 'warning_closed', 'prevented'))
  AND NOT EXISTS (SELECT 1 FROM payment_refunds
    WHERE stripe_payment_id = ? AND status IN ('pending', 'requires_action'))
  AND NOT EXISTS (SELECT 1 FROM billing_cases
    WHERE stripe_payment_id = ? AND kind IN ('refund_request', 'unrecognized_charge', 'duplicate_charge')
      AND status NOT IN ('denied', 'refunded', 'closed'))`

async function releaseCreditHoldIfSafe(paymentId: string): Promise<void> {
  await getDatabaseBinding().prepare(RELEASE_CREDIT_HOLD_SQL)
    .bind(paymentId, paymentId, paymentId, paymentId).run()
}

async function invoiceForPayment(paymentId: string | null): Promise<{
  id: string
  user_id: string
  stripe_invoice_id: string | null
  amount: number
  currency: string
} | null> {
  if (!paymentId) return null
  const binding = getDatabaseBinding()
  const direct = await binding.prepare(
    "SELECT id, user_id, stripe_invoice_id, amount, currency FROM invoices WHERE stripe_payment_id = ? LIMIT 1",
  ).bind(paymentId).first<{ id: string; user_id: string; stripe_invoice_id: string | null; amount: number; currency: string }>()
  if (direct) return direct

  // Subscription invoices historically lacked a local payment-intent ID.
  const payments = await getStripe().invoicePayments.list({ payment: { type: "payment_intent", payment_intent: paymentId }, limit: 1 })
  const invoiceId = stripeId(payments.data[0]?.invoice)
  if (!invoiceId) return null
  return binding.prepare(
    "SELECT id, user_id, stripe_invoice_id, amount, currency FROM invoices WHERE stripe_invoice_id = ? LIMIT 1",
  ).bind(invoiceId).first<{ id: string; user_id: string; stripe_invoice_id: string | null; amount: number; currency: string }>()
}

export async function createBillingCase(input: {
  clerkId: string
  kind: BillingCaseKind
  invoiceId: string | null
  reason: string
  details: string
}): Promise<string> {
  const binding = getDatabaseBinding()
  const user = await binding.prepare("SELECT id FROM users WHERE clerk_id = ? LIMIT 1")
    .bind(input.clerkId).first<{ id: string }>()
  if (!user) throw new Error("Your billing profile is not available")
  const recent = await binding.prepare(`SELECT COUNT(*) AS count FROM billing_cases
    WHERE user_id = ? AND created_at >= ?`)
    .bind(user.id, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .first<{ count: number }>()
  if (Number(recent?.count ?? 0) >= 10) throw new Error("Too many billing requests today. Please email support if urgent")

  const invoice = input.invoiceId
    ? await binding.prepare(
        "SELECT id, stripe_payment_id, stripe_invoice_id, status FROM invoices WHERE id = ? AND user_id = ? LIMIT 1",
      ).bind(input.invoiceId, user.id).first<{
        id: string; stripe_payment_id: string | null; stripe_invoice_id: string | null; status: string
      }>()
    : null
  if (input.invoiceId && !invoice) throw new Error("Payment not found in your account")
  if (input.kind === "refund_request" && (!invoice || invoice.status !== "paid")) {
    throw new Error("Choose a paid transaction to request a refund")
  }
  if (input.kind === "refund_request" && invoice) {
    const existing = await binding.prepare(
      "SELECT id FROM billing_cases WHERE user_id = ? AND invoice_id = ? AND kind = 'refund_request' AND status NOT IN ('denied', 'refunded', 'closed') LIMIT 1",
    ).bind(user.id, invoice.id).first<{ id: string }>()
    if (existing) return existing.id
  }

  const id = crypto.randomUUID()
  const priority = input.kind === "unrecognized_charge" || input.kind === "cancellation_problem" ? "P1" : "P2"
  const now = new Date().toISOString()
  const statements = [
    binding.prepare(`INSERT INTO billing_cases
      (id, user_id, kind, priority, status, invoice_id, stripe_payment_id, stripe_invoice_id,
       reason, details, response_due_at, decision_due_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, user.id, input.kind, priority, invoice?.id ?? null,
        invoice?.stripe_payment_id ?? null, invoice?.stripe_invoice_id ?? null,
        input.reason, input.details, dueInBusinessDays(1), dueInBusinessDays(5), now, now),
    binding.prepare(`INSERT INTO billing_case_events
      (id, case_id, event_type, actor_kind, actor_id, note, created_at)
      VALUES (?, ?, 'opened', 'customer', ?, NULL, ?)`)
      .bind(crypto.randomUUID(), id, input.clerkId, now),
  ]
  if (["refund_request", "unrecognized_charge", "duplicate_charge"].includes(input.kind)
    && invoice?.stripe_payment_id) {
    // Hold unspent credits from this pack while the refund is reviewed.
    statements.push(binding.prepare(
      "UPDATE credit_packs SET refund_hold = 1 WHERE user_id = ? AND stripe_payment_id = ? AND credits_remaining > 0",
    ).bind(user.id, invoice.stripe_payment_id))
  }
  try {
    await binding.batch(statements)
  } catch (error) {
    if (input.kind === "refund_request" && invoice) {
      const raced = await binding.prepare(`SELECT id FROM billing_cases WHERE user_id = ? AND invoice_id = ?
        AND kind = 'refund_request' AND status NOT IN ('denied', 'refunded', 'closed') LIMIT 1`)
        .bind(user.id, invoice.id).first<{ id: string }>()
      if (raced) return raced.id
    }
    throw error
  }
  return id
}

export async function listCustomerBillingCases(clerkId: string): Promise<BillingCase[]> {
  const result = await getDatabaseBinding().prepare(`
    SELECT c.*, u.email, i.amount, i.currency, i.description
    FROM billing_cases c JOIN users u ON u.id = c.user_id
    LEFT JOIN invoices i ON i.id = c.invoice_id
    WHERE u.clerk_id = ? ORDER BY c.created_at DESC LIMIT 50
  `).bind(clerkId).all<BillingCase>()
  return result.results ?? []
}

export async function listAdminBillingCases(): Promise<BillingCase[]> {
  const result = await getDatabaseBinding().prepare(`
    SELECT c.*, u.email, i.amount, i.currency, i.description,
      (SELECT a.terms_version FROM purchase_acceptances a WHERE
        a.stripe_invoice_id = c.stripe_invoice_id OR a.stripe_payment_id = c.stripe_payment_id
        ORDER BY a.accepted_at DESC LIMIT 1) AS terms_version,
      (SELECT a.refund_version FROM purchase_acceptances a WHERE
        a.stripe_invoice_id = c.stripe_invoice_id OR a.stripe_payment_id = c.stripe_payment_id
        ORDER BY a.accepted_at DESC LIMIT 1) AS refund_version,
      (SELECT a.commercial_terms FROM purchase_acceptances a WHERE
        a.stripe_invoice_id = c.stripe_invoice_id OR a.stripe_payment_id = c.stripe_payment_id
        ORDER BY a.accepted_at DESC LIMIT 1) AS commercial_terms
    FROM billing_cases c LEFT JOIN users u ON u.id = c.user_id
    LEFT JOIN invoices i ON i.id = c.invoice_id
    ORDER BY CASE WHEN c.status IN ('closed', 'denied', 'refunded') THEN 1 ELSE 0 END,
      CASE c.priority WHEN 'P1' THEN 0 WHEN 'P2' THEN 1 ELSE 2 END,
      c.response_due_at ASC LIMIT 200
  `).all<BillingCase>()
  return result.results ?? []
}

export async function getAdminBillingSummary(now = new Date().toISOString()) {
  const result = await getDatabaseBinding().prepare(`SELECT
    (SELECT COUNT(*) FROM billing_cases WHERE status NOT IN ('closed', 'denied', 'refunded')) AS open_cases,
    (SELECT COUNT(*) FROM billing_cases WHERE status NOT IN ('closed', 'denied', 'refunded')
      AND response_due_at < ?) AS overdue_responses,
    (SELECT COUNT(*) FROM billing_cases WHERE status NOT IN ('closed', 'denied', 'refunded')
      AND decision_due_at IS NOT NULL AND decision_due_at < ?) AS decisions_due,
    (SELECT COUNT(*) FROM payment_disputes WHERE status NOT IN ('won', 'lost', 'warning_closed', 'prevented')) AS active_disputes,
    (SELECT COUNT(*) FROM payment_refunds WHERE status = 'failed' OR credit_adjustment = 'manual_review') AS refund_exceptions,
    ((SELECT COUNT(*) FROM payment_refunds WHERE user_id IS NULL) +
      (SELECT COUNT(*) FROM payment_disputes WHERE user_id IS NULL)) AS unmatched_payments,
    (SELECT COUNT(*) FROM billing_notifications WHERE status IN ('failed', 'sending')) AS email_exceptions`)
    .bind(now, now).first<{
      open_cases: number; overdue_responses: number; decisions_due: number;
      active_disputes: number; refund_exceptions: number; unmatched_payments: number;
      email_exceptions: number;
    }>()
  if (!result) throw new Error("Billing summary is unavailable")
  return result
}

export async function listAdminBillingEvents() {
  const result = await getDatabaseBinding().prepare(`SELECT case_id, event_type, actor_kind,
    note, created_at FROM billing_case_events ORDER BY created_at DESC LIMIT 500`)
    .all<{ case_id: string; event_type: string; actor_kind: string; note: string | null; created_at: string }>()
  return result.results ?? []
}

export async function listAdminDisputes() {
  const result = await getDatabaseBinding().prepare(`
    SELECT d.*, u.email FROM payment_disputes d
    LEFT JOIN users u ON u.id = d.user_id
    ORDER BY CASE WHEN d.status IN ('won', 'lost', 'warning_closed') THEN 1 ELSE 0 END,
      d.evidence_due_at ASC LIMIT 100
  `).all<{
    stripe_dispute_id: string; case_id: string | null; email: string | null;
    status: string; reason: string; amount_minor: number; currency: string;
    evidence_due_at: string | null; evidence_submitted: number; funds_state: string;
    credit_adjustment: string;
  }>()
  return result.results ?? []
}

export async function listAdminRefunds() {
  const result = await getDatabaseBinding().prepare(`
    SELECT r.*, u.email FROM payment_refunds r LEFT JOIN users u ON u.id = r.user_id
    ORDER BY r.created_at DESC LIMIT 100
  `).all<{
    stripe_refund_id: string; case_id: string | null; email: string | null;
    status: string; amount_minor: number; currency: string; credit_adjustment: string;
    failure_reason: string | null; created_at: string;
  }>()
  return result.results ?? []
}

export async function listCustomerRefunds(clerkId: string) {
  const result = await getDatabaseBinding().prepare(`
    SELECT r.stripe_refund_id, r.status, r.amount_minor, r.currency, r.created_at
    FROM payment_refunds r JOIN users u ON u.id = r.user_id
    WHERE u.clerk_id = ? ORDER BY r.created_at DESC LIMIT 30
  `).bind(clerkId).all<{
    stripe_refund_id: string; status: string; amount_minor: number; currency: string; created_at: string
  }>()
  return result.results ?? []
}

export async function listCustomerDisputes(clerkId: string) {
  const result = await getDatabaseBinding().prepare(`
    SELECT d.stripe_dispute_id, d.status, d.amount_minor, d.currency, d.created_at
    FROM payment_disputes d JOIN users u ON u.id = d.user_id
    WHERE u.clerk_id = ? ORDER BY d.created_at DESC LIMIT 30
  `).bind(clerkId).all<{
    stripe_dispute_id: string; status: string; amount_minor: number; currency: string; created_at: string
  }>()
  return result.results ?? []
}

export async function getHeldCreditCount(clerkId: string): Promise<number> {
  const row = await getDatabaseBinding().prepare(`SELECT COALESCE(SUM(p.credits_remaining), 0) AS held
    FROM credit_packs p JOIN users u ON u.id = p.user_id
    WHERE u.clerk_id = ? AND p.refund_hold = 1 AND p.expires_at > ?`)
    .bind(clerkId, new Date().toISOString()).first<{ held: number }>()
  return Number(row?.held ?? 0)
}

export async function listBillingNotificationExceptions() {
  const result = await getDatabaseBinding().prepare(`
    SELECT id, template, reference_id, status, attempts, last_error, next_attempt_at
    FROM billing_notifications WHERE status IN ('failed', 'sending')
    ORDER BY next_attempt_at ASC LIMIT 50
  `).all<{
    id: string; template: string; reference_id: string; status: string;
    attempts: number; last_error: string | null; next_attempt_at: string
  }>()
  return result.results ?? []
}

export async function transitionBillingCase(input: {
  caseId: string
  status: "triaged" | "awaiting_customer" | "under_review" | "approved" | "denied" | "closed"
  actorId: string
  note: string
}): Promise<void> {
  const binding = getDatabaseBinding()
  const current = await binding.prepare("SELECT id, kind, status, stripe_payment_id FROM billing_cases WHERE id = ?")
    .bind(input.caseId).first<{ id: string; kind: string; status: string; stripe_payment_id: string | null }>()
  if (!current) throw new Error("Case not found")
  if (current.kind === "payment_dispute" && ["approved", "denied", "closed"].includes(input.status)) {
    throw new Error("Dispute outcomes are controlled by Stripe")
  }
  if (current.status === "refunded" || current.status === "closed") throw new Error("Case is already final")
  const now = new Date().toISOString()
  const statements = [
    binding.prepare("UPDATE billing_cases SET status = ?, decision_note = ?, assigned_to = ?, updated_at = ? WHERE id = ?")
      .bind(input.status, input.note, input.actorId, now, input.caseId),
    binding.prepare(`INSERT INTO billing_case_events (id, case_id, event_type, actor_kind, actor_id, note, created_at)
      VALUES (?, ?, ?, 'operator', ?, ?, ?)`)
      .bind(crypto.randomUUID(), input.caseId, input.status, input.actorId, input.note, now),
  ]
  if (["denied", "closed"].includes(input.status) && current.stripe_payment_id) {
    statements.push(binding.prepare(RELEASE_CREDIT_HOLD_SQL)
      .bind(current.stripe_payment_id, current.stripe_payment_id,
        current.stripe_payment_id, current.stripe_payment_id))
  }
  await binding.batch(statements)
}

export async function recordStripeRefund(refund: Stripe.Refund, livemode: boolean, eventId: string): Promise<void> {
  const binding = getDatabaseBinding()
  const paymentId = stripeId(refund.payment_intent) ??
    (refund.charge ? stripeId((await getStripe().charges.retrieve(stripeId(refund.charge)!)).payment_intent) : null)
  const chargeId = stripeId(refund.charge)
  const invoice = await invoiceForPayment(paymentId)
  const matchedCase = invoice
    ? await binding.prepare(`SELECT id FROM billing_cases WHERE invoice_id = ? AND kind = 'refund_request'
        ORDER BY created_at DESC LIMIT 1`).bind(invoice.id).first<{ id: string }>()
    : null
  const now = new Date().toISOString()
  let adjustment = "not_applicable"
  const pack = paymentId
    ? await binding.prepare(`SELECT pack_size, credits_remaining, price_paid FROM credit_packs
        WHERE stripe_payment_id = ? LIMIT 1`).bind(paymentId)
      .first<{ pack_size: number; credits_remaining: number; price_paid: number }>()
    : null
  const previous = await binding.prepare("SELECT credit_adjustment FROM payment_refunds WHERE stripe_refund_id = ?")
    .bind(refund.id).first<{ credit_adjustment: string }>()
  if (pack) {
    if (previous?.credit_adjustment === "revoked" && refund.status === "succeeded") {
      adjustment = "revoked"
    } else if (refund.status === "succeeded" && refund.amount === Math.round(pack.price_paid * 100)
      && pack.credits_remaining === pack.pack_size) {
      const result = await binding.prepare(`UPDATE credit_packs SET credits_remaining = 0, refund_hold = 0
        WHERE stripe_payment_id = ? AND credits_remaining = pack_size`)
        .bind(paymentId).run()
      adjustment = result.meta?.changes ? "revoked" : "manual_review"
    } else if (refund.status === "failed" || refund.status === "canceled") {
      adjustment = previous?.credit_adjustment === "revoked" ? "manual_review" : "not_applicable"
    } else if (refund.status === "succeeded") {
      await binding.prepare("UPDATE credit_packs SET refund_hold = 1 WHERE stripe_payment_id = ? AND credits_remaining > 0")
        .bind(paymentId).run()
      adjustment = "manual_review"
    } else {
      await binding.prepare("UPDATE credit_packs SET refund_hold = 1 WHERE stripe_payment_id = ? AND credits_remaining > 0")
        .bind(paymentId).run()
      adjustment = "held"
    }
  }
  await binding.prepare(`INSERT INTO payment_refunds
    (stripe_refund_id, case_id, user_id, stripe_payment_id, stripe_charge_id, amount_minor, currency,
     status, reason, failure_reason, credit_adjustment, livemode, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(stripe_refund_id) DO UPDATE SET
      case_id = COALESCE(payment_refunds.case_id, excluded.case_id),
      user_id = COALESCE(payment_refunds.user_id, excluded.user_id),
      stripe_payment_id = COALESCE(payment_refunds.stripe_payment_id, excluded.stripe_payment_id),
      stripe_charge_id = COALESCE(payment_refunds.stripe_charge_id, excluded.stripe_charge_id),
      status = excluded.status,
      failure_reason = excluded.failure_reason, credit_adjustment = excluded.credit_adjustment,
      updated_at = excluded.updated_at`)
    .bind(refund.id, matchedCase?.id ?? null, invoice?.user_id ?? null, paymentId, chargeId,
      refund.amount, refund.currency, refund.status ?? "unknown", refund.reason ?? null,
      refund.failure_reason ?? null, adjustment, livemode ? 1 : 0,
      new Date(refund.created * 1000).toISOString(), now).run()
  let fullyRefunded = false
  if (invoice) {
    const total = await binding.prepare(`SELECT COALESCE(SUM(amount_minor), 0) AS total
      FROM payment_refunds WHERE stripe_payment_id = ? AND status = 'succeeded'`)
      .bind(paymentId).first<{ total: number }>()
    fullyRefunded = Number(total?.total ?? 0) >= Math.round(invoice.amount * 100)
    if (fullyRefunded) {
      await binding.prepare("UPDATE invoices SET status = 'refunded' WHERE id = ?")
        .bind(invoice.id).run()
    } else if (refund.status === "failed" || refund.status === "canceled") {
      await binding.prepare("UPDATE invoices SET status = 'paid' WHERE id = ? AND status = 'refunded'")
        .bind(invoice.id).run()
    }
  }
  if (matchedCase) {
    const status = refund.status === "succeeded" && fullyRefunded ? "refunded" :
      refund.status === "failed" || refund.status === "canceled" ? "under_review" : "refund_pending"
    await binding.batch([
      binding.prepare("UPDATE billing_cases SET status = ?, updated_at = ? WHERE id = ?")
        .bind(status, now, matchedCase.id),
      binding.prepare(`INSERT OR IGNORE INTO billing_case_events
        (id, case_id, event_key, event_type, actor_kind, note, created_at)
        VALUES (?, ?, ?, ?, 'stripe', ?, ?)`)
        .bind(crypto.randomUUID(), matchedCase.id, eventId, `refund_${refund.status ?? "unknown"}`,
          refund.id, now),
    ])
  }
  if (paymentId && (refund.status === "failed" || refund.status === "canceled")) {
    await releaseCreditHoldIfSafe(paymentId)
  }
}

export async function recordStripeDispute(dispute: Stripe.Dispute, eventType: string, eventId: string): Promise<void> {
  const binding = getDatabaseBinding()
  const paymentId = stripeId(dispute.payment_intent) ??
    stripeId((await getStripe().charges.retrieve(stripeId(dispute.charge)!)).payment_intent)
  const chargeId = stripeId(dispute.charge)!
  const invoice = await invoiceForPayment(paymentId)
  const existing = await binding.prepare("SELECT case_id FROM payment_disputes WHERE stripe_dispute_id = ?")
    .bind(dispute.id).first<{ case_id: string | null }>()
  const caseId = existing?.case_id ?? crypto.randomUUID()
  const now = new Date().toISOString()
  const dueAt = dispute.evidence_details?.due_by
    ? new Date(dispute.evidence_details.due_by * 1000).toISOString() : null
  const closed = ["won", "lost", "warning_closed", "prevented"].includes(dispute.status)
  let adjustment = "not_applicable"
  if (paymentId) {
    const pack = await binding.prepare(`SELECT pack_size, credits_remaining, price_paid FROM credit_packs
      WHERE stripe_payment_id = ? LIMIT 1`).bind(paymentId)
      .first<{ pack_size: number; credits_remaining: number; price_paid: number }>()
    if (pack) {
      const previous = await binding.prepare("SELECT credit_adjustment FROM payment_disputes WHERE stripe_dispute_id = ?")
        .bind(dispute.id).first<{ credit_adjustment: string }>()
      if (dispute.status === "lost" && previous?.credit_adjustment === "revoked") {
        adjustment = "revoked"
      } else if (dispute.status === "lost" && dispute.amount >= Math.round(pack.price_paid * 100)
        && pack.credits_remaining === pack.pack_size) {
        const revoked = await binding.prepare(`UPDATE credit_packs SET credits_remaining = 0, refund_hold = 0
          WHERE stripe_payment_id = ? AND credits_remaining = pack_size`).bind(paymentId).run()
        adjustment = revoked.meta?.changes ? "revoked" : "manual_review"
      } else if (dispute.status === "lost") {
        adjustment = "manual_review"
      } else {
        if (!closed) {
          await binding.prepare("UPDATE credit_packs SET refund_hold = 1 WHERE stripe_payment_id = ? AND credits_remaining > 0")
            .bind(paymentId).run()
          adjustment = "held"
        }
      }
    }
  }
  await binding.prepare(`INSERT OR IGNORE INTO billing_cases
    (id, user_id, kind, priority, status, invoice_id, stripe_payment_id, stripe_invoice_id,
     stripe_dispute_id, reason, details, response_due_at, livemode, created_at, updated_at)
    VALUES (?, ?, 'payment_dispute', 'P1', ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?)`)
    .bind(caseId, invoice?.user_id ?? null, closed ? "closed" : "open",
      invoice?.id ?? null, paymentId, invoice?.stripe_invoice_id ?? null,
      dispute.id, dispute.reason, dueAt ?? dueInBusinessDays(1), dispute.livemode ? 1 : 0,
      new Date(dispute.created * 1000).toISOString(), now).run()
  if (invoice) {
    await binding.prepare(`UPDATE billing_cases SET user_id = COALESCE(user_id, ?),
      invoice_id = COALESCE(invoice_id, ?), stripe_invoice_id = COALESCE(stripe_invoice_id, ?),
      stripe_payment_id = COALESCE(stripe_payment_id, ?) WHERE id = ?`)
      .bind(invoice.user_id, invoice.id, invoice.stripe_invoice_id, paymentId, caseId).run()
  }
  await binding.prepare(`INSERT INTO payment_disputes
    (stripe_dispute_id, case_id, user_id, stripe_payment_id, stripe_charge_id, amount_minor,
     currency, reason, status, evidence_due_at, evidence_submitted, funds_state, credit_adjustment,
     livemode, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(stripe_dispute_id) DO UPDATE SET
      user_id = COALESCE(payment_disputes.user_id, excluded.user_id),
      stripe_payment_id = COALESCE(payment_disputes.stripe_payment_id, excluded.stripe_payment_id),
      status = excluded.status,
      evidence_due_at = excluded.evidence_due_at,
      evidence_submitted = excluded.evidence_submitted,
      funds_state = CASE WHEN excluded.funds_state = 'unknown' THEN payment_disputes.funds_state
        ELSE excluded.funds_state END, credit_adjustment = excluded.credit_adjustment,
      updated_at = excluded.updated_at`)
    .bind(dispute.id, caseId, invoice?.user_id ?? null, paymentId, chargeId,
      dispute.amount, dispute.currency, dispute.reason, dispute.status, dueAt,
      dispute.evidence_details?.submission_count ? 1 : 0,
      dispute.status === "won" ? "reinstated" :
        dispute.status === "lost" ? "withdrawn" :
          eventType === "charge.dispute.funds_withdrawn" ? "withdrawn" :
            eventType === "charge.dispute.funds_reinstated" ? "reinstated" : "unknown",
      adjustment, dispute.livemode ? 1 : 0, new Date(dispute.created * 1000).toISOString(), now).run()
  await binding.batch([
    binding.prepare("UPDATE billing_cases SET status = ?, response_due_at = COALESCE(?, response_due_at), updated_at = ? WHERE id = ?")
      .bind(closed ? "closed" : "under_review", dueAt, now, caseId),
    binding.prepare(`INSERT OR IGNORE INTO billing_case_events
      (id, case_id, event_key, event_type, actor_kind, note, created_at)
      VALUES (?, ?, ?, ?, 'stripe', ?, ?)`)
      .bind(crypto.randomUUID(), caseId, eventId, eventType, dispute.status, now),
  ])
  if (paymentId && closed && dispute.status !== "lost") {
    await releaseCreditHoldIfSafe(paymentId)
  }
}

/** Match Stripe objects that arrived before the local invoice webhook. */
export async function reconcileUnmatchedBillingObjects(limit = 10): Promise<void> {
  const binding = getDatabaseBinding()
  const stripe = getStripe()
  const refundRows = await binding.prepare(`SELECT stripe_refund_id, livemode FROM payment_refunds
    WHERE user_id IS NULL AND stripe_payment_id IS NOT NULL
    ORDER BY updated_at ASC LIMIT ?`).bind(limit).all<{ stripe_refund_id: string; livemode: number }>()
  for (const row of refundRows.results ?? []) {
    try {
      const refund = await stripe.refunds.retrieve(row.stripe_refund_id)
      await recordStripeRefund(refund, Boolean(row.livemode), `reconcile-refund:${row.stripe_refund_id}`)
    } catch (error) {
      console.warn("[billing reconcile] Refund lookup failed", error instanceof Error ? error.name : "UnknownError")
    }
  }
  const disputeRows = await binding.prepare(`SELECT stripe_dispute_id FROM payment_disputes
    WHERE user_id IS NULL AND stripe_payment_id IS NOT NULL
    ORDER BY updated_at ASC LIMIT ?`).bind(limit).all<{ stripe_dispute_id: string }>()
  for (const row of disputeRows.results ?? []) {
    try {
      const dispute = await stripe.disputes.retrieve(row.stripe_dispute_id)
      await recordStripeDispute(dispute, "reconcile", `reconcile-dispute:${row.stripe_dispute_id}`)
    } catch (error) {
      console.warn("[billing reconcile] Dispute lookup failed", error instanceof Error ? error.name : "UnknownError")
    }
  }
}
