"use client";

import { ArrowRight, ChevronDown, FileText } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { RawDocumentViewer } from "@/components/raw-document-viewer";
import { clauseExcerpt } from "@/lib/scan-results-workspace";
import { formatClauseTitle } from "@/lib/scan-display";
import { formatArticleId } from "@/lib/compliance-display";
import type { WorkspaceSectionKey } from "@/lib/scan-results-workspace";
import { ScanResultsBriefing, BriefingFinding } from "./briefing";
import type { WorkspaceActions, WorkspaceData } from "./types";
import styles from "./briefing.module.css";

function ReportHeading({ title, description, count }: { title: string; description: string; count?: string }) {
  return (
    <div className={styles.reportHeading}>
      <div className={styles.documentIcon}><FileText size={22} strokeWidth={1.5} /></div>
      <div className={styles.reportIdentity}>
        <p className={styles.eyebrow}>Your scan, in plain English</p>
        <h1>{title}</h1>
        <div className={styles.metadata}><span>{description}</span>{count && <span>{count}</span>}</div>
      </div>
    </div>
  );
}

function ReportGroup({ title, label, children }: { title: string; label?: string; children: React.ReactNode }) {
  return (
    <section className={styles.priority}>
      <div className={styles.sectionHeading}><h2>{title}</h2>{label && <span>{label}</span>}</div>
      <div className={styles.findings}>{children}</div>
    </section>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}

export function SummaryPanel({ data, actions, sections, onSectionChange, onReset }: {
  data: WorkspaceData;
  actions: WorkspaceActions;
  sections: Record<WorkspaceSectionKey, boolean>;
  onSectionChange: (key: WorkspaceSectionKey, checked: boolean) => void;
  onReset: () => void;
}) {
  return <ScanResultsBriefing data={data} actions={actions} sections={sections} onSectionChange={onSectionChange} onReset={onReset} />;
}

export function FlaggedPanel({ data, actions }: { data: WorkspaceData; actions: WorkspaceActions }) {
  return (
    <div className={styles.briefing}>
      <ReportHeading title="Flagged clauses" description="The wording and next steps behind each finding" count={`${data.flaggedCount} findings`} />
      {data.flaggedClauses.length ? (
        <ReportGroup title="What deserves your attention" label="Open a finding to read more">
          {data.flaggedClauses.map((clause, index) => <BriefingFinding key={clause.id} clause={clause} index={index} actions={actions} />)}
        </ReportGroup>
      ) : <EmptyRow>No clauses were flagged for extra attention.</EmptyRow>}
    </div>
  );
}

export function SuggestionsPanel({ data, actions }: { data: WorkspaceData; actions: WorkspaceActions }) {
  return (
    <div className={styles.briefing}>
      <ReportHeading title="Actionable insights" description="Steps you can start now, grounded in the document" count={`${data.pushbackItems.length} insights`} />
      {data.pushbackItems.length ? (
        <ReportGroup title="What you can do" label="Open an insight to read more">
          {data.pushbackItems.map((item, index) => (
            <details key={`${item.clauseId ?? "insight"}-${index}`} className={styles.finding}>
              <summary className={styles.findingSummary}>
                <span className={styles.number} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <span className={styles.findingCopy}>
                  <span className={styles.tags}><span className={styles.severity}><span aria-hidden="true" />{item.isDirectAction ? "Available action" : "Suggested ask"}</span></span>
                  <span className={styles.findingTitle}>{item.title || "Review this term"}</span>
                  <span className={styles.findingDescription}>{clauseExcerpt(item.suggestedAsk, 150)}</span>
                </span>
                <ChevronDown className={styles.chevron} size={16} aria-hidden="true" />
              </summary>
              <div className={styles.findingDetail}>
                <div><h3>{item.isDirectAction ? "Action you can take" : "What you can ask for"}</h3><p>{item.suggestedAsk}</p><CopyButton value={item.suggestedAsk} label="Copy action" copiedLabel="Copied" className="mt-3" /></div>
                <div><h3>Why it matters</h3><p>{item.whyItMatters}</p></div>
                <div><h3>What the document says</h3><blockquote>“{clauseExcerpt(item.quote, 600)}”</blockquote>{item.clauseId && data.uniqueClauses.some((clause) => clause.id === item.clauseId) && <button type="button" className={styles.sourceLink} onClick={() => actions.locateInDoc(item.clauseId!)}>View in the original document <ArrowRight size={14} aria-hidden="true" /></button>}</div>
              </div>
            </details>
          ))}
        </ReportGroup>
      ) : <EmptyRow>No immediate steps were identified in this scan. Review flagged clauses for context.</EmptyRow>}
    </div>
  );
}

export function CompliancePanel({ data, actions }: { data: WorkspaceData; actions: WorkspaceActions }) {
  return (
    <div className={styles.briefing}>
      <ReportHeading title="Compliance" description="Regulatory frameworks connected to the findings" count={`${data.complianceScores.length} frameworks`} />
      {data.complianceScores.length ? (
        <ReportGroup title="Legal context" label="Open a framework to see its references">
          {data.complianceScores.map((score, index) => {
            const tags = data.complianceTags.filter((tag) => tag.regulationCode === score.code);
            const articleIds = Array.from(new Set(tags.map((tag) => formatArticleId(tag.articleId)).filter(Boolean)));
            const linkedIds = new Set(tags.map((tag) => tag.clauseId));
            const linkedClauses = data.uniqueClauses.filter((clause) => linkedIds.has(clause.id));
            return (
              <details key={score.code} className={styles.finding}>
                <summary className={styles.findingSummary}>
                  <span className={styles.number} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <span className={styles.findingCopy}>
                    <span className={styles.tags}><span className={styles.category}>{score.code}</span><span className={styles.localImpact}>{score.score}/100</span></span>
                    <span className={styles.findingTitle}>{score.fullName}</span>
                    <span className={styles.findingDescription}>{linkedClauses.length} connected clause{linkedClauses.length === 1 ? "" : "s"}</span>
                  </span>
                  <ChevronDown className={styles.chevron} size={16} aria-hidden="true" />
                </summary>
                <div className={styles.findingDetail}>
                  {articleIds.length > 0 && <div><h3>Referenced articles</h3><p>{articleIds.join(" · ")}</p></div>}
                  <div><h3>Connected wording</h3>{linkedClauses.length ? linkedClauses.map((clause) => (
                    <div key={clause.id} className="mb-4"><p className="font-medium">{formatClauseTitle(clause.category)}</p><blockquote>“{clauseExcerpt(clause.text, 420)}”</blockquote><button type="button" className={styles.sourceLink} onClick={() => actions.locateInDoc(clause.id)}>View in the original document <ArrowRight size={14} aria-hidden="true" /></button></div>
                  )) : <p>No specific clauses were linked to this framework.</p>}</div>
                </div>
              </details>
            );
          })}
        </ReportGroup>
      ) : <EmptyRow>No regulatory connections are available for this scan.</EmptyRow>}
    </div>
  );
}

export function ExtractionPanel({ data, actions }: { data: WorkspaceData; actions: WorkspaceActions }) {
  return (
    <div className={styles.briefing}>
      <ReportHeading title="Extraction" description="Sections identified in the source document" count={`${data.fullExtraction.length} sections`} />
      {data.fullExtractionLoading ? <EmptyRow>Loading structured sections…</EmptyRow> : data.fullExtraction.length ? (
        <ReportGroup title="Document sections" label="Open a section to read its key points">
          {data.fullExtraction.map((section, index) => (
            <details key={`${section.section}-${index}`} className={styles.finding}>
              <summary className={styles.findingSummary}>
                <span className={styles.number} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <span className={styles.findingCopy}><span className={styles.tags}><span className={styles.category}>Section {index + 1}</span></span><span className={styles.findingTitle}>{section.section}</span><span className={styles.findingDescription}>{clauseExcerpt(section.keyPoints[0]?.detail ?? "", 150)}</span></span>
                <ChevronDown className={styles.chevron} size={16} aria-hidden="true" />
              </summary>
              <div className={styles.findingDetail}>
                {section.keyPoints.map((point, pointIndex) => <div key={pointIndex}><h3>{point.severity === "warning" ? "Warning" : point.severity === "caution" ? "Noteworthy" : "Key point"}</h3><p>{point.detail}</p>{point.quote && <blockquote>“{point.quote}”</blockquote>}</div>)}
                <button type="button" className={styles.sourceLink} onClick={() => actions.selectExtractionSection(index)}>Read the full document <ArrowRight size={14} aria-hidden="true" /></button>
              </div>
            </details>
          ))}
        </ReportGroup>
      ) : <EmptyRow>No extraction sections are available for this scan.</EmptyRow>}
    </div>
  );
}

export function DocumentPanel({ data, actions }: { data: WorkspaceData; actions: WorkspaceActions }) {
  return (
    <div className={styles.briefing}>
      <ReportHeading title="Full document" description="Complete original wording" />
      {data.scan.documentLoading ? (
        <EmptyRow>Loading the original document…</EmptyRow>
      ) : data.scan.documentError ? (
        <div>
          <EmptyRow>{data.scan.documentError}</EmptyRow>
          <button type="button" className={styles.sourceLink} onClick={actions.retryDocument}>
            Try loading again <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
      ) : data.scan.rawText ? (
        <RawDocumentViewer text={data.scan.rawText} highlightText={actions.highlightText} mode="page" />
      ) : (
        <EmptyRow>The original document is unavailable for this scan.</EmptyRow>
      )}
    </div>
  );
}

export function WorkspacePanels({ data, actions, workspaceSections, onWorkspaceSectionChange, onResetWorkspace }: {
  data: WorkspaceData;
  actions: WorkspaceActions;
  workspaceSections: Record<WorkspaceSectionKey, boolean>;
  onWorkspaceSectionChange: (key: WorkspaceSectionKey, checked: boolean) => void;
  onResetWorkspace: () => void;
}) {
  return (
    <div key={actions.panel} className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 pt-6 pb-8 sm:px-7 sm:pt-8 sm:pb-12 lg:px-10" data-scan-report-scroll>
      <div className="mx-auto w-full max-w-[880px]">
        {actions.panel === "summary" && <SummaryPanel data={data} actions={actions} sections={workspaceSections} onSectionChange={onWorkspaceSectionChange} onReset={onResetWorkspace} />}
        {actions.panel === "flagged" && <FlaggedPanel data={data} actions={actions} />}
        {actions.panel === "suggestions" && <SuggestionsPanel data={data} actions={actions} />}
        {actions.panel === "compliance" && <CompliancePanel data={data} actions={actions} />}
        {actions.panel === "extraction" && <ExtractionPanel data={data} actions={actions} />}
        {actions.panel === "document" && <DocumentPanel data={data} actions={actions} />}
      </div>
    </div>
  );
}
