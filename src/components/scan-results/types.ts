import type { JurisdictionContext } from "@/lib/jurisdiction";
import type { WorkspacePanel } from "@/lib/scan-results-workspace";
import type { ComplianceScore, ComplianceTag, ComplianceTagRef } from "@/lib/compliance-shared";
import type { FullExtractionSection } from "@/lib/llm";
import type { PushbackItem } from "@/lib/pushback";
import type { ScanDecision } from "@/lib/decisions";
import type { DocumentType } from "@/lib/document-types";
import type { AttentionTone } from "@/lib/attention-level";

export const workspaceActionButtonClass =
  "inline-flex items-center gap-0.5 rounded-[6px] border border-[var(--ds-border)] bg-[var(--ds-card)] px-2 py-1 text-[12px] font-medium text-[var(--ds-text-muted)] transition hover:border-[var(--ds-border-hover)] hover:bg-[var(--ds-card-hover)] hover:text-[var(--ds-text-secondary)] sm:text-[13px]";

export const workspaceActionButtonIconClass = "h-3.5 w-3.5";

export type WorkspaceClause = {
  id: string;
  text: string;
  category: string | null;
  riskScore: number | null;
  riskLevel: "green" | "yellow" | "red" | null;
  explanation: string | null;
  whyItMatters: string | null;
  recommendedAction?: string | null;
  isTargetClause?: boolean;
  isStandardPractice?: boolean;
  isFlagged: boolean;
  position: number | null;
  impact: {
    level: "high" | "medium" | "low";
    label: string;
    score: number;
    note: string;
  };
};

export type WorkspaceScanMeta = {
  id: string;
  title: string;
  serviceLabel: string;
  domain: string | null;
  url: string | null;
  documentType: DocumentType;
  updatedLabel: string;
  summary: string | null;
  rawText: string;
  documentLoading: boolean;
  documentError: string | null;
  createdAt: string;
  clauseCount: number;
  decision: ScanDecision;
};

export type WorkspaceData = {
  scan: WorkspaceScanMeta;
  score100: number;
  attention: { bucket: "high" | "medium" | "low"; label: string; tone: AttentionTone };
  flaggedCount: number;
  uniqueCount: number;
  targetHits: number;
  regulatoryFlags: number;
  jurisdiction: JurisdictionContext;
  jurisdictionSummary: string;
  clauses: WorkspaceClause[];
  flaggedClauses: WorkspaceClause[];
  uniqueClauses: WorkspaceClause[];
  fullExtraction: FullExtractionSection[];
  fullExtractionLoading: boolean;
  pushbackItems: PushbackItem[];
  vendorLabel: string;
  complianceScores: ComplianceScore[];
  complianceTags: (ComplianceTag & { clauseCategory?: string | null; clauseText?: string | null })[];
  clauseComplianceTags: Record<string, ComplianceTagRef[]>;
  previousScanCount: number;
  previousScanId?: string;
  documentIdentityKey?: string | null;
  userPlan?: string;
  isAdmin: boolean;
};

export type WorkspaceActions = {
  onDecisionSaved: (decision: ScanDecision) => void;
  panel: WorkspacePanel;
  highlightText?: string;
  railCollapsed: boolean;
  switchPanel: (panel: WorkspacePanel) => void;
  locateInDoc: (id: string) => void;
  selectExtractionSection: (index: number) => void;
  retryDocument: () => void;
  toggleRail: () => void;
};

export type ClauseClassification = "warning" | "noteworthy" | "informational";

export function getClauseClassification(clause: {
  riskLevel?: WorkspaceClause["riskLevel"];
  isStandardPractice?: boolean;
}): ClauseClassification {
  if (clause.riskLevel === "red" && !clause.isStandardPractice) {
    return "warning";
  }
  if (clause.isStandardPractice || clause.riskLevel === "yellow") {
    return "noteworthy";
  }
  return "informational";
}

export function getClauseClassificationLabel(clause: {
  riskLevel?: WorkspaceClause["riskLevel"];
  isStandardPractice?: boolean;
}): string {
  const classification = getClauseClassification(clause);
  if (classification === "warning") return "Warning";
  if (classification === "noteworthy") return "Noteworthy";
  return "Informational";
}

export function classificationDotClass(classification: ClauseClassification): string {
  if (classification === "warning") return "bg-[var(--ds-danger)]";
  if (classification === "noteworthy") return "bg-[var(--ds-warning)]";
  return "bg-[var(--ds-success)]";
}

export function riskDotClass(level: WorkspaceClause["riskLevel"]): string {
  if (level === "red") return "bg-[var(--ds-danger)]";
  if (level === "yellow") return "bg-[var(--ds-warning)]";
  return "bg-[var(--ds-success)]";
}

export function scoreToneClass(score: number): string {
  if (score >= 80) return "text-[var(--ds-success)]";
  if (score >= 50) return "text-[var(--ds-warning)]";
  return "text-[var(--ds-danger)]";
}

export function scoreBarClass(score: number): string {
  if (score >= 80) return "bg-[var(--ds-success)]";
  if (score >= 50) return "bg-[var(--ds-warning)]";
  return "bg-[var(--ds-danger)]";
}

export function attentionBarClass(tone: AttentionTone): string {
  if (tone === "danger") return "bg-[var(--ds-danger)]";
  if (tone === "warning") return "bg-[var(--ds-warning)]";
  return "bg-[var(--ds-success)]";
}

export function clauseJurisdictionTag(
  clause: WorkspaceClause,
  tags: Record<string, ComplianceTagRef[]>,
  jurisdiction: JurisdictionContext,
): string {
  const codes = Array.from(
    new Set((tags[clause.id] ?? []).map((tag) => tag.regulationCode).filter(Boolean)),
  );
  if (codes.length > 0) return codes.slice(0, 2).join(" · ");
  if (clause.impact.level === "high" && jurisdiction.normalizedState) {
    return `Higher impact in ${jurisdiction.normalizedState}`;
  }
  if (clause.impact.level === "medium") return "Moderate impact";
  return clause.impact.label;
}

export function findClauseForQuote(quote: string, clauses: WorkspaceClause[]): WorkspaceClause | undefined {
  const needle = quote.trim().toLowerCase().slice(0, 48);
  if (!needle) return undefined;
  return clauses.find((clause) => {
    const hay = clause.text.toLowerCase();
    return hay.includes(needle) || needle.includes(hay.slice(0, 48));
  });
}
