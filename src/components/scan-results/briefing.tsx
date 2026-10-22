"use client";

import { ArrowDown, ArrowRight, BookOpen, ChevronDown, CircleAlert, FileText, Info, MapPin } from "lucide-react";
import Link from "next/link";
import { DecisionControl } from "@/components/decision-control";
import { DomainFavicon } from "@/components/domain-favicon";
import { cn } from "@/lib/cn";
import { clauseExcerpt } from "@/lib/scan-results-workspace";
import { formatClauseTitle } from "@/lib/scan-display";
import { documentTypeLabel } from "@/lib/document-types";
import { CustomizePopover, SectionGate } from "./customize-popover";
import type { WorkspaceActions, WorkspaceClause, WorkspaceData } from "./types";
import type { WorkspaceSectionKey } from "@/lib/scan-results-workspace";
import styles from "./briefing.module.css";

type BriefingProps = {
  data: WorkspaceData;
  actions: WorkspaceActions;
  sections: Record<WorkspaceSectionKey, boolean>;
  onSectionChange: (key: WorkspaceSectionKey, checked: boolean) => void;
  onReset: () => void;
};

export function BriefingFinding({ clause, index, actions }: { clause: WorkspaceClause; index: number; actions: WorkspaceActions }) {
  const isWarning = clause.riskLevel === "red" && !clause.isStandardPractice;
  const isNoteworthy = Boolean(clause.isStandardPractice) || clause.riskLevel === "yellow";
  const severity = isWarning ? "Warning" : isNoteworthy ? "Noteworthy" : "Informational";
  const category = formatClauseTitle(clause.category);
  const explanation = clause.explanation?.trim() || category;
  const why = clause.whyItMatters?.trim();
  const action = clause.recommendedAction?.trim();

  return (
    <details className={styles.finding}>
      <summary className={styles.findingSummary}>
        <span className={styles.number} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <span className={styles.findingCopy}>
          <span className={styles.tags}>
            <span className={cn(styles.severity, isWarning ? styles.warning : isNoteworthy ? styles.noteworthy : styles.info)}>
              <span aria-hidden="true" />{severity}
            </span>
            <span className={styles.category}>{category}</span>
            {clause.impact.level === "high" && <span className={styles.localImpact}>Higher local impact</span>}
          </span>
          <span className={styles.findingTitle}>{clauseExcerpt(explanation, 170)}</span>
          {why && <span className={styles.findingDescription}>{clauseExcerpt(why, 150)}</span>}
        </span>
        <ChevronDown className={styles.chevron} size={16} aria-hidden="true" />
      </summary>
      <div className={styles.findingDetail}>
        <div>
          <h3>What this means for you</h3>
          <p>{explanation}</p>
          {why && why !== explanation && <p className={styles.detailWhy}>{why}</p>}
        </div>
        {action && <div className={styles.action}><ArrowRight size={16} aria-hidden="true" /><div><h3>What you can do</h3><p>{action}</p></div></div>}
        <div>
          <h3>What the document says</h3>
          <blockquote>“{clauseExcerpt(clause.text, 600)}”</blockquote>
          <button type="button" className={styles.sourceLink} onClick={() => actions.locateInDoc(clause.id)}>
            View in the original document <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </details>
  );
}

