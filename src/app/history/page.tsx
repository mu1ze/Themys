import styles from "@/components/workspace-pages.module.css";
import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { after } from "next/server";
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  Lightbulb,
  ListChecks,
  Search,
} from "lucide-react";

import {
  Badge,
  ButtonLink,
  EmptyState,
  PageHeader,
  PageShell,
} from "@/components/ui";
import { DeleteScanButton } from "@/components/delete-scan-button";
import { DocumentTypeBadge } from "@/components/document-type-badge";
import { HistoryFilters } from "@/components/history-filters";
import { HistoryExportPageButton, HistoryRowExportButton } from "@/components/history-actions";
import { ScanServiceIcon } from "@/components/scan-service-icon";
import { getUserProfileByClerkId, listScansPageByUserId, type ScanPageFilters, type ScanRecord } from "@/lib/persistence";
import { maybeSeedCachedScansForUser } from "@/lib/restore-cached-scans";
import { buildCompanyLogoUrl, extractHostname, formatCompanyName } from "@/lib/scan-display";
import { getAttentionLevel } from "@/lib/attention-level";

type HistoryPageProps = {
  searchParams: Promise<{
    page?: string;
    search?: string;
    risk?: string;
    dateRange?: string;
    sort?: string;
  }>;
};

type HistoryScan = ScanRecord;

function formatLocation(
  country: string | null | undefined,
  state: string | null | undefined
): string {
  const parts = [country?.trim(), state?.trim()].filter(
    (part): part is string => Boolean(part)
  );
  return parts.length ? parts.join(", ") : "Location not set";
}

function formatScanDate(isoString: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(isoString));
}

function riskStyles(score: number | null) {
  const attention = getAttentionLevel(score);

  if (attention.bucket === "high") {
    return {
      status: "text-[var(--ds-danger)]",
      label: attention.label,
      badgeTone: attention.tone,
    };
  }

  if (attention.bucket === "medium") {
    return {
      status: "text-[var(--ds-warning)]",
      label: attention.label,
      badgeTone: attention.tone,
    };
  }

  return {
    status: "text-[var(--ds-success)]",
    label: attention.label,
    badgeTone: attention.tone,
  };
}

