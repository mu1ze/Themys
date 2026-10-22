"use client"

import { useState, useTransition } from "react"
import { createBillingPortalSession, resumeSubscription } from "@/app/actions/account"

export function ManageBillingButton({ canceling = false }: { canceling?: boolean }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState("")
  const run = (resume: boolean) => start(async () => {
    setError("")
    if (resume) {
      const result = await resumeSubscription()
      if (result.success) window.location.reload()
      else setError(result.error ?? "Unable to resume subscription")
      return
    }
    const result = await createBillingPortalSession()
    if (result.ok) window.location.assign(result.url)
    else setError(result.error)
  })
  return <div className="flex flex-wrap items-center gap-2">
    <button type="button" disabled={pending} onClick={() => run(false)} className="inline-flex h-9 items-center justify-center rounded-[var(--ds-radius-sm)] bg-[var(--ds-accent)] px-4 text-[13px] font-semibold text-[var(--primary-foreground)] disabled:opacity-60">
      {pending ? "Opening…" : "Manage billing"}
    </button>
    {canceling && <button type="button" disabled={pending} onClick={() => run(true)} className="text-[13px] font-medium text-[var(--ds-accent)] underline disabled:opacity-60">Undo cancellation</button>}
    {error && <p role="alert" className="w-full text-xs text-[var(--ds-danger)]">{error}</p>}
  </div>
}
