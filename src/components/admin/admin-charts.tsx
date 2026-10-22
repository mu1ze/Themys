import { cn } from "@/lib/cn";

/* ─── Bar Chart (CSS-only) ─── */

type BarChartProps = {
  data: { label: string; value: number }[];
  maxValue?: number;
  barColor?: string;
  height?: number;
  className?: string;
};

export function BarChart({
  data,
  maxValue,
  barColor = "bg-blue-500",
  height = 120,
  className,
}: BarChartProps) {
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1);

  return (
    <div className={cn("flex items-end gap-1", className)} style={{ height }}>
      {data.map((item, i) => {
        const pct = Math.max(2, (item.value / max) * 100);
        return (
          <div
            key={i}
            className="group relative flex flex-1 flex-col items-center justify-end"
            style={{ height: "100%" }}
          >
            <div
              className={cn(
                "w-full min-w-[4px] rounded-t-sm transition-all duration-300",
                barColor
              )}
              style={{ height: `${pct}%` }}
            />
            {/* Tooltip */}
            <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 scale-0 rounded-md bg-[var(--ds-text)] px-2 py-1 text-[10px] font-medium text-[var(--ds-bg)] transition group-hover:scale-100">
              {item.value}
            </div>
            <span className="mt-1 text-[9px] leading-none text-[var(--ds-text-muted)]">
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Donut Chart (CSS conic-gradient) ─── */

type DonutSegment = {
  label: string;
  value: number;
  color: string;
};

type DonutChartProps = {
  segments: DonutSegment[];
  size?: number;
  className?: string;
};

export function DonutChart({
  segments,
  size = 140,
  className,
}: DonutChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return (
      <div
        className={cn("rounded-full bg-[var(--ds-card-hover)]", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  let cumulativePct = 0;
  const gradientStops: string[] = [];

  for (const segment of segments) {
    const pct = (segment.value / total) * 100;
    gradientStops.push(`${segment.color} ${cumulativePct}% ${cumulativePct + pct}%`);
    cumulativePct += pct;
  }

  const gradient = `conic-gradient(${gradientStops.join(", ")})`;

  return (
    <div className={cn("flex items-center gap-5", className)}>
      <div
        className="shrink-0 rounded-full"
        style={{
          width: size,
          height: size,
          background: gradient,
          mask: `radial-gradient(circle at center, transparent 42%, black 42%)`,
          WebkitMask: `radial-gradient(circle at center, transparent 42%, black 42%)`,
        }}
      />
      <div className="space-y-1.5">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2 text-sm">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-[var(--ds-text-secondary)]">{seg.label}</span>
            <span className="font-medium text-[var(--ds-text)]">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Stat Card (admin-specific) ─── */

type AdminStatProps = {
  label: string;
  value: string | number;
  detail?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
};

export function AdminStat({
  label,
  value,
  detail,
  className,
}: AdminStatProps) {
  return (
    <div
      className={cn(
        "border-y border-[var(--ds-border)] px-1 py-5",
        className
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--ds-text-muted)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-medium tracking-tight text-[var(--ds-text)]">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {detail && (
        <p className="mt-1 text-xs text-[var(--ds-text-muted)]">{detail}</p>
      )}
    </div>
  );
}
