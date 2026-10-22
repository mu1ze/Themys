"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronDown,
  Shield,
  AlertTriangle,
  Info,
  CheckCircle2,
  Scale,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  getRegulationColor,
  getScoreColor,
  formatArticleId,
} from "@/lib/compliance-display";
import type { ComplianceScore, ComplianceTag } from "@/lib/compliance-shared";

type ComplianceTagWithClause = ComplianceTag & {
  clauseCategory?: string | null;
  clauseText?: string | null;
};

type ComplianceTabProps = {
  complianceScores: ComplianceScore[];
  tags: ComplianceTagWithClause[];
};

export function ComplianceTab({ complianceScores, tags }: ComplianceTabProps) {
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

  if (complianceScores.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16 text-center rounded-2xl"
        style={{
          border: "1px dashed var(--ds-border)",
          background: "var(--ds-card-hover)",
        }}
      >
        <Shield className="h-10 w-10" style={{ color: "var(--ds-text-muted)" }} />
        <h3
          className="mt-3 text-base font-semibold"
          style={{ color: "var(--ds-text)" }}
        >
          No compliance data
        </h3>
        <p
          className="mt-1 text-sm max-w-xs"
          style={{ color: "var(--ds-text-muted)" }}
        >
          Compliance tags will appear here once the scan identifies regulatory
          connections. Run a new scan to generate compliance data.
        </p>
      </div>
    );
  }

  // Group tags by regulation code
  const tagsByCode = new Map<string, ComplianceTagWithClause[]>();
  for (const tag of tags) {
    const code = tag.regulationCode;
    if (!code) continue;
    const list = tagsByCode.get(code) ?? [];
    list.push(tag);
    tagsByCode.set(code, list);
  }

  // Overall stats
  const totalViolations = complianceScores.reduce(
    (sum, s) => sum + s.violations,
    0,
  );
  const totalPotentials = complianceScores.reduce(
    (sum, s) => sum + s.potentials,
    0,
  );
  const avgScore =
    complianceScores.length > 0
      ? Math.round(
          complianceScores.reduce((sum, s) => sum + s.score, 0) /
            complianceScores.length,
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* ── Summary Header ── */}
      <div
        className="flex flex-wrap items-center gap-6 rounded-xl p-5"
        style={{
          border: "1px solid var(--ds-border)",
          background: "var(--ds-card)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-xl"
            style={{ background: getScoreColor(avgScore).bg }}
          >
            <span
              className="text-xl font-bold"
              style={{ color: getScoreColor(avgScore).text }}
            >
              {avgScore}
            </span>
          </div>
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "var(--ds-text-muted)" }}
            >
              Avg Compliance
            </p>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--ds-text-secondary)" }}
            >
              across {complianceScores.length} regulation
              {complianceScores.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div
          className="h-8 w-px"
          style={{ background: "var(--ds-border)" }}
        />

        <div className="flex items-center gap-4">
          {totalViolations > 0 && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-500">
              <AlertTriangle className="h-4 w-4" />
              {totalViolations} violation{totalViolations !== 1 ? "s" : ""}
            </span>
          )}
          {totalPotentials > 0 && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-500">
              <Info className="h-4 w-4" />
              {totalPotentials} potential{totalPotentials !== 1 ? "s" : ""}
            </span>
          )}
          {totalViolations === 0 && totalPotentials === 0 && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
              No violations found
            </span>
          )}
        </div>
      </div>

      {/* ── Regulation Cards ── */}
      <div className="space-y-4">
        {complianceScores.map((score, index) => {
          const codeTags = tagsByCode.get(score.code) ?? [];
          return (
            <motion.div
              key={score.code}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: index * 0.06,
                duration: 0.35,
                ease: "easeOut",
              }}
            >
              <RegulationCard
                score={score}
                tags={codeTags}
                isExpanded={expandedCode === score.code}
                onToggle={() =>
                  setExpandedCode(
                    expandedCode === score.code ? null : score.code,
                  )
                }
              />
            </motion.div>
          );
        })}
      </div>

      {/* ── Disclaimer ── */}
      <div
        className="flex items-start gap-2 rounded-lg p-3 text-xs"
        style={{
          background: "var(--ds-info-bg)",
          color: "var(--ds-text-muted)",
        }}
      >
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--ds-accent)" }} />
        <p>
          Compliance assessments are AI-generated and provided for informational
          purposes only. They do not constitute legal advice. Consult a qualified
          attorney for compliance decisions.
        </p>
      </div>
    </div>
  );
}

/* ── Regulation Card ── */

