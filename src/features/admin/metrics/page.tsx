import { FounderDashboard, type DashboardView } from "@/components/admin/founder-dashboard";
import { getD1Inventory, getFounderMetrics, getSourceHealth } from "./server";
import { reportingWindow } from "./queries";
export type AdminMetricPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
export async function MetricPage({ searchParams, view }: AdminMetricPageProps & { view: DashboardView }) {
  const params = await searchParams;
  const window = reportingWindow(params.days);
  const [data, inventory, health] = await Promise.all([
    getFounderMetrics(window),
    view === "overview" ? getD1Inventory() : Promise.resolve(null),
    getSourceHealth(),
  ]);
  return <FounderDashboard data={data} inventory={inventory} health={health} window={window} view={view} />;
}
