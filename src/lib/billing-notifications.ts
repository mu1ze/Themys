import "server-only"

import { getCloudflareContext } from "@opennextjs/cloudflare"
import { getDatabaseBinding } from "@/lib/database"

type Template = "purchase_confirmation" | "case_received" | "case_updated" | "urgent_case_alert" | "refund_result" | "dispute_alert" | "cancellation_confirmation" | "resume_confirmation"
type WorkerBinding = { fetch(request: Request): Promise<Response> }

export async function queueBillingNotification(template: Template, referenceId: string, eventKey: string): Promise<void> {
  await getDatabaseBinding().prepare(`INSERT OR IGNORE INTO billing_notifications
    (id, template, reference_id) VALUES (?, ?, ?)`)
    .bind(eventKey.slice(0, 160), template, referenceId).run()
  await dispatchBillingNotification(eventKey.slice(0, 160))
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] ?? character)
}

async function messageFor(template: Template, referenceId: string): Promise<{
  to: string; subject: string; text: string
} | null> {
  const binding = getDatabaseBinding()
  if (template === "dispute_alert") {
    const dispute = await binding.prepare(`SELECT stripe_dispute_id, status, evidence_due_at
      FROM payment_disputes WHERE stripe_dispute_id = ?`)
      .bind(referenceId).first<{ stripe_dispute_id: string; status: string; evidence_due_at: string | null }>()
    if (!dispute) return null
    return {
      to: "admin@themys.ca", subject: `Themys dispute needs review: ${dispute.stripe_dispute_id}`,
      text: `Stripe dispute ${dispute.stripe_dispute_id} is ${dispute.status}. Evidence due: ${dispute.evidence_due_at ?? "check Stripe"}. Review https://admin.themys.ca/admin/billing and Stripe Dashboard promptly.`,
    }
  }
  if (template === "urgent_case_alert") {
    const billingCase = await binding.prepare("SELECT id, kind, response_due_at FROM billing_cases WHERE id = ?")
      .bind(referenceId).first<{ id: string; kind: string; response_due_at: string }>()
    if (!billingCase) return null
    return {
      to: "admin@themys.ca", subject: `Urgent Themys billing case: ${billingCase.id.slice(0, 8)}`,
      text: `A ${billingCase.kind.replaceAll("_", " ")} case requires review. Reference: ${billingCase.id}. Response target: ${billingCase.response_due_at}. Open https://admin.themys.ca/admin/billing.`,
    }
  }
  if (template === "purchase_confirmation") {
    const purchase = await binding.prepare(`SELECT a.stripe_session_id, a.product_kind, a.amount_minor,
      a.currency, a.terms_version, a.refund_version, a.commercial_terms, u.email
      FROM purchase_acceptances a JOIN users u ON u.id = a.user_id
      WHERE a.stripe_session_id = ? AND a.status = 'paid'`)
      .bind(referenceId).first<{
        stripe_session_id: string; product_kind: string; amount_minor: number | null;
        currency: string | null; terms_version: string; refund_version: string;
        commercial_terms: string; email: string
      }>()
    if (!purchase) return null
    const amount = purchase.amount_minor != null && purchase.currency
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: purchase.currency.toUpperCase() }).format(purchase.amount_minor / 100)
      : "the amount shown by Stripe"
    return {
      to: purchase.email, subject: "Your Themys purchase confirmation",
      text: `Thank you for your ${purchase.product_kind === "credit_pack" ? "credit pack" : "subscription"} purchase. Amount: ${amount}. Reference: ${purchase.stripe_session_id}.\n\nPurchase terms: ${purchase.commercial_terms}\n\nYour accepted Terms version is ${purchase.terms_version} and Refund Policy version is ${purchase.refund_version}. Retain this email, a copy of https://docs.themys.ca/legal, and your Stripe receipt. Manage billing at https://themys.ca/settings#subscription. Refund requests: https://themys.ca/settings#payments.`,
    }
  }
  if (template === "refund_result") {
    const refund = await binding.prepare(`SELECT r.stripe_refund_id, r.status, r.amount_minor,
      r.currency, u.email FROM payment_refunds r JOIN users u ON u.id = r.user_id
      WHERE r.stripe_refund_id = ?`)
      .bind(referenceId).first<{
        stripe_refund_id: string; status: string; amount_minor: number; currency: string; email: string
      }>()
    if (!refund) return null
    const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: refund.currency.toUpperCase() }).format(refund.amount_minor / 100)
    return {
      to: refund.email, subject: `Themys refund ${refund.status}`,
      text: `Your refund ${refund.stripe_refund_id} for ${amount} is ${refund.status}. A successful refund returns to the original payment method; your bank determines when it appears. If the refund failed, visit https://themys.ca/settings#payments or email admin@themys.ca.`,
    }
  }
  if (template === "cancellation_confirmation" || template === "resume_confirmation") {
    const user = await binding.prepare("SELECT email, subscription_ends_at FROM users WHERE id = ?")
      .bind(referenceId).first<{ email: string; subscription_ends_at: string | null }>()
    if (!user) return null
    return template === "cancellation_confirmation"
      ? {
          to: user.email, subject: "Themys subscription cancellation scheduled",
          text: `Your Themys subscription is scheduled to end on ${user.subscription_ends_at ?? "the end of your paid period"}. It will not renew unless you resume it. Cancellation does not automatically refund the current period. Manage billing or undo cancellation at https://themys.ca/settings#subscription.`,
        }
      : {
          to: user.email, subject: "Themys subscription resumed",
          text: `Your Themys subscription will renew at the end of the current paid period, subject to the plan and price shown in Stripe billing. Review or cancel at https://themys.ca/settings#subscription.`,
        }
  }
  const billingCase = await binding.prepare(`SELECT c.id, c.status, c.kind, u.email
    FROM billing_cases c JOIN users u ON u.id = c.user_id WHERE c.id = ?`)
    .bind(referenceId).first<{ id: string; status: string; kind: string; email: string }>()
  if (!billingCase) return null
  return template === "case_received"
    ? {
        to: billingCase.email, subject: `Themys billing request received: ${billingCase.id.slice(0, 8)}`,
        text: `We received your ${billingCase.kind.replaceAll("_", " ")} request ${billingCase.id}. We aim to respond within one business day. You can check status at https://themys.ca/settings#payments. Do not reply with card details.`,
      }
    : {
        to: billingCase.email, subject: `Themys billing request update: ${billingCase.id.slice(0, 8)}`,
        text: `Your billing request ${billingCase.id} is now ${billingCase.status.replaceAll("_", " ")}. An approved request is not a completed refund; Stripe must confirm the refund separately. Check https://themys.ca/settings#payments or email admin@themys.ca if you need help.`,
      }
}

