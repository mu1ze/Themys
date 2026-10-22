import Link from "next/link";
import { Activity, Users, ScanLine } from "lucide-react";
import { ratio, type MetricsData, type MetricRow, type ReportingWindow } from "@/features/admin/metrics/queries";
import type { D1InventoryRow } from "@/features/admin/data-inventory";
import type { SourceHealth } from "@/features/admin/metrics/server";

export type DashboardView = "overview" | "growth" | "revenue" | "reliability" | "usage";

/* Admin v3 composite — component picks: 02·D header+tabs, 03·C KPI ledger rows,
   04·D bars+trend, 08·A action rows, 09·B peach tiles, 10·D status strip.
   Honesty rules from admin/KPIS.md are structural: a missing measure renders a
   dash with its definition, never a zero; currency rows are never summed. */

const views = {
  overview: { title: "The business, at a glance.", description: "Are people finding value—and can they rely on us?", path: "/admin" },
  growth: { title: "From first review to a habit.", description: "Activation, repeat use, and the path toward a purchase.", path: "/admin/conversion" },
  revenue: { title: "What customers have paid.", description: "Recorded payments and subscription state, with currencies kept separate.", path: "/admin/revenue" },
  reliability: { title: "Every review should work.", description: "Recorded outcomes, blocked requests, and backend response times.", path: "/admin/system" },
  usage: { title: "Where the value is delivered.", description: "Review activity across web, Chrome, Safari, and the API.", path: "/admin/usage" },
};
const channels: Record<string, string> = { web: "Web app", extension: "Chrome", "safari-ios": "Safari / iOS", api_key: "Developer API", cron: "Monitoring" };
const num = (row: MetricRow | undefined, key: string) => Number(row?.[key] ?? 0);
const count = (value: number) => value.toLocaleString("en-US");
const dayLabel = (date: string) => new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const currency = (value: number, code: string) => {
  const normalized = code.trim().toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: normalized, currencyDisplay: "code" }).format(value);
  } catch {
    return `${normalized || "UNKNOWN"} ${value.toFixed(2)}`;
  }
};

/* ── 03·C: KPI ledger row — label / value / detail / definition trigger ── */

function KpiRow({ label, sub, value, movement, detail, definition, alert = false }: {
  label: string;
  sub?: string;
  value: string;
  movement?: { kind: "up" | "down" | "flat"; text: string };
  detail: string;
  definition: string;
  alert?: boolean;
}) {
  return (
    <div className="admin-kpi-row">
      <div className="label">
        {label}
        {sub && <span>{sub}</span>}
      </div>
      <div className={`value${alert ? " alert" : ""}`}>
        {value}
        {value !== "—" && movement && (
          <span className={movement.kind}>{movement.text}</span>
        )}
      </div>
      <div className="detail">{value === "—" ? "Measure unavailable or denominator empty — shown as “—”, never zero." : detail}</div>
      <details className="def">
        <summary aria-label={`Definition: ${label}`}>DEF ↗</summary>
        <p>{definition}</p>
      </details>
    </div>
  );
}

function KpiLedger({ children, note }: { children: React.ReactNode; note: string }) {
  return (
    <>
      <div className="admin-section-label"><span>Key measures</span><span>{note}</span></div>
      <div className="admin-kpi-ledger">{children}</div>
    </>
  );
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="admin-panel">
      <h2>{title}</h2>
      {note && <p className="note">{note}</p>}
      {children}
    </section>
  );
}

function Empty({ children = "No activity in this period." }: { children?: React.ReactNode }) {
  return <p className="admin-empty">{children}</p>;
}

/* ── 04·D: pale sienna bars + ink trend line ── */

