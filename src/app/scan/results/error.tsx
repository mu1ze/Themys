"use client"

import * as Sentry from "@sentry/browser"
import { useEffect } from "react"

export default function ScanResultsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <section className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-bold text-foreground">We could not load these scan results</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--ds-text-secondary)]">
        Your scan has not been deleted. Please retry, or return to your scan history and open it again.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-10 items-center rounded-[var(--ds-radius-sm)] border border-transparent bg-primary px-4 text-sm font-medium text-white shadow-[var(--shadow-card)] transition hover:brightness-110 active:brightness-95"
        >
          Retry
        </button>
        <a href="/history" className="inline-flex h-10 items-center rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card)] px-4 text-sm font-medium text-[var(--ds-text)] transition hover:border-[var(--ds-border-hover)] hover:bg-[var(--ds-card-hover)]">
          Scan history
        </a>
      </div>
    </section>
  )
}
