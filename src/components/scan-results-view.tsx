"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAttentionLevel } from "@/lib/attention-level";
import { buildJurisdictionContext, getClauseJurisdictionImpact, getJurisdictionSummary } from "@/lib/jurisdiction";
import { mapCategoryToCanonical } from "@/lib/analysis-engine";
import type { FullExtractionSection } from "@/lib/llm";
import { dedupeClausesByTitle, isFlaggedClause } from "@/lib/scan-display";
import type { ComplianceScore, ComplianceTag, ComplianceTagRef } from "@/lib/compliance-shared";
import { buildPushbackList } from "@/lib/pushback";
import type { ScanDecision } from "@/lib/decisions";
import type { DocumentType } from "@/lib/document-types";
import {
  DEFAULT_WORKSPACE_SECTIONS,
  RAIL_COLLAPSED_KEY,
  WORKSPACE_CUSTOMIZE_KEY,
  toAttentionScore100,
  type WorkspacePanel,
  type WorkspaceSectionKey,
} from "@/lib/scan-results-workspace";
import { ScanResultsTopbar } from "@/components/scan-results/topbar";
import { ScanResultsRail } from "@/components/scan-results/rail";
import { WorkspacePanels } from "@/components/scan-results/panels";
import { ScanResultsMobileNav } from "@/components/scan-results/mobile-nav";
import type { WorkspaceActions, WorkspaceClause, WorkspaceData } from "@/components/scan-results/types";

function formatUpdatedLabel(isoString: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(isoString));
}

function deriveServiceLabel(title: string): string {
  return title
    .replace(/\s+Terms of Service$/i, "")
    .replace(/\s+Terms & Conditions$/i, "")
    .replace(/\s+Terms$/i, "")
    .trim();
}

