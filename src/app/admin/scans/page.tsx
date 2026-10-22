import Form from "next/form";
import { listAllScans } from "@/features/admin/server/queries";
import { ScansListClient } from "@/components/admin/scans-list-client";
import { FilterSubmitButton } from "@/components/admin/filter-submit-button";
import { ScanSearch, ShieldAlert, Flag, Layers } from "lucide-react";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function AdminScansPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const requestedPage = Number(params.page ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const search = typeof params.search === "string" ? params.search : "";
  const riskLevel = typeof params.risk === "string" && ["low", "medium", "high"].includes(params.risk) ? params.risk : "all";
  const source = typeof params.source === "string" && ["web", "extension", "paste"].includes(params.source) ? params.source : "all";

  const { scans, total } = await listAllScans(page, 25, {
    search: search || undefined,
    riskLevel: riskLevel !== "all" ? (riskLevel as "low" | "medium" | "high") : undefined,
    source: source !== "all" ? source : undefined,
  });

  const highRiskCount = scans.filter((s) => (s.riskScore ?? 0) >= 7).length;
  const totalFlagged = scans.reduce((acc, s) => acc + (s.flaggedCount ?? 0), 0);

  return (
    <div className="space-y-8 founder-dashboard">
      <header className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">
            Themys / Forensic Explorer
          </p>
          <h1>Terms of Service Scans</h1>
          <p className="desc">Inspect parsed contracts, risk assessments, clause extractions, and user submissions.</p>
        </div>
        <span className="admin-record-count">{total.toLocaleString()} matching documents</span>
      </header>

      {/* KPI Overview Grid */}
      <div className="admin-kpi-grid">
        <article className="admin-kpi admin-kpi-accent">
          <div className="admin-kpi-header">
            <div className="flex items-center gap-2">
              <span className="admin-icon-chip admin-tone-neutral">
                <ScanSearch />
              </span>
              <h2>Matching Documents</h2>
            </div>
          </div>
          <p className="admin-kpi-value">{total.toLocaleString()}</p>
          <div className="admin-kpi-footer">
            <p className="admin-kpi-detail">Distinct retained documents returned by the current filters</p>
          </div>
        </article>

        <article className="admin-kpi">
          <div className="admin-kpi-header">
            <div className="flex items-center gap-2">
              <span className="admin-icon-chip admin-tone-danger">
                <ShieldAlert />
              </span>
              <h2>High Risk in View</h2>
            </div>
          </div>
          <p className={`admin-kpi-value ${highRiskCount > 0 ? "admin-tone-danger" : ""}`}>
            {highRiskCount}
          </p>
          <div className="admin-kpi-footer">
            <p className="admin-kpi-detail">Scans with risk score ≥ 7.0 on this page</p>
          </div>
        </article>

        <article className="admin-kpi">
          <div className="admin-kpi-header">
            <div className="flex items-center gap-2">
              <span className="admin-icon-chip admin-tone-warning">
                <Flag />
              </span>
              <h2>Flagged Clauses</h2>
            </div>
          </div>
          <p className="admin-kpi-value">{totalFlagged.toLocaleString()}</p>
          <div className="admin-kpi-footer">
            <p className="admin-kpi-detail">Attention-worthy clauses in current page set</p>
          </div>
        </article>

        <article className="admin-kpi">
          <div className="admin-kpi-header">
            <div className="flex items-center gap-2">
              <span className="admin-icon-chip admin-tone-neutral">
                <Layers />
              </span>
              <h2>Current Window</h2>
            </div>
          </div>
          <p className="admin-kpi-value">{scans.length}</p>
          <div className="admin-kpi-footer">
            <p className="admin-kpi-detail">Page {page} of {Math.max(1, Math.ceil(total / 25))}</p>
          </div>
        </article>
      </div>

      {/* Filters Bar */}
      <section className="admin-panel !p-4">
        <Form action="/admin/scans" className="admin-filter-bar">
          <div className="relative min-w-[220px] flex-1">
            <label htmlFor="scan-search" className="sr-only">Search documents by domain or title</label>
            <input
              id="scan-search"
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Search by domain or title…"
              className="admin-field w-full"
            />
          </div>
          <label htmlFor="scan-risk" className="sr-only">Filter documents by risk</label>
          <select
            id="scan-risk"
            name="risk"
            defaultValue={riskLevel}
            className="admin-field"
          >
            <option value="all">All risks</option>
            <option value="high">High (≥7)</option>
            <option value="medium">Medium (4–7)</option>
            <option value="low">Low (&lt;4)</option>
          </select>
          <label htmlFor="scan-source" className="sr-only">Filter documents by source</label>
          <select
            id="scan-source"
            name="source"
            defaultValue={source}
            className="admin-field"
          >
            <option value="all">All sources</option>
            <option value="web">Web</option>
            <option value="extension">Extension</option>
            <option value="paste">Paste</option>
          </select>
          <FilterSubmitButton />
        </Form>
      </section>

      <ScansListClient
        scans={scans}
        total={total}
        page={page}
        pageSize={25}
        basePath="/admin/scans"
        searchParams={{
          ...(search && { search }),
          ...(riskLevel !== "all" && { risk: riskLevel }),
          ...(source !== "all" && { source }),
        }}
      />
    </div>
  );
}
