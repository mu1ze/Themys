import { MetricPage, type AdminMetricPageProps } from "@/features/admin/metrics/page";

export default function Page(props: AdminMetricPageProps) {
  return <MetricPage {...props} view="usage" />;
}
