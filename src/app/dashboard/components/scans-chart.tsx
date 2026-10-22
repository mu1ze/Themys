'use client';

import { useSyncExternalStore } from 'react';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface ScansChartProps {
  data: { date: string; scans: number; avgRisk: number }[];
}

/* ── custom tooltip ───────────────────────────────────────────── */

interface TooltipPayload {
  payload: { date: string; scans: number; avgRisk: number };
}

function CustomTooltip({
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
        <span className="font-semibold">{d.scans}</span> scans
      </p>
      <p className="text-sm text-[var(--ds-text)]">
        Avg risk: <span className="font-semibold">{d.avgRisk.toFixed(1)}</span>
      </p>
    </div>
  );
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ── component ────────────────────────────────────────────────── */

const subscribeToClient = () => () => {};

export function ScansChart({ data }: ScansChartProps) {
  const isMounted = useSyncExternalStore(subscribeToClient, () => true, () => false);

  if (!isMounted) {
    return <div className="h-[300px] w-full" />;
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="scans-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--ds-accent)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--ds-accent)" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--ds-grid)"
            vertical={false}
          />

          <XAxis
            dataKey="date"
            tickFormatter={formatDateLabel}
            tick={{ fill: 'var(--ds-text-secondary)', fontSize: 12 }}
            axisLine={{ stroke: 'var(--ds-grid)' }}
            tickLine={false}
          />

          <YAxis
            tick={{ fill: 'var(--ds-text-secondary)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />

          <Tooltip content={<CustomTooltip />} />

          <Area
            type="monotone"
            dataKey="scans"
            stroke="var(--ds-accent)"
            strokeWidth={2}
            fill="url(#scans-gradient)"
            dot={false}
            activeDot={{ r: 5, fill: 'var(--ds-accent)', stroke: 'var(--ds-card)', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
