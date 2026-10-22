'use client';

import { useSyncExternalStore } from 'react';

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

export interface RiskRadarProps {
  data: { category: string; score: number }[];
}

/* ── tooltip ──────────────────────────────────────────────────── */

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { category: string; score: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;

  return (
    <div className="rounded-lg border border-[var(--ds-border)] bg-[var(--ds-card)] px-4 py-3 shadow-xl">
      <p className="text-xs font-medium text-[var(--ds-text-secondary)]">{d.category}</p>
      <p className="mt-1 text-sm text-[var(--ds-text)]">
        Score: <span className="font-semibold">{d.score.toFixed(1)}</span>
      </p>
    </div>
  );
}

/* ── component ────────────────────────────────────────────────── */

const subscribeToClient = () => () => {};

export function RiskRadar({ data }: RiskRadarProps) {
  const isMounted = useSyncExternalStore(subscribeToClient, () => true, () => false);

  if (!isMounted) {
    return <div className="h-[300px] w-full" />;
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
          <PolarGrid stroke="var(--ds-grid)" />
          <PolarAngleAxis
            dataKey="category"
            tick={{ fill: 'var(--ds-text-secondary)', fontSize: 12 }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 10]}
            tick={{ fill: 'var(--ds-text-muted)', fontSize: 10 }}
            axisLine={false}
          />
          <Radar
            name="Risk"
            dataKey="score"
            stroke="var(--ds-accent)"
            strokeWidth={2}
            fill="var(--ds-accent)"
            fillOpacity={0.2}
            dot={{ r: 4, fill: 'var(--ds-accent)', stroke: 'var(--ds-card)', strokeWidth: 2 }}
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
