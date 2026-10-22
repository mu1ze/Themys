"use client";

import Link from "next/link";
import { ArrowLeft, Clock3, MapPin, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/cn";
import { Tooltip } from "@/components/tooltip";
import { TooltipGroup } from "@/components/interior/tooltip-group";
import { DecisionControl } from "@/components/decision-control";
import { WORKSPACE_NAV } from "./nav-items";
import type { WorkspaceActions, WorkspaceData } from "./types";

export function scanHistoryHref(data: WorkspaceData) {
  return data.scan.domain && data.documentIdentityKey
    ? `/scan/history/${encodeURIComponent(data.scan.domain)}?identity=${encodeURIComponent(data.documentIdentityKey)}`
    : "/history";
}

export function ScanResultsRail({ data, actions }: { data: WorkspaceData; actions: WorkspaceActions }) {
  const collapsed = actions.railCollapsed;
  const counts = {
    flagged: data.flaggedCount,
    suggestions: data.pushbackItems.length,
    compliance: data.complianceScores.length,
  };
  const historyHref = scanHistoryHref(data);

  return (
    <TooltipGroup>
      <aside
        className={cn(
          "hidden min-[1200px]:flex min-h-0 shrink-0 flex-col overflow-y-auto border-r border-[var(--ds-border)] bg-[var(--ds-card)] transition-[width] duration-200 motion-reduce:transition-none",
          collapsed ? "w-[64px]" : "w-[208px]",
        )}
        aria-label="Scan results sidebar"
      >
        <div className={cn("flex h-[64px] shrink-0 items-center", collapsed ? "justify-center" : "justify-between px-5")}>
          {!collapsed && <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--ds-text-muted)]">This report</span>}
          <button
            type="button"
            onClick={actions.toggleRail}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar (B)" : "Collapse sidebar (B)"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--ds-text-muted)] transition-colors hover:bg-[var(--ds-card-hover)] hover:text-[var(--ds-text)]"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        <nav className="grid gap-1 px-2.5" aria-label="Result views">
          {WORKSPACE_NAV.map((item) => {
            const Icon = item.icon;
            const active = actions.panel === item.id;
            const count = item.countKey ? counts[item.countKey] : 0;
            const button = (
              <button
                type="button"
                onClick={() => actions.switchPanel(item.id)}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-10 w-full items-center gap-2.5 rounded-[10px] px-3 text-left text-[13px] leading-5 transition-colors",
                  active ? "bg-[var(--ds-card-hover)] font-medium text-[var(--ds-text)]" : "text-[var(--ds-text-muted)] hover:bg-[var(--ds-bg)] hover:text-[var(--ds-text)]",
                  collapsed && "justify-center px-0",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
                {!collapsed && <span>{item.label}</span>}
                {count > 0 && !collapsed ? (
                  <span className="ml-auto min-w-5 rounded-md bg-[var(--ds-bg)] px-1.5 py-0.5 text-center text-[10px] font-medium tabular-nums text-[var(--ds-text-muted)]">{count}</span>
                ) : null}
                {collapsed && count > 0 ? <span className="absolute right-1.5 top-1.5 h-1 w-1 rounded-full bg-[var(--ds-text-muted)]" /> : null}
              </button>
            );
            return collapsed ? (
              <Tooltip key={item.id} side="right" label={`${item.label}${count ? ` · ${count}` : ""}`} className="w-full">{button}</Tooltip>
            ) : <div key={item.id}>{button}</div>;
          })}
        </nav>

        <div className={cn("mt-5 border-t border-[var(--ds-border)] pt-4", collapsed ? "mx-2.5" : "mx-5")}>
          <Link href={historyHref} title="Scan history" className={cn("flex min-h-9 items-center gap-2.5 text-[12px] text-[var(--ds-text-muted)] hover:text-[var(--ds-text)]", collapsed && "justify-center")}>
            <Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />
            {!collapsed && <><span>Scan history</span>{data.previousScanCount > 1 && <span className="ml-auto text-[10px]">{data.previousScanCount}</span>}</>}
          </Link>
          <Link href="/dashboard" title="Back to dashboard" className={cn("flex min-h-9 items-center gap-2.5 text-[12px] text-[var(--ds-text-muted)] hover:text-[var(--ds-text)]", collapsed && "justify-center")}>
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
            {!collapsed && <span>Back to dashboard</span>}
          </Link>
        </div>

        <div className={cn("mt-auto pt-8 pb-5", collapsed ? "px-3" : "px-4")}>
          {!collapsed && (
            <div className="mb-5 rounded-xl border border-[var(--ds-border)] p-3">
              <p className="mb-2.5 text-[11px] font-medium text-[var(--ds-text-secondary)]">Your decision</p>
              <DecisionControl scanId={data.scan.id} initialDecision={data.scan.decision} value={data.scan.decision} onSaved={actions.onDecisionSaved} variant="strip" />
              <p className="mt-2 text-[10px] leading-relaxed text-[var(--ds-text-muted)]">A note for your records.</p>
            </div>
          )}
          <Link href="/settings" title={data.jurisdiction.isSet ? `Location: ${data.jurisdiction.label}` : "Set your location"} className={cn("flex items-center gap-2.5 text-[11px] leading-relaxed text-[var(--ds-text-muted)] hover:text-[var(--ds-text)]", collapsed && "justify-center")}>
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            {!collapsed && <span>{data.jurisdiction.isSet ? <><span className="block text-[10px]">Location for this scan</span><span className="text-[var(--ds-text-secondary)]">{data.jurisdiction.label}</span></> : "Add your location for context"}</span>}
          </Link>
        </div>
      </aside>
    </TooltipGroup>
  );
}