function Trend({ rows, window: win }: { rows: MetricRow[] | null; window: ReportingWindow }) {
  if (!rows) return <Empty>Review activity is unavailable. Reload to retry.</Empty>;
  const points = Array.from({ length: win.days }, (_, index) => {
    const date = new Date(new Date(win.start).getTime() + index * 86400000).toISOString().slice(0, 10);
    return { date, value: num(rows.find((row) => row.day === date), "count") };
  });
  const total = points.reduce((sum, p) => sum + p.value, 0);
  const max = Math.max(1, ...points.map((p) => p.value));
  const avg = Math.round(total / points.length);
  const w = 1000;
  const h = 150;
  const linePoints = points
    .map((p, i) => `${(i / (points.length - 1)) * w},${h - (p.value / max) * (h - 10) - 2}`)
    .join(" ");

  return (
    <>
      <div className="admin-trend-stats">
        <div className="s"><span>Total reviews</span><b>{count(total)}</b></div>
        <div className="s"><span>Daily average</span><b>{count(avg)}</b></div>
        <div className="s"><span>Peak day</span><b>{count(max)}</b></div>
      </div>
      <div className="admin-trend" role="img" aria-label={`Daily saved reviews, ${count(total)} total over ${win.days} days. Daily values are available in the table below.`}>
        <span
          aria-hidden="true"
          className="absolute left-0 top-0 -translate-y-full pb-1 font-mono text-[9px] tracking-wide text-[var(--admin-dim)]"
        >
          {count(max)} reviews/day
        </span>
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-0 -translate-x-full -translate-y-1 pr-2 font-mono text-[9px] tracking-wide text-[var(--admin-dim)]"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg) translateX(50%)", height: "100%", position: "absolute", left: -18 }}
        >
          REVIEWS
        </span>
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" width="100%" height={h} aria-hidden="true">
          <polyline points={linePoints} fill="none" stroke="var(--admin-ink)" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {points.map((p) => (
          <div className="bar" key={p.date} title={`${p.date}: ${count(p.value)} reviews`} style={{ height: `${Math.max(2, (p.value / max) * 100)}%` }} />
        ))}
      </div>
      <div className="admin-chart-labels">
        <span>{dayLabel(win.start)}</span>
        <span className="legend">
          <span><i style={{ background: "var(--admin-chart-fill)" }} />daily</span>
          <span><i style={{ background: "var(--admin-ink)", height: 2 }} />trend</span>
        </span>
        <span>{dayLabel(points.at(-1)!.date)}</span>
      </div>
      <p className="admin-chart-axis-note">
        X axis: day (UTC, {win.days} complete days ending {dayLabel(points.at(-1)!.date)}) · Y axis: saved reviews per day, 0–{count(max)}
      </p>
      <details className="admin-data-details">
        <summary>View daily values</summary>
        <div className="admin-scroll-table">
          <table>
            <thead><tr><th scope="col">Date (UTC)</th><th scope="col">Reviews</th></tr></thead>
            <tbody>{points.map((p) => <tr key={p.date}><td>{p.date}</td><td>{count(p.value)}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </>
  );
}

