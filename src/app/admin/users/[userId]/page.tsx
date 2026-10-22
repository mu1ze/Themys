import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { getUserAdminDetail } from "@/features/admin/server/queries";
import { PlanBadge, SubscriptionStatusBadge, RiskBadge } from "@/components/admin/plan-badge";
import { ChangePlanForm } from "@/components/admin/change-plan-form";
import { SeedCachedScansButton } from "@/components/admin/seed-cached-scans-button";

/* Admin v3 user detail — 07·D: peach briefing header carries who-this-is;
   operational facts (profile/plan change, allowances, history, invoices)
   stay in card sections below. Sheet-07 pick, materialised. */

function SectionHeading({ title, note, children }: { title: string; note?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--admin-dim)]">{title}</p>
        {note && <p className="mt-1 text-sm text-[var(--admin-muted)]">{note}</p>}
      </div>
      {children}
    </div>
  );
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const detail = await getUserAdminDetail(userId);

  if (!detail) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--admin-dim)] hover:text-[var(--admin-ink)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to users
        </Link>
        <p className="text-[var(--admin-muted)]">User not found.</p>
      </div>
    );
  }

  const { profile, scans, creditPacks, invoices, scanRateLimit, aiRateLimit } = detail;

  return (
    <div className="space-y-8">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--admin-dim)] hover:text-[var(--admin-ink)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Users
      </Link>

      {/* ── 07·D: peach briefing header — who this is ── */}
      <div
        className="flex flex-col gap-4 rounded-none px-6 py-6 sm:flex-row sm:items-center sm:justify-between"
        style={{ background: "var(--admin-peach)", border: "1px solid color-mix(in srgb, var(--admin-sienna) 14%, transparent)" }}
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--admin-sienna)" }}>
            {profile.email}
          </h1>
          <p className="mt-1.5 font-mono text-xs" style={{ color: "color-mix(in srgb, var(--admin-sienna) 70%, transparent)" }}>
            clerk · {profile.clerkId} · joined {new Date(profile.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PlanBadge
            plan={profile.plan}
            className="border-[color-mix(in_srgb,var(--admin-sienna)_25%,transparent)] bg-[color-mix(in_srgb,var(--admin-paper)_62%,transparent)]"
          />
          <SubscriptionStatusBadge status={profile.subscriptionStatus} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile & billing facts */}
        <section className="admin-panel" style={{ padding: "20px 22px" }}>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--admin-dim)]">
            Profile &amp; billing
          </p>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--admin-muted)]">Email</dt>
              <dd className="font-medium text-[var(--admin-ink)]">{profile.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--admin-muted)]">Plan</dt>
              <dd><PlanBadge plan={profile.plan} /></dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--admin-muted)]">Subscription</dt>
              <dd><SubscriptionStatusBadge status={profile.subscriptionStatus} /></dd>
            </div>
            {profile.subscriptionEndsAt && (
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--admin-muted)]">Renews / ends</dt>
                <dd className="text-[var(--admin-ink)]">
                  {new Date(profile.subscriptionEndsAt).toLocaleDateString()}
                </dd>
              </div>
            )}
            {profile.stripeCustomerId && (
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--admin-muted)]">Stripe customer</dt>
                <dd className="flex items-center gap-1 font-mono text-xs text-[var(--admin-ink)]">
                  {profile.stripeCustomerId}
                  <a
                    href={`https://dashboard.stripe.com/customers/${profile.stripeCustomerId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--admin-dim)] hover:text-[var(--admin-ink)]"
                    aria-label="Open in Stripe"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </dd>
              </div>
            )}
            {profile.country && (
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--admin-muted)]">Location</dt>
                <dd className="text-[var(--admin-ink)]">
                  {[profile.state, profile.country].filter(Boolean).join(", ")}
                </dd>
              </div>
            )}
          </dl>
          <div className="mt-5 border-t border-[var(--admin-line)] pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--admin-dim)]">
              Change plan
            </p>
            <div className="mt-3">
              <ChangePlanForm userId={profile.id} currentPlan={profile.plan} />
            </div>
          </div>
        </section>

        {/* Allowances right now */}
        <section className="admin-panel" style={{ padding: "20px 22px" }}>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--admin-dim)]">
            Allowances right now
          </p>
          <div className="mt-4 space-y-4 text-sm">
            <div>
              <div className="flex justify-between">
                <span className="text-[var(--admin-muted)]">Scans today</span>
                <span className="font-mono text-[var(--admin-ink)]">
                  {scanRateLimit ? `${scanRateLimit.remaining} / ${scanRateLimit.limit} remaining` : "—"}
                </span>
              </div>
              {scanRateLimit && (
                <div className="mt-1.5 h-1 overflow-hidden bg-[var(--admin-line-subtle)]">
                  <div
                    className="h-full bg-[var(--admin-muted)]"
                    style={{
                      width: `${Math.min(100, ((scanRateLimit.limit - scanRateLimit.remaining) / scanRateLimit.limit) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
            <div>
              <div className="flex justify-between">
                <span className="text-[var(--admin-muted)]">AI this month</span>
                <span className="font-mono text-[var(--admin-ink)]">
                  {aiRateLimit ? `${aiRateLimit.remaining} / ${aiRateLimit.limit} remaining` : "—"}
                </span>
              </div>
              {aiRateLimit && (
                <div className="mt-1.5 h-1 overflow-hidden bg-[var(--admin-line-subtle)]">
                  <div
                    className="h-full bg-[var(--admin-muted)]"
                    style={{
                      width: `${Math.min(100, ((aiRateLimit.limit - aiRateLimit.remaining) / aiRateLimit.limit) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          </div>
          <p className="admin-footnote mt-5">
            Rate-limit buckets are the live enforcement state. Quota rejections appear in this account&apos;s
            usage event stream — they are product limits, not failures.
          </p>
        </section>
      </div>

      {/* Review history */}
      <section className="admin-panel" style={{ padding: "20px 22px" }}>
        <SectionHeading
          title="Review history"
          note={`${scans.length} scan${scans.length !== 1 ? "s" : ""} · restore copies unsaved URL analyses from the public cache into history; it does not attach the entire cache to the user.`}
        >
          <SeedCachedScansButton userId={profile.id} />
        </SectionHeading>

        {scans.length > 0 ? (
          <div className="admin-scroll-table mt-4">
            <table>
              <thead>
                <tr>
                  <th scope="col">Review</th>
                  <th scope="col">Risk</th>
                  <th scope="col">Clauses</th>
                  <th scope="col">Date</th>
                </tr>
              </thead>
              <tbody>
                {scans.map((scan) => (
                  <tr key={scan.id}>
                    <td>
                      <Link
                        href={`/admin/scans/${scan.id}`}
                        className="font-medium text-[var(--admin-ink)] hover:underline hover:underline-offset-4"
                      >
                        {scan.domain ?? scan.title ?? "Untitled"}
                      </Link>
                    </td>
                    <td><RiskBadge score={scan.riskScore} /></td>
                    <td className="text-[var(--admin-muted)]">
                      {scan.clauseCount} ({scan.flaggedCount} flagged)
                    </td>
                    <td className="text-[var(--admin-dim)]">
                      {new Date(scan.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="admin-empty mt-4">No scans recorded.</p>
        )}
      </section>

      {/* Credit packs */}
      <section className="admin-panel" style={{ padding: "20px 22px" }}>
        <SectionHeading title="Credit packs" note="Recorded product credits — not currency." />
        {creditPacks.length > 0 ? (
          <div className="admin-scroll-table mt-4">
            <table>
              <thead>
                <tr>
                  <th scope="col">Size</th>
                  <th scope="col">Remaining</th>
                  <th scope="col">Paid</th>
                  <th scope="col">Purchased</th>
                  <th scope="col">Expires</th>
                </tr>
              </thead>
              <tbody>
                {creditPacks.map((pack) => {
                  const expired = new Date(pack.expiresAt) < new Date();
                  return (
                    <tr key={pack.id} className={expired ? "opacity-50" : ""}>
                      <td className="font-medium text-[var(--admin-ink)]">{pack.packSize} credits</td>
                      <td>{pack.creditsRemaining}</td>
                      <td>${pack.pricePaid.toFixed(2)}</td>
                      <td className="text-[var(--admin-dim)]">{new Date(pack.purchasedAt).toLocaleDateString()}</td>
                      <td className="text-[var(--admin-dim)]">
                        {expired ? <span className="text-[var(--admin-rose)]">Expired</span> : new Date(pack.expiresAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="admin-empty mt-4">No credit packs purchased.</p>
        )}
      </section>

      {/* Invoices */}
      <section className="admin-panel" style={{ padding: "20px 22px" }}>
        <SectionHeading
          title="Invoices"
          note="Amounts as recorded at payment time. Reconcile with Stripe before financial reporting."
        />
        {invoices.length > 0 ? (
          <div className="admin-scroll-table mt-4">
            <table>
              <thead>
                <tr>
                  <th scope="col">Amount</th>
                  <th scope="col">Status</th>
                  <th scope="col">Description</th>
                  <th scope="col">Date</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="font-medium text-[var(--admin-ink)]">
                      ${inv.amount.toFixed(2)} {inv.currency.toUpperCase()}
                    </td>
                    <td>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                          inv.status === "paid"
                            ? "border-[color-mix(in_srgb,var(--admin-green)_30%,transparent)] bg-[var(--admin-green-bg)] text-[var(--admin-green)]"
                            : inv.status === "failed"
                              ? "border-[color-mix(in_srgb,var(--admin-rose)_30%,transparent)] bg-[var(--admin-rose-bg)] text-[var(--admin-rose)]"
                              : "border-[var(--admin-line)] bg-[var(--admin-surface)] text-[var(--admin-muted)]"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate text-[var(--admin-muted)]">
                      {inv.description ?? "—"}
                    </td>
                    <td className="text-[var(--admin-dim)]">
                      {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="admin-empty mt-4">No invoices recorded.</p>
        )}
      </section>
    </div>
  );
}
