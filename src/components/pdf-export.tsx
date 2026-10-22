'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { FileDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { dedupeClausesByTitle, formatClauseTitle } from '@/lib/scan-display';
import type { FullExtractionSection } from '@/lib/llm';
import type { ComplianceTagRef } from '@/lib/compliance';
import type { ScanDecision } from '@/lib/decisions';
import { formatScanDecisionLabel } from '@/lib/decisions';
import type { PushbackItem } from '@/lib/pushback';

/* ─── Types ─── */

type ScanSummary = {
  id: string;
  title: string | null;
  url: string | null;
  domain: string | null;
  riskScore: number | null;
  createdAt: string;
  decision?: ScanDecision;
};

type ClauseSummary = {
  text: string;
  category: string | null;
  riskScore: number | null;
  riskLevel: 'green' | 'yellow' | 'red' | null;
  explanation: string | null;
  whyItMatters: string | null;
  position: number | null;
};

type PdfExportButtonProps = {
  scan: ScanSummary;
  clauses: ClauseSummary[];
  extraction?: FullExtractionSection[];
  complianceTags?: Record<string, ComplianceTagRef[]>;
  pushback?: PushbackItem[];
  userPlan?: string;
  className?: string;
  variant?: "link" | "toolbar" | "toolbar-icon";
};

/* ─── Helpers ─── */

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function riskColor(level: 'green' | 'yellow' | 'red' | null): string {
  if (level === 'red') return '#dc2626';
  if (level === 'yellow') return '#d97706';
  return '#059669';
}

function severityColor(severity: 'info' | 'caution' | 'warning'): string {
  if (severity === 'warning') return '#dc2626';
  if (severity === 'caution') return '#d97706';
  return '#777b86';
}

/** Strip emoji icons from section titles — react-pdf can't render them */
function cleanSectionTitle(title: string): string {
  return title.replace(/[^\w\s&()-/,.]/g, '').trim().replace(/\s+/g, ' ');
}

/* ─── PDF Document (loaded lazily) ─── */

