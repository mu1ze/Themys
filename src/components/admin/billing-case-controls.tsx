"use client"

import { useState, useTransition } from "react"
import { updateBillingCase } from "@/app/actions/billing"

export function BillingCaseControls({ caseId, isDispute }: { caseId: string; isDispute: boolean }) {
  const [pending, start] = useTransition()
  const [message, setMessage] = useState("")
  return <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(event) => {
    event.preventDefault()
    const form = event.currentTarget
    start(async () => {
      const result = await updateBillingCase(new FormData(form))
      setMessage(result.ok ? "Saved" : result.error)
      if (result.ok) form.reset()
    })
  }}>
    <input type="hidden" name="caseId" value={caseId} />
    <label className="grid gap-1 text-xs">Status
      <select name="status" className="admin-field min-w-36" required>
        <option value="triaged">Triaged</option>
        <option value="under_review">Under review</option>
        <option value="awaiting_customer">Awaiting customer</option>
        {!isDispute && <option value="approved">Approved, refund pending</option>}
        {!isDispute && <option value="denied">Denied</option>}
        {!isDispute && <option value="closed">Closed</option>}
      </select>
    </label>
    <label className="grid min-w-56 flex-1 gap-1 text-xs">Decision note
      <input name="note" required minLength={5} maxLength={1000} className="admin-field" placeholder="Document the decision or next step" />
    </label>
    <button disabled={pending} type="submit" className="admin-field cursor-pointer font-semibold disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
    {message && <span role="status" className="w-full text-xs">{message}</span>}
  </form>
}
