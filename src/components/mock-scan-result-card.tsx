import { AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { cn } from "@/lib/cn";

const flaggedClauses = [
  {
    label: "Broad data sharing",
    severity: "warning" as const,
    clause:
      "Section 4.2 — Data may be shared with partners for targeted advertising.",
  },
  {
    label: "Unilateral changes",
    severity: "warning" as const,
    clause:
      "Section 8.1 — Terms may be modified at any time without notice.",
  },
  {
    label: "Binding arbitration",
    severity: "danger" as const,
    clause:
      "Section 12.3 — Disputes resolved exclusively through binding arbitration.",
  },
];

const severityStyles = {
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-rose-50 text-rose-700 border-rose-200",
  safe: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function MockScanResultCard() {
  return (
    <div className="glass-card rounded-2xl p-5 shadow-lg">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--ds-card-hover)]">
            <FileText className="h-5 w-5 text-[var(--ds-text-secondary)]" strokeWidth={2} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--ds-text)]">
              Spotify Terms of Service
            </p>
            <p className="text-xs text-[var(--ds-text-muted)]">Scanned just now</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5">
          <CheckCircle2
            className="h-3.5 w-3.5 text-emerald-600"
            strokeWidth={2.5}
          />
          <span className="text-xs font-semibold text-emerald-700">
            3
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="my-4 h-px bg-[var(--ds-border)]" />

      {/* Flagged clauses */}
      <div className="space-y-2.5">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--ds-text-muted)]">
          Flagged Clauses
        </p>
        {flaggedClauses.map((item) => (
          <div
            key={item.label}
            className="flex items-start gap-2.5 rounded-lg bg-[var(--ds-card-hover)] px-3 py-2.5"
          >
            <AlertTriangle
              className={cn(
                "mt-0.5 h-3.5 w-3.5 shrink-0",
                item.severity === "danger"
                  ? "text-rose-500"
                  : "text-amber-500",
              )}
              strokeWidth={2}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[var(--ds-text)]">
                  {item.label}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                    severityStyles[item.severity],
                  )}
                >
                  {item.severity}
                </span>
              </div>
              <p className="mt-0.5 text-xs leading-5 text-[var(--ds-text-muted)]">
                {item.clause}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