async function generatePdf(
  scan: ScanSummary,
  clauses: ClauseSummary[],
  extraction: FullExtractionSection[],
  complianceTags: Record<string, ComplianceTagRef[]>,
  pushback: PushbackItem[],
) {
  const { Document, Page, Text, View, StyleSheet, pdf } = await import(
    '@react-pdf/renderer'
  );

  const COLORS = {
    accent: '#5d2a1a',
    peach: '#fbe1d1',
    background: '#fafafb',
    green: '#059669',
    yellow: '#d97706',
    red: '#dc2626',
    dark: '#17191c',
    muted: '#6f7278',
    lightBg: '#f2f2f3',
    border: '#ececec',
    white: '#ffffff',
  };

  const styles = StyleSheet.create({
    // ── Cover page ──
    coverPage: {
      padding: 60,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      backgroundColor: COLORS.background,
    },
    logo: {
      fontSize: 28,
      fontWeight: 'bold',
      fontFamily: 'Times-Roman',
      color: COLORS.dark,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 11,
      color: COLORS.muted,
      marginBottom: 50,
    },
    scoreCircle: {
      width: 110,
      height: 110,
      borderRadius: 55,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    scoreText: {
      fontSize: 15,
      fontWeight: 'bold',
      color: COLORS.white,
      textAlign: 'center',
      paddingHorizontal: 8,
    },
    scoreUnit: {
      fontSize: 9,
      color: COLORS.white,
      opacity: 0.9,
    },
    riskLabel: {
      fontSize: 13,
      fontWeight: 'bold',
      marginBottom: 40,
    },
    coverTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      fontFamily: 'Times-Roman',
      color: COLORS.dark,
      textAlign: 'center',
      marginBottom: 6,
    },
    coverUrl: {
      fontSize: 10,
      color: COLORS.muted,
      textAlign: 'center',
      marginBottom: 4,
    },
    coverDate: {
      fontSize: 9,
      color: COLORS.muted,
      textAlign: 'center',
      marginBottom: 6,
    },
    coverMeta: {
      fontSize: 9,
      color: COLORS.muted,
      textAlign: 'center',
    },
    coverDivider: {
      width: 60,
      height: 1,
      backgroundColor: COLORS.border,
      marginTop: 30,
      marginBottom: 30,
    },

    // ── Content pages ──
    page: {
      padding: 50,
      paddingBottom: 70,
      fontFamily: 'Helvetica',
      fontSize: 10,
      color: COLORS.dark,
      lineHeight: 1.5,
      backgroundColor: COLORS.background,
    },
    pageTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      fontFamily: 'Times-Roman',
      color: COLORS.dark,
      marginBottom: 6,
    },
    pageSubtitle: {
      fontSize: 10,
      color: COLORS.muted,
      marginBottom: 24,
    },
    sectionDivider: {
      height: 2,
      backgroundColor: COLORS.accent,
      marginBottom: 24,
      width: 40,
    },

    // ── Clause cards ──
    clauseCard: {
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 4,
      padding: 12,
      marginBottom: 14,
      backgroundColor: COLORS.lightBg,
    },
    clauseHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    clauseCategory: {
      fontSize: 11,
      fontWeight: 'bold',
      fontFamily: 'Times-Roman',
      color: COLORS.dark,
      flex: 1,
    },
    clauseRiskBadge: {
      fontSize: 8,
      fontWeight: 'bold',
      color: COLORS.white,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
      overflow: 'hidden',
    },
    clauseText: {
      fontSize: 8,
      color: COLORS.muted,
      marginBottom: 8,
      fontStyle: 'italic',
      paddingLeft: 8,
      borderLeftWidth: 2,
      borderLeftColor: COLORS.border,
      lineHeight: 1.4,
    },
    clauseExplanation: {
      fontSize: 9,
      color: COLORS.dark,
      marginBottom: 4,
      lineHeight: 1.4,
    },
    clauseWhy: {
      fontSize: 8,
      color: COLORS.accent,
      fontWeight: 'bold',
      lineHeight: 1.4,
    },
    pushbackItem: {
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 4,
      padding: 10,
      marginBottom: 10,
      backgroundColor: COLORS.lightBg,
    },
    pushbackQuote: {
      fontSize: 8,
      color: COLORS.muted,
      fontStyle: 'italic',
      marginBottom: 6,
      lineHeight: 1.4,
    },
    pushbackAsk: {
      fontSize: 9,
      color: COLORS.dark,
      fontWeight: 'bold',
      lineHeight: 1.4,
    },
    complianceTagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
      marginTop: 6,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
    },
    complianceChip: {
      fontSize: 7,
      color: COLORS.accent,
      backgroundColor: COLORS.peach,
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 4,
      fontWeight: 'bold',
    },

    // ── Extraction ──
    extractionSection: {
      marginBottom: 20,
    },
    extractionTitle: {
      fontSize: 13,
      fontWeight: 'bold',
      fontFamily: 'Times-Roman',
      color: COLORS.dark,
      marginBottom: 10,
    },
    keyPoint: {
      marginBottom: 10,
      paddingLeft: 10,
      borderLeftWidth: 3,
    },
    keyPointTitle: {
      fontSize: 10,
      fontWeight: 'bold',
      color: COLORS.dark,
      marginBottom: 2,
    },
    keyPointDetail: {
      fontSize: 8,
      color: COLORS.muted,
      marginBottom: 3,
      lineHeight: 1.4,
    },
    keyPointQuote: {
      fontSize: 7,
      color: COLORS.muted,
      fontStyle: 'italic',
      paddingLeft: 6,
      borderLeftWidth: 1,
      borderLeftColor: COLORS.border,
      lineHeight: 1.3,
    },

    // ── Compliance page ──
    complianceRegulation: {
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 4,
      marginBottom: 16,
      overflow: 'hidden',
    },
    complianceRegHeader: {
      backgroundColor: COLORS.lightBg,
      paddingHorizontal: 12,
      paddingVertical: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    complianceRegTitle: {
      fontSize: 12,
      fontWeight: 'bold',
      color: COLORS.dark,
    },
    complianceRegCount: {
      fontSize: 9,
      color: COLORS.muted,
    },
    complianceMapping: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    complianceArticleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    complianceArticle: {
      fontSize: 10,
      fontWeight: 'bold',
      color: COLORS.accent,
    },
    complianceArticleTitle: {
      fontSize: 9,
      color: COLORS.muted,
      marginLeft: 6,
    },
    complianceQuote: {
      fontSize: 8,
      color: COLORS.muted,
      fontStyle: 'italic',
      paddingLeft: 6,
      borderLeftWidth: 2,
      borderLeftColor: COLORS.red,
      lineHeight: 1.3,
      marginTop: 4,
    },
    complianceMatch: {
      fontSize: 7,
      color: COLORS.muted,
      textAlign: 'right',
      marginTop: 2,
    },

    // ── Footer ──
    footerSpacer: {
      flexGrow: 1,
    },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
      fontSize: 7,
      color: COLORS.muted,
    },
  });

  const uniqueClauses = dedupeClausesByTitle(clauses);
  const riskScore = scan.riskScore ?? 0;

  const scoreBg =
    riskScore >= 7
      ? COLORS.red
      : riskScore >= 4
        ? COLORS.yellow
        : COLORS.green;

  const riskLabel =
    riskScore >= 7
      ? 'Needs attention'
      : riskScore >= 4
        ? 'Worth reviewing'
        : 'Standard';

  const scanDate = new Date(scan.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Build flat compliance mapping list
  const complianceList = Object.entries(complianceTags).flatMap(
    ([clauseId, tags]) =>
      tags.map((tag) => ({ clauseId, ...tag })),
  );

  // Group by regulation code
  const complianceByReg = new Map<string, typeof complianceList>();
  for (const item of complianceList) {
    const list = complianceByReg.get(item.regulationCode) ?? [];
    list.push(item);
    complianceByReg.set(item.regulationCode, list);
  }

  /* ── Cover Page ── */
  const CoverPage = () => (
    <Page size="A4" style={styles.coverPage}>
      <Text style={styles.logo}>Themys</Text>
      <Text style={styles.subtitle}>Terms of Service Analysis Report</Text>

      <View style={[styles.scoreCircle, { backgroundColor: scoreBg }]}>
        <Text style={styles.scoreText}>{riskLabel}</Text>
        <Text style={styles.scoreUnit}>Attention level</Text>
      </View>

      <Text style={[styles.riskLabel, { color: scoreBg }]}>Review guidance</Text>

      <View style={styles.coverDivider} />

      <Text style={styles.coverTitle}>
        {scan.title ?? scan.domain ?? 'Scan Report'}
      </Text>
      <Text style={styles.coverUrl}>
        {scan.url ?? scan.domain ?? 'Unknown source'}
      </Text>
      <Text style={styles.coverDate}>{scanDate}</Text>
      <Text style={styles.coverMeta}>
        {uniqueClauses.length} clauses analyzed{' '}
        {complianceList.length > 0 &&
          `· ${complianceList.length} compliance tags`}
      </Text>
      <Text style={[styles.coverMeta, { marginTop: 14, maxWidth: 360 }]}>
        This is not legal advice. Themys highlights clauses worth reviewing, not a legal risk determination.
      </Text>
    </Page>
  );

  /* ── Pushback Page ── */
  const PushbackPage = () => {
    const decision = scan.decision ?? 'open';

    return (
      <Page size="A4" style={styles.page}>
        <Text style={styles.pageTitle}>Pushback &amp; Decision</Text>
        <Text style={styles.pageSubtitle}>
          Decision: {formatScanDecisionLabel(decision)}
        </Text>
        <View style={styles.sectionDivider} />

        {pushback.length === 0 ? (
          <Text style={{ color: COLORS.muted }}>No suggested asks recorded.</Text>
        ) : (
          pushback.map((item, idx) => (
            <View key={idx} style={styles.pushbackItem} wrap={false}>
              <Text style={styles.clauseCategory}>Ask {idx + 1}</Text>
              <Text style={styles.pushbackQuote}>&quot;{item.quote}&quot;</Text>
              <Text style={styles.clauseExplanation}>
                Why it matters: {item.whyItMatters}
              </Text>
              <Text style={styles.pushbackAsk}>{item.suggestedAsk}</Text>
            </View>
          ))
        )}

        <Text style={[styles.coverMeta, { marginTop: 16 }]}>
          This is not legal advice. Themys highlights clauses worth reviewing, not a legal risk determination.
        </Text>

        <View style={styles.footerSpacer} />
        <View style={styles.footerRow} fixed>
          <Text>Themys — Terms of Service Report</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    );
  };

  /* ── Clauses Page(s) ── */
  const ClausesPage = () => (
    <Page size="A4" style={styles.page}>
      <Text style={styles.pageTitle}>Flagged Clauses</Text>
      <Text style={styles.pageSubtitle}>
        {uniqueClauses.length} clause{uniqueClauses.length !== 1 ? 's' : ''}{' '}
        flagged across the document
      </Text>
      <View style={styles.sectionDivider} />

      {uniqueClauses.length === 0 ? (
        <Text style={{ color: COLORS.muted }}>No clauses flagged.</Text>
      ) : (
        uniqueClauses.map((clause, idx) => (
          <View key={idx} style={styles.clauseCard} wrap={false}>
            <View style={styles.clauseHeader}>
              <Text style={styles.clauseCategory}>
                {formatClauseTitle(clause.category)}
              </Text>
              <View
                style={[
                  styles.clauseRiskBadge,
                  { backgroundColor: riskColor(clause.riskLevel) },
                ]}
              >
                <Text>
                  {clause.riskLevel === 'red'
                    ? 'NEEDS ATTENTION'
                    : clause.riskLevel === 'yellow'
                      ? 'WORTH REVIEWING'
                      : 'STANDARD'}
                </Text>
              </View>
            </View>

            <Text style={styles.clauseText}>{clause.text}</Text>

            {clause.explanation && (
              <Text style={styles.clauseExplanation}>
                Plain English: {clause.explanation}
              </Text>
            )}

            {clause.whyItMatters && (
              <Text style={styles.clauseWhy}>
                Why it matters: {clause.whyItMatters}
              </Text>
            )}
          </View>
        ))
      )}

      <View style={styles.footerSpacer} />
      <View style={styles.footerRow} fixed>
        <Text>Themys — Terms of Service Report</Text>
        <Text
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
        />
      </View>
    </Page>
  );

  /* ── Extraction Page(s) ── */
  const ExtractionPages = () => {
    if (extraction.length === 0) return null;

    return (
      <Page size="A4" style={styles.page}>
        <Text style={styles.pageTitle}>Full Extraction Analysis</Text>
        <Text style={styles.pageSubtitle}>
          Detailed breakdown of all sections found in the document
        </Text>
        <View style={styles.sectionDivider} />

        {extraction.map((section, sIdx) => (
          <View key={sIdx} style={styles.extractionSection}>
            <Text style={styles.extractionTitle}>
              {cleanSectionTitle(section.section)}
            </Text>

            {section.keyPoints.map((point, pIdx) => (
              <View
                key={pIdx}
                style={[
                  styles.keyPoint,
                  { borderLeftColor: severityColor(point.severity) },
                ]}
                wrap={false}
              >
                <Text style={styles.keyPointTitle}>{point.title}</Text>
                <Text style={styles.keyPointDetail}>{point.detail}</Text>
                {point.quote && (
                  <Text style={styles.keyPointQuote}>&quot;{point.quote}&quot;</Text>
                )}
              </View>
            ))}
          </View>
        ))}

        <View style={styles.footerSpacer} />
        <View style={styles.footerRow} fixed>
          <Text>Themys — Terms of Service Report</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    );
  };

  /* ── Compliance Page(s) ── */
  const CompliancePages = () => {
    if (complianceList.length === 0) return null;

    const sortedRegs = [...complianceByReg.entries()].sort(
      ([, a], [, b]) => b.length - a.length,
    );

    return (
      <Page size="A4" style={styles.page}>
        <Text style={styles.pageTitle}>Compliance Assessment</Text>
        <Text style={styles.pageSubtitle}>
          {complianceList.length} regulation mapping
          {complianceList.length !== 1 ? 's' : ''} across{' '}
          {complianceByReg.size} regulation
          {complianceByReg.size !== 1 ? 's' : ''}
        </Text>
        <View style={styles.sectionDivider} />

        {sortedRegs.map(([code, mappings]) => (
          <View key={code} style={styles.complianceRegulation}>
            <View style={styles.complianceRegHeader}>
              <Text style={styles.complianceRegTitle}>{code}</Text>
              <Text style={styles.complianceRegCount}>
                {mappings.length} mapping{mappings.length !== 1 ? 's' : ''}
              </Text>
            </View>
            {mappings.map((m, mIdx) => (
              <View key={mIdx} style={styles.complianceMapping} wrap={false}>
                <View style={styles.complianceArticleHeader}>
                  <Text style={styles.complianceArticle}>
                    {m.articleId}
                  </Text>
                  {m.articleTitle && (
                    <Text style={styles.complianceArticleTitle}>
                      — {m.articleTitle}
                    </Text>
                  )}
                </View>
                {m.quote && (
                  <Text style={styles.complianceQuote}>
                    &ldquo;{m.quote}&rdquo;
                  </Text>
                )}
                <Text style={styles.complianceMatch}>
                  {Math.round(m.relevance * 100)}% match
                </Text>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.footerSpacer} />
        <View style={styles.footerRow} fixed>
          <Text>Themys — Terms of Service Report</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    );
  };

  /* ── Compose Document ── */
  const MyDocument = () => (
    <Document
      title={`Themys Report — ${scan.domain ?? 'scan'}`}
      author="Themys"
      subject="Terms of Service Analysis"
    >
      <CoverPage />
      <PushbackPage />
      <ClausesPage />
      <CompliancePages />
      <ExtractionPages />
    </Document>
  );

  const blob = await pdf(<MyDocument />).toBlob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  const dateStr = new Date(scan.createdAt).toISOString().slice(0, 10);
  anchor.download = `themys-report-${slugify(scan.domain ?? 'scan')}-${dateStr}.pdf`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

/* ─── Button Component ─── */

export function PdfExportButton({
  scan,
  clauses,
  extraction = [],
  complianceTags = {},
  pushback = [],
  userPlan,
  className,
  variant = "link",
}: PdfExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const isPaid = userPlan === 'base' || userPlan === 'advanced' || userPlan === 'lifetime';

  const handleClick = useCallback(async () => {
    if (!isPaid || loading) return;
    setLoading(true);
    try {
      await generatePdf(scan, clauses, extraction, complianceTags, pushback);
    } catch (err) {
      console.error('[PdfExport] generation failed:', err);
    } finally {
      setLoading(false);
    }
  }, [isPaid, loading, scan, clauses, extraction, complianceTags, pushback]);

  const toolbarClass =
    "inline-flex items-center gap-1 rounded-[6px] border border-[var(--ds-border)] bg-[var(--ds-card)] px-2 py-1 text-[15px] font-medium text-[var(--ds-text-muted)] transition hover:border-[var(--ds-border-hover)] hover:bg-[var(--ds-card-hover)] hover:text-[var(--ds-text-secondary)]";
  const toolbarIconClass =
    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--ds-border)] bg-[var(--ds-card)] text-[var(--ds-text-muted)] transition hover:border-[var(--ds-border-hover)] hover:bg-[var(--ds-card-hover)] hover:text-[var(--ds-text-secondary)]";
  const linkClass = "inline-flex items-center gap-2 text-sm font-semibold text-[var(--ds-text-muted)] cursor-not-allowed";
  const toolbarButtonClass =
    variant === "toolbar-icon" ? toolbarIconClass : variant === "toolbar" ? toolbarClass : "";
  const iconSize = variant === "toolbar-icon" ? "h-3.5 w-3.5" : variant === "toolbar" ? "h-3 w-3" : "h-4 w-4";

  if (!isPaid) {
    return (
      <Link
        href="/pricing"
        className={cn(toolbarButtonClass || linkClass, className)}
        title="Upgrade to export PDF"
        aria-label="Upgrade to export PDF"
      >
        <FileDown className={iconSize} />
        {variant === "toolbar" ? "Export" : variant === "link" ? "Upgrade to export" : null}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={loading}
      className={cn(
        variant === "toolbar" || variant === "toolbar-icon"
          ? toolbarButtonClass
          : "inline-flex items-center gap-2 text-sm font-semibold transition hover:underline disabled:cursor-wait disabled:opacity-60",
        "disabled:cursor-wait disabled:opacity-60",
        className,
      )}
      title={loading ? "Generating PDF…" : "Download PDF report"}
      aria-label={loading ? "Generating PDF…" : "Export PDF"}
      style={variant === "toolbar" || variant === "toolbar-icon" ? undefined : { color: "var(--ds-accent)" }}
    >
      {loading ? (
        <svg className={cn(iconSize, "animate-spin")} viewBox="0 0 24 24" fill="none">
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="60"
            strokeDashoffset="20"
          />
        </svg>
      ) : (
        <FileDown className={iconSize} />
      )}
      {variant === "toolbar" ? (loading ? "Generating…" : "Export") : variant === "link" ? (loading ? "Generating…" : "Export PDF") : null}
    </button>
  );
}
