import { auth } from "@clerk/nextjs/server";
import { Search } from "lucide-react";

import { ButtonLink, Card, Badge } from "@/components/ui";
import {
  getLatestScanByClerkId,
  getScanDomainHistorySummary,
  getScanWithClauses,
  getUserProfileByClerkId,
} from "@/lib/persistence";
import { ScanResultsView } from "@/components/scan-results-view";
import {
  getComplianceTagsForScan,
  getRegulations,
  calculateComplianceScore,
  type ComplianceTagRef,
} from "@/lib/compliance";

export const dynamic = "force-dynamic";

type ResultsPageProps = {
  searchParams?: Promise<{ id?: string; scanId?: string }>;
};

export default async function ResultsPage({ searchParams }: ResultsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const requestedScanId = resolvedSearchParams.id || resolvedSearchParams.scanId;

  // auth() reads the verified request session. currentUser() makes an extra
  // Clerk Backend API call, which was being rate-limited on this hot page.
  let clerkId: string | null = null;
  try {
    clerkId = (await auth()).userId;
  } catch (error) {
    console.warn("[scan/results] Could not resolve the Clerk session", error instanceof Error ? error.name : "UnknownError");
  }

  const [latest, userProfile] = clerkId
    ? await Promise.all([
        requestedScanId
          ? getScanWithClauses(clerkId, requestedScanId)
          : getLatestScanByClerkId(clerkId),
        getUserProfileByClerkId(clerkId).catch((error) => {
          console.warn("[scan/results] Could not load the user profile", error instanceof Error ? error.name : "UnknownError");
          return null;
        }),
      ])
    : [null, null];

  if (!latest) {
    return (
      <section className="mx-auto h-full w-full max-w-[1200px] overflow-y-auto px-4 py-8 pb-32 pt-[max(2rem,calc(env(safe-area-inset-top)+1.5rem))] sm:px-6 lg:px-8 lg:pb-36">
        <Card className="overflow-hidden">
          <div className="grid gap-8 p-6 md:grid-cols-[minmax(0,1fr)_220px] md:p-8">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2">
                <Badge tone="neutral">Scan results</Badge>
                <span className="text-[15px] text-[var(--ds-text-muted)]">Waiting for the first saved scan</span>
              </div>
              <h1 className="mt-3 text-[28px] font-normal leading-tight text-[var(--ds-text)] sm:text-[36px]">
                {requestedScanId ? "Scan not found" : "No scan data yet"}
              </h1>
              <p className="mt-3 max-w-xl text-[17px] leading-6 text-[var(--ds-text-secondary)]">
                {requestedScanId
                  ? "This review is unavailable for the signed-in account. Start a new scan or open one from history."
                  : "Run the first analysis to populate the score, risk categories, and clause-level findings."}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <ButtonLink href="/scan/new" icon={Search}>
                  Start a scan
                </ButtonLink>
                <ButtonLink href="/history" variant="ghost">
                  View history
                </ButtonLink>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center gap-3 rounded-[20px] border border-[var(--ds-border)] bg-[var(--ds-card-hover)] p-6 text-center">
              <div className="relative flex h-32 w-32 items-center justify-center">
                <svg className="h-full w-full -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-[var(--ds-border)]"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    fill="transparent"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="8"
                    className="text-[var(--ds-danger)]"
                    style={{
                      strokeDasharray: 2 * Math.PI * 56,
                      strokeDashoffset: 2 * Math.PI * 56,
                    }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[36px] font-medium leading-none text-[var(--ds-danger)]">0</span>
                  <span className="mt-1 text-[15px] text-[var(--ds-text-muted)]">Out of 100</span>
                </div>
              </div>
              <p className="text-[15px] font-medium text-[var(--ds-danger)]">Waiting for input</p>
              <p className="text-[15px] leading-6 text-[var(--ds-text-secondary)]">
                Start from the scan workspace and the latest saved result will
                be loaded automatically.
              </p>
            </div>
          </div>
        </Card>
      </section>
    );
  }

  // Fetch compliance data for the scan
  let complianceScores: Awaited<ReturnType<typeof calculateComplianceScore>> = [];
  let complianceTagsWithClause: Array<Awaited<ReturnType<typeof getComplianceTagsForScan>>[number] & { clauseCategory?: string | null; clauseText?: string | null }> = [];
  let clauseComplianceTags: Record<string, ComplianceTagRef[]> = {};
  let previousScanCount = 0;
  let previousScanId: string | undefined;

  const [history, dbTags, regulations] = await Promise.all([
    clerkId && latest.scan.domain && latest.scan.documentIdentityKey
      ? getScanDomainHistorySummary(
          clerkId,
          latest.scan.domain,
          latest.scan.documentIdentityKey,
          latest.scan.id,
          latest.scan.documentType,
        ).catch(() => ({ count: 0, previousScanId: undefined }))
      : Promise.resolve({ count: 0, previousScanId: undefined }),
    getComplianceTagsForScan(
      latest.scan.id,
      latest.clauses.map((clause) => clause.id),
    ).catch(() => []),
    getRegulations().catch(() => []),
  ]);
  previousScanCount = history.count;
  previousScanId = history.previousScanId;

  if (dbTags.length > 0 && regulations.length > 0) {
    // Build clause lookup for enrichment
    const clauseMap = new Map(latest.clauses.map((c) => [c.id, c]));

    // Enrich tags with clause metadata
    complianceTagsWithClause = dbTags.map((tag) => ({
      ...tag,
      clauseCategory: clauseMap.get(tag.clauseId)?.category ?? null,
      clauseText: clauseMap.get(tag.clauseId)?.text ?? null,
    }));

    // Derive severity from clause risk level for scoring
    const tagsForScoring = dbTags.map((tag) => {
      const clause = clauseMap.get(tag.clauseId);
      const riskLevel = clause?.riskLevel;
      const severity: "warning" | "caution" | "info" =
        riskLevel === "red" ? "warning" : riskLevel === "yellow" ? "caution" : "info";
      return { ...tag, severity };
    });

    complianceScores = calculateComplianceScore(tagsForScoring, regulations);
  }

  // Build clause → compliance tags map for chips from DB tags
  for (const tag of dbTags) {
    if (!clauseComplianceTags[tag.clauseId]) {
      clauseComplianceTags[tag.clauseId] = [];
    }
    clauseComplianceTags[tag.clauseId].push({
      regulationCode: tag.regulationCode ?? "",
      articleId: tag.articleId,
      articleTitle: tag.articleTitle ?? "",
      relevance: tag.relevance ?? 0.8,
      quote: tag.quote ?? undefined,
    } as ComplianceTagRef);
  }

  return (
    <ScanResultsView
      scan={latest.scan}
      clauses={latest.clauses}
      fullExtraction={latest.fullExtraction}
      userProfile={userProfile}
      complianceScores={complianceScores}
      complianceTags={complianceTagsWithClause}
      clauseComplianceTags={clauseComplianceTags}
      previousScanCount={previousScanCount}
      previousScanId={previousScanId}
    />
  );
}
