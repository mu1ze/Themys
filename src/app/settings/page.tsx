import Link from "next/link"
import { currentUser } from "@clerk/nextjs/server"
import { SignOutButton } from "@clerk/nextjs"
import {
  CreditCard,
  LogOut,
  MapPin,
  Receipt,
  ScanLine,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  User as UserIcon,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Badge, Card, EmptyState, PageShell } from "@/components/ui"
import { ProfileLocationForm } from "@/components/profile-location-form"
import { ActiveSessionsManager } from "@/app/settings/active-sessions-manager"
import { ConnectedAccountManager } from "@/app/settings/connected-account-manager"
import { PrimaryEmailAddress } from "@/app/settings/primary-email-address"
import { IdentityProfileForm } from "@/app/settings/identity-profile-form"
import { PasswordForm } from "@/app/settings/password-form"
import { ProfileImageForm } from "@/app/settings/profile-image-form"
import { TargetClausesForm } from "@/app/settings/target-clauses-form"
import { DeleteAccountForm } from "@/app/settings/delete-account-form"
import { CancelSubscriptionButton } from "@/app/settings/cancel-subscription-button"
import { ManageBillingButton } from "@/app/settings/manage-billing-button"
import { BillingHelp } from "@/app/settings/billing-help"
import { getHeldCreditCount, listCustomerBillingCases, listCustomerDisputes, listCustomerRefunds } from "@/lib/billing-operations"
import { SettingsTabs } from "@/app/settings/settings-tabs"
import { SettingsActionDisclosure } from "@/app/settings/action-disclosure"
import {
  getCreditBalanceByClerkId,
  getUserProfileByClerkId,
  insertInvoice,
  listInvoicesByClerkId,
} from "@/lib/persistence"
import { getRateLimitStatus } from "@/lib/rate-limit"
import { syncPaymentHistoryFromStripe } from "@/lib/payment-history"
import { getStripe } from "@/lib/stripe"
import { cn } from "@/lib/cn"
import { planDisplayName } from "@/lib/entitlements"

function planLabel(plan: string): string {
  return planDisplayName(plan)
}

function statusBadge(status: string | null) {
  if (!status) return <Badge tone="neutral">Unknown</Badge>
  const map: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
    active: { label: "Active", tone: "success" },
    trialing: { label: "Trialing", tone: "success" },
    past_due: { label: "Past due", tone: "warning" },
    canceling: { label: "Canceling", tone: "warning" },
    canceled: { label: "Canceled", tone: "danger" },
    incomplete: { label: "Incomplete", tone: "warning" },
  }
  const entry = map[status] ?? { label: status, tone: "neutral" as const }
  return <Badge tone={entry.tone}>{entry.label}</Badge>
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount)
}

function formatDate(date: string | null): string {
  if (!date) return "—"
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "•"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function SettingsCard({
  icon: Icon,
  title,
  description,
  actions,
  tone = "neutral",
  children,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: string
  actions?: React.ReactNode
  tone?: "neutral" | "danger"
  children: React.ReactNode
  className?: string
}) {
  const chipTone =
    tone === "danger"
      ? "bg-[var(--ds-danger-bg)] text-[var(--ds-danger)]"
      : "bg-[var(--ds-accent-glow)] text-[var(--ds-accent)]"
  return (
    <Card
      className={cn(
        "min-w-0 overflow-hidden transition-colors duration-300 hover:border-[var(--ds-border-hover)]",
        tone === "danger" && "border-[var(--ds-danger)]/25 hover:border-[var(--ds-danger)]/40",
        className
      )}
    >
      <div className="flex flex-col gap-4 border-b border-[var(--ds-border)] px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="flex items-start gap-3.5">
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ds-radius-sm)]", chipTone)}>
            <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <h2 className="font-[family-name:var(--ds-doc-font)] text-[20px] font-normal leading-tight tracking-[-0.025em] text-[var(--ds-text)]">{title}</h2>
             {description ? (
               <p className="mt-1 text-[12px] leading-5 text-[var(--ds-text-muted)]">{description}</p>
             ) : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </Card>
  )
}

function StatTile({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string
  value: React.ReactNode
  icon?: LucideIcon
  hint?: React.ReactNode
}) {
  return (
    <div className="rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card)] px-4 py-4 transition-colors duration-200 hover:border-[var(--ds-border-hover)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--ds-text-muted)]">{label}</p>
        {Icon ? <Icon className="h-3.5 w-3.5 text-[var(--ds-text-dim)]" /> : null}
      </div>
      <p className="mt-2 font-[family-name:var(--ds-doc-font)] text-[24px] font-normal tracking-[-0.025em] text-[var(--ds-text)]">{value}</p>
      {hint ? <div className="mt-1 text-[12px] text-[var(--ds-text-muted)]">{hint}</div> : null}
    </div>
  )
}

