import { cn } from "@/lib/cn";
import { PLAN_DISPLAY_NAME } from "@/lib/entitlements";

const planStyles: Record<string, { tone: string; label: string }> = {
  free: { tone: "border-[var(--admin-line)] bg-[var(--admin-surface)] text-[var(--admin-muted)]", label: PLAN_DISPLAY_NAME.free },
  base: { tone: "border-[var(--admin-ink)] bg-[var(--admin-ink)] text-[var(--admin-paper)]", label: PLAN_DISPLAY_NAME.base },
  advanced: { tone: "border-[color-mix(in_srgb,var(--admin-sienna)_22%,var(--admin-line))] bg-[var(--admin-peach)] text-[var(--admin-sienna)]", label: PLAN_DISPLAY_NAME.advanced },
  lifetime: { tone: "border-[color-mix(in_srgb,var(--admin-amber)_22%,var(--admin-line))] bg-[var(--admin-amber-bg)] text-[var(--admin-amber)]", label: PLAN_DISPLAY_NAME.lifetime },
};

export function PlanBadge({
  plan,
  className,
}: {
  plan: string;
  className?: string;
}) {
  const style = planStyles[plan] ?? planStyles.free;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        style.tone,
        className
      )}
    >
      {style.label}
    </span>
  );
}

const statusStyles: Record<string, { dot: string; text: string }> = {
  active: { dot: "bg-[var(--admin-green)]", text: "text-[var(--admin-green)]" },
  trialing: { dot: "bg-[var(--admin-muted)]", text: "text-[var(--admin-muted)]" },
  past_due: { dot: "bg-[var(--admin-amber)]", text: "text-[var(--admin-amber)]" },
  canceled: { dot: "bg-[var(--admin-dim)]", text: "text-[var(--admin-dim)]" },
  canceling: { dot: "bg-[var(--admin-amber)]", text: "text-[var(--admin-amber)]" },
  incomplete: { dot: "bg-[var(--admin-rose)]", text: "text-[var(--admin-rose)]" },
};

export function SubscriptionStatusBadge({
  status,
  className,
}: {
  status: string | null;
  className?: string;
}) {
  if (!status) {
    return (
      <span className={cn("text-xs text-[var(--admin-dim)]", className)}>—</span>
    );
  }

  const style = statusStyles[status] ?? { dot: "bg-[var(--admin-dim)]", text: "text-[var(--admin-dim)]" };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        style.text,
        className
      )}
    >
      <span className={cn("inline-block h-1.5 w-1.5 rounded-full", style.dot)} />
      {status.replace("_", " ")}
    </span>
  );
}

export function RiskBadge({
  score,
  className,
}: {
  score: number | null;
  className?: string;
}) {
  if (score == null) {
    return <span className={cn("text-xs text-[var(--admin-dim)]", className)}>—</span>;
  }

  const tone =
    score >= 7
      ? "border-[color-mix(in_srgb,var(--admin-rose)_24%,var(--admin-line))] bg-[var(--admin-rose-bg)] text-[var(--admin-rose)]"
      : score >= 4
        ? "border-[color-mix(in_srgb,var(--admin-amber)_24%,var(--admin-line))] bg-[var(--admin-amber-bg)] text-[var(--admin-amber)]"
        : "border-[color-mix(in_srgb,var(--admin-green)_24%,var(--admin-line))] bg-[var(--admin-green-bg)] text-[var(--admin-green)]";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
        tone,
        className
      )}
    >
      {score.toFixed(1)}
    </span>
  );
}
