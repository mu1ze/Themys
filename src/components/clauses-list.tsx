"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Filter,
  Info,
  MapPin,
  Quote,
  ShieldCheck,
  TextSelect,
} from "lucide-react";
import { Badge } from "@/components/ui";
import { Modal } from "@/components/modal";
import { CopyButton } from "@/components/copy-button";
import { ShowMore } from "@/components/show-more";
import { ComplianceChips } from "@/components/compliance-chips";
import { cn } from "@/lib/cn";
import { formatClauseTitle } from "@/lib/scan-display";
import type { ComplianceTagRef } from "@/lib/compliance-shared";

type ClauseItem = {
  id: string;
  text: string;
  category: string | null;
  riskScore: number | null;
  riskLevel: "green" | "yellow" | "red" | null;
  position: number | null;
  isFlagged: boolean;
  isAiExplained: boolean;
  explanation: string | null;
  whyItMatters: string | null;
  recommendedAction?: string | null;
  confidence: number | null;
  impact: {
    level: "high" | "medium" | "low";
    label: string;
    score: number;
    note: string;
  };
  isStandardPractice?: boolean;
  isTargetClause?: boolean;
};

type ClausesListProps = {
  clauses: ClauseItem[];
  jurisdiction: {
    isSet: boolean;
    country?: string;
    state?: string;
  };
  clauseComplianceTags?: Record<string, ComplianceTagRef[]>;
  onClauseClick?: (text: string) => void;
};

function riskCardStyles(level: ClauseItem["riskLevel"], isStandardPractice?: boolean) {
  if (level === "red" && !isStandardPractice) {
    return {
      badge: "danger" as const,
      label: "Warning",
      icon: AlertTriangle,
      accent: "text-[var(--ds-danger)]",
      dot: "bg-[var(--ds-danger)]",
      hover: "hover:bg-[var(--ds-danger-bg)]",
      ring: "ring-1 ring-inset ring-[var(--ds-danger)]",
    };
  }
  if (isStandardPractice || level === "yellow") {
    return {
      badge: "warning" as const,
      label: "Noteworthy",
      icon: Info,
      accent: "text-[var(--ds-warning)]",
      dot: "bg-[var(--ds-warning)]",
      hover: "hover:bg-[var(--ds-warning-bg)]",
      ring: "ring-1 ring-inset ring-[var(--ds-warning)]",
    };
  }
  return {
    badge: "success" as const,
    label: "Standard",
    icon: CheckCircle2,
    accent: "text-[var(--ds-success)]",
    dot: "bg-[var(--ds-success)]",
    hover: "hover:bg-[var(--ds-success-bg)]",
    ring: "ring-1 ring-inset ring-[var(--ds-success)]",
  };
}