function ChannelTable({ rows }: { rows: MetricRow[] | null }) {
  if (!rows) return <Empty>Channel metrics are unavailable.</Empty>;
  if (!rows.length) return <Empty />;
  return (
    <div className="admin-scroll-table">
      <table>
        <thead><tr>
          <th scope="col">Channel</th><th scope="col">Succeeded</th><th scope="col">Failed</th>
          <th scope="col">Quota limited</th><th scope="col">Cached</th>
        </tr></thead>
        <tbody>
          {Object.entries(channels).map(([id, label]) => {
            const channel = rows.filter((row) => row.channel === id);
            const success = num(channel.find((r) => r.outcome === "success"), "count");
            const failed = num(channel.find((r) => r.outcome === "failed"), "count");
            const limited = num(channel.find((r) => r.outcome === "quota_rejected"), "count");
            return (
              <tr key={id}>
                <th scope="row">{label}</th>
                <td>{count(success)}</td>
                <td>{failed > 0 ? count(failed) : "0"}</td>
                <td>{limited > 0 ? count(limited) : "0"}</td>
                <td>{ratio(channel.reduce((s, r) => s + num(r, "cached"), 0), success)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── 10·D: source status strip — every row is a real query ── */

function StatusStrip({ health, inventory }: { health: SourceHealth | null; inventory: D1InventoryRow[] | null }) {
  const expected = inventory?.length ?? null;
  const available = inventory?.filter((row) => row.available).length ?? null;
  const lastEvent = health?.lastEventAt ? `${health.lastEventAt.replace("T", " ").slice(0, 16)} UTC` : null;
  const lastStripeEvent = health?.lastStripeEventAt ? `${health.lastStripeEventAt.replace("T", " ").slice(0, 16)} UTC` : null;
  const rows: { name: string; state: "ok" | "warn" | "fail"; evidence: string }[] = [
    {
      name: "Cloudflare D1",
      state: expected != null && available != null
        ? (available === expected ? "ok" : "warn")
        : health?.inventoryTables != null ? "ok" : "fail",
      evidence: expected != null && available != null
        ? `INVENTORY ${available}/${expected} TABLES${health?.retainedScans != null ? ` · ${count(health.retainedScans)} REVIEWS RETAINED` : ""}`
        : health?.inventoryTables != null
          ? `SCHEMA READ ${count(health.inventoryTables)} TABLES${health.retainedScans != null ? ` · ${count(health.retainedScans)} REVIEWS RETAINED` : ""}`
          : "SCHEMA READ UNAVAILABLE · MEASURES SHOW —",
    },
    {
      name: "Usage events",
      state: lastEvent ? "ok" : "warn",
      evidence: lastEvent ? `LAST EVENT ${lastEvent}` : "NO EVENT RECORDED · MEASURES SHOW —",
    },
    {
      name: "Stripe webhook ledger",
      state: lastStripeEvent ? "ok" : "warn",
      evidence: lastStripeEvent ? `LAST RECEIVED ${lastStripeEvent} · RECONCILE MANUALLY` : "NO WEBHOOK EVENT RECORDED · RECONCILE MANUALLY",
    },
  ];
  return (
    <div className="admin-status-strip">
      {rows.map((row) => (
        <div className="srow" key={row.name}>
          <span
            className="d"
            aria-hidden="true"
            style={{ background: row.state === "ok" ? "var(--admin-green)" : row.state === "warn" ? "var(--admin-amber)" : "var(--admin-rose)" }}
          />
          <b>{row.name}</b>
          <span className="q">{row.evidence}</span>
        </div>
      ))}
    </div>
  );
}

function D1Inventory({ rows }: { rows: D1InventoryRow[] | null }) {
  if (!rows) return <Empty>The D1 inventory could not be read. Reload to retry.</Empty>;
  const available = rows.filter((row) => row.available);
  const missing = rows.filter((row) => !row.available);
  const rowCount = (table: string) => rows.find((row) => row.table === table)?.count ?? 0;
  const activityTables = ["scans", "clauses", "invoices", "usage_events"];
  const looksPartiallyCopied = rowCount("users") > 0 && activityTables.every((table) => rowCount(table) === 0);

  return (
    <>
      <div className="admin-signal-grid">
        <div><p>D1 schema</p><strong>{available.length} / {rows.length}</strong><span>expected tables available</span></div>
        <div><p>Stored rows</p><strong>{count(available.reduce((sum, row) => sum + (row.count ?? 0), 0))}</strong><span>across all D1 datasets</span></div>
      </div>
      {missing.length > 0 && <div role="alert" className="admin-alert" style={{ marginTop: 14 }}><strong>D1 schema is incomplete.</strong> Missing: {missing.map((row) => row.table).join(", ")}.</div>}
      {looksPartiallyCopied && <div role="alert" className="admin-alert" style={{ marginTop: 14 }}><strong>The database may only be partially copied.</strong> D1 has account rows, but reviews, clauses, invoices, and product events are all empty. Compare D1 with the frozen Supabase source before treating this as a completed migration.</div>}
      <details className="admin-data-details" open={missing.length > 0 || looksPartiallyCopied}>
        <summary>View every D1 dataset</summary>
        <div className="admin-scroll-table">
          <table>
            <thead><tr><th scope="col">Dataset</th><th scope="col">Table</th><th scope="col">Rows</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {rows.map((dataset) => (
                <tr key={dataset.table}>
                  <th scope="row">{dataset.label}</th>
                  <td>{dataset.table}</td>
                  <td>{dataset.count === null ? "—" : count(dataset.count)}</td>
                  <td>{dataset.available ? "Available" : "Missing"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className="admin-footnote">Source: the Cloudflare D1 <code>DB</code> binding used by this admin Worker. These counts prove what is currently in D1; source parity still requires the guarded migration verification against Supabase.</p>
    </>
  );
}

/* ── The dashboard ── */

export function FounderDashboard({
  data,
  inventory,
  health,
  window: win,
  view = "overview",
}: {
  data: MetricsData;
  inventory: D1InventoryRow[] | null;
  health: SourceHealth | null;
  window: ReportingWindow;
  view?: DashboardView;
}) {
  const meta = views[view];
  const accounts = data.accounts?.[0];
  const reviewers = data.reviewers?.[0];
  const activation = data.activation?.[0];
  const scans = data.scans?.[0];
  const value = (rows: MetricRow[] | null, key: string) => (rows ? count(num(rows[0], key)) : "—");
  const outcome = (name: string) => (data.channels ?? []).filter((r) => r.outcome === name).reduce((sum, row) => sum + num(row, "count"), 0);
  const successes = outcome("success");
  const failures = outcome("failed");
  const blocked = outcome("quota_rejected");
  const successfulRate = data.channels ? ratio(successes, successes + failures) : "—";
  const cached = (data.channels ?? []).reduce((sum, row) => sum + num(row, "cached"), 0);
  const paywall = num(data.commercial?.find((r) => r.operation === "paywall_view"), "people");
  const checkout = num(data.commercial?.find((r) => r.operation === "checkout_start"), "people");
  const failedGroups = Object.entries(data).filter(([, rows]) => rows === null).map(([key]) => key);
  const link = (path: string) => `${path}?days=${win.days}`;
  const activationRate = data.activation ? ratio(num(activation, "activated"), num(activation, "eligible")) : "—";
  const retainedRate = data.reviewers ? ratio(num(reviewers, "retained"), num(reviewers, "previous_active")) : "—";
  const periodNote = "compared with the preceding interval";

  const kpiLedger = (children: React.ReactNode, note = periodNote) => <KpiLedger note={note}>{children}</KpiLedger>;
  const reviewerDelta = num(reviewers, "active") - num(reviewers, "previous_active");
  const newAccountDelta = num(accounts, "new_users") - num(accounts, "previous_users");
  const movement = (delta: number) => ({
    kind: delta === 0 ? "flat" as const : delta > 0 ? "up" as const : "down" as const,
    text: delta === 0 ? " —" : ` ${delta > 0 ? "▲" : "▼"}${Math.abs(delta)}`,
  });
  const timedSamples = num(data.latency?.[0], "samples");
  const p95 = data.latency && timedSamples > 0 ? `${(num(data.latency[0], "p95_ms") / 1000).toFixed(1)}s` : "—";
  const paidInvoices = data.revenue?.reduce((sum, row) => sum + num(row, "payments"), 0) ?? 0;
  const pricing = num(data.commercial?.find((row) => row.operation === "pricing_view"), "people");

  let viewContent: React.ReactNode;

  if (view === "growth") {
    viewContent = (
      <>
        {kpiLedger(
          <>
            <KpiRow
              label="New accounts"
              sub="period"
              value={value(data.accounts, "new_users")}
              movement={data.accounts ? movement(newAccountDelta) : undefined}
              detail={`${count(num(accounts, "new_users"))} persisted profiles, versus ${count(num(accounts, "previous_users"))} in the preceding interval.`}
              definition="Surviving local user profiles created during the selected period, compared with the preceding equal-length period. Clerk registrations not yet persisted are not counted."
            />
            <KpiRow
              label="7-day activation"
              sub="period · mature cohort"
              value={activationRate}
              detail={`${count(num(activation, "activated"))} of ${count(num(activation, "eligible"))} eligible accounts saved a review in their first seven days.`}
              definition="Accounts created in the selected window shifted back seven days, with a saved non-monitoring review in their first seven days. Every account has a full observation window."
            />
            <KpiRow
              label="Repeat reviewers"
              sub="period"
              value={retainedRate}
              detail={`${count(num(reviewers, "retained"))} reviewers returned from ${count(num(reviewers, "previous_active"))} prior-period reviewers.`}
              definition="People with a saved non-monitoring review in both adjacent periods / reviewers in the previous period. Deleted reviews and deleted accounts are excluded."
            />
            <KpiRow
              label="Paywall → checkout"
              sub="period · 7-day handoff"
              value={data.handoff && data.commercial ? ratio(num(data.handoff[0], "converted"), paywall) : "—"}
              detail={`${count(num(data.handoff?.[0], "converted"))} of ${count(paywall)} tracked paywall viewers started checkout.`}
              definition="Distinct tracked actors who started checkout after a paywall view within seven days, with both events inside the selected period. Checkout does not imply payment."
            />
          </>,
        )}
        <div className="admin-section-label"><span>Commercial intent · separate populations</span></div>
        <div className="admin-signal-grid">
          <div><p>Pricing viewers</p><strong>{data.commercial ? count(pricing) : "—"}</strong><span>distinct tracked actors</span></div>
          <div><p>Paywall viewers</p><strong>{data.commercial ? count(paywall) : "—"}</strong><span>distinct tracked actors</span></div>
          <div><p>Checkout starters</p><strong>{data.commercial ? count(checkout) : "—"}</strong><span>intent only · not payment</span></div>
        </div>
        <p className="admin-footnote">These are separate signals in the same period, not a visitor-to-paid conversion funnel.</p>
      </>
    );
  } else if (view === "revenue") {
    viewContent = (
      <>
        {kpiLedger(
          <>
            <KpiRow label="Active subscriptions" sub="current snapshot" value={value(data.accounts, "active_subscriptions")} detail="Accounts whose synchronized subscription state is active; trials are separate." definition="Accounts whose current subscription_status is active. Trials and manually assigned paid plans are excluded. This is a present-day snapshot, not a period total." />
            <KpiRow label="In trial" sub="current snapshot" value={value(data.accounts, "trials")} detail="Current accounts in a trialing subscription state." definition="Current accounts with trialing subscription status. These are not counted as active paying subscriptions." />
            <KpiRow label="Past due" sub="current snapshot" value={value(data.accounts, "past_due")} alert={num(accounts, "past_due") > 0} detail="Accounts that need billing follow-up in Stripe." definition="Current accounts with past_due subscription status according to the synchronized D1 profile." />
            <KpiRow label="Recorded paid invoices" sub="period" value={data.revenue ? count(paidInvoices) : "—"} detail="Paid-at date falls inside the selected interval; refunded records are excluded." definition="Invoices with status paid and paid_at within the interval. This is a record count, not MRR or audited net revenue." />
          </>,
          "snapshots labeled current · collections use the selected period",
        )}
        <div className="admin-section-label"><span>Recorded collections · currencies kept separate</span></div>
        {data.revenue?.length ? (
          <div className="admin-signal-grid">
            {data.revenue.map((row) => (
              <div key={String(row.currency)}>
                <p>{String(row.currency).toUpperCase()}</p>
                <strong>{currency(num(row, "amount"), String(row.currency))}</strong>
                <span>{count(num(row, "payments"))} invoices · {count(num(row, "payers"))} payers</span>
              </div>
            ))}
          </div>
        ) : <Empty>{data.revenue ? "No paid invoices in this period." : "Invoice totals are unavailable."}</Empty>}
        <p className="admin-footnote">Source: synchronized invoices. Currencies are never added together. Reconcile with Stripe before financial reporting.</p>
        <div className="admin-section-label"><span>Recent payment records</span><span>latest 12 in period</span></div>
        <Panel title="Payments" note="The collections above include every stored paid invoice in the interval.">
          {data.invoices?.length ? (
            <div className="admin-scroll-table"><table><thead><tr><th scope="col">Paid at (UTC)</th><th scope="col">Amount</th><th scope="col">Status</th></tr></thead><tbody>
              {data.invoices.map((row) => <tr key={String(row.id)}><td>{String(row.paid_at).replace("T", " ").slice(0, 16)}</td><td>{currency(num(row, "amount"), String(row.currency))}</td><td>{String(row.status)}</td></tr>)}
            </tbody></table></div>
          ) : <Empty>{data.invoices ? "No payment records in this period." : "Payment records are unavailable."}</Empty>}
        </Panel>
      </>
    );
  } else if (view === "reliability") {
    viewContent = (
      <>
        {kpiLedger(
          <>
            <KpiRow label="Recorded success rate" sub="period" value={successfulRate} detail={`${count(successes)} succeeded · ${count(failures)} failed. Quota blocks are excluded.`} definition="Successful analyze and batch-item events / (successful + failed). Quota blocks and idempotent replays are excluded. Requests rejected before event recording are not represented." />
            <KpiRow label="Failed attempts" sub="period" value={data.channels ? count(failures) : "—"} alert={failures > 0} detail="Recorded processing failures across supported channels." definition="Failed analyze and batch-item events. This is an attempt count, not a unique-user count or an uptime measure." />
            <KpiRow label="Quota blocks" sub="period · product limit" value={data.channels ? count(blocked) : "—"} detail="Requests unable to proceed within the account allowance; not infrastructure failures." definition="Recorded quota-rejected analyze and batch-item events. These are product limits and are intentionally separate from failures." />
            <KpiRow label="p95 backend time" sub="period · timed successes" value={p95} detail={`${count(timedSamples)} timed successful single-review requests.`} definition="Nearest-rank 95th percentile of successful single-review duration_ms. Historical untimed events are excluded. This is not end-to-end browser latency." />
          </>,
        )}
        <div className="admin-section-label"><span>Outcomes by delivery channel</span></div>
        <Panel title="Recorded attempts" note="Analyze and batch-item events only · idempotent replays excluded."><ChannelTable rows={data.channels} /></Panel>
      </>
    );
  } else if (view === "usage") {
    viewContent = (
      <>
        {kpiLedger(
          <>
            <KpiRow label="Saved reviews" sub="period" value={value(data.scans, "completed")} detail="User-initiated, retained reviews; monitoring scans are excluded." definition="Saved, non-deleted scans in the selected period; monitoring scans are excluded. Successful attempts may reuse an existing result and need not create a new row." />
            <KpiRow label="Active reviewers" sub="period" value={value(data.reviewers, "active")} movement={data.reviewers ? movement(reviewerDelta) : undefined} detail="Distinct owners of a saved, non-monitoring review." definition="Distinct owners of non-deleted, non-monitoring saved scans in the selected period." />
            <KpiRow label="Cache reuse" sub="period · successful attempts" value={data.channels ? ratio(cached, successes) : "—"} detail={`${count(cached)} recorded successful attempts reused a cached result.`} definition="Recorded successful analyze and batch-item events with cached=true / all recorded successful events." />
            <KpiRow label="Credits consumed" sub="period · product units" value={data.channels ? count(data.channels.reduce((sum, row) => sum + num(row, "credits"), 0)) : "—"} detail="Recorded product credits; these are not dollars or provider cost." definition="Sum of product credits recorded on analyze and batch-item events. This is not a unit-economics measure." />
          </>,
        )}
        <div className="admin-section-label"><span>Delivery volume</span></div>
        <Panel title="Reviews delivered" note="Saved, non-deleted, non-monitoring reviews · UTC daily"><Trend rows={data.daily} window={win} /></Panel>
        <div className="admin-section-label"><span>Usage by delivery channel</span></div>
        <Panel title="Recorded attempts" note="Succeeded, failed, quota limited, and cache reuse remain distinct."><ChannelTable rows={data.channels} /></Panel>
      </>
    );
  } else {
    viewContent = (
      <>
        {kpiLedger(
          <>
            <KpiRow label="Active reviewers" sub="period" value={value(data.reviewers, "active")} movement={data.reviewers ? movement(reviewerDelta) : undefined} detail="Distinct owners of saved, non-deleted, non-monitoring reviews in the period." definition="Distinct users with at least one saved, non-deleted, non-monitoring scan in this period. Compared with the preceding equal-length period." />
            <KpiRow label="7-day activation" sub="period · mature cohort" value={activationRate} detail={`${count(num(activation, "activated"))} of ${count(num(activation, "eligible"))} eligible accounts saved a review in their first seven days.`} definition="Accounts created in the selected window shifted back seven days, with a saved non-monitoring review in their first seven days. Every account has a full observation window." />
            <KpiRow label="Repeat reviewers" sub="period" value={retainedRate} detail={`${count(num(reviewers, "retained"))} reviewers returned from the prior period of ${count(num(reviewers, "previous_active"))}.`} definition="Reviewers active in both this and the previous period / reviewers active in the previous period. Deleted reviews and deleted accounts are excluded." />
            <KpiRow label="Recorded success rate" sub="period" value={successfulRate} detail={`${count(successes)} succeeded · ${count(failures)} failed. Quota blocks (${data.channels ? count(blocked) : "—"}) counted separately.`} definition="Successful / (successful + failed) recorded analyze and batch-item events. Excludes quota blocks and idempotent replays; not an uptime metric." />
          </>,
        )}
        <div className="admin-section-label"><span>Delivery &amp; decisions</span></div>
        <div className="admin-two-columns">
          <Panel title="Reviews delivered" note="Saved, non-deleted, non-monitoring reviews · UTC daily"><Trend rows={data.daily} window={win} /></Panel>
          <Panel title="What needs attention" note="Use these signals to choose the next action.">
            <div className="admin-actions">
              <Link href={link("/admin/system")}><span className="ic red"><Activity size={16} /></span><span><strong>{data.channels ? `${count(failures)} failed attempts` : "Reliability data unavailable"}{failures > 0 && <span className="admin-tag act">ACTION</span>}</strong><p>Inspect outcomes by channel before increasing traffic.</p></span><span className="go">→</span></Link>
              <Link href={link("/admin/revenue")}><span className="ic amber"><Users size={16} /></span><span><strong>{data.accounts ? `${count(num(accounts, "past_due"))} past-due accounts` : "Billing data unavailable"}{num(accounts, "past_due") > 0 && <span className="admin-tag warn">FOLLOW UP</span>}</strong><p>Review billing state and follow up in Stripe.</p></span><span className="go">→</span></Link>
              <Link href="/admin/scans"><span className="ic plain"><ScanLine size={16} /></span><span><strong>{data.scans ? `${count(num(scans, "unclassified"))} unclassified documents` : "Document data unavailable"}</strong><p>Sample classification and extraction quality.</p></span><span className="go">→</span></Link>
            </div>
          </Panel>
        </div>
        <div className="admin-section-label"><span>Commercial snapshot · current accounts</span></div>
        <div className="admin-signal-grid">
          <div><p>Active subscriptions</p><strong>{value(data.accounts, "active_subscriptions")}</strong><span>current snapshot · trials not counted</span></div>
          <div><p>Checkout starters</p><strong>{data.commercial ? count(checkout) : "—"}</strong><span>distinct tracked actors · intent, not payment</span></div>
          <div><p>Paywall viewers</p><strong>{data.commercial ? count(paywall) : "—"}</strong><span>distinct tracked actors · same period</span></div>
        </div>
        <p className="admin-footnote">Open <Link href={link("/admin/revenue")} className="underline underline-offset-2 font-semibold">Revenue</Link> for collections by currency and billing follow-up. These populations are separate signals—not a payment-conversion funnel.</p>
      </>
    );
  }

  return (
    <div className="founder-dashboard space-y-6">
      {/* ── 02·D: header + period contract + view tabs ── */}
      <header className="admin-page-heading">
        <div>
          <p className="admin-eyebrow"><span className="dot" />{meta.path === "/admin" ? "OVERVIEW" : view.toUpperCase()}</p>
          <h1>{meta.title}</h1>
          <p className="desc">{meta.description}</p>
        </div>
        <div className="admin-period">
          <nav className="admin-period-pill" aria-label="Reporting period">
            {[7, 30, 90].map((days) => (
              <Link key={days} href={`${meta.path}?days=${days}`} aria-current={win.days === days ? "page" : undefined}>
                {days} days
              </Link>
            ))}
          </nav>
          <span className="note">
            {dayLabel(win.start)} – {dayLabel(new Date(new Date(win.end).getTime() - 86400000).toISOString())} · complete UTC days, today excluded
          </span>
        </div>
      </header>
      <nav className="admin-view-tabs" aria-label="Measurement views">
        {Object.entries(views).map(([key, v]) => (
          <Link key={key} href={`${v.path}?days=${win.days}`} aria-current={key === view ? "page" : undefined}>
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </Link>
        ))}
        <span className="trail">
          <Link href="/admin/users">Users</Link> · <Link href="/admin/scans">Scans</Link> · <Link href="/admin/cache">Cache</Link>
        </span>
      </nav>

      {failedGroups.length > 0 && (
        <div role="alert" className="admin-alert">
          <strong>Some data could not be loaded.</strong> Missing measures show “—”, not zero.{" "}
          <Link href={link(meta.path)} className="underline underline-offset-2 font-semibold">Reload this view</Link>
          <span className="block text-xs mt-1">Unavailable: {failedGroups.join(", ")}</span>
        </div>
      )}

      {viewContent}

      {/* ── 10·D: source status strip ── */}
      <div className="admin-section-label"><span>Data sources · what the numbers above are standing on</span></div>
      <StatusStrip health={health} inventory={inventory} />
      {view === "overview" && inventory && (
        <details className="admin-data-details">
          <summary>Cloudflare D1 data inventory</summary>
          <D1Inventory rows={inventory} />
        </details>
      )}

      <details className="admin-measurement">
        <summary>Measurement notes &amp; what to instrument next</summary>
        <p className="admin-footnote">
          Activity metrics reflect retained records. Event delivery is best-effort; missing telemetry is not counted as success. Account/subscription totals are current snapshots. No visitor-to-paid or payment-conversion claim is made without linked cohorts. No MRR, LTV, or unit-economics claim until provider costs and subscription items are persisted.
        </p>
      </details>
    </div>
  );
}
