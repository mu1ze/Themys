'use client';

import styles from "@/components/workspace-pages.module.css";

import { useState, useTransition, useCallback, useEffect, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  ExternalLink,
  Loader2,
  Monitor,
  Search,
  Shield,
  Trash2,
} from 'lucide-react';
import { AlertCard, type AlertData } from './alert-card';
import type { MonitoringSubscription } from '@/lib/monitoring';
import { documentTypeLabel } from '@/lib/document-types';
import { ButtonLink, EmptyState, PageHeader, PageShell, StatStrip } from '@/components/ui';
import { MotionLoadingButton } from '@/components/motion-loading-button';
import { SegmentedControl } from '@/components/segmented-control';
import { Dropdown } from '@/components/interior/dropdown';
import {
  createMonitoringSubscription,
  deleteMonitoringSubscription,
  markMonitoringAlertRead,
  updateMonitoringNotifications,
} from '@/lib/monitoring-client';

/* ── types ─────────────────────────────────────────────────────── */

type EnrichedAlert = AlertData & { domain?: string };

interface MonitoringClientData {
  subscriptions: MonitoringSubscription[];
  alerts: EnrichedAlert[];
  displayName: string;
  focusedAlertId: string | null;
}

/* ── helpers ───────────────────────────────────────────────────── */