export function ScanResultsBriefing({ data, actions, sections, onSectionChange, onReset }: BriefingProps) {
  const warnings = data.uniqueClauses.filter((clause) => clause.riskLevel === "red" && !clause.isStandardPractice).length;
  const noteworthyCount = data.uniqueClauses.filter((clause) => Boolean(clause.isStandardPractice) || clause.riskLevel === "yellow").length;
  const informational = Math.max(0, data.uniqueCount - warnings - noteworthyCount);
  const priorityClauses = data.flaggedClauses.slice(0, 3);
  const hasFindings = data.flaggedCount > 0;
  const hasClauses = data.uniqueCount > 0;
  const fallbackSummary = hasFindings
    ? `${data.flaggedCount} of the ${data.uniqueCount} analyzed clauses are worth a closer look. Start with the key findings below, then open any clause for its meaning, a next step, and the original wording.`
    : hasClauses
      ? "No clauses were flagged for extra attention. You can still review the analyzed clauses and the original wording."
      : "No analyzed clauses are available for this scan. Review the document before drawing a conclusion.";
  const summary = data.scan.summary?.trim() || fallbackSummary;
  const reviewPriority = () => {
    if (!hasFindings || !sections.topitem) {
      actions.switchPanel(hasFindings ? "flagged" : "document");
      return;
    }
    const first = document.querySelector<HTMLDetailsElement>("#scan-priority-findings details");
    if (!first) return;
    first.open = true;
    first.querySelector("summary")?.focus({ preventScroll: true });
    first.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };

  return (
    <div className={styles.briefing}>
      <div className={styles.reportHeading}>
        <div className={styles.documentIcon}>
          {data.scan.domain ? <DomainFavicon domain={data.scan.domain} size={24} className="h-6 w-6 rounded-md" /> : <FileText size={22} strokeWidth={1.5} />}
        </div>
        <div className={styles.reportIdentity}>
          <p className={styles.eyebrow}>Your scan, in plain English</p>
          <h1>{data.scan.serviceLabel}</h1>
          <div className={styles.metadata}>
            <span>{documentTypeLabel(data.scan.documentType)}</span>
            <span>{data.scan.updatedLabel}</span>
            <span>{data.scan.clauseCount || data.uniqueCount} clauses analyzed</span>
          </div>
        </div>
        <CustomizePopover
          label="Report sections"
          items={[
            { key: "bottomline", label: "Briefing" },
            { key: "topitem", label: "Key findings" },
            { key: "fulldoc", label: "Explore the report" },
            { key: "stats", label: "Finding counts" },
          ]}
          values={sections}
          onChange={onSectionChange}
          onReset={onReset}
          className="shrink-0"
        />
      </div>

      <SectionGate show={sections.bottomline}>
        <section className={cn(styles.hero, !sections.stats && styles.heroWithoutStats)} aria-label="Scan briefing">
          <div className={styles.heroCopy}>
            <div className={styles.attention}>
              <CircleAlert size={14} aria-hidden="true" />
              <span>{hasClauses ? data.attention.label : "Analysis unavailable"}</span>
              {hasClauses && <span className={styles.score} title="Attention score: a higher score means more review is needed.">{data.score100}/100 attention score</span>}
            </div>
            <h2>{hasFindings ? "Know what you’re agreeing to." : hasClauses ? "No flags. Still worth a read." : "Take a look at the original."}</h2>
            <p>{clauseExcerpt(summary, 340)}</p>
            {summary.length > 340 && <details className={styles.fullSummary}><summary>Read the full summary</summary><p>{summary}</p></details>}
            <button type="button" onClick={reviewPriority} className={styles.primary}>
              {hasFindings ? `Review the ${priorityClauses.length} key finding${priorityClauses.length === 1 ? "" : "s"}` : "Review the document"}
              <ArrowDown size={14} aria-hidden="true" />
            </button>
          </div>
          <SectionGate show={sections.stats}>
            <div className={styles.metrics} aria-label="Finding severity counts">
              <span className={styles.metricsLabel}>In this scan</span>
              <div><strong>{warnings}</strong><span><i className={styles.warning} />Warning{warnings === 1 ? "" : "s"}</span></div>
              <div><strong>{noteworthyCount}</strong><span><i className={styles.noteworthy} />Noteworthy</span></div>
              <div><strong>{informational}</strong><span><i className={styles.info} />Informational</span></div>
            </div>
          </SectionGate>
        </section>
        <p className={styles.footnote}><Info size={13} aria-hidden="true" /><span>AI-generated guidance. Check important details in the original document.</span></p>
      </SectionGate>

      <SectionGate show={sections.topitem}>
        <section id="scan-priority-findings" className={styles.priority}>
          <div className={styles.sectionHeading}>
            <h2>What deserves your attention</h2>
            <span>{hasFindings ? "Start here" : "Scan complete"}</span>
          </div>
          {priorityClauses.length > 0 ? (
            <div className={styles.findings}>
              {priorityClauses.map((clause, index) => <BriefingFinding key={clause.id} clause={clause} index={index} actions={actions} />)}
            </div>
          ) : <p className={styles.empty}>{hasClauses ? "No flagged clauses in this scan. The complete extraction is available in the report." : "There are no findings to show for this scan."}</p>}
          <button type="button" className={styles.more} onClick={() => actions.switchPanel(hasFindings ? "flagged" : "extraction")}>
            <span>{hasFindings ? `View all ${data.flaggedCount} flagged findings` : "View the analyzed clauses"}<ArrowRight size={14} aria-hidden="true" /></span>
            <span>{hasFindings ? "The complete picture" : "Full extraction"}</span>
          </button>
        </section>
      </SectionGate>

      <SectionGate show={sections.fulldoc}>
        <div className={styles.explore}>
          <button type="button" onClick={() => actions.switchPanel("document")}><BookOpen size={18} strokeWidth={1.6} aria-hidden="true" /><span><strong>Read the full document</strong><span>The original wording behind every finding.</span></span><ArrowRight size={15} aria-hidden="true" /></button>
          <button type="button" onClick={() => actions.switchPanel("compliance")}><MapPin size={18} strokeWidth={1.6} aria-hidden="true" /><span><strong>Understand the legal context</strong><span>Location, frameworks, and references.</span></span><ArrowRight size={15} aria-hidden="true" /></button>
        </div>
      </SectionGate>

      <div className={cn(styles.mobileDecision, actions.railCollapsed && styles.showDecision)}>
        <div><p>Your decision</p><span>A note for your records.</span></div>
        <DecisionControl scanId={data.scan.id} initialDecision={data.scan.decision} value={data.scan.decision} onSaved={actions.onDecisionSaved} variant="strip" />
        <Link href="/settings"><MapPin size={13} aria-hidden="true" />{data.jurisdiction.isSet ? data.jurisdiction.label : "Add your location for context"}</Link>
      </div>
      <footer className={styles.footer}><span>{data.scan.clauseCount || data.uniqueCount} clauses analyzed · {documentTypeLabel(data.scan.documentType)}</span><span>AI analysis · Not legal advice</span></footer>
    </div>
  );
}