function ClauseCard({
  clause,
  index,
  onOpen,
  onHighlight,
}: {
  clause: ClauseItem;
  index: number;
  onOpen: () => void;
  onHighlight?: (e: React.MouseEvent) => void;
}) {
  const styles = riskCardStyles(clause.riskLevel, clause.isStandardPractice);
  const Icon = styles.icon;
  const title = formatClauseTitle(clause.category);

  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-haspopup="dialog"
      aria-label={`View details for ${title}`}
      className={cn(
        "group relative flex min-h-[190px] flex-col bg-[var(--ds-bg)] p-5 text-left sm:p-6",
        "transition-colors duration-200 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ds-accent)]",
        styles.hover,
        styles.ring,
        "cursor-pointer"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <Icon className={cn("h-5 w-5", styles.accent)} strokeWidth={1.75} />
        <div className="flex items-center gap-3">
          {onHighlight && (
            <button
              type="button"
              onClick={onHighlight}
              className="z-10 flex items-center gap-1.5 rounded-[var(--ds-radius-sm)] bg-[var(--ds-card-hover)] px-2.5 py-1 text-[10px] font-medium text-[var(--ds-text-muted)] opacity-0 transition-all hover:bg-[var(--ds-border)] hover:text-[var(--ds-text)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-accent)] group-hover:opacity-100"
              title="Locate in original document"
            >
              <TextSelect className="h-3 w-3" />
              Locate
            </button>
          )}
          <span className="font-mono text-[10px] tracking-widest text-[var(--ds-text-muted)]">
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>
      </div>

      <div className="mt-auto pt-8">
        <h3 className="text-[17px] font-medium leading-tight tracking-[-0.015em] text-[var(--ds-text)]">
          {title}
        </h3>
        <p className="mt-2 line-clamp-3 text-[13px] font-normal leading-5 text-[var(--ds-text-muted)] md:line-clamp-2">
          {clause.explanation ?? "This clause outlines terms standard to this product."}
        </p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[9px] font-medium uppercase tracking-[0.2em] text-[var(--ds-text-muted)]">
            <span className={cn("h-1.5 w-1.5 rounded-full", styles.dot)} />
            {styles.label}
          </span>
          <span className="flex items-center gap-1 text-[11px] font-medium text-[var(--ds-text-muted)] transition-colors group-hover:text-[var(--ds-text)]">
            View details
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
}

function ClauseModal({
  clause,
  jurisdiction,
  complianceTags,
  onClose,
}: {
  clause: ClauseItem;
  jurisdiction: ClausesListProps["jurisdiction"];
  complianceTags?: ComplianceTagRef[];
  onClose: () => void;
}) {
  const styles = riskCardStyles(clause.riskLevel, clause.isStandardPractice);
  const title = formatClauseTitle(clause.category);

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      className="max-w-3xl"
      eyebrow={
        <>
          <Badge tone={styles.badge} className="uppercase tracking-[0.14em]">{styles.label}</Badge>
          {clause.isTargetClause ? <Badge tone="warning" className="uppercase tracking-[0.14em]">Target clause</Badge> : null}
          {clause.isStandardPractice && !clause.isTargetClause ? <Badge tone="neutral" className="uppercase tracking-[0.14em]">Standard practice</Badge> : null}
        </>
      }
    >
        <div>
          <div className="grid gap-8 sm:grid-cols-[1fr_150px]">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--ds-text-muted)]">
                In plain English
              </p>
              <p className="mt-3 text-[17px] font-normal leading-7 text-[var(--ds-text)]">
                {clause.explanation ?? "This clause outlines terms standard to this product."}
              </p>
            </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
                <div className="border-l border-[var(--ds-border)] pl-4">
                  <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--ds-text-muted)]">Attention level</p>
                  <p className={cn("mt-2 text-lg font-medium", styles.accent)}>
                    {styles.label}
                  </p>
                </div>
                {clause.confidence != null && (
                  <div className="border-l border-[var(--ds-border)] pl-4">
                    <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--ds-text-muted)]">AI confidence</p>
                    <p className="mt-2 text-2xl font-medium text-[var(--ds-text)]">
                      {Math.round(clause.confidence * (clause.confidence <= 1 ? 100 : 1))}%
                    </p>
                  </div>
                )}
              </div>
          </div>

          {clause.whyItMatters && (
            <div className="mt-8 border-t border-[var(--ds-border)] pt-7">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--ds-text-muted)]">
                Why it matters
              </p>
              <p className="mt-3 text-base leading-7 text-[var(--ds-text-secondary)]">
                {clause.whyItMatters}
              </p>
            </div>
          )}

          {clause.recommendedAction && (
            <div className="mt-8 border-t border-[var(--ds-border)] pt-7">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--ds-text-muted)]">
                  Suggested ask
                </p>
                <CopyButton value={clause.recommendedAction} label="Copy ask" copiedLabel="Copied" />
              </div>
              <p className="mt-3 text-base font-medium leading-7 text-[var(--ds-text)]">
                {clause.recommendedAction}
              </p>
            </div>
          )}

          {jurisdiction.isSet && clause.impact.note && (
            <div className="mt-8 border-y border-[var(--ds-accent)]/20 bg-[var(--ds-accent-glow)] px-1 py-5">
              <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--ds-accent)]">
                <MapPin className="h-3.5 w-3.5" />
                Jurisdiction impact
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--ds-text-secondary)]">
                {clause.impact.note}
              </p>
            </div>
          )}

          <div className="mt-8 border-t border-[var(--ds-border)] pt-6">
            <div className="flex items-center justify-between gap-4">
              <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--ds-text-muted)]">
                <Quote className="h-4 w-4" />
                Original text
              </p>
              <CopyButton value={clause.text} label="Copy" copiedLabel="Copied" />
            </div>
            <blockquote className="mt-4 border-l-2 border-[var(--ds-border-hover)] pl-4 text-sm italic leading-6 text-[var(--ds-text-secondary)]">
              <ShowMore lines={4} moreLabel="Show full text" lessLabel="Show less">
                &ldquo;{clause.text}&rdquo;
              </ShowMore>
            </blockquote>
          </div>

          {complianceTags && complianceTags.length > 0 && (
            <div className="mt-8 border-t border-[var(--ds-border)] pt-7">
              <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--ds-text-muted)]">
                Compliance signals
              </p>
              <ComplianceChips tags={complianceTags} />
            </div>
          )}
        </div>
    </Modal>
  );
}

