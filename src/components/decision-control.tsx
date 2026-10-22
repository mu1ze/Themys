"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Tooltip } from "@/components/tooltip";
import {
  formatScanDecisionLabel,
  type ScanDecision,
} from "@/lib/decisions";
import { trackEvent } from "@/lib/track";

type DecisionControlProps = {
  scanId: string;
  initialDecision: ScanDecision;
  value?: ScanDecision;
  onSaved?: (decision: ScanDecision) => void;
  className?: string;
  variant?: "card" | "rail" | "strip";
  compact?: boolean;
  showTooltips?: boolean;
};

const ACTION_DECISIONS: ScanDecision[] = ["sign", "negotiate", "walk_away"];
const RAIL_DECISIONS: ScanDecision[] = ["open", "sign", "negotiate", "walk_away"];
const RAIL_DECISION_ABBR: Record<ScanDecision, string> = {
  open: "O",
  sign: "S",
  negotiate: "N",
  walk_away: "W",
};
const RAIL_DECISION_HINTS: Record<ScanDecision, string> = {
  open: "Still reviewing this vendor",
  sign: "Accept the terms as written",
  negotiate: "Plan to push back on flagged clauses",
  walk_away: "Do not proceed with this vendor",
};

export function DecisionControl({
  scanId,
  initialDecision,
  value,
  onSaved,
  className,
  variant = "card",
  compact = false,
  showTooltips = false,
}: DecisionControlProps) {
  const [localDecision, setDecision] = useState<ScanDecision>(initialDecision);
  const decision = value ?? localDecision;
  const [pending, setPending] = useState<ScanDecision | null>(null);

  const saveDecision = async (next: ScanDecision) => {
    const previous = decision;
    setDecision(next);
    setPending(next);

    try {
      const response = await fetch(`/api/scans/${encodeURIComponent(scanId)}/decision`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: next }),
      });

      if (!response.ok) {
        setDecision(previous);
        return;
      }

      onSaved?.(next);
      trackEvent("decision_set", { decision: next });
    } catch {
      setDecision(previous);
    } finally {
      setPending(null);
    }
  };

  const options = variant === "card" ? ACTION_DECISIONS : RAIL_DECISIONS;

  if (variant === "strip") {
    return (
      <div className={cn("grid grid-cols-2 gap-1.5", className)} role="group" aria-label="Decision">
        {options.map((value) => {
          const active = decision === value;
          const isLoading = pending === value;
          const label = formatScanDecisionLabel(value);
          return (
            <button
              key={value}
              type="button"
              disabled={pending !== null}
              onClick={() => saveDecision(value)}
              aria-label={label}
              aria-pressed={active}
              className={cn(
                "min-h-9 min-w-0 whitespace-nowrap rounded-[8px] border px-1.5 py-2 text-center text-[11px] font-medium leading-tight transition disabled:opacity-60",
                active
                  ? "border-[var(--ds-accent)] bg-[var(--ds-accent-glow)] text-[var(--ds-accent)]"
                  : "border-[var(--ds-border)] bg-[var(--ds-bg)] text-[var(--ds-text-secondary)] hover:border-[var(--ds-border-hover)] hover:text-[var(--ds-text)]",
              )}
            >
              {isLoading ? "…" : label}
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === "rail") {
    return (
      <div className={cn("flex flex-col", compact ? "gap-1.5" : "gap-px", className)} role="group" aria-label="Decision">
        {options.map((value) => {
          const active = decision === value;
          const isLoading = pending === value;
          const label = formatScanDecisionLabel(value);
          const button = (
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => saveDecision(value)}
              title={showTooltips ? undefined : label}
              aria-label={label}
              className={cn(
                "flex w-full items-center gap-1.5 rounded-[6px] border px-2 py-1 text-left text-[15px] font-normal tracking-[0.02em] leading-none transition",
                compact && "flex-col gap-1 px-1 py-2",
                
                active
                  ? "border-[var(--ds-accent)] bg-[var(--ds-accent-glow)] text-[var(--ds-accent)]"
                  : "border-transparent text-[var(--ds-text-muted)] hover:bg-[var(--ds-card-hover)] hover:text-[var(--ds-text-secondary)]",
              )}
            >
              <span
                className={cn(
                  "shrink-0 rounded-full border border-current",
                  compact ? "h-1.5 w-1.5" : "h-1 w-1",
                  
                  active && "bg-current",
                )}
              />
              <span
                className={cn(
                  "min-w-0 flex-1 truncate",
                  compact && "hidden",
                  
                )}
              >
                {isLoading ? "Saving…" : label}
              </span>
              <span
                className={cn(
                  "hidden font-medium uppercase tracking-[0.06em] leading-none",
                  compact ? "block text-[15px]" : "text-[15px]",
                )}
              >
                {isLoading ? "…" : RAIL_DECISION_ABBR[value]}
              </span>
              {active && !compact ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3 w-3 shrink-0" aria-hidden>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : null}
            </button>
          );

          if (!showTooltips) {
            return <div key={value}>{button}</div>;
          }

          return (
            <Tooltip
              key={value}
              side="right"
              className="w-full"
              contentClassName="max-w-[220px]"
              label={
                <span className="block px-1 py-0.5">
                  <span className="block font-semibold text-[var(--ds-text)]">{label}</span>
                  <span className="mt-0.5 block text-[15px] font-normal leading-snug text-[var(--ds-text-muted)]">
                    {RAIL_DECISION_HINTS[value]}
                  </span>
                </span>
              }
            >
              {button}
            </Tooltip>
          );
        })}
      </div>
    );
  }

  return (
    <section
      className={cn(
        "rounded-xl border border-[var(--ds-border)] bg-transparent p-5 md:p-6",
        className
      )}
      aria-labelledby="decision-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="decision-heading"
            className="text-[15px] font-medium uppercase tracking-[0.2em] text-[var(--ds-text-muted)]"
          >
            Your decision
          </h2>
          <p className="mt-2 text-sm text-[var(--ds-text-secondary)]">
            Record what you plan to do with this vendor.
          </p>
        </div>
        <span className="rounded-full border border-[var(--ds-border)] px-3 py-1 text-xs font-medium text-[var(--ds-text-secondary)]">
          {formatScanDecisionLabel(decision)}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {ACTION_DECISIONS.map((value) => {
          const active = decision === value;
          const isLoading = pending === value;

          return (
            <button
              key={value}
              type="button"
              disabled={pending !== null}
              onClick={() => saveDecision(value)}
              className={cn(
                "rounded-[var(--ds-radius-sm)] px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-accent)] disabled:opacity-60",
                active
                  ? "bg-[var(--ds-accent)] text-[var(--primary-foreground)]"
                  : "border border-[var(--ds-border)] bg-[var(--ds-card-hover)] text-[var(--ds-text)] hover:bg-[var(--ds-card)]"
              )}
            >
              {isLoading ? "Saving…" : formatScanDecisionLabel(value)}
            </button>
          );
        })}
      </div>
    </section>
  );
}
