'use client';

import { motion } from 'motion/react';
import { Bell, ArrowUpRight, AlertTriangle, FileText, Layers } from 'lucide-react';

export interface AlertData {
  id: string;
  subscription_id: string;
  user_id: string;
  old_snapshot_id: string | null;
  new_snapshot_id: string;
  change_type: 'text_change' | 'risk_increase' | 'new_flags' | 'all';
  risk_delta: number | null;
  summary: string | null;
  is_read: boolean;
  is_email_sent: boolean;
  created_at: string;
  scan_id?: string | null;
  domain?: string;
}

export interface AlertCardProps {
  alert: AlertData;
  onMarkRead: (alertId: string) => void;
  isFocused?: boolean;
}

/* ── helpers ──────────────────────────────────────────────────── */

function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}`;
}

function changeTypeBadge(changeType: AlertData['change_type']): {
  label: string;
  color: string;
  bgColor: string;
  icon: typeof FileText;
} {
  switch (changeType) {
    case 'risk_increase':
      return { label: 'Risk increase', color: 'var(--ds-danger)', bgColor: 'var(--ds-danger-bg)', icon: ArrowUpRight };
    case 'new_flags':
      return { label: 'New flags', color: 'var(--ds-warning)', bgColor: 'var(--ds-warning-bg)', icon: AlertTriangle };
    case 'text_change':
      return { label: 'Text changed', color: 'var(--ds-text-secondary)', bgColor: 'var(--ds-card-hover)', icon: FileText };
    case 'all':
      return { label: 'Multiple changes', color: 'var(--ds-text-secondary)', bgColor: 'var(--ds-card-hover)', icon: Layers };
    default:
      return { label: 'Alert', color: '#6b7280', bgColor: 'rgba(107,114,128,0.12)', icon: Bell };
  }
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/* ── component ────────────────────────────────────────────────── */

export function AlertCard({ alert, onMarkRead, isFocused = false }: AlertCardProps) {
  const badge = changeTypeBadge(alert.change_type);
  const BadgeIcon = badge.icon;

  return (
    <motion.div
      id={`monitoring-alert-${alert.id}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="group rounded-[20px] border p-4 transition-colors duration-200 sm:p-5"
      style={{
        backgroundColor: 'var(--ds-card)',
        borderColor: alert.is_read ? 'var(--ds-border)' : 'var(--ds-border-hover)',
        boxShadow: isFocused ? `0 0 0 2px ${badge.color}` : undefined,
      }}
    >
      <div className="flex items-start gap-3">
        {/* Favicon */}
        {alert.domain ? (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--ds-border)]"
            style={{ backgroundColor: 'var(--ds-card-hover)' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={faviconUrl(alert.domain)}
              alt={`${alert.domain} favicon`}
              className="h-6 w-6 rounded object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: badge.bgColor }}
          >
            <BadgeIcon className="h-5 w-5" style={{ color: badge.color }} />
          </div>
        )}

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* Change type badge */}
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: badge.bgColor, color: badge.color }}
            >
              <BadgeIcon className="h-3 w-3" />
              {badge.label}
            </span>

            {/* Risk delta */}
            {alert.risk_delta !== null && alert.risk_delta !== 0 && (
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-bold ${
                  alert.risk_delta > 0 ? 'text-[var(--ds-danger)]' : 'text-[var(--ds-success)]'
                }`}
              >
                {alert.risk_delta > 0 ? '+' : ''}
                {alert.risk_delta.toFixed(1)}
              </span>
            )}

            {/* Unread dot */}
            {!alert.is_read && (
              <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--ds-unread-dot)]" />
            )}

            {/* Timestamp */}
            <span className="ml-auto text-xs text-[var(--ds-text-muted)]">
              {formatTimeAgo(alert.created_at)}
            </span>
          </div>

          {/* Domain */}
          {alert.domain && (
            <p className="mt-2 break-words text-[13px] font-medium text-[var(--ds-text)]">
              {alert.domain}
            </p>
          )}

          {/* Summary */}
          {alert.summary && (
            <p className="mt-1 break-words text-[12px] leading-relaxed text-[var(--ds-text-secondary)]">
              {alert.summary}
            </p>
          )}
          {alert.scan_id && (
            <a
              href={`/scan/results?id=${encodeURIComponent(alert.scan_id)}`}
              className="mt-3 inline-flex min-h-8 items-center gap-1 rounded-full border border-[var(--ds-border)] px-3 text-[11px] text-[var(--ds-text-secondary)] hover:bg-[var(--ds-card-hover)]"
            >
              View full scan
              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </a>
          )}
          {!alert.is_read && <button type="button" onClick={() => onMarkRead(alert.id)} className="mt-3 min-h-8 rounded-full border border-[var(--ds-border)] px-3 text-[11px] text-[var(--ds-text-secondary)] hover:bg-[var(--ds-card-hover)]">Mark as read</button>}
        </div>
      </div>
    </motion.div>
  );
}
