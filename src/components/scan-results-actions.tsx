"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Bookmark, FileDown, Menu, Share2, X } from "lucide-react";

import { DeleteScanButton } from "@/components/delete-scan-button";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/cn";
import { dedupeClausesByTitle, formatClauseTitle } from "@/lib/scan-display";

type ScanSummary = {
  id: string;
  title: string | null;
  url: string | null;
  domain: string | null;
  riskScore: number | null;
  createdAt: string;
};

type ClauseSummary = {
  text: string;
  category: string | null;
  riskScore: number | null;
  riskLevel: "green" | "yellow" | "red" | null;
  explanation: string | null;
  whyItMatters: string | null;
  position: number | null;
};

type DownloadSnippetsButtonProps = {
  scan: ScanSummary;
  clauses: ClauseSummary[];
};

type ResultsActionBarProps = {
  criticalCount: number;
  scan: ScanSummary;
  clauses: ClauseSummary[];
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function buildSnippetReport(scan: ScanSummary, clauses: ClauseSummary[]): string {
  const uniqueClauses = dedupeClausesByTitle(clauses);
  const parts = [
    `Themys snippet export`,
    `Title: ${scan.title ?? scan.domain ?? "Latest scan"}`,
    `Source: ${scan.url ?? scan.domain ?? "Unknown source"}`,
    `Risk score: ${scan.riskScore != null ? scan.riskScore.toFixed(1) : "n/a"}`,
    "",
  ];

  uniqueClauses.forEach((clause, index) => {
    parts.push(
      `[${formatClauseTitle(clause.category)}]`,
      clause.text,
      clause.explanation ? `Plain English: ${clause.explanation}` : "Plain English: n/a",
      clause.whyItMatters ? `Why it matters: ${clause.whyItMatters}` : "Why it matters: n/a",
      ""
    );
  });

  return parts.join("\n");
}

function buildFullReport(scan: ScanSummary, clauses: ClauseSummary[]): string {
  const uniqueClauses = dedupeClausesByTitle(clauses);
  const highRisk = uniqueClauses.filter((clause) => clause.riskLevel === "red").length;
  const moderateRisk = uniqueClauses.filter((clause) => clause.riskLevel === "yellow").length;
  const safe = uniqueClauses.filter((clause) => clause.riskLevel === "green").length;

  const parts = [
    `Themys report`,
    `Title: ${scan.title ?? scan.domain ?? "Latest scan"}`,
    `Source: ${scan.url ?? scan.domain ?? "Unknown source"}`,
    `Created: ${new Date(scan.createdAt).toLocaleString()}`,
    `Overall score: ${scan.riskScore != null ? scan.riskScore.toFixed(1) : "n/a"}`,
    `High risk clauses: ${highRisk}`,
    `Moderate clauses: ${moderateRisk}`,
    `Safe clauses: ${safe}`,
    "",
  ];

  uniqueClauses.forEach((clause, index) => {
    parts.push(
      `Clause ${index + 1}: ${formatClauseTitle(clause.category)}`,
      `Risk level: ${clause.riskLevel ?? "unknown"}`,
      `Risk score: ${clause.riskScore != null ? clause.riskScore.toFixed(1) : "n/a"}`,
      `Text: ${clause.text}`,
      clause.explanation ? `Plain English: ${clause.explanation}` : "Plain English: n/a",
      clause.whyItMatters ? `Why it matters: ${clause.whyItMatters}` : "Why it matters: n/a",
      ""
    );
  });

  return parts.join("\n");
}

function downloadTextFile(filename: string, body: string) {
  const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function DownloadSnippetsButton({
  scan,
  clauses,
}: DownloadSnippetsButtonProps) {
  return (
    <button
      type="button"
      onClick={() =>
        downloadTextFile(
          `${slugify(scan.title ?? scan.domain ?? "scan")}-snippets.txt`,
          buildSnippetReport(scan, clauses)
        )
      }
      className="text-sm font-semibold text-[var(--ds-accent)] transition hover:text-[var(--ds-accent)] hover:underline"
    >
      Download All Snippets
    </button>
  );
}

export function ResultsActionBar({
  criticalCount,
  scan,
  clauses,
}: ResultsActionBarProps) {
  const [open, setOpen] = useState(false);
  const [shareLabel, setShareLabel] = useState("Share");
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const hasCriticalIssues = criticalCount > 0;
  const criticalTone = hasCriticalIssues ? "danger" : "success";

  const reportFilename = useMemo(
    () => `${slugify(scan.title ?? scan.domain ?? "scan")}-report.txt`,
    [scan.domain, scan.title]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;

      if (target && menuRef.current && !menuRef.current.contains(target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function closeMenu() {
    setOpen(false);
  }

  function handleExportReport() {
    downloadTextFile(reportFilename, buildFullReport(scan, clauses));
    closeMenu();
  }

  async function handleShare() {
    const shareUrl = window.location.href;

    try {
      if (navigator.share) {
        try {
          await navigator.share({
            title: scan.title ?? "Themys report",
            url: shareUrl,
          });
        } catch {
          await navigator.clipboard.writeText(shareUrl);
          setShareLabel("Copied");
          window.setTimeout(() => setShareLabel("Share"), 1400);
        }
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setShareLabel("Copied");
        window.setTimeout(() => setShareLabel("Share"), 1400);
      }
    } catch {
      // Ignore clipboard failures here; the action menu still closes.
    } finally {
      closeMenu();
    }
  }

  return (
    <div ref={menuRef} className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
      {open ? (
        <div
          id={menuId}
          className="mb-3 w-[min(92vw,348px)] overflow-hidden rounded-[28px] border border-[var(--ds-border)] bg-[var(--ds-card)] shadow-[0_24px_70px_rgba(15,23,42,0.18)]"
        >
          <div className="border-b border-[var(--ds-border)] px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ds-text-muted)]">
                  Critical issues
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge tone={criticalTone} className="px-2.5 py-1 text-[11px]">
                    {criticalCount}
                  </Badge>
                  <span className="text-sm font-semibold text-[var(--ds-text)]">
                    {criticalCount === 1 ? "issue identified" : "issues identified"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={closeMenu}
                title="Close scan actions"
                aria-label="Close scan actions"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card)] text-[var(--ds-text-muted)] transition hover:border-[var(--ds-border-hover)] hover:bg-[var(--ds-card-hover)] hover:text-[var(--ds-text)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="space-y-2 p-3">
            <button
              type="button"
              onClick={handleExportReport}
              title="Download the full report"
              className="group inline-flex w-full items-center gap-3 rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-card-hover)]/70 px-4 py-3 text-sm font-semibold text-[var(--ds-text-secondary)] transition hover:border-[var(--ds-border)] hover:bg-[var(--ds-card)] hover:text-[var(--ds-text)]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ds-radius-sm)] bg-[var(--ds-card)] text-[var(--ds-text-muted)] shadow-sm transition group-hover:bg-[var(--ds-card-hover)] group-hover:text-[var(--ds-text)]">
                <FileDown className="h-4 w-4" />
              </span>
              <span className="flex-1 text-left">
                <span className="block">Export Report</span>
                <span className="block text-xs font-normal text-[var(--ds-text-muted)]">
                  Download the full findings summary
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                void handleShare();
              }}
              title="Copy or share this scan"
              className="group inline-flex w-full items-center gap-3 rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-card-hover)]/70 px-4 py-3 text-sm font-semibold text-[var(--ds-text-secondary)] transition hover:border-[var(--ds-border)] hover:bg-[var(--ds-card)] hover:text-[var(--ds-text)]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ds-radius-sm)] bg-[var(--ds-card)] text-[var(--ds-text-muted)] shadow-sm transition group-hover:bg-[var(--ds-card-hover)] group-hover:text-[var(--ds-text)]">
                <Share2 className="h-4 w-4" />
              </span>
              <span className="flex-1 text-left">
                <span className="block">{shareLabel}</span>
                <span className="block text-xs font-normal text-[var(--ds-text-muted)]">
                  Send this result link to someone else
                </span>
              </span>
            </button>

            <Link
              href="/settings"
              onClick={closeMenu}
              title="Add this scan to your watchlist"
              className="group inline-flex w-full items-center gap-3 rounded-2xl border border-blue-200 bg-[var(--ds-info-bg)]/70 px-4 py-3 text-sm font-semibold text-[var(--ds-accent)] transition hover:border-blue-300 hover:bg-[var(--ds-info-bg)] hover:text-[var(--ds-accent)]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ds-radius-sm)] bg-[var(--ds-card)] text-[var(--ds-accent)] shadow-sm transition group-hover:bg-blue-100">
                <Bookmark className="h-4 w-4" />
              </span>
              <span className="flex-1 text-left">
                <span className="block">Add to Watchlist</span>
                <span className="block text-xs font-normal text-[var(--ds-accent)]/70">
                  Keep this scan pinned in settings
                </span>
              </span>
            </Link>

            <div className="pt-2">
              <DeleteScanButton
                scanId={scan.id}
                afterDeleteHref="/history"
                title="Delete this scan"
                label="Delete scan"
                className="group inline-flex w-full items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/70 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
              />
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        title={open ? "Close scan actions" : "Open scan actions"}
        className={cn(
          "inline-flex h-12 items-center gap-3 rounded-[var(--ds-radius-md)] border px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          open
            ? "border-[var(--ds-border)] bg-[var(--ds-card)] text-[var(--ds-text)] shadow-[0_12px_32px_rgba(15,23,42,0.12)]"
            : "border-[var(--ds-border)] bg-[var(--ds-card)]/95 text-[var(--ds-text-secondary)] shadow-[0_12px_28px_rgba(15,23,42,0.12)] hover:border-[var(--ds-border)] hover:bg-[var(--ds-card-hover)]"
        )}
      >
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-[var(--ds-radius-sm)] text-[var(--ds-card)] transition",
            open ? "bg-[var(--ds-accent)]" : "bg-[var(--ds-text)]"
          )}
        >
          <Menu className="h-4 w-4" />
        </span>
        <span>Actions</span>
        <Badge tone={criticalTone} className="px-2 py-0.5 text-[11px]">
          {criticalCount}
        </Badge>
      </button>
    </div>
  );
}

export const ResultsActionsMenu = ResultsActionBar;
