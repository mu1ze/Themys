"use client";

import Link from "next/link";
import { AlertTriangle, MapPin } from "lucide-react";
import { cn } from "@/lib/cn";
import { DecisionControl } from "@/components/decision-control";
import { attentionBarClass } from "./types";
import type { WorkspaceData } from "./types";

export function ScanResultsMobileOverview({ data }: { data: WorkspaceData }) {
  return (
    <div className="mb-4 min-[1200px]:hidden">
      <div className="rounded-[20px] border border-[var(--ds-border)] bg-[var(--ds-card)] p-4">
        <div className="flex items-end gap-3">
          <div>
            <div className="text-[32px] font-medium leading-none tracking-[-0.04em] text-[var(--ds-text)]">
              {data.score100}
            </div>
            <div className="mt-1.5 text-[13px] font-medium uppercase tracking-[0.06em] text-[var(--ds-text-dim)]">
              / 100
            </div>
          </div>
          <div className="min-w-0 flex-1 pb-0.5">
            <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-[var(--ds-border)]">
              <div
                className={cn("h-full rounded-full", attentionBarClass(data.attention.tone))}
                style={{ width: `${data.score100}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[13px] font-medium",
                  data.attention.tone === "danger" &&
                    "border-[var(--ds-danger)]/20 bg-[var(--ds-danger-bg)] text-[var(--ds-danger)]",
                  data.attention.tone === "warning" &&
                    "border-[var(--ds-warning)]/20 bg-[var(--ds-warning-bg)] text-[var(--ds-warning)]",
                  data.attention.tone === "success" &&
                    "border-[var(--ds-success)]/20 bg-[var(--ds-success-bg)] text-[var(--ds-success)]",
                )}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                {data.attention.label}
              </span>
              {data.flaggedCount > 0 ? (
                <span className="inline-flex items-center rounded-full border border-[var(--ds-danger)]/20 bg-[var(--ds-danger-bg)] px-2.5 py-1 text-[13px] font-medium text-[var(--ds-danger)]">
                  {data.flaggedCount} flagged
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-[var(--ds-border)] pt-3">
          <p className="mb-2 text-[13px] font-medium uppercase tracking-[0.14em] text-[var(--ds-text-dim)]">
            Decision
          </p>
          <DecisionControl
            scanId={data.scan.id}
            initialDecision={data.scan.decision}
            variant="strip"
          />
        </div>

        <div className="mt-3 flex items-start gap-1.5 text-[15px] leading-snug text-[var(--ds-text-secondary)]">
          <MapPin className="mt-px h-4 w-4 shrink-0 text-[var(--ds-accent)]" />
          <span>
            {data.jurisdiction.isSet ? (
              <>
                Ranked for{" "}
                <strong className="font-medium text-[var(--ds-text)]">{data.jurisdiction.label}</strong>
              </>
            ) : (
              <>
                Location not set.{" "}
                <Link href="/settings" className="font-medium text-[var(--ds-accent)]">
                  Add it
                </Link>
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