function buildPagination(totalPages: number, currentPage: number): Array<number | "..."> {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, "...", totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [1, "...", totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
}

function pageHref(page: number, query?: string) {
  const params = new URLSearchParams(query);
  if (page > 1) {
    params.set("page", String(page));
  } else {
    params.delete("page");
  }
  const qs = params.toString();
  return qs ? `/history?${qs}` : "/history";
}

function PageButton({
  page,
  currentPage,
  query,
}: {
  page: number | "...";
  currentPage: number;
  query?: string;
}) {
  if (page === "...") {
    return <span className="px-1 text-[13px] text-[var(--ds-text-muted)]">...</span>;
  }

  const active = page === currentPage;
  const base =
    "inline-flex h-9 w-9 items-center justify-center rounded-[var(--ds-radius-sm)] text-[13px] font-medium transition";
  const classes = active
    ? "bg-[var(--ds-accent)] text-[var(--primary-foreground)] shadow-[var(--shadow-card)]"
    : "text-[var(--ds-text-secondary)] hover:bg-[var(--ds-card-hover)] hover:text-[var(--ds-text)]";

  return (
    <Link href={pageHref(page, query)} aria-current={active ? "page" : undefined} className={`${base} ${classes}`}>
      {page}
    </Link>
  );
}

function ScanCard({
  scan,
  fallbackCountry,
  fallbackState,
}: {
  scan: HistoryScan;
  fallbackCountry?: string | null;
  fallbackState?: string | null;
}) {
  const risk = riskStyles(scan.riskScore);
  const companyName = formatCompanyName(scan);
  const logoUrl = buildCompanyLogoUrl(scan);
  const hostname = extractHostname(scan.domain) ?? extractHostname(scan.url);

  return (
    <article className="group flex flex-col rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-card)] p-4 transition hover:border-[var(--ds-border-hover)] sm:p-5">
      {/* Row 1: service identity */}
      <div className="flex items-center gap-3">
        <ScanServiceIcon name={companyName} logoUrl={logoUrl} />
        <div className="min-w-0 flex-1">
          <Link
            href={`/scan/results?id=${scan.id}`}
            className="block truncate text-[13px] font-semibold text-[var(--ds-text)] transition hover:text-[var(--ds-accent)]"
          >
            {companyName}
          </Link>
          <p className="mt-0.5 truncate text-[11px] text-[var(--ds-text-muted)]">
            {hostname ?? formatLocation(scan.jurisdictionCountry ?? fallbackCountry, scan.jurisdictionState ?? fallbackState)}
          </p>
        </div>
      </div>

      {/* Row 2: attention level */}
      <div className="mt-4 flex flex-wrap gap-2 sm:mt-5">
        <Badge className="text-[10px] font-normal" tone={risk.badgeTone}>{risk.label}</Badge>
        <DocumentTypeBadge type={scan.documentType} className={styles.documentBadge} />
      </div>

      {/* Row 3: scan stats */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[var(--ds-text-secondary)] sm:mt-5 sm:gap-x-7">
        <span className="inline-flex items-center gap-1.5">
          <Flag className={`h-3.5 w-3.5 ${scan.flaggedCount > 0 ? risk.status : "text-[var(--ds-text-muted)]"}`} />
          {scan.flaggedCount} flag{scan.flaggedCount === 1 ? "" : "s"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ListChecks className="h-3.5 w-3.5 text-[var(--ds-text-muted)]" />
          {scan.clauseCount} clause{scan.clauseCount === 1 ? "" : "s"}
        </span>
      </div>

      {/* Footer: date + actions */}
      <div className="mt-4 flex flex-col gap-2 border-t border-[var(--ds-border)] pt-3 sm:mt-5 sm:flex-row sm:items-center sm:justify-between sm:pt-4">
        <span className="text-[11px] text-[var(--ds-text-muted)]">{formatScanDate(scan.createdAt)}</span>
        <div className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
          <Link
            href={`/scan/results?id=${scan.id}`}
            className="inline-flex h-8 items-center rounded-[var(--ds-radius-sm)] px-3 text-[11px] font-medium text-[var(--ds-accent)] transition hover:bg-[var(--ds-accent-glow)]"
          >
            View
          </Link>
          <HistoryRowExportButton
            scan={scan}
            iconOnly
            className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--ds-radius-sm)] text-[var(--ds-text-muted)] transition hover:bg-[var(--ds-card-hover)] hover:text-[var(--ds-text)]"
          />
          <DeleteScanButton
            scanId={scan.id}
            iconOnly
            title="Delete scan"
            label="Delete scan"
            className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--ds-radius-sm)] text-[var(--ds-danger)] transition hover:bg-[var(--ds-danger-bg)] disabled:opacity-50"
          />
        </div>
      </div>
    </article>
  );
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const user = await currentUser();
  const params = await searchParams;
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const pageSize = 12;
  const requestedPageSafe = Math.max(1, Number.isFinite(requestedPage) ? requestedPage : 1);

  const search = params.search?.trim() ?? "";
  const risk: ScanPageFilters["risk"] =
    params.risk === "high" || params.risk === "medium" || params.risk === "low" ? params.risk : "all";
  const dateRange: ScanPageFilters["dateRange"] =
    params.dateRange === "7" || params.dateRange === "all" ? params.dateRange : "30";
  const sort: ScanPageFilters["sort"] =
    params.sort === "risk" || params.sort === "name" ? params.sort : "date";

  const filters: ScanPageFilters = { search, risk, dateRange, sort };
  const filterQuery = new URLSearchParams({
    ...(search && { search }),
    ...(risk !== "all" && { risk }),
    ...(dateRange !== "30" && { dateRange }),
    ...(sort !== "date" && { sort }),
  }).toString();

  if (user?.id) {
    after(() => maybeSeedCachedScansForUser(user.id));
  }

  const profile = user?.id ? await getUserProfileByClerkId(user.id) : null;
  const scanPage = profile
    ? await listScansPageByUserId(profile.id, requestedPageSafe, pageSize, filters)
    : { scans: [], total: 0 };
  const { scans, total } = scanPage;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(totalPages, requestedPageSafe);
  const visibleScans = profile && currentPage !== requestedPageSafe
    ? (await listScansPageByUserId(profile.id, currentPage, pageSize, filters)).scans
    : scans;
  const startIndex = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(total, startIndex + visibleScans.length - 1);
  const pagination = buildPagination(totalPages, currentPage);

  const paginationControls = (
    <div className="flex items-center gap-2">
      {currentPage === 1 ? (
        <button type="button" disabled title="Previous page" className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card)] text-[var(--ds-text-muted)] disabled:opacity-40" aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </button>
      ) : (
        <Link href={pageHref(currentPage - 1, filterQuery)} title="Previous page" className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card)] text-[var(--ds-text-secondary)] transition hover:border-[var(--ds-border-hover)] hover:bg-[var(--ds-card-hover)] hover:text-[var(--ds-text)]" aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </Link>
      )}
      <div className="flex items-center gap-1">
        {pagination.map((page) => <PageButton key={String(page)} page={page} currentPage={currentPage} query={filterQuery} />)}
      </div>
      {currentPage === totalPages ? (
        <button type="button" disabled title="Next page" className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card)] text-[var(--ds-text-muted)] disabled:opacity-40" aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </button>
      ) : (
        <Link href={pageHref(currentPage + 1, filterQuery)} title="Next page" className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card)] text-[var(--ds-text-secondary)] transition hover:border-[var(--ds-border-hover)] hover:bg-[var(--ds-card-hover)] hover:text-[var(--ds-text)]" aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--ds-bg)]">
      <PageShell className={`${styles.page} space-y-7`}>
        <PageHeader className={styles.header}
          eyebrow="History"
          title="Scan history"
          description="Review and manage your analyzed legal documents."
          actions={<HistoryExportPageButton scans={visibleScans} />}
        />

        <HistoryFilters search={search} risk={risk} dateRange={dateRange} sort={sort} />

        {visibleScans.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleScans.map((scan) => (
                <ScanCard
                  key={scan.id}
                  scan={scan}
                  fallbackCountry={profile?.country}
                  fallbackState={profile?.state}
                />
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13px] text-[var(--ds-text-muted)]">Showing <span className="font-medium text-[var(--ds-text)]">{startIndex}-{endIndex}</span> of {total} scans</p>
              {paginationControls}
            </div>
          </>
        ) : (
          <EmptyState
            icon={Search}
            title="No scans found"
            description="Try a different search or date range, or start a new review to save your first scan."
            actions={<><ButtonLink href="/scan/new" icon={Search}>New scan</ButtonLink><ButtonLink href="/dashboard" variant="ghost">Dashboard</ButtonLink></>}
          />
        )}

        <aside className="flex items-start gap-3 border-t border-[var(--ds-border)] pt-6 text-[13px] text-[var(--ds-text-muted)]">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ds-warning)]" />
          <p><span className="font-medium text-[var(--ds-text)]">Pro tip.</span> Set up automatic notifications for sites you care about and Themys will alert you when their terms change.</p>
        </aside>
      </PageShell>
    </div>
  );
}
