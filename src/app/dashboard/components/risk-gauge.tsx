'use client';

import { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { getAttentionLevel } from '@/lib/attention-level';

export interface RiskGaugeProps {
  score: number;   // 0–10
  size?: number;   // px, default 200
}

/* ── helpers ──────────────────────────────────────────────────── */

function scoreColor(score: number): string {
  if (score <= 3) return 'var(--ds-success)';   // green
  if (score <= 6) return 'var(--ds-warning)';   // amber
  return 'var(--ds-danger)';                   // red
}

/* ── component ────────────────────────────────────────────────── */

export function RiskGauge({ score, size = 200 }: RiskGaugeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });

  const clamped = Math.max(0, Math.min(10, score));
  const color = scoreColor(clamped);
  const attention = getAttentionLevel(clamped);

  /* geometry */
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - 32) / 2;       // 16 px padding
  const strokeWidth = 12;
  const circumference = Math.PI * radius; // semicircle

  /* arc dashoffset: 0 = full semicircle, circumference = empty */
  const targetOffset = circumference - (clamped / 10) * circumference;

  return (
    <div ref={ref} className="flex flex-col items-center gap-2">
      <svg
        width={size}
        height={size / 2 + 24}
        viewBox={`0 0 ${size} ${size / 2 + 24}`}
        className="overflow-visible"
      >
        {/* background track (semicircle from left to right) */}
        <path
          d={describeArc(cx, cy, radius, 180, 360)}
          fill="none"
          stroke="var(--ds-grid)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* animated value arc */}
        <motion.path
          d={describeArc(cx, cy, radius, 180, 360)}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={inView ? { strokeDashoffset: targetOffset } : undefined}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />

        {/* needle / indicator dot at the end of the arc */}
        {inView && (
          <motion.circle
            r={5}
            fill={color}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.0, duration: 0.3 }}
            style={{
              filter: `drop-shadow(0 0 6px ${color}80)`,
            }}
            cx={cx + radius * Math.cos(degToRad(180 + (clamped / 10) * 180))}
            cy={cy + radius * Math.sin(degToRad(180 + (clamped / 10) * 180))}
          />
        )}

        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          className="fill-[var(--ds-text)] text-2xl font-bold"
        >
          {inView ? attention.label : ''}
        </text>

        <text
          x={cx}
          y={cy + 30}
          textAnchor="middle"
          className="fill-[var(--ds-text-secondary)] text-sm"
        >
          Attention level
        </text>
      </svg>

      <p className="text-sm font-medium text-[var(--ds-text-secondary)]">Attention level</p>
    </div>
  );
}

/* ── SVG path helpers ─────────────────────────────────────────── */

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Describe an SVG arc path between two angles on a circle. */
function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = degToRad(angleDeg);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
