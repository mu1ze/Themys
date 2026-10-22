'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'motion/react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

export interface KpiCardProps {
  label: string;
  value: string | number;
  delta: number;
  trend: 'up' | 'down' | 'flat';
  sparklineData: number[];
  color: string;
}

/* ── helpers ──────────────────────────────────────────────────── */

function parseNumeric(v: string | number): number {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function formatAnimatedValue(raw: string | number, current: number): string {
  if (typeof raw === 'number') return current.toLocaleString();
  const m = String(raw).match(/^(\D*)([\d.,]+)(\D*)$/);
  if (!m) return String(raw);
  const decimals = m[2].includes('.') ? m[2].split('.')[1].length : 0;
  return `${m[1]}${current.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${m[3]}`;
}

function deltaColor(trend: 'up' | 'down' | 'flat'): string {
  if (trend === 'up') return 'text-[var(--ds-success)]';
  if (trend === 'down') return 'text-[var(--ds-danger)]';
  return 'text-[var(--ds-text-muted)]';
}

function deltaArrow(trend: 'up' | 'down' | 'flat') {
  if (trend === 'up') return '↑';
  if (trend === 'down') return '↓';
  return '→';
}

/* ── component ────────────────────────────────────────────────── */

export function KpiCard({
  label,
  value,
  delta,
  trend,
  sparklineData,
  color = 'var(--ds-accent)',
}: KpiCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });

  /* count-up animation */
  const target = parseNumeric(value);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 900;
    const t0 = performance.now();
    let raf: number;

    function tick(now: number) {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - (1 - p) ** 3; // ease-out cubic
      setDisplay(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target]);

  /* sparkline data */
  const chartData = sparklineData.map((v, i) => ({ i, v }));

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="group relative overflow-hidden border-b border-r border-[var(--ds-border)] p-4 transition-colors hover:bg-[var(--ds-card-hover)] sm:p-5 lg:border-b-0"
    >
      {/* label */}
      <p className="text-[15px] font-medium uppercase tracking-[0.16em] text-[var(--ds-text-muted)]">
        {label}
      </p>

      {/* big number + delta */}
      <div className="mt-2 flex items-baseline gap-3">
        <span className="text-3xl font-medium tracking-[-0.04em] text-[var(--ds-text)]">
          {inView ? formatAnimatedValue(value, display) : '–'}
        </span>
        <span className={`flex items-center gap-1 text-xs font-medium ${deltaColor(trend)}`}>
          {deltaArrow(trend)}
          {Math.abs(delta).toFixed(1)}%
        </span>
      </div>

      {/* sparkline */}
      <div className="mt-3 h-12 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`kpi-spark-${label.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke={color}
              strokeWidth={2}
              fill={`url(#kpi-spark-${label.replace(/\s+/g, '-')})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
