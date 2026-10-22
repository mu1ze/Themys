"use client"

import { useState, useTransition } from "react"
import { ChevronDown } from "lucide-react"
import { submitBillingCase } from "@/app/actions/billing"

type Invoice = { id: string; amount: number; currency: string; description: string | null; paidAt: string | null; status: string }
type Case = { id: string; kind: string; status: string; created_at: string }

export function BillingHelp({ invoices, cases, email }: { invoices: Invoice[]; cases: Case[]; email: string }) {
  const [pending, start] = useTransition()
  const [kind, setKind] = useState("refund_request")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  return <div className="mt-7 border-t border-[var(--ds-border)] pt-6">
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card)] px-4 py-3.5 outline-none transition hover:bg-[var(--ds-card-hover)] focus-visible:ring-2 focus-visible:ring-[var(--ds-accent)] marker:content-none [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-[13px] font-semibold text-[var(--ds-text)]">Billing help</span>
          <span className="mt-1 block text-[12px] leading-5 text-[var(--ds-text-muted)]">Open a request about a payment, refund, or billing problem.</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[var(--ds-text-muted)] transition-transform group-open:rotate-180" />
      </summary>
      <div className="pt-4">
    <p className="text-sm text-[var(--ds-text-secondary)]">Request a refund or report a charge or billing problem. We’ll review the payment and reply to your account email. Do not include card numbers.</p>
    <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={(event) => {
      event.preventDefault()
      setError("")
      setMessage("")
      const form = event.currentTarget
      start(async () => {
        const result = await submitBillingCase(new FormData(form))
        if (result.ok) {
          setMessage(`Request ${result.caseId.slice(0, 8)} received. We aim to respond within one business day.`)
          form.reset()
          setKind("refund_request")
        } else setError(result.error)
      })
    }}>
      <label className="grid gap-1 text-xs font-medium text-[var(--ds-text-secondary)]">Request type
        <select name="kind" required value={kind} onChange={(event) => setKind(event.target.value)} className="min-h-10 rounded-md border border-[var(--ds-border)] bg-[var(--ds-card)] px-3 text-sm text-[var(--ds-text)]">
          <option value="refund_request">Request a refund</option>
          <option value="unrecognized_charge">Unrecognized charge</option>
          <option value="duplicate_charge">Duplicate charge</option>
          <option value="billing_error">Other billing error</option>
          <option value="cancellation_problem">Cancellation problem</option>
          <option value="missing_entitlement">Missing credits or plan access</option>
        </select>
      </label>
      {kind === "unrecognized_charge" && <p className="sm:col-span-2 rounded-md border border-[var(--ds-danger)]/30 p-3 text-sm text-[var(--ds-text-secondary)]">If your card or account may be compromised, contact your bank or card issuer promptly and secure your account.</p>}
      <label className="grid gap-1 text-xs font-medium text-[var(--ds-text-secondary)]">Payment
        <select name="invoiceId" defaultValue={invoices.find((invoice) => invoice.status === "paid")?.id ?? ""} className="min-h-10 rounded-md border border-[var(--ds-border)] bg-[var(--ds-card)] px-3 text-sm text-[var(--ds-text)]">
          <option value="">Charge not listed</option>
          {invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>
            {invoice.description ?? "Payment"} · {new Intl.NumberFormat("en-US", { style: "currency", currency: invoice.currency.toUpperCase() }).format(invoice.amount)} · {invoice.paidAt?.slice(0, 10) ?? "recent"}
          </option>)}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-medium text-[var(--ds-text-secondary)] sm:col-span-2">Reason
        <input name="reason" required minLength={3} maxLength={120} placeholder="For example, renewal after cancellation" className="min-h-10 rounded-md border border-[var(--ds-border)] bg-[var(--ds-card)] px-3 text-sm text-[var(--ds-text)]" />
      </label>
      <label className="grid gap-1 text-xs font-medium text-[var(--ds-text-secondary)] sm:col-span-2">What happened?
        <textarea name="details" required minLength={10} maxLength={2000} rows={3} className="rounded-md border border-[var(--ds-border)] bg-[var(--ds-card)] p-3 text-sm text-[var(--ds-text)]" />
      </label>
      <label className="flex items-start gap-2 text-xs text-[var(--ds-text-secondary)] sm:col-span-2">
        <input name="confirmEmail" type="checkbox" value="yes" required className="mt-0.5 size-4" />
        <span>My account email, {email}, is current for replies about this request.</span>
      </label>
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className="rounded-md bg-[var(--ds-accent)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-60">{pending ? "Submitting…" : "Submit request"}</button>
      </div>
    </form>
    {error && <p role="alert" className="mt-3 text-sm text-[var(--ds-danger)]">{error}</p>}
    {message && <p role="status" className="mt-3 text-sm text-[var(--ds-success)]">{message}</p>}
      </div>
    </details>
    {cases.length > 0 && <div className="mt-6">
      <h4 className="text-sm font-semibold text-[var(--ds-text)]">Your requests</h4>
      <ul className="mt-2 divide-y divide-[var(--ds-border)] text-sm text-[var(--ds-text-secondary)]">
        {cases.map((item) => <li key={item.id} className="flex flex-wrap justify-between gap-2 py-2">
          <span>{item.kind.replaceAll("_", " ")} · {item.id.slice(0, 8)}</span>
          <span>{item.status.replaceAll("_", " ")}</span>
        </li>)}
      </ul>
    </div>}
    <p className="mt-5 text-xs text-[var(--ds-text-muted)]">See the <a className="underline" href="https://docs.themys.ca/legal#refunds">Refund Policy</a>. You can also email <a className="underline" href="mailto:admin@themys.ca">admin@themys.ca</a> from your account address.</p>
  </div>
}
