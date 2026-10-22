import { AlertTriangle, CreditCard, ReceiptText } from "lucide-react"
import Link from "next/link"
import { BillingCaseControls } from "@/components/admin/billing-case-controls"
import { getAdminBillingSummary, listAdminBillingCases, listAdminBillingEvents, listAdminDisputes, listAdminRefunds, listBillingNotificationExceptions } from "@/lib/billing-operations"

export const dynamic = "force-dynamic"

function money(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(minor / 100)
}

function when(date: string | null): string {
  return date ? new Date(date).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC" : "—"
}

async function getServerTime(): Promise<number> {
  return Date.now()
}

export default async function AdminBillingPage() {
  const [summary, cases, disputes, refunds, notices, events] = await Promise.all([
    getAdminBillingSummary(),
    listAdminBillingCases(), listAdminDisputes(), listAdminRefunds(), listBillingNotificationExceptions(),
    listAdminBillingEvents(),
  ])
  const now = await getServerTime()
  const eventsByCase = new Map<string, typeof events>()
  for (const event of events) {
    const group = eventsByCase.get(event.case_id) ?? []
    if (group.length < 3) group.push(event)
    eventsByCase.set(event.case_id, group)
  }

  return <div className="space-y-8 founder-dashboard">
    <header className="admin-page-heading"><div>
      <p className="admin-eyebrow">Themys / Billing operations</p>
      <h1>Refunds & disputes</h1>
      <p className="desc">Review customer requests, Stripe outcomes, credit adjustments, and evidence deadlines.</p>
    </div></header>
    <div className="admin-kpi-grid">
      {[
        { label: "Open cases", value: summary.open_cases, icon: ReceiptText },
        { label: "Overdue responses", value: summary.overdue_responses, icon: AlertTriangle },
        { label: "Decisions due", value: summary.decisions_due, icon: AlertTriangle },
        { label: "Active disputes", value: summary.active_disputes, icon: CreditCard },
        { label: "Refund exceptions", value: summary.refund_exceptions, icon: AlertTriangle },
        { label: "Unmatched payments", value: summary.unmatched_payments, icon: AlertTriangle },
      ].map(({ label, value, icon: Icon }) => <article className="admin-kpi" key={label}>
        <div className="admin-kpi-header"><div className="flex items-center gap-2"><span className="admin-icon-chip admin-tone-neutral"><Icon /></span><h2>{label}</h2></div></div>
        <p className="admin-kpi-value">{value}</p>
      </article>)}
    </div>

    <section className="admin-panel space-y-4">
      <div><h2 className="text-xl font-semibold">Case queue</h2><p className="text-sm text-[var(--admin-muted)]">Review the payment, policy window, usage, and any open dispute before deciding. Issue approved refunds in Stripe Dashboard; the webhook updates this queue.</p></div>
      {cases.length === 0 ? <p className="text-sm">No billing cases yet.</p> : <div className="space-y-3">{cases.map((item) => {
        const late = !["closed", "denied", "refunded"].includes(item.status) && Date.parse(item.response_due_at) < now
        return <article key={item.id} className="rounded-xl border border-[var(--admin-border)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h3 className="font-semibold">{item.kind.replaceAll("_", " ")} · {item.id.slice(0, 8)}</h3>
              <p className="text-sm text-[var(--admin-muted)]">{item.user_id ? <Link className="underline" href={`/admin/users/${item.user_id}`}>{item.email ?? "Account"}</Link> : "Unmatched account"} · {item.description ?? "No selected payment"}{item.amount != null && item.currency ? ` · ${money(Math.round(item.amount * 100), item.currency)}` : ""}</p></div>
            <span className={late ? "text-sm font-semibold text-red-500" : "text-sm"}>{item.priority} · {item.status.replaceAll("_", " ")}</span>
          </div>
          <p className="mt-2 text-sm"><strong>Reason:</strong> {item.reason}</p>
          {item.details && <p className="mt-1 text-sm text-[var(--admin-muted)]">{item.details}</p>}
          {item.commercial_terms && <p className="mt-2 rounded-md border border-[var(--admin-border)] p-2 text-xs">Purchase disclosure: {item.commercial_terms}<br />Terms {item.terms_version} · Refund Policy {item.refund_version}</p>}
          <p className="mt-2 text-xs text-[var(--admin-muted)]">Opened {when(item.created_at)} · Response due {when(item.response_due_at)}{item.decision_due_at ? ` · Decision target ${when(item.decision_due_at)}` : ""}{item.stripe_payment_id ? ` · Payment ${item.stripe_payment_id}` : ""}{item.stripe_invoice_id ? ` · Invoice ${item.stripe_invoice_id}` : ""}</p>
          {item.decision_note && <p className="mt-2 text-xs">Last note: {item.decision_note}</p>}
          {(eventsByCase.get(item.id) ?? []).length > 0 && <ol className="mt-2 list-inside list-disc text-xs text-[var(--admin-muted)]">
            {(eventsByCase.get(item.id) ?? []).map((event, index) => <li key={`${event.created_at}-${index}`}>
              {when(event.created_at)} · {event.actor_kind} · {event.event_type.replaceAll("_", " ")}{event.note ? `: ${event.note}` : ""}
            </li>)}
          </ol>}
          {! ["closed", "refunded"].includes(item.status) && <BillingCaseControls caseId={item.id} isDispute={item.kind === "payment_dispute"} />}
        </article>
      })}</div>}
    </section>

    <section className="admin-panel space-y-3">
      <h2 className="text-xl font-semibold">Stripe disputes</h2>
      <p className="text-sm text-[var(--admin-muted)]">Respond in Stripe before the UTC evidence deadline. Use the linked purchase disclosure, cancellation record, support history, and factual service delivery; exclude customer document contents and account secrets.</p>
      {disputes.length === 0 ? <p className="text-sm">No disputes recorded.</p> : disputes.map((item) => <div key={item.stripe_dispute_id} className="flex flex-wrap justify-between gap-3 border-t border-[var(--admin-border)] py-3 text-sm">
        <div><strong>{item.stripe_dispute_id}</strong> · {item.email ?? "Unmatched account"}<br /><span className="text-[var(--admin-muted)]">{item.reason} · {money(item.amount_minor, item.currency)} · {item.funds_state} · Credits: {item.credit_adjustment.replaceAll("_", " ")}</span></div>
        <div className="text-right"><strong>{item.status.replaceAll("_", " ")}</strong><br /><span className="text-[var(--admin-muted)]">Evidence due {when(item.evidence_due_at)} · {item.evidence_submitted ? "submitted" : "not submitted"}</span></div>
      </div>)}
    </section>

    <section className="admin-panel space-y-3">
      <h2 className="text-xl font-semibold">Stripe refunds</h2>
      {refunds.length === 0 ? <p className="text-sm">No refunds recorded.</p> : refunds.map((item) => <div key={item.stripe_refund_id} className="flex flex-wrap justify-between gap-3 border-t border-[var(--admin-border)] py-3 text-sm">
        <div><strong>{item.stripe_refund_id}</strong> · {item.email ?? "Unmatched account"}<br /><span className="text-[var(--admin-muted)]">{money(item.amount_minor, item.currency)} · Credits: {item.credit_adjustment.replaceAll("_", " ")}</span></div>
        <div className="text-right"><strong>{item.status}</strong><br /><span className="text-[var(--admin-muted)]">{item.failure_reason ?? when(item.created_at)}</span></div>
      </div>)}
    </section>
    <section className="admin-panel space-y-3">
      <h2 className="text-xl font-semibold">Billing email exceptions ({summary.email_exceptions})</h2>
      {notices.length === 0 ? <p className="text-sm">No billing email exceptions.</p> : notices.map((item) => <div key={item.id} className="border-t border-[var(--admin-border)] py-3 text-sm">
        <strong>{item.template.replaceAll("_", " ")}</strong> · {item.reference_id} · {item.status} · {item.attempts} attempts
        <p className="text-[var(--admin-muted)]">{item.last_error ?? "Unknown delivery error"} · Next attempt {when(item.next_attempt_at)}</p>
      </div>)}
    </section>
  </div>
}
