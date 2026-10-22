import "server-only";
import { getDatabaseBinding } from "@/lib/database";
import { requireAdmin } from "@/lib/admin";
import { d1Datasets, type D1InventoryRow } from "@/features/admin/data-inventory";
import { metricsSql, healthSql, type MetricGroup, type MetricRow, type MetricsData, type ReportingWindow } from "./queries";

export async function getFounderMetrics(window: ReportingWindow): Promise<MetricsData> {
  await requireAdmin();
  const groups = Object.keys(metricsSql) as MetricGroup[];
  const settled = await Promise.allSettled(groups.map(async (group) => {
    const sql = metricsSql[group];
    const values = sql.includes("?3") ? [window.start, window.end, window.previous] : [window.start, window.end];
    const result = await getDatabaseBinding().prepare(sql).bind(...values).all<MetricRow>();
    if (result.success === false || result.error || !result.results) throw new Error("Metric query failed");
    return result.results;
  }));
  return Object.fromEntries(groups.map((group, index) => {
    const result = settled[index];
    if (result.status === "rejected") {
      const reason = result.reason;
      const message = reason instanceof Error ? reason.message : "unknown database error";
      console.error("[admin-metrics] unavailable", group, message);
    }
    return [group, result.status === "fulfilled" ? result.value : null];
  })) as MetricsData;
}

export async function getD1Inventory(): Promise<D1InventoryRow[] | null> {
  await requireAdmin();
  const binding = getDatabaseBinding();

  try {
    const schema = await binding
      .prepare("SELECT name FROM sqlite_schema WHERE type = 'table'")
      .all<{ name: string }>();
    if (schema.success === false || schema.error || !schema.results) {
      throw new Error("Could not read the D1 schema");
    }

    const availableTables = new Set(schema.results.map((row) => row.name));
    const queryable = d1Datasets.filter((dataset) => availableTables.has(dataset.table));
    const counts = await binding.batch<{ count: number }>(queryable.map((dataset) =>
      binding.prepare(`SELECT COUNT(*) AS count FROM "${dataset.table}"`)
    ));
    const countByTable = new Map(
      queryable.map((dataset, index) => [
        dataset.table,
        Number(counts[index]?.results?.[0]?.count ?? 0),
      ]),
    );

    return d1Datasets.map((dataset) => ({
      ...dataset,
      available: availableTables.has(dataset.table),
      count: availableTables.has(dataset.table) ? (countByTable.get(dataset.table) ?? 0) : null,
    }));
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "unknown database error";
    console.error("[admin-inventory] unavailable", message);
    return null;
  }
}

export type SourceHealth = {
  inventoryTables: number | null;
  retainedScans: number | null;
  lastEventAt: string | null;
  lastStripeEventAt: string | null;
};

/** Best-effort per-source facts for the admin status strip. Null = unavailable, never zero. */
export async function getSourceHealth(): Promise<SourceHealth> {
  await requireAdmin();
  const binding = getDatabaseBinding();
  const run = async <T>(sql: string): Promise<T | null> => {
    try {
      const result = await binding.prepare(sql).all<T>();
      if (result.success === false || result.error || !result.results) throw new Error("health query failed");
      return (result.results[0] ?? null) as T | null;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "unknown database error";
      console.error("[admin-health] unavailable", message);
      return null;
    }
  };
  const [inventory, scans, lastEvent, lastStripeEvent] = await Promise.all([
    run<{ total: number }>(healthSql.inventory),
    run<{ count: number }>(healthSql.scans),
    run<{ last: string | null }>(healthSql.lastEvent),
    run<{ last: string | null }>(healthSql.lastStripeEvent),
  ]);
  return {
    inventoryTables: inventory?.total ?? null,
    retainedScans: scans?.count ?? null,
    lastEventAt: lastEvent?.last ?? null,
    lastStripeEventAt: lastStripeEvent?.last ?? null,
  };
}