function RegulationCard({
  score,
  tags,
  isExpanded,
  onToggle,
}: {
  score: ComplianceScore;
  tags: ComplianceTagWithClause[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const colors = getScoreColor(score.score);
  const regColors = getRegulationColor(score.code);

  // Split tags by severity
  const violations = tags.filter(
    (t) =>
      t.clauseCategory &&
      tags.some((_) => false), // placeholder — we use score counts
  );
  // Actually, we don't have severity on tags directly. Use the score counts.
  // The tags are all for this regulation, so we show them all in the expanded view.

  return (
    <div
      className="overflow-hidden rounded-xl transition-all duration-200"
      style={{
        border: `1px solid ${isExpanded ? "var(--ds-accent)" : "var(--ds-border)"}`,
        background: "var(--ds-card)",
        boxShadow: isExpanded
          ? "0 0 0 1px var(--ds-accent-glow)"
          : "none",
      }}
    >
      {/* Card Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider",
                  regColors.bg,
                  regColors.text,
                  regColors.border,
                )}
              >
                <span
                  className={cn("h-1.5 w-1.5 rounded-full", regColors.dot)}
                />
                {score.code}
              </span>
              <span
                className="text-xs font-medium"
                style={{ color: "var(--ds-text-muted)" }}
              >
                {score.fullName}
              </span>
            </div>

            {/* Score Bar */}
            <div className="mt-3 flex items-center gap-3">
              <div
                className="h-2 flex-1 overflow-hidden rounded-full"
                style={{ background: "var(--ds-card-hover)" }}
              >
                <motion.div
                  className={cn("h-full rounded-full", colors.bar)}
                  initial={{ width: 0 }}
                  animate={{ width: `${score.score}%` }}
                  transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
                />
              </div>
              <span
                className="text-sm font-bold tabular-nums"
                style={{ color: colors.text }}
              >
                {score.score}/100
              </span>
            </div>

            {/* Counts */}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {score.violations > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-rose-400">
                  <AlertTriangle className="h-3 w-3" />
                  {score.violations} violation{score.violations !== 1 ? "s" : ""}
                </span>
              )}
              {score.potentials > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-400">
                  <Info className="h-3 w-3" />
                  {score.potentials} potential{score.potentials !== 1 ? "s" : ""}
                </span>
              )}
              {score.info > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue-400">
                  <CheckCircle2 className="h-3 w-3" />
                  {score.info} info
                </span>
              )}
              {tags.length > 0 && (
                <span
                  className="text-[11px]"
                  style={{ color: "var(--ds-text-dim)" }}
                >
                  {tags.length} clause{tags.length !== 1 ? "s" : ""} mapped
                </span>
              )}
            </div>
          </div>

          {/* Score Badge */}
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
            style={{ background: colors.bg }}
          >
            <span className="text-xl font-bold" style={{ color: colors.text }}>
              {score.score}
            </span>
          </div>
        </div>

        {/* Expand Button */}
        {tags.length > 0 && (
          <button
            type="button"
            onClick={onToggle}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-semibold transition-colors"
            style={{
              border: "1px solid var(--ds-border)",
              background: isExpanded ? "var(--ds-accent-glow)" : "var(--ds-card-hover)",
              color: isExpanded ? "var(--ds-accent)" : "var(--ds-text-muted)",
            }}
          >
            {isExpanded ? "Hide details" : `Show ${tags.length} clause mapping${tags.length !== 1 ? "s" : ""}`}
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform duration-200",
                isExpanded && "rotate-180",
              )}
            />
          </button>
        )}
      </div>

      {/* Expanded: Clause Mappings */}
      <AnimatePresence>
        {isExpanded && tags.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ borderTop: "1px solid var(--ds-border)" }}
          >
            <div className="max-h-96 overflow-y-auto p-4 space-y-3">
              {tags.map((tag, i) => (
                <ClauseMapping
                  key={`${tag.clauseId}-${tag.articleId}-${i}`}
                  tag={tag}
                  regColors={regColors}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Individual Clause Mapping ── */

function ClauseMapping({
  tag,
  regColors,
}: {
  tag: ComplianceTagWithClause;
  regColors: ReturnType<typeof getRegulationColor>;
}) {
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: "1px solid var(--ds-border)", background: "var(--ds-card)" }}
    >
      {/* Article Header */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ background: "var(--ds-card-hover)" }}
      >
        <Scale className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--ds-accent)" }} />
        <span className="text-[11px] font-bold" style={{ color: "var(--ds-text)" }}>
          {formatArticleId(tag.articleId)}
        </span>
        {tag.articleTitle && (
          <>
            <span style={{ color: "var(--ds-text-dim)" }}>—</span>
            <span
              className="text-[11px] font-medium truncate"
              style={{ color: "var(--ds-text-secondary)" }}
            >
              {tag.articleTitle}
            </span>
          </>
        )}
        <span className="ml-auto text-[10px] tabular-nums" style={{ color: "var(--ds-text-dim)" }}>
          {Math.round(tag.relevance * 100)}% match
        </span>
      </div>

      {/* Content */}
      <div className="px-3 py-2.5 space-y-2.5">
        {/* Regulation context */}
        {tag.regulationFullName && (
          <div className="flex items-start gap-2 rounded-md px-2.5 py-2"
            style={{ background: "var(--ds-info-bg)" }}>
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--ds-info)" }} />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5"
                style={{ color: "var(--ds-info)" }}>
                Regulation
              </p>
              <p className="text-xs leading-relaxed"
                style={{ color: "var(--ds-text-secondary)" }}>
                {tag.regulationFullName} — {formatArticleId(tag.articleId)}
                {tag.articleTitle ? `: ${tag.articleTitle}` : ''}
              </p>
            </div>
          </div>
        )}

        {/* Violating Quote */}
        {tag.quote && (
          <div
            className="flex items-start gap-2 rounded-md px-3 py-2"
            style={{
              borderLeft: "3px solid var(--ds-danger)",
              background: "var(--ds-danger-bg)",
            }}
          >
            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--ds-danger)" }} />
            <div className="min-w-0">
              <p
                className="text-[10px] font-semibold uppercase tracking-wider mb-0.5"
                style={{ color: "var(--ds-danger)" }}
              >
                Violating text
              </p>
              <p
                className="text-xs italic leading-relaxed"
                style={{ color: "var(--ds-text-secondary)" }}
              >
                &ldquo;{tag.quote}&rdquo;
              </p>
            </div>
          </div>
        )}

        {/* Clause Category */}
        {tag.clauseCategory && (
          <div className="flex items-center gap-1.5">
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--ds-text-dim)" }}
            >
              Category:
            </span>
            <span
              className="text-[11px] font-medium"
              style={{ color: "var(--ds-text-secondary)" }}
            >
              {tag.clauseCategory}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
