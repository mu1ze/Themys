"use client"

import { useState } from "react"
import { Loader2, Trash2, X } from "lucide-react"

import { deleteAccount } from "@/app/actions/account"
import { cn } from "@/lib/cn"

export function DeleteAccountForm() {
  const [showConfirm, setShowConfirm] = useState(false)
  const [status, setStatus] = useState<"idle" | "deleting" | "error">("idle")
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setStatus("deleting")
    setError(null)

    try {
      const result = await deleteAccount()
      if (!result.success) {
        throw new Error(result.error ?? "Failed to delete account")
      }
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Failed to delete account")
    }
  }

  if (!showConfirm) {
    return (
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--ds-danger)]/30 bg-[var(--ds-danger-bg)] px-5 text-[12px] font-medium text-[var(--ds-danger)] transition hover:border-[var(--ds-danger)]/50 hover:bg-[var(--ds-danger-bg)]/80 sm:w-auto"
      >
        <Trash2 className="h-4 w-4" />
        Delete account
      </button>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--ds-danger)]/30 bg-[var(--ds-danger-bg)] p-4">
        <p className="text-sm font-semibold text-[var(--ds-text)]">
          This action cannot be undone
        </p>
        <p className="mt-1 text-sm leading-6 text-[var(--ds-text-secondary)]">
          Deleting your account will permanently remove all your data, including scans,
          clauses, and payment history. This includes removing your account from Clerk.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={handleDelete}
          disabled={status === "deleting"}
          className={cn(
            "inline-flex h-11 items-center gap-2 rounded-md bg-[var(--ds-danger)] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--ds-danger)]/80 disabled:cursor-not-allowed disabled:opacity-60"
          )}
        >
          {status === "deleting" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          <span>{status === "deleting" ? "Deleting..." : "Confirm deletion"}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setShowConfirm(false)
            setStatus("idle")
            setError(null)
          }}
          disabled={status === "deleting"}
          className="inline-flex h-11 items-center gap-1.5 rounded-md border border-[var(--ds-border)] bg-[var(--ds-card)] px-5 text-sm font-semibold text-[var(--ds-text-secondary)] shadow-sm transition hover:border-[var(--ds-border)] hover:bg-[var(--ds-card-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <X className="h-4 w-4" />
          Cancel
        </button>
      </div>

      {error && (
        <p className="text-sm text-[var(--ds-danger)]" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
