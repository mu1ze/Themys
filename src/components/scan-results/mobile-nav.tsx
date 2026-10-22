"use client";

import { cn } from "@/lib/cn";
import { WORKSPACE_NAV } from "./nav-items";
import type { WorkspaceActions, WorkspaceData } from "./types";

export function ScanResultsMobileNav({ data, actions }: { data: WorkspaceData; actions: WorkspaceActions }) {
  const counts = {
    flagged: data.flaggedCount,
    suggestions: data.pushbackItems.length,
    compliance: data.complianceScores.length,
  };

  return (
    <nav
      className="grid shrink-0 grid-cols-6 border-[var(--ds-border)] bg-[var(--ds-card)] min-[1200px]:hidden max-md:order-3 max-md:border-t max-md:px-1 max-md:pt-1 md:order-2 md:border-b md:px-5"
      aria-label="Result views"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {WORKSPACE_NAV.map((item) => {
        const Icon = item.icon;
        const active = actions.panel === item.id;
        const count = item.countKey ? counts[item.countKey] : 0;
        return (
          <button
            type="button"
            key={item.id}
            onClick={() => actions.switchPanel(item.id)}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-h-[54px] min-w-0 flex-col items-center justify-center gap-1 whitespace-nowrap rounded-lg px-1 text-[10px] leading-4 transition-colors md:min-h-12 md:flex-row md:gap-2 md:rounded-none md:text-[12px]",
              active ? "font-medium text-[var(--ds-text)]" : "text-[var(--ds-text-muted)] hover:text-[var(--ds-text)]",
            )}
          >
            {active && <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-[var(--ds-text)] md:inset-x-5 md:bottom-0 md:top-auto" aria-hidden="true" />}
            <span className="relative flex h-5 w-5 items-center justify-center">
              <Icon className="h-[17px] w-[17px]" strokeWidth={1.7} aria-hidden="true" />
              {count > 0 && <span className="absolute -right-2 -top-1 rounded-full bg-[var(--ds-card-hover)] px-1 text-[9px] font-medium leading-[13px] tabular-nums">{count}</span>}
            </span>
            <span className="md:hidden">{item.shortLabel}</span>
            <span className="hidden md:inline">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