export async function dispatchBillingNotification(id: string): Promise<"sent" | "failed" | "skipped"> {
  const binding = getDatabaseBinding()
  const now = new Date().toISOString()
  const claimed = await binding.prepare(`UPDATE billing_notifications
    SET status = 'sending', attempts = attempts + 1, next_attempt_at = ?
    WHERE id = ? AND status IN ('pending', 'failed', 'sending') AND next_attempt_at <= ?
    RETURNING id, template, reference_id, attempts`)
    .bind(new Date(Date.now() + 15 * 60_000).toISOString(), id, now)
    .first<{ id: string; template: Template; reference_id: string; attempts: number }>()
  if (!claimed) return "skipped"
  try {
    const message = await messageFor(claimed.template, claimed.reference_id)
    if (!message) {
      await binding.prepare("UPDATE billing_notifications SET status = 'skipped' WHERE id = ?")
        .bind(id).run()
      return "skipped"
    }
    const env = getCloudflareContext().env as unknown as Record<string, unknown>
    const worker = env.MONITORING_EMAIL_WORKER as WorkerBinding | undefined
    if (!worker) throw new Error("Email service unavailable")
    const from = typeof env.MONITORING_EMAIL_FROM === "string" ? env.MONITORING_EMAIL_FROM : "alerts@themys.ca"
    const response = await worker.fetch(new Request("https://monitoring-email.internal/deliver", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: `billing:${id}`, from, to: message.to, subject: message.subject,
        text: message.text, html: `<p>${escapeHtml(message.text).replaceAll("\n", "<br />")}</p>`,
      }),
      signal: AbortSignal.timeout(10_000),
    }))
    if (!response.ok) throw new Error(`Email service returned ${response.status}`)
    await binding.prepare(`UPDATE billing_notifications SET status = 'sent', sent_at = ?, last_error = NULL WHERE id = ?`)
      .bind(new Date().toISOString(), id).run()
    return "sent"
  } catch (error) {
    const delayMinutes = Math.min(60 * 24, 5 * 2 ** Math.min(claimed.attempts, 8))
    await binding.prepare(`UPDATE billing_notifications SET status = 'failed',
      next_attempt_at = ?, last_error = ? WHERE id = ?`)
      .bind(new Date(Date.now() + delayMinutes * 60_000).toISOString(),
        error instanceof Error ? error.message.slice(0, 200) : "Delivery failed", id).run()
    return "failed"
  }
}

export async function dispatchPendingBillingNotifications(): Promise<void> {
  const result = await getDatabaseBinding().prepare(`SELECT id FROM billing_notifications
    WHERE status IN ('pending', 'failed', 'sending') AND next_attempt_at <= ? AND attempts < 8
    ORDER BY next_attempt_at LIMIT 30`)
    .bind(new Date().toISOString()).all<{ id: string }>()
  for (const row of result.results ?? []) await dispatchBillingNotification(row.id)
}
