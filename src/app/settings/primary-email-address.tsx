"use client"

import { useUser } from "@clerk/nextjs"

import { Badge } from "@/components/ui"
import { useHasHydrated } from "@/lib/use-has-hydrated"

export function PrimaryEmailAddress({
  initialEmail,
  initialEmailCount,
  initialIsVerified,
}: {
  initialEmail: string
  initialEmailCount: number
  initialIsVerified: boolean
}) {
  const { isLoaded, user } = useUser()
  const hydrated = useHasHydrated()
  const email = hydrated && isLoaded
    ? user?.primaryEmailAddress?.emailAddress ?? initialEmail
    : initialEmail
  const emailCount = hydrated && isLoaded
    ? user?.emailAddresses.length ?? initialEmailCount
    : initialEmailCount
  const isVerified = hydrated && isLoaded
    ? user?.primaryEmailAddress?.verification.status === "verified"
    : initialIsVerified

  return (
    <div className="rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card)] px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--ds-text-dim)]">
            Account email
          </p>
          <p className="mt-1 break-all text-[13px] font-medium text-[var(--ds-text)]">
            {email || "No email address connected"}
          </p>
        </div>
        {email ? (
          <div className="flex shrink-0 flex-wrap gap-1.5">
            <Badge tone="primary">Primary</Badge>
            <Badge tone={isVerified ? "success" : "warning"}>
              {isVerified ? "Verified" : "Not verified"}
            </Badge>
          </div>
        ) : null}
      </div>
      <p className="mt-3 text-[12px] leading-5 text-[var(--ds-text-muted)]">
        {emailCount > 1
          ? `This account currently has ${emailCount} email addresses. Contact support to resolve extra addresses.`
          : email
            ? "One email address is connected to this account. Contact support if it needs to change."
            : "No email address is connected. Contact support for account help."}
      </p>
    </div>
  )
}
