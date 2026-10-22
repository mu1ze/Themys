"use client";

import { useSyncExternalStore } from "react";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface UsageTrendChartProps {
  data: { date: string; count: number }[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDateLabel(iso: string): string {
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  if (!month || !day) return iso;
  return `${MONTHS[month - 1]} ${day}`;
}

/* ── custom tooltip ───────────────────────────────────────────── */

interface TooltipPayload {
  payload: { date: string; count: number };
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;

  return (
    <div className="rounded-lg border border-[var(--ds-border)] bg-[var(--ds-card)] px-4 py-3 shadow-xl">
      <p className="text-xs font-medium text-[var(--ds-text-secondary)]">{formatDateLabel(d.date)}</p>
      <p className="mt-1 text-sm text-[var(--ds-text)]">
        <span className="font-semibold">{d.count.toLocaleString()}</span> events
      </p>
    </div>
  );
}

/* ── component ────────────────────────────────────────────────── */

const subscribeToClient = () => () => {};

export function UsageTrendChart({ data }: UsageTrendChartProps) {
  const isMounted = useSyncExternalStore(subscribeToClient, () => true, () => false);

  if (!isMounted) {
    return <div className="h-[280px] w-full" />;
  }

  const avg = data.length > 0 ? data.reduce((sum, p) => sum + p.count, 0) / data.length : 0;

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--ds-grid)"
            vertical={false}
          />

          <XAxis
            dataKey="date"
            tickFormatter={formatDateLabel}
            tick={{ fill: "var(--ds-text-secondary)", fontSize: 12 }}
            axisLine={{ stroke: "var(--ds-grid)" }}
            tickLine={false}
            minTickGap={28}
          />

          <YAxis
            allowDecimals={false}
            tick={{ fill: "var(--ds-text-secondary)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />

          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: "var(--ds-grid)", strokeWidth: 1 }}
          />

          <ReferenceLine
            y={avg}
            stroke="var(--ds-text-muted)"
            strokeDasharray="4 4"
            label={{
              value: `avg ${avg.toFixed(1)}/day`,
              position: "insideTopRight",
              fill: "var(--ds-text-muted)",
              fontSize: 11,
            }}
          />

          <Line
            type="monotone"
            dataKey="count"
            stroke="var(--ds-accent)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, fill: "var(--ds-accent)", stroke: "var(--ds-card)", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
