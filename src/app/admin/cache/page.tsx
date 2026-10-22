import { getCacheOverview } from "@/features/admin/server/queries";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { Database, FileText, Server, Layers } from "lucide-react";

export default async function AdminCachePage() {
  const overview = await getCacheOverview();

  return (
    <div className="space-y-8 founder-dashboard">
      <header className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">
            Themys / Cache & Performance
          </p>
          <h1>System Cache & Limits</h1>
          <p className="desc">Cloudflare KV telemetry, cached document entries, and enforced tier quotas.</p>
        </div>
        <span className="admin-source-status" data-state={overview.kvAvailable ? "connected" : "fallback"}>
          <i aria-hidden="true" />
          {overview.kvAvailable ? "Cloudflare KV connected" : "Local in-memory fallback"}
        </span>
      </header>

      {/* Primary KPI Cards */}
      <div className="admin-kpi-grid">
        <article className="admin-kpi admin-kpi-accent">
          <div className="admin-kpi-header">
            <div className="flex items-center gap-2">
              <span className="admin-icon-chip admin-tone-neutral">
                <Database />
              </span>
              <h2>Scan Result Cache</h2>
            </div>
            <span className="kpi-meta">CACHE_KV</span>
          </div>
          <p className="admin-kpi-value">{overview.scanEntries.toLocaleString()}</p>
          <div className="admin-kpi-footer">
            <p className="admin-kpi-detail">
              Pre-computed analysis results stored in edge cache
            </p>
          </div>
        </article>

        <article className="admin-kpi">
          <div className="admin-kpi-header">
            <div className="flex items-center gap-2">
              <span className="admin-icon-chip admin-tone-neutral">
                <FileText />
              </span>
              <h2>ToS Text Cache</h2>
            </div>
            <span className="kpi-meta">CACHE_KV</span>
          </div>
          <p className="admin-kpi-value">{overview.textEntries.toLocaleString()}</p>
          <div className="admin-kpi-footer">
            <p className="admin-kpi-detail">
              Deduplicated terms text reused across repeat scans
            </p>
          </div>
        </article>

        <article className="admin-kpi">
          <div className="admin-kpi-header">
            <div className="flex items-center gap-2">
              <span className="admin-icon-chip admin-tone-neutral">
                <Server />
              </span>
              <h2>Environment</h2>
            </div>
          </div>
          <p className="admin-kpi-value text-sm-value">
            {overview.kvAvailable ? "Workers KV" : "In-Memory"}
          </p>
          <div className="admin-kpi-footer">
            <p className="admin-kpi-detail">
              {overview.kvAvailable ? "Bound Workers KV namespace for this admin runtime" : "Ephemeral fallback for local development"}
            </p>
          </div>
        </article>

        <article className="admin-kpi">
          <div className="admin-kpi-header">
            <div className="flex items-center gap-2">
              <span className="admin-icon-chip admin-tone-neutral">
                <Layers />
              </span>
              <h2>Active Tiers</h2>
            </div>
          </div>
          <p className="admin-kpi-value text-sm-value">
            {Object.keys(RATE_LIMITS).length} Configured
          </p>
          <div className="admin-kpi-footer">
            <p className="admin-kpi-detail">
              Enforcing daily scans & monthly AI allowances
            </p>
          </div>
        </article>
      </div>

      <div className="admin-two-columns">
        {/* Top Cached Domains Panel */}
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>Top Cached Domains</h2>
              <p>Frequently requested domains currently held in scan cache.</p>
            </div>
          </div>

          {overview.topDomains.length > 0 ? (
            <div className="admin-scroll-table">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Domain</th>
                    <th scope="col" className="text-right">Cached Entries</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.topDomains.map((d) => (
                    <tr key={d.domain}>
                      <td className="font-medium">{d.domain}</td>
                      <td className="text-right font-mono font-semibold">{d.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="admin-empty">
              {overview.kvAvailable
                ? "No scan cache entries recorded yet."
                : "KV unavailable in this process — counts reflect the in-memory cache only."}
            </p>
          )}
        </section>

        {/* Rate Limit Config Panel */}
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>Rate Limit Policy</h2>
              <p>Active enforcement limits per 24-hour UTC window and billing cycle.</p>
            </div>
          </div>

          <div className="admin-scroll-table">
            <table>
              <thead>
                <tr>
                  <th scope="col">Tier</th>
                  <th scope="col">Scans / Day</th>
                  <th scope="col">AI / Month</th>
                </tr>
              </thead>
              <tbody>
                {(Object.entries(RATE_LIMITS) as [string, typeof RATE_LIMITS[keyof typeof RATE_LIMITS]][]).map(
                  ([tier, limits]) => (
                    <tr key={tier}>
                      <th scope="row">
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${
                          tier === "free"
                            ? "border-[var(--admin-line)] bg-[var(--admin-surface)] text-[var(--admin-muted)]"
                            : tier === "base"
                              ? "border-[color-mix(in_srgb,var(--admin-green)_24%,var(--admin-line))] bg-[var(--admin-green-bg)] text-[var(--admin-green)]"
                              : "border-[color-mix(in_srgb,var(--admin-sienna)_24%,var(--admin-line))] bg-[var(--admin-peach)] text-[var(--admin-sienna)]"
                        }`}>
                          {tier.charAt(0).toUpperCase() + tier.slice(1)}
                        </span>
                      </th>
                      <td className="font-mono font-medium">
                        {limits.scans.max}
                      </td>
                      <td className="font-mono font-medium">
                        {limits.ai.max >= 9999 ? "Unlimited" : limits.ai.max}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
