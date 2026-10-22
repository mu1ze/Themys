"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Clock3, MoreHorizontal, Scale } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/cn";
import { scanHistoryHref } from "./rail";
import type { WorkspaceData, WorkspaceActions } from "./types";
import type { PushbackItem } from "@/lib/pushback";
import type { FullExtractionSection } from "@/lib/llm";
import type { ComplianceTagRef } from "@/lib/compliance-shared";

const PdfExportButton = dynamic(
  () => import("@/components/pdf-export").then((module) => module.PdfExportButton),
  { ssr: false },
);

export function ScanResultsTopbar({
  data,
  actions,
  headerBackButton,
  headerActions,
}: {
  data: WorkspaceData;
  actions: WorkspaceActions;
  headerBackButton?: React.ReactNode;
  headerActions?: React.ReactNode;
}) {
  const { scan } = data;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const pdfProps = {
    scan: {
      id: scan.id,
      title: scan.title,
      url: scan.url,
      domain: scan.domain,
      riskScore: data.score100 / 10,
      createdAt: scan.createdAt,
      decision: scan.decision,
    },
    clauses: data.uniqueClauses,
    extraction: data.fullExtraction as FullExtractionSection[],
    complianceTags: data.clauseComplianceTags as Record<string, ComplianceTagRef[]>,
    pushback: data.pushbackItems as PushbackItem[],
    userPlan: data.userPlan,
  };

  return (
    <header className="flex shrink-0 items-center border-b border-[var(--ds-border)] bg-[var(--ds-card)] pt-[env(safe-area-inset-top)]">
      <Link href="/dashboard" aria-label="Themys dashboard" className={cn("hidden h-14 shrink-0 items-center gap-2.5 border-r border-[var(--ds-border)] px-5 transition-[width] duration-200 motion-reduce:transition-none min-[1200px]:flex", actions.railCollapsed ? "w-[64px] justify-center px-0" : "w-[208px]")}>
        <Scale className="h-[19px] w-[19px] text-[var(--ds-text)]" strokeWidth={1.5} aria-hidden="true" />
        {!actions.railCollapsed && <span className="font-[family-name:var(--ds-doc-font)] text-[24px] tracking-[-0.06em] text-[var(--ds-text)]">themys</span>}
      </Link>
      <div className="flex h-14 min-w-0 flex-1 items-center gap-2 px-3 sm:gap-3 sm:px-5">
        {headerBackButton && <div className="hidden shrink-0 min-[1200px]:block">{headerBackButton}</div>}
        <div className="shrink-0 min-[1200px]:hidden">
          {headerBackButton ?? (
            <Link href="/dashboard" aria-label="Back to dashboard" className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--ds-text-muted)] hover:bg-[var(--ds-card-hover)]">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 text-[12px]">
          <span className="hidden shrink-0 text-[var(--ds-text-muted)] sm:inline">Scan results</span>
          <ChevronRight className="hidden h-3 w-3 shrink-0 text-[var(--ds-text-dim)] sm:block" aria-hidden="true" />
          <span className="truncate font-medium text-[var(--ds-text-secondary)]">{scan.serviceLabel}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {/* The rail holds this link on desktop; below 1200px it lives here. */}
          <Link
            href={scanHistoryHref(data)}
            aria-label="Scan history"
            title="Scan history"
            className="flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-full px-2 text-[12px] font-medium text-[var(--ds-text-muted)] transition-colors hover:bg-[var(--ds-card-hover)] hover:text-[var(--ds-text)] sm:px-3 min-[1200px]:hidden"
          >
            <Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">History</span>
          </Link>
          <PdfExportButton {...pdfProps} variant="toolbar" className="min-h-9 gap-1.5 rounded-full px-3 text-[12px] font-medium" />
          {headerActions && <div className="relative min-[1200px]:hidden" ref={menuRef}>
            <button
              type="button"
              aria-label="More actions"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--ds-text-muted)] hover:bg-[var(--ds-card-hover)]"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen ? (
              <div role="dialog" aria-label="Scan actions" className="absolute right-0 top-full z-30 mt-2 min-w-[184px] rounded-xl border border-[var(--ds-border)] bg-[var(--ds-card)] p-1.5 shadow-[var(--ds-shadow-overlay)]">
                <div className="px-1">{headerActions}</div>
              </div>
            ) : null}
          </div>}
          <span className="mx-1 hidden h-4 w-px bg-[var(--ds-border)] sm:block" aria-hidden="true" />
          <ThemeToggle />
          {headerActions && <div className="hidden items-center gap-1 min-[1200px]:flex">{headerActions}</div>}
        </div>
      </div>
    </header>
  );
}
