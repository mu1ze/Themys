import Link from "next/link"
import { XCircle } from "lucide-react"

export default function CheckoutCancelPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#fee2e2]">
          <XCircle className="h-8 w-8 text-[#dc2626]" strokeWidth={2} />
        </div>

        <h1 className="mt-6 text-[28px] font-medium tracking-[-0.035em] leading-tight text-foreground">
          Checkout canceled
        </h1>
        <p className="mt-3 text-[16px] leading-6 text-[var(--ds-text-secondary)]">
          No charges were made. You can try again whenever you&apos;re ready.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/pricing"
            className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-white transition hover:opacity-90"
          >
            Try Again
          </Link>
          <Link
            href="#"
            className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--ds-border)] px-6 text-sm font-medium text-[var(--ds-text-secondary)] transition hover:bg-[var(--ds-card-hover)]"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </main>
  )
}
