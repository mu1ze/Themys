// Pure SQL contracts, shared by the D1 reader and SQLite regression tests.
// All windows are half-open UTC intervals. Values are always bound, never interpolated.
export function reportingWindow(raw: unknown, now = new Date()) {
  const days = raw === "7" ? 7 : raw === "90" ? 90 : 30;
  const end = new Date(now);
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end.getTime() - days * 86400000);
  const previous = new Date(start.getTime() - days * 86400000);
  return { days, start: start.toISOString(), end: end.toISOString(), previous: previous.toISOString() };
}

export const metricsSql = {
  accounts: `SELECT COUNT(*) total,
    SUM(created_at >= ?1 AND created_at < ?2) new_users,
    SUM(created_at >= ?3 AND created_at < ?1) previous_users,
    SUM(subscription_status = 'active') active_subscriptions,
    SUM(subscription_status = 'trialing') trials,
    SUM(subscription_status = 'past_due') past_due
    FROM users`,
  reviewers: `WITH current AS (
      SELECT DISTINCT user_id FROM scans WHERE is_deleted = 0 AND is_monitoring_scan = 0 AND created_at >= ?1 AND created_at < ?2
    ), previous AS (
      SELECT DISTINCT user_id FROM scans WHERE is_deleted = 0 AND is_monitoring_scan = 0 AND created_at >= ?3 AND created_at < ?1
    ) SELECT (SELECT COUNT(*) FROM current) active,
      (SELECT COUNT(*) FROM previous) previous_active,
      (SELECT COUNT(*) FROM current INNER JOIN previous USING(user_id)) retained`,
  activation: `SELECT COUNT(*) eligible, COALESCE(SUM(EXISTS (
      SELECT 1 FROM scans s WHERE s.user_id = u.id AND s.is_deleted = 0 AND s.is_monitoring_scan = 0
      AND julianday(s.created_at) >= julianday(u.created_at)
      AND julianday(s.created_at) < julianday(u.created_at) + 7
    )), 0) activated FROM users u
    WHERE julianday(u.created_at) >= julianday(?1) - 7
      AND julianday(u.created_at) < julianday(?2) - 7`,
  scans: `SELECT COUNT(*) completed, COALESCE(SUM(decision IN ('sign', 'negotiate', 'walk_away')), 0) decisions,
    COALESCE(SUM(document_type = 'unknown'), 0) unclassified
    FROM scans WHERE is_deleted = 0 AND is_monitoring_scan = 0 AND created_at >= ?1 AND created_at < ?2`,
  daily: `SELECT substr(created_at, 1, 10) day, COUNT(*) count FROM scans
    WHERE is_deleted = 0 AND is_monitoring_scan = 0 AND created_at >= ?1 AND created_at < ?2 GROUP BY day ORDER BY day`,
  channels: `SELECT client_type channel, outcome, COUNT(*) count, COALESCE(SUM(CASE WHEN outcome = 'success' THEN cached ELSE 0 END), 0) cached,
    COALESCE(SUM(credits), 0) credits, COALESCE(SUM(ai_slots), 0) ai_slots
    FROM usage_events WHERE created_at >= ?1 AND created_at < ?2 AND operation IN ('analyze', 'batch_item')
    AND outcome IN ('success', 'failed', 'quota_rejected') GROUP BY client_type, outcome`,
  latency: `WITH durations AS (
    SELECT CAST(json_extract(metadata, '$.duration_ms') AS REAL) duration
    FROM usage_events WHERE created_at >= ?1 AND created_at < ?2 AND operation = 'analyze'
      AND outcome = 'success' AND json_type(metadata, '$.duration_ms') IN ('integer', 'real')
      AND CAST(json_extract(metadata, '$.duration_ms') AS REAL) >= 0
  ), ranked AS (SELECT duration, ROW_NUMBER() OVER (ORDER BY duration) rank, COUNT(*) OVER () total FROM durations)
    SELECT COUNT(*) samples, MAX(CASE WHEN rank = CAST((total * 95 + 99) / 100 AS INTEGER) THEN duration END) p95_ms FROM ranked`,
  commercial: `SELECT operation, COUNT(DISTINCT actor_hash) people, COUNT(*) events FROM usage_events
    WHERE created_at >= ?1 AND created_at < ?2 AND operation IN ('paywall_view', 'pricing_view', 'checkout_start')
    GROUP BY operation`,
  handoff: `SELECT COUNT(DISTINCT p.actor_hash) converted FROM usage_events p
    WHERE p.operation = 'paywall_view' AND p.created_at >= ?1 AND p.created_at < ?2
      AND EXISTS (SELECT 1 FROM usage_events c WHERE c.actor_hash = p.actor_hash AND c.operation = 'checkout_start'
        AND c.created_at >= p.created_at AND c.created_at < ?2
        AND julianday(c.created_at) <= julianday(p.created_at) + 7)`,
  revenue: `SELECT lower(currency) currency, COUNT(*) payments, COUNT(DISTINCT user_id) payers, SUM(amount) amount
    FROM invoices WHERE status = 'paid' AND paid_at >= ?1 AND paid_at < ?2 GROUP BY lower(currency)`,
  invoices: `SELECT id, currency, amount, status, paid_at FROM invoices
    WHERE paid_at >= ?1 AND paid_at < ?2 ORDER BY paid_at DESC LIMIT 12`,
} as const;

export type MetricGroup = keyof typeof metricsSql;
export type MetricRow = Record<string, string | number | null>;
export type MetricsData = Record<MetricGroup, MetricRow[] | null>;
export type ReportingWindow = ReturnType<typeof reportingWindow>;

export function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? `${(100 * numerator / denominator).toFixed(1)}%` : "—";
}
export function change(current: number, previous: number) {
  if (previous === 0) return current === 0 ? "No change" : "No prior activity";
  const value = 100 * (current - previous) / previous;
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}% vs prior period`;
}

/* ── Source-health strip (admin v3) ── */
export const healthSql = {
  inventory: `SELECT COUNT(*) total FROM sqlite_schema WHERE type = 'table'`,
  scans: `SELECT COUNT(*) count FROM scans WHERE is_deleted = 0`,
  lastEvent: `SELECT MAX(created_at) last FROM usage_events`,
  lastStripeEvent: `SELECT MAX(received_at) last FROM stripe_events`,
} as const;
export type HealthGroup = keyof typeof healthSql;