function impactRank(level: "high" | "medium" | "low"): number {
  if (level === "high") return 3;
  if (level === "medium") return 2;
  return 1;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

export interface ScanResultsViewProps {
  scan: any;
  clauses: any[];
  fullExtraction: FullExtractionSection[];
  userProfile?: { country: string | null; state: string | null; plan?: string } | null;
  headerActions?: React.ReactNode;
  headerBackButton?: React.ReactNode;
  isAdmin?: boolean;
  complianceScores?: ComplianceScore[];
  complianceTags?: (ComplianceTag & { clauseCategory?: string | null; clauseText?: string | null })[];
  clauseComplianceTags?: Record<string, ComplianceTagRef[]>;
  previousScanCount?: number;
  previousScanId?: string;
}

export function ScanResultsView({
  scan,
  clauses,
  fullExtraction,
  userProfile,
  headerActions,
  headerBackButton,
  isAdmin = false,
  complianceScores = [],
  complianceTags = [],
  clauseComplianceTags = {},
  previousScanCount = 0,
  previousScanId,
}: ScanResultsViewProps) {
  const [panel, setPanel] = useState<WorkspacePanel>("summary");
  const [documentText, setDocumentText] = useState<string>(scan.rawText ?? "");
  const [documentLoadingScanId, setDocumentLoadingScanId] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState<{ scanId: string; message: string } | null>(null);
  const [documentLoadedScanId, setDocumentLoadedScanId] = useState<string | null>(
    scan.rawText != null ? String(scan.id) : null,
  );
  const [documentRetry, setDocumentRetry] = useState(0);
  const documentRequestScanId = useRef<string | null>(null);
  const [decisionOverride, setDecisionOverride] = useState<{ scanId: string; decision: ScanDecision } | null>(null);
  const [highlightText, setHighlightText] = useState<string | undefined>();
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [loadedExtraction, setLoadedExtraction] = useState(fullExtraction);
  const [extractionLoading, setExtractionLoading] = useState(fullExtraction.length === 0);
  const [extractionLoaded, setExtractionLoaded] = useState(fullExtraction.length > 0);
  const [loadedExtractionScanId, setLoadedExtractionScanId] = useState<string | null>(
    fullExtraction.length > 0 ? String(scan.id) : null,
  );
  const extractionRequestScanId = useRef<string | null>(null);
  const [workspaceSections, setWorkspaceSections] = useState(DEFAULT_WORKSPACE_SECTIONS);

  useEffect(() => {
    setLoadedExtraction(fullExtraction);
    setExtractionLoading(fullExtraction.length === 0);
    setExtractionLoaded(fullExtraction.length > 0);
    setLoadedExtractionScanId(fullExtraction.length > 0 ? String(scan.id) : null);
  }, [fullExtraction, scan.id]);

  useEffect(() => {
    const scanId = String(scan.id);
    if (panel !== "document" || scan.rawText != null || documentLoadedScanId === scanId) return;
    if (documentRequestScanId.current === scanId) return;
    documentRequestScanId.current = scanId;
    let active = true;

    setDocumentLoadingScanId(scanId);
    setDocumentError(null);
    void fetch(`/api/scans/${encodeURIComponent(scanId)}/document`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Document request failed: ${response.status}`);
        const body = (await response.json()) as { text?: string | null };
        if (!active) return;
        setDocumentText(typeof body.text === "string" ? body.text : "");
        setDocumentLoadedScanId(scanId);
      })
      .catch(() => {
        if (!active) return;
        setDocumentError({ scanId, message: "The original document could not be loaded." });
        documentRequestScanId.current = null;
      })
      .finally(() => {
        if (active) setDocumentLoadingScanId(null);
      });

    return () => {
      active = false;
      if (documentRequestScanId.current === scanId) {
        documentRequestScanId.current = null;
      }
    };
  }, [documentLoadedScanId, documentRetry, panel, scan.id, scan.rawText]);

  useEffect(() => {
    if (fullExtraction.length > 0) return;
    if (extractionRequestScanId.current === String(scan.id)) return;
    extractionRequestScanId.current = String(scan.id);

    let active = true;

    void (async () => {
      const delays = [0, 750, 1500, 2500];
      try {
        for (const delay of delays) {
          if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
          const response = await fetch(`/api/scans/${encodeURIComponent(String(scan.id))}/extraction`, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(5000),
          });
          if (!response.ok) throw new Error(`Extraction request failed: ${response.status}`);
          const body = (await response.json()) as { fullExtraction?: FullExtractionSection[] };
          const sections = Array.isArray(body.fullExtraction) ? body.fullExtraction : [];
          if (!active) return;
          setLoadedExtraction(sections);
          if (sections.length > 0 || delay === delays[delays.length - 1]) {
            setLoadedExtractionScanId(String(scan.id));
            return;
          }
        }
      } catch {
        if (active) setLoadedExtraction([]);
      } finally {
        if (!active) return;
        setExtractionLoading(false);
        setExtractionLoaded(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [fullExtraction.length, scan.id]);

  const effectiveExtraction = useMemo(
    () => fullExtraction.length > 0 || loadedExtractionScanId === String(scan.id)
      ? (fullExtraction.length > 0 ? fullExtraction : loadedExtraction)
      : [],
    [fullExtraction, loadedExtraction, loadedExtractionScanId, scan.id],
  );

  useEffect(() => {
    setRailCollapsed(localStorage.getItem(RAIL_COLLAPSED_KEY) === "true");
    setWorkspaceSections(readJson(WORKSPACE_CUSTOMIZE_KEY, DEFAULT_WORKSPACE_SECTIONS));
  }, []);

  const title = scan.title ?? scan.domain ?? "Latest scan";
  const riskScore = scan.riskScore ?? 0;
  const attention = getAttentionLevel(riskScore);
  const serviceLabel = deriveServiceLabel(title) || title;
  const scanCountry = scan.jurisdictionCountry ?? scan.jurisdiction_country;
  const scanState = scan.jurisdictionState ?? scan.jurisdiction_state;
  const jurisdiction = buildJurisdictionContext(scanCountry ?? userProfile?.country, scanState ?? userProfile?.state);
  const scanDecision: ScanDecision =
    decisionOverride?.scanId === String(scan.id)
      ? decisionOverride.decision
      : scan.decision === "sign" ||
        scan.decision === "negotiate" ||
        scan.decision === "walk_away" ||
        scan.decision === "open"
        ? scan.decision
        : "open";

  const clausesWithImpact: WorkspaceClause[] = clauses.map((clause) => {
    const canonicalCategory = mapCategoryToCanonical(clause.category);
    const impact = canonicalCategory
      ? getClauseJurisdictionImpact(canonicalCategory, jurisdiction)
      : {
          level: "low" as const,
          label: "Lower impact",
          score: 0,
          note: jurisdiction.isSet
            ? "This clause is less likely to change the rights that matter most in your location."
            : "Set your country and state in Settings to rank clauses by the rules that matter where you live.",
        };
    const isFlagged = isFlaggedClause(clause);

    return {
      id: clause.id,
      text: clause.text,
      category: clause.category,
      riskScore: clause.riskScore,
      riskLevel: clause.riskLevel,
      explanation: clause.explanation,
      whyItMatters: clause.whyItMatters,
      recommendedAction: clause.recommendedAction,
      isTargetClause: clause.isTargetClause,
      isStandardPractice: Boolean(clause.isStandardPractice),
      isFlagged,
      position: clause.position ?? null,
      impact,
    };
  });

  const uniqueClauses = dedupeClausesByTitle(clausesWithImpact);
  const sortByPriority = (left: WorkspaceClause, right: WorkspaceClause) => {
    // Higher severity and target clauses appear first.
    const getPriorityRank = (c: WorkspaceClause) => {
      if (c.riskLevel === "red" && !c.isStandardPractice) return 4;
      if (c.isTargetClause) return 3;
      if (c.isStandardPractice || c.riskLevel === "yellow") return 2;
      return 1;
    };
    const priorityDelta = getPriorityRank(right) - getPriorityRank(left);
    if (priorityDelta !== 0) return priorityDelta;
    const impactDelta = impactRank(right.impact.level) - impactRank(left.impact.level);
    if (impactDelta !== 0) return impactDelta;
    return (right.riskScore ?? 0) - (left.riskScore ?? 0);
  };
  const flaggedClauses = uniqueClauses.filter((clause) => clause.isFlagged).sort(sortByPriority);

  const pushbackItems = buildPushbackList(
    uniqueClauses.map((clause) => ({
      id: clause.id,
      text: clause.text,
      category: clause.category,
      whyItMatters: clause.whyItMatters,
      recommendedAction: clause.recommendedAction,
      isTargetClause: clause.isTargetClause,
      riskScore: clause.riskScore,
      riskLevel: clause.riskLevel,
      isFlagged: clause.isFlagged,
    })),
    10,
  );

  const data: WorkspaceData = {
    scan: {
      id: scan.id,
      title,
      serviceLabel,
      domain: scan.domain ?? null,
      url: scan.url ?? null,
      documentType: (scan.documentType ?? "unknown") as DocumentType,
      updatedLabel: formatUpdatedLabel(scan.createdAt ?? scan.created_at),
      summary: scan.summary ?? null,
      rawText: documentLoadedScanId === String(scan.id) ? documentText : (scan.rawText ?? ""),
      documentLoading: documentLoadingScanId === String(scan.id),
      documentError: documentError?.scanId === String(scan.id) ? documentError.message : null,
      createdAt: scan.createdAt ?? scan.created_at,
      clauseCount: scan.clauseCount ?? 0,
      decision: scanDecision,
    },
    score100: toAttentionScore100(riskScore),
    attention,
    flaggedCount: flaggedClauses.length,
    uniqueCount: uniqueClauses.length,
    targetHits: uniqueClauses.filter((clause) => clause.isTargetClause).length,
    regulatoryFlags: complianceTags.length,
    jurisdiction,
    jurisdictionSummary: getJurisdictionSummary(jurisdiction),
    clauses: clausesWithImpact,
    flaggedClauses,
    uniqueClauses,
    fullExtraction: effectiveExtraction ?? [],
    fullExtractionLoading: extractionLoading && !extractionLoaded,
    pushbackItems,
    vendorLabel: scan.domain ?? scan.title ?? "this vendor",
    complianceScores,
    complianceTags,
    clauseComplianceTags,
    previousScanCount,
    previousScanId,
    documentIdentityKey: scan.documentIdentityKey,
    userPlan: userProfile?.plan,
    isAdmin,
  };

  const switchPanel = useCallback((next: WorkspacePanel) => {
    setPanel(next);
    setHighlightText(undefined);
  }, []);

  const locateInDoc = useCallback(
    (id: string) => {
      const clause = uniqueClauses.find((entry) => entry.id === id);
      if (!clause) return;
      setHighlightText(clause.text);
      setPanel("document");
    },
    [uniqueClauses],
  );

  const selectExtractionSection = useCallback(
    (index: number) => {
      const section = effectiveExtraction?.[index];
      if (!section) return;
      setPanel("document");
      const flaggedPoint = section.keyPoints.find(
        (point) => point.severity === "warning" || point.severity === "caution",
      );
      const quote = flaggedPoint?.quote || flaggedPoint?.detail;
      setHighlightText(quote || undefined);
    },
    [effectiveExtraction],
  );

  const toggleRail = useCallback(() => {
    setRailCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(RAIL_COLLAPSED_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const persistWorkspace = (next: typeof DEFAULT_WORKSPACE_SECTIONS) => {
    setWorkspaceSections(next);
    try {
      localStorage.setItem(WORKSPACE_CUSTOMIZE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable=true]")) return;
      if (event.key === "b" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        toggleRail();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleRail]);

  const actions: WorkspaceActions = {
    onDecisionSaved: (decision) => setDecisionOverride({ scanId: String(scan.id), decision }),
    panel,
    highlightText,
    railCollapsed,
    switchPanel,
    locateInDoc,
    selectExtractionSection,
    retryDocument: () => {
      documentRequestScanId.current = null;
      setDocumentRetry((value) => value + 1);
    },
    toggleRail,
  };

  return (
    <>
      <div
        className={
          isAdmin
            ? "-mx-4 -my-8 flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden bg-[var(--ds-bg)] sm:-mx-6 lg:-mx-8"
            : "flex h-full min-w-0 flex-col overflow-hidden bg-[var(--ds-bg)] [text-size-adjust:100%]"
        }
      >
        <ScanResultsTopbar
          data={data}
          actions={actions}
          headerBackButton={headerBackButton}
          headerActions={headerActions}
        />
        <ScanResultsMobileNav data={data} actions={actions} />
        <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden max-md:order-2 md:order-3">
          <ScanResultsRail data={data} actions={actions} />
          <WorkspacePanels
            data={data}
            actions={actions}
            workspaceSections={workspaceSections}
            onWorkspaceSectionChange={(key: WorkspaceSectionKey, checked: boolean) =>
              persistWorkspace({ ...workspaceSections, [key]: checked })
            }
            onResetWorkspace={() => persistWorkspace(DEFAULT_WORKSPACE_SECTIONS)}
          />
        </div>
      </div>
    </>
  );
}