export function ClausesList({
  clauses,
  jurisdiction,
  clauseComplianceTags = {},
  onClauseClick,
}: ClausesListProps) {
  const [activeTab, setActiveTab] = useState<"all" | "flagged" | "moderate" | "safe">("all");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedClause, setSelectedClause] = useState<ClauseItem | null>(null);

  const stats = useMemo(
    () => ({
      all: clauses.length,
      flagged: clauses.filter((clause) => clause.riskLevel === "red").length,
      moderate: clauses.filter((clause) => clause.riskLevel === "yellow").length,
      safe: clauses.filter((clause) => clause.riskLevel === "green" || !clause.riskLevel).length,
    }),
    [clauses]
  );

  const categories = useMemo(() => {
    const values = new Set<string>();
    clauses.forEach((clause) => {
      if (clause.category) values.add(clause.category);
    });
    return Array.from(values).sort();
  }, [clauses]);

  const filteredClauses = useMemo(() => {
    let result = clauses;
    if (activeTab === "flagged") result = result.filter((clause) => clause.riskLevel === "red");
    if (activeTab === "moderate") result = result.filter((clause) => clause.riskLevel === "yellow");
    if (activeTab === "safe") result = result.filter((clause) => clause.riskLevel === "green" || !clause.riskLevel);
    if (activeCategory) result = result.filter((clause) => clause.category === activeCategory);
    return result;
  }, [clauses, activeTab, activeCategory]);

  const openClause = (clause: ClauseItem) => {
    setSelectedClause(clause);
  };

  const handleHighlight = (e: React.MouseEvent, clause: ClauseItem) => {
    e.stopPropagation();
    onClauseClick?.(clause.text);
  };

  const filterButton = (
    tab: "all" | "flagged" | "moderate" | "safe",
    label: string,
    count: number
  ) => (
    <button
      key={tab}
      type="button"
      onClick={() => setActiveTab(tab)}
      className={cn(
        "rounded-[var(--ds-radius-sm)] px-3.5 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-accent)]",
        activeTab === tab
          ? "bg-[var(--ds-card-hover)] text-[var(--ds-text)] ring-1 ring-inset ring-[var(--ds-border-hover)]"
          : "text-[var(--ds-text-muted)] hover:bg-[var(--ds-card-hover)] hover:text-[var(--ds-text)]"
      )}
    >
      {label} <span className="ml-1 opacity-65">{count}</span>
    </button>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 overflow-x-auto">
            {filterButton("all", "All", stats.all)}
            {filterButton("flagged", "Warnings", stats.flagged)}
            {filterButton("moderate", "Noteworthy", stats.moderate)}
            {filterButton("safe", "Standard", stats.safe)}
          </div>
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--ds-text-muted)]">
            {filteredClauses.length} {filteredClauses.length === 1 ? "clause" : "clauses"}
          </p>
        </div>

        {categories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Filter className="h-4 w-4 shrink-0 text-[var(--ds-text-muted)]" />
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className={cn(
                "whitespace-nowrap rounded-[var(--ds-radius-sm)] border px-3 py-1 text-[11px] font-normal transition",
                activeCategory === null
                  ? "border-[var(--ds-border)] bg-transparent text-[var(--ds-text-secondary)]"
                  : "border-transparent text-[var(--ds-text-muted)] hover:text-[var(--ds-text)]"
              )}
            >
              All topics
            </button>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={cn(
                  "whitespace-nowrap rounded-[var(--ds-radius-sm)] border px-3 py-1 text-[11px] font-normal transition",
                  activeCategory === category
                    ? "border-[var(--ds-border)] bg-transparent text-[var(--ds-text-secondary)]"
                    : "border-transparent text-[var(--ds-text-muted)] hover:text-[var(--ds-text)]"
                )}
              >
                {formatClauseTitle(category)}
              </button>
            ))}
          </div>
        )}
      </div>

      {filteredClauses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--ds-border)] bg-[var(--ds-card-hover)] py-16 text-center">
          <ShieldCheck className="h-10 w-10 text-[var(--ds-text-dim)]" />
          <h3 className="mt-3 text-base font-semibold text-[var(--ds-text)]">No clauses found</h3>
          <p className="mt-1 max-w-xs text-sm text-[var(--ds-text-muted)]">
            There are no clauses matching this classification.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-[var(--ds-border)] bg-[var(--ds-border)] md:grid-cols-2">
          {filteredClauses.map((clause, index) => (
            <ClauseCard
              key={clause.id}
              clause={clause}
              index={index}
              onOpen={() => openClause(clause)}
              onHighlight={onClauseClick ? (e) => handleHighlight(e, clause) : undefined}
            />
          ))}
        </div>
      )}

      {selectedClause && (
        <ClauseModal
          clause={selectedClause}
          jurisdiction={jurisdiction}
          complianceTags={clauseComplianceTags[selectedClause.id]}
          onClose={() => setSelectedClause(null)}
        />
      )}
    </div>
  );
}
