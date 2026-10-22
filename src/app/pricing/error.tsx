"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/browser"
import Link from "next/link"

export default function PricingError({
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
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="mx-auto max-w-lg text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
          Themys
        </p>
        <h1 className="mt-3 text-[28px] font-medium tracking-[-0.035em] leading-tight text-foreground">
          Pricing is temporarily unavailable
        </h1>
        <p className="mt-3 text-[16px] leading-6 text-[var(--ds-text-secondary)]">
          The rest of the site is still available. Retry once, and if the page
          keeps failing, use the dashboard or contact support.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-white transition hover:opacity-90"
          >
            Retry
          </button>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--ds-border)] px-6 text-sm font-medium text-[var(--ds-text-secondary)] transition hover:bg-[var(--ds-card-hover)]"
          >
            Go Home
          </Link>
        </div>
      </div>
    </main>
  )
}