export default async function SettingsPage() {
  const user = await currentUser()
  const clerkId = user?.id

  const [profile, creditBalance, initialInvoices] = clerkId
    ? await Promise.all([
        getUserProfileByClerkId(clerkId),
        getCreditBalanceByClerkId(clerkId),
        listInvoicesByClerkId(clerkId),
      ])
    : [null, 0, []]

  let invoices = initialInvoices
  const billingCases = clerkId ? await listCustomerBillingCases(clerkId) : []
  const [refunds, disputes] = clerkId
    ? await Promise.all([listCustomerRefunds(clerkId), listCustomerDisputes(clerkId)])
    : [[], []]
  const heldCredits = clerkId ? await getHeldCreditCount(clerkId) : 0
  if (profile?.stripeCustomerId) {
    try {
      await syncPaymentHistoryFromStripe({
        stripe: getStripe(),
        userId: profile.id,
        stripeCustomerId: profile.stripeCustomerId,
        writeInvoice: insertInvoice,
      })
      invoices = await listInvoicesByClerkId(clerkId!)
    } catch (error) {
      console.warn(
        "[settings] Failed to sync payment history from Stripe",
        error instanceof Error ? error.name : "UnknownError",
      )
    }
  }

  const tier = profile?.plan ?? "free"

  // Fallback: fetch billing date from Stripe if missing
  let subscriptionEndsAt = profile?.subscriptionEndsAt ?? null
  if (!subscriptionEndsAt && profile?.stripeCustomerId) {
    try {
      const stripe = getStripe()
      const subs = await stripe.subscriptions.list({ customer: profile.stripeCustomerId, status: "active", limit: 1 })
      const firstItem = subs.data[0]?.items?.data?.[0]
      if (firstItem?.current_period_end) {
        subscriptionEndsAt = new Date(firstItem.current_period_end * 1000).toISOString()
      }
    } catch (e) {
      console.warn(
        "[settings] Failed to fetch subscription from Stripe",
        e instanceof Error ? e.name : "UnknownError",
      )
    }
  }

  const aiStatus = clerkId
    ? await getRateLimitStatus(clerkId, tier, "ai")
    : null

  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    profile?.email ??
    ""
  const displayName =
    user?.fullName ?? user?.firstName ?? email.split("@")[0] ?? ""

  const plan = profile?.plan ?? "free"
  const subscriptionStatus = profile?.subscriptionStatus
  const createdAt = profile?.createdAt

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[var(--ds-bg)] pb-16">
      <PageShell className="settings-page min-w-0 space-y-8" width="data">
        {/* Header */}
        <header className="flex flex-col gap-6 border-b border-[var(--ds-border)] pb-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--ds-border)] bg-[var(--ds-card)] font-[family-name:var(--ds-doc-font)] text-[16px] text-[var(--ds-text)]">
              {user?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initials(displayName || email)
              )}
              <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--ds-bg)] bg-[var(--ds-success)]" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--ds-text-muted)]">
                Settings
              </p>
              <h1 className="mt-1 font-[family-name:var(--ds-doc-font)] text-[30px] font-normal leading-tight tracking-[-0.035em] text-[var(--ds-text)] sm:text-[34px]">
                Account settings
              </h1>
              <p className="mt-1.5 break-words text-[12px] text-[var(--ds-text-secondary)]">
                Manage your profile, subscription, and account preferences.
              </p>
            </div>
          </div>
          <Link
            href="/pricing"
            className="inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-2 rounded-full border border-[var(--ds-border)] bg-[var(--ds-card)] px-4 text-[12px] font-medium text-[var(--ds-text-secondary)] transition hover:border-[var(--ds-border-hover)] hover:text-[var(--ds-text)] sm:w-auto"
          >
            <CreditCard className="h-4 w-4 text-[var(--ds-text-dim)]" />
            Billing plans
          </Link>
        </header>

        <SettingsTabs
          panels={{
            profile: (
              <SettingsCard
                icon={UserIcon}
                title="Profile"
                description="Manage how your identity appears across Themys."
              >
                <div className="space-y-6">
                  <ProfileImageForm
                    displayName={displayName}
                    email={email}
                    initialImageUrl={user?.imageUrl ?? null}
                    initialHasImage={user?.hasImage ?? false}
                  />
                  <SettingsActionDisclosure
                    label="Edit profile"
                    description="Update your name and username."
                  >
                    <IdentityProfileForm
                      initialFirstName={user?.firstName ?? ""}
                      initialLastName={user?.lastName ?? ""}
                      initialUsername={user?.username ?? ""}
                    />
                  </SettingsActionDisclosure>

                  <PrimaryEmailAddress
                    initialEmail={email}
                    initialEmailCount={user?.emailAddresses.length ?? 0}
                    initialIsVerified={user?.primaryEmailAddress?.verification?.status === "verified"}
                  />

                  {createdAt ? (
                    <div className="border-t border-[var(--ds-border)] pt-5">
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--ds-text-dim)]">
                        Member since
                      </p>
                      <p className="mt-1.5 text-[13px] text-[var(--ds-text-secondary)]">{formatDate(createdAt)}</p>
                    </div>
                  ) : null}
                </div>
              </SettingsCard>
            ),

            accounts: (
              <SettingsCard
                icon={ShieldCheck}
                title="Connected accounts"
                description="External sign-in providers linked to your account."
              >
                <ConnectedAccountManager />
              </SettingsCard>
            ),

            location: (
              <SettingsCard
                icon={MapPin}
                title="Location profile"
                description="Set the country and state used to rank clauses by the rules that matter where you live."
              >
                <SettingsActionDisclosure
                  label="Edit location"
                  description="Update the country and region used to personalize scan results."
                >
                  <ProfileLocationForm defaultCountry={profile?.country} defaultState={profile?.state} />
                </SettingsActionDisclosure>
              </SettingsCard>
            ),

            scan: (
              <SettingsCard
                icon={SlidersHorizontal}
                title="Scan preferences"
                description="Configure your personalized AI scan settings."
              >
                <TargetClausesForm
                  defaultTargetClauses={profile?.targetClauses ?? []}
                  defaultStrictMode={profile?.strictMode ?? false}
                  defaultPlaybookId={profile?.playbookId ?? "consumer_app"}
                />
              </SettingsCard>
            ),

            subscription: (
              <SettingsCard
                icon={Sparkles}
                title="Subscription"
                description="Your current plan, billing status, and credit balance."
                actions={<Badge tone={plan === "free" ? "neutral" : "primary"}>{planLabel(plan)}</Badge>}
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <StatTile label="Plan" value={planLabel(plan)} icon={Sparkles} />
                  <StatTile label="Status" value={statusBadge(subscriptionStatus ?? null)} icon={ShieldCheck} />
                  <StatTile label="Credits" value={creditBalance} icon={CreditCard} hint="Available for scans" />
                  {heldCredits > 0 && <StatTile label="Credits on hold" value={heldCredits} icon={CreditCard} hint="While a billing request or dispute is reviewed" />}
                  <StatTile
                    label="AI explanations"
                    value={aiStatus ? `${aiStatus.remaining} / ${aiStatus.limit}` : "—"}
                    icon={ScanLine}
                    hint="This month"
                  />
                  <StatTile
                    label="Next billing"
                    value={formatDate(subscriptionEndsAt)}
                    icon={Receipt}
                    hint={subscriptionEndsAt ? (subscriptionStatus === "canceling" ? "Access ends on this date" : "Renews automatically") : undefined}
                  />
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[var(--ds-border)] pt-5">
                  {plan !== "free" ? (
                    <>
                      <ManageBillingButton canceling={subscriptionStatus === "canceling"} />
                      {subscriptionStatus === "canceling" ? (
                        <p className="text-[13px] text-[var(--ds-text-secondary)]">
                          Cancellation scheduled for the end of the current billing period.
                        </p>
                      ) : (
                        <CancelSubscriptionButton />
                      )}
                    </>
                  ) : (
                    <Link
                      href="/pricing"
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--ds-radius-sm)] bg-[var(--ds-accent)] px-4 text-[13px] font-semibold text-[var(--primary-foreground)] shadow-[var(--shadow-card)] transition hover:brightness-110 active:brightness-95"
                    >
                      Upgrade plan
                    </Link>
                  )}
                </div>
              </SettingsCard>
            ),

            payments: (
              <SettingsCard
                icon={Receipt}
                title="Payment history"
                description="Recent invoices from your subscription and credit purchases."
              >
                {profile?.stripeCustomerId && <div className="mb-5"><ManageBillingButton /></div>}
                {invoices.length === 0 ? (
                  <EmptyState
                    title="No payments yet"
                    description="Your payment history will appear here after your first transaction."
                    icon={Receipt}
                  />
                ) : (
                  <>
                    <ul className="divide-y divide-[var(--ds-border)] md:hidden">
                      {invoices.map((invoice) => (
                        <li key={invoice.id} className="space-y-2.5 py-4 first:pt-0 last:pb-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-[var(--ds-text)]">
                                {invoice.description ?? "Payment"}
                              </p>
                              <p className="mt-1 text-xs text-[var(--ds-text-muted)]">
                                {formatDate(invoice.paidAt)}
                              </p>
                            </div>
                            <p className="shrink-0 text-sm font-semibold text-[var(--ds-text)]">
                              {formatCurrency(invoice.amount, invoice.currency)}
                            </p>
                          </div>
                          <Badge
                            tone={
                              invoice.status === "paid"
                                ? "success"
                                : invoice.status === "pending"
                                  ? "warning"
                                  : invoice.status === "failed"
                                    ? "danger"
                                    : "neutral"
                            }
                          >
                            {invoice.status}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                    <div className="hidden overflow-hidden rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] md:block">
                      <table className="w-full text-left text-[14px]">
                        <thead>
                          <tr className="bg-[var(--ds-card-hover)]/60">
                            <th className="px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ds-text-muted)]">Date</th>
                            <th className="px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ds-text-muted)]">Description</th>
                            <th className="px-4 py-3 text-right font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ds-text-muted)]">Amount</th>
                            <th className="px-4 py-3 text-right font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ds-text-muted)]">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--ds-border)]">
                          {invoices.map((invoice) => (
                            <tr key={invoice.id} className="transition-colors hover:bg-[var(--ds-card-hover)]/60">
                              <td className="px-4 py-3.5 text-[var(--ds-text-secondary)]">
                                {formatDate(invoice.paidAt)}
                              </td>
                              <td className="px-4 py-3.5 font-medium text-[var(--ds-text)]">
                                {invoice.description ?? "Payment"}
                              </td>
                              <td className="px-4 py-3.5 text-right font-semibold text-[var(--ds-text)]">
                                {formatCurrency(invoice.amount, invoice.currency)}
                              </td>
                              <td className="px-4 py-3.5 text-right">
                                <Badge
                                  tone={
                                    invoice.status === "paid"
                                      ? "success"
                                      : invoice.status === "pending"
                                        ? "warning"
                                        : invoice.status === "failed"
                                          ? "danger"
                                          : "neutral"
                                  }
                                >
                                  {invoice.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                {(refunds.length > 0 || disputes.length > 0) && <div className="mt-6 rounded-md border border-[var(--ds-border)] p-4 text-sm text-[var(--ds-text-secondary)]">
                  <h3 className="font-semibold text-[var(--ds-text)]">Refunds and disputes</h3>
                  {refunds.map((item) => <p key={item.stripe_refund_id} className="mt-2">Refund {item.stripe_refund_id.slice(0, 12)} · {formatCurrency(item.amount_minor / 100, item.currency)} · {item.status}</p>)}
                  {disputes.map((item) => <p key={item.stripe_dispute_id} className="mt-2">Dispute {item.stripe_dispute_id.slice(0, 12)} · {formatCurrency(item.amount_minor / 100, item.currency)} · {item.status.replaceAll("_", " ")}</p>)}
                </div>}
                <BillingHelp invoices={invoices} cases={billingCases} email={email} />
              </SettingsCard>
            ),

            account: (
              <SettingsCard
                icon={ShieldCheck}
                title="Account & security"
                description="Manage your password, sessions, and account."
              >
                <SettingsActionDisclosure
                  label="Change password"
                  description={user?.passwordEnabled ? "Update your account password." : "Set a password for your account."}
                >
                  <PasswordForm passwordEnabled={user?.passwordEnabled ?? false} />
                </SettingsActionDisclosure>
                <ActiveSessionsManager />

                <div className="mt-7 border-t border-[var(--ds-danger)]/25 pt-6">
                  <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--ds-danger)]">
                    Account actions
                  </p>
                  <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0 break-words text-[13px] leading-6 text-[var(--ds-text-secondary)]">
                      Signing out ends your session on this device. Deleting your account is permanent and removes all
                      your data, including scans, clauses, and payment history.
                    </div>
                    <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center xl:w-auto">
                      <SignOutButton redirectUrl="/">
                        <button
                          type="button"
                          className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-[var(--ds-border)] bg-[var(--ds-card)] px-4 text-[12px] font-medium text-[var(--ds-text-secondary)] transition hover:border-[var(--ds-border-hover)] hover:bg-[var(--ds-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-accent)] sm:w-auto"
                        >
                          <LogOut className="h-4 w-4 text-[var(--ds-text-dim)]" />
                          Sign out
                        </button>
                      </SignOutButton>

                      <DeleteAccountForm />
                    </div>
                  </div>
                </div>
              </SettingsCard>
            ),
          }}
        />

        <p className="flex items-center justify-center gap-1.5 pt-2 text-center text-[11px] text-[var(--ds-text-dim)]">
          <Trash2 className="h-3 w-3" />
          Need help? Reach out to{" "}
          <a
            href="mailto:admin@themys.ca"
            className="font-medium text-[var(--ds-text-muted)] underline underline-offset-4 transition-colors hover:text-[var(--ds-text)]"
          >
            admin@themys.ca
          </a>
        </p>
      </PageShell>
    </div>
  )
}
