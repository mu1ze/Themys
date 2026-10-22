'use client';

import { motion } from 'motion/react';
import { getAttentionLevel } from '@/lib/attention-level';

export interface TopService {
  domain: string;
  name: string;
  riskScore: number;
  logoUrl: string;
  scanCount: number;
}

export interface TopServicesProps {
  services: TopService[];
}

/* ── helpers ──────────────────────────────────────────────────── */

function riskBadgeColor(score: number): string {
  if (score <= 3) return 'text-[var(--ds-success)]';
  if (score <= 6) return 'text-[var(--ds-warning)]';
  return 'text-[var(--ds-danger)]';
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
}

/* ── component ────────────────────────────────────────────────── */

export function TopServices({ services }: TopServicesProps) {
  if (!services.length) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-[var(--ds-text-secondary)]">
        No services needing attention yet.
      </div>
    );
  }

  return (
    <div className="divide-y divide-[var(--ds-border)] border-y border-[var(--ds-border)]">
      {services.slice(0, 5).map((svc, i) => {
        const attention = getAttentionLevel(svc.riskScore);

        return (
        <motion.div
          key={svc.domain}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.07, duration: 0.35, ease: 'easeOut' }}
          className="group flex items-center gap-4 px-1 py-3 transition-colors hover:bg-[var(--ds-card-hover)]"
        >
          {/* Rank */}
          <span className="w-5 shrink-0 text-center text-xs tabular-nums text-[var(--ds-text-muted)]">
            {i + 1}
          </span>

          {/* Local monogram avoids one third-party request per dashboard row. */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--ds-border)] bg-[var(--ds-card)]">
            <span className="text-xs font-bold text-[var(--ds-accent)]">{initials(svc.name)}</span>
          </div>

          {/* Name + scan count */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--ds-text)]">
              {svc.name}
            </p>
            <p className="text-xs text-[var(--ds-text-secondary)]">
              {svc.scanCount} {svc.scanCount === 1 ? 'scan' : 'scans'}
            </p>
          </div>

          {/* Risk badge */}
          <span
            className={`inline-flex items-center text-xs font-medium ${riskBadgeColor(
              svc.riskScore,
            )}`}
          >
            {attention.label}
          </span>
        </motion.div>
        );
      })}
    </div>
  );
}