function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}`;
}

function frequencyLabel(freq: string): string {
  switch (freq) {
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    case 'monthly':
      return 'Monthly';
    default:
      return freq;
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/* ── component ─────────────────────────────────────────────────── */

export function MonitoringClient({ data }: { data: MonitoringClientData }) {
  const { subscriptions: initialSubs, alerts: initialAlerts, displayName, focusedAlertId } = data;

  const [subscriptions, setSubscriptions] = useState(initialSubs);
  const [alerts, setAlerts] = useState(initialAlerts);
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'alerts'>(
    focusedAlertId ? 'alerts' : 'subscriptions',
  );
  const [isPending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [notificationId, setNotificationId] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [frequency, setFrequency] = useState<MonitoringSubscription['frequency']>('weekly');
  const [setupError, setSetupError] = useState<string | null>(null);

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  useEffect(() => {
    if (activeTab !== 'alerts' || !focusedAlertId) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`monitoring-alert-${focusedAlertId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, focusedAlertId]);

  /* ── actions ─────────────────────────────────────────────────── */

  const submitSubscription = useCallback(() => {
    const submittedUrl = url.trim();
    if (!submittedUrl) return Promise.resolve();

    setSetupError(null);
    return new Promise<void>((resolve) => {
      startTransition(async () => {
      try {
        const { subscription } = await createMonitoringSubscription({
          url: submittedUrl,
          frequency,
        });
        setSubscriptions((previous) => [
          subscription,
          ...previous.filter((item) => item.id !== subscription.id),
        ]);
        setUrl('');
      } catch (err) {
        setSetupError(err instanceof Error ? err.message : 'Unable to start monitoring this service.');
      } finally {
        resolve();
      }
      });
    });
  }, [frequency, url]);

  const handleSubscribe = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitSubscription();
  }, [submitSubscription]);

  const handleRemove = useCallback(
    (subscriptionId: string) => {
      setRemovingId(subscriptionId);
      startTransition(async () => {
        try {
          await deleteMonitoringSubscription(subscriptionId);
          setSubscriptions((prev) => prev.filter((s) => s.id !== subscriptionId));
          setAlerts((prev) => prev.filter((alert) => alert.subscription_id !== subscriptionId));
        } catch (err) {
          console.error('Remove subscription failed:', err);
        } finally {
          setRemovingId(null);
        }
      });
    },
    [],
  );

  const handleMarkRead = useCallback((alertId: string) => {
    startTransition(async () => {
      try {
        await markMonitoringAlertRead(alertId);
        setAlerts((prev) =>
          prev.map((a) => (a.id === alertId ? { ...a, is_read: true } : a)),
        );
      } catch (err) {
        console.error('Mark alert read failed:', err);
      }
    });
  }, []);

  const handleNotificationToggle = useCallback((subscription: MonitoringSubscription) => {
    setNotificationId(subscription.id);
    startTransition(async () => {
      try {
        const result = await updateMonitoringNotifications(subscription.id, !subscription.email_notifications_enabled);
        setSubscriptions((previous) => previous.map((item) => item.id === subscription.id ? result.subscription : item));
      } catch (err) {
        console.error('Update notification preference failed:', err);
      } finally {
        setNotificationId(null);
      }
    });
  }, []);

  return (
    <div className="min-h-screen bg-[var(--ds-bg)]">
      <PageShell className={`${styles.page} space-y-7`}>
        <PageHeader className={styles.header} eyebrow="Your watchlist"
          title="Monitoring"
          description="Track each Privacy Policy, Terms of Use, or Terms of Service as its own document."
          meta={displayName ? `Monitoring for ${displayName}` : undefined}
          actions={
            <>
              <ButtonLink href="/scan/new" icon={Search}>New scan</ButtonLink>
              <ButtonLink href="/dashboard" variant="ghost">Dashboard</ButtonLink>
            </>
          }
        />

        {/* Stats row */}
        <StatStrip className={styles.stats} items={[
          { label: 'Monitored services', value: subscriptions.length, icon: Monitor, tone: 'primary' },
          { label: 'Unread alerts', value: unreadCount, icon: Bell, tone: 'warning' },
          { label: 'Total alerts', value: alerts.length, icon: Shield, tone: 'success' },
        ]} />

        <section className={styles.setup}>
          <div className="max-w-2xl">
            <h2 className="text-base font-medium text-[var(--ds-text)]">Monitor a service</h2>
            <p className="mt-1 text-[13px] leading-6 text-[var(--ds-text-muted)]">
              Add the direct link to a legal document. We&apos;ll identify its exact type, save a separate baseline, and notify you when that same document changes.
            </p>
          </div>
          <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={handleSubscribe}>
            <label className="sr-only" htmlFor="monitoring-url">Legal document URL</label>
            <input
              id="monitoring-url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/terms"
              required
              disabled={isPending}
              className="min-h-11 min-w-0 flex-1 rounded-[var(--ds-radius-sm)] border bg-[var(--ds-card)] px-4 text-[13px] text-[var(--ds-text)] placeholder:text-[var(--ds-text-dim)] focus:border-[var(--ds-accent)] focus:outline-none disabled:opacity-60"
            />
            <Dropdown
              value={frequency}
              onChange={(next) => setFrequency(next as MonitoringSubscription['frequency'])}
              disabled={isPending}
              label="Check frequency"
              className="w-full shrink-0 sm:w-40 [&>button]:w-full"
              items={[
                { value: 'daily', label: 'Daily', hint: 'Every day' },
                { value: 'weekly', label: 'Weekly', hint: 'Every week' },
                { value: 'monthly', label: 'Monthly', hint: 'Every month' },
              ]}
            />
            <MotionLoadingButton
              onAction={submitSubscription}
              disabled={isPending || !url.trim()}
              className="w-full shrink-0 sm:w-48"
              pendingLabel="Saving…"
              successLabel="Monitoring started"
              errorLabel="Try again"
            >
              Start monitoring
            </MotionLoadingButton>
          </form>
          {setupError ? <p className="mt-3 text-[13px] text-[var(--ds-danger)]" role="alert">{setupError}</p> : null}
        </section>

        {/* Tabs */}
        <SegmentedControl
          label="Monitoring views"
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: 'subscriptions', label: 'Subscriptions', icon: Monitor, count: subscriptions.length },
            { value: 'alerts', label: 'Alerts', icon: Bell, count: unreadCount },
          ]}
        />

        {/* Tab content */}
        <div>
          <AnimatePresence mode="wait">
            {activeTab === 'subscriptions' ? (
              <motion.div
                key="subscriptions"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {subscriptions.length === 0 ? (
                  <EmptyState
                    icon={Monitor}
                    title="No monitored services"
                    description="Add a direct Privacy Policy, Terms of Use, or Terms of Service URL to receive correctly separated alerts."
                  />
                ) : (
                  <div className={`${styles.subscriptions} divide-y divide-[var(--ds-border)]`}>
                    {subscriptions.map((sub, i) => (
                      <motion.div
                        key={sub.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05, duration: 0.3 }}
                        className="group flex flex-col gap-4 px-4 py-5 transition-colors hover:bg-[var(--ds-card-hover)] sm:flex-row sm:items-center sm:px-4"
                      >
                        {/* Favicon */}
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card-hover)]"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={faviconUrl(sub.domain)}
                            alt={`${sub.domain} favicon`}
                            className="h-6 w-6 rounded object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-[var(--ds-text)]">
                            {sub.title || sub.domain}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="text-[11px] text-[var(--ds-text-muted)]">
                              {sub.domain}
                            </span>
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-[var(--ds-info-bg)] text-[var(--ds-accent)]">
                              {frequencyLabel(sub.frequency)}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-[var(--ds-card-hover)] px-2 py-0.5 text-[11px] font-medium text-[var(--ds-text-secondary)]">
                              {documentTypeLabel(sub.document_type)}
                            </span>
                            <span className="text-[11px] text-[var(--ds-text-dim)]">
                              Last checked: {formatDate(sub.last_checked_at)}
                            </span>
                          </div>
                          {sub.verification_status !== 'active' && (
                            <p className="mt-2 text-[11px] text-[var(--ds-warning)]">
                              {sub.verification_message || 'This document needs review before comparisons can continue.'}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex w-full flex-wrap items-center justify-end gap-1 sm:w-auto">
                          <a
                            href={sub.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-8 items-center gap-1.5 rounded-[var(--ds-radius-sm)] px-3 text-[11px] font-medium text-[var(--ds-text-secondary)] transition hover:bg-[var(--ds-card-hover)]"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open terms
                          </a>
                          <button
                            type="button"
                            onClick={() => handleNotificationToggle(sub)}
                            disabled={notificationId === sub.id}
                            aria-pressed={sub.email_notifications_enabled}
                            title={sub.email_notifications_enabled ? 'Disable email alerts' : 'Enable email alerts'}
                            className="inline-flex h-8 items-center gap-1.5 rounded-[var(--ds-radius-sm)] px-3 text-[11px] font-medium text-[var(--ds-text-secondary)] transition hover:bg-[var(--ds-card-hover)] disabled:opacity-50"
                          >
                            <Bell className={`h-3.5 w-3.5 ${sub.email_notifications_enabled ? 'text-[var(--ds-accent)]' : 'text-[var(--ds-text-dim)]'}`} />
                            {sub.email_notifications_enabled ? 'Email on' : 'Email off'}
                          </button>
                          <button
                            onClick={() => handleRemove(sub.id)}
                            disabled={removingId === sub.id}
                            className="inline-flex h-8 items-center gap-1.5 rounded-[var(--ds-radius-sm)] px-3 text-[11px] font-medium text-[var(--ds-danger)] transition hover:bg-[var(--ds-danger-bg)] disabled:opacity-50"
                          >
                            {removingId === sub.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            Remove
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="alerts"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {alerts.length === 0 ? (
                  <EmptyState
                    icon={Bell}
                    title="No alerts yet"
                    description="When a monitored service's Terms of Service changes, you'll see alerts here."
                    actions={
                      <button
                        type="button"
                        onClick={() => setActiveTab('subscriptions')}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--ds-radius-sm)] border border-transparent bg-[var(--ds-accent)] px-4 text-[13px] font-medium text-[var(--primary-foreground)] shadow-[var(--shadow-card)] transition hover:brightness-110 active:brightness-95"
                      >
                        <Monitor className="h-4 w-4" />
                        View monitored services
                      </button>
                    }
                  />
                ) : (
                  <div className="space-y-3">
                    {alerts.map((alert) => (
                      <AlertCard
                        key={alert.id}
                        alert={alert}
                        onMarkRead={handleMarkRead}
                        isFocused={alert.id === focusedAlertId}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--ds-border)] pt-6 text-center">
          <p className="text-[11px] text-[var(--ds-text-dim)]">
            Powered by <span className="font-semibold text-[var(--ds-accent)]">Themys</span> · Know what you agree to
          </p>
        </div>
      </PageShell>
    </div>
  );
}
