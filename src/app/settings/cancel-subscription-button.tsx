"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { cancelSubscription } from "@/app/actions/account"

export function CancelSubscriptionButton() {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCancel() {
    setCancelling(true)
    setError(null)

    try {
      const result = await cancelSubscription()
      if (!result.success) {
        setError(result.error ?? "Failed to cancel subscription")
        return
      }
      setConfirming(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel subscription")
    } finally {
      setCancelling(false)
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--ds-danger)]/30 bg-[var(--ds-danger-bg)] px-4 text-[13px] font-medium text-[var(--ds-danger)] shadow-sm transition hover:opacity-90"
      >
        Cancel subscription
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <p className="text-sm text-[var(--ds-text-secondary)]">
        Schedule cancellation? Your paid access remains active until the end of the current billing period.
      </p>
      <button
        type="button"
        onClick={handleCancel}
        disabled={cancelling}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--ds-danger)] px-4 text-[13px] font-medium text-white disabled:opacity-60"
      >
        {cancelling && <Loader2 className="h-4 w-4 animate-spin" />}
        {cancelling ? "Scheduling..." : "Schedule cancellation"}
      </button>
      <button
        type="button"
        onClick={() => {
          setConfirming(false)
          setError(null)
        }}
        disabled={cancelling}
        className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--ds-border)] px-4 text-[13px] font-medium text-[var(--ds-text-secondary)] disabled:opacity-60"
      >
        Keep subscription
      </button>
      {error && <p className="text-sm text-[var(--ds-danger)]" role="alert">{error}</p>}
    </div>
  )
}
