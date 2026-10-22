"use client";

import { Download } from "lucide-react";

type HistoryScan = {
  id: string;
  title: string | null;
  url: string | null;
  domain: string | null;
  riskScore: number | null;
  clauseCount: number;
  flaggedCount: number;
  source: "web" | "extension" | "paste" | "upload";
  createdAt: string;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
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

function formatStatus(score: number | null): string {
  if ((score ?? 0) >= 7) return "Needs attention";
  if ((score ?? 0) >= 4) return "Worth reviewing";
  return "Standard";
}

function buildCsv(scans: HistoryScan[]): string {
  const header = [
    "title",
    "date",
    "attention_level",
    "flags",
    "status",
    "source",
  ];

  const rows = scans.map((scan) => [
    scan.title ?? scan.domain ?? "Untitled scan",
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(scan.createdAt)),
    formatStatus(scan.riskScore),
    String(scan.flaggedCount),
    formatStatus(scan.riskScore),
    scan.source,
  ]);

  return [header, ...rows]
    .map((row) =>
      row
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(",")
    )
    .join("\n");
}

function buildScanReport(scan: HistoryScan): string {
  const date = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(scan.createdAt));

  return [
    "Themys history export",
    `Title: ${scan.title ?? scan.domain ?? "Untitled scan"}`,
    `Date: ${date}`,
    `Attention level: ${formatStatus(scan.riskScore)}`,
    `Flags: ${scan.flaggedCount}`,
    `Clauses: ${scan.clauseCount}`,
    `Status: ${formatStatus(scan.riskScore)}`,
    `Source: ${scan.source}`,
    `URL: ${scan.url ?? scan.domain ?? "n/a"}`,
  ].join("\n");
}

export function HistoryExportPageButton({ scans }: { scans: HistoryScan[] }) {
  return (
    <button
      type="button"
      onClick={() => downloadTextFile("tos-scanner-history.csv", buildCsv(scans))}
      disabled={scans.length === 0}
      className="inline-flex h-10 items-center gap-2 rounded-full border border-transparent bg-[var(--ds-accent)] px-4 text-[12px] font-medium text-[var(--primary-foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Download className="h-4 w-4" />
      <span>Export page</span>
    </button>
  );
}

export function HistoryRowExportButton({
  scan,
  iconOnly = false,
  className,
}: {
  scan: HistoryScan;
  iconOnly?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        downloadTextFile(
          `${slugify(scan.title ?? scan.domain ?? "scan")}.txt`,
          buildScanReport(scan)
        )
      }
      title="Export this scan"
      aria-label="Export scan"
      className={className ?? "inline-flex h-10 items-center gap-2 rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card)] px-4 text-sm font-medium text-[var(--ds-text-secondary)] transition hover:border-[var(--ds-border-hover)] hover:bg-[var(--ds-card-hover)] hover:text-[var(--ds-text)]"}
    >
      <Download className="h-4 w-4" />
      {iconOnly ? <span className="sr-only">Export</span> : <span>Export</span>}
    </button>
  );
}
