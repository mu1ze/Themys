import { currentUser } from "@clerk/nextjs/server";
import { getSubscriptions, getAlerts } from "@/features/monitoring/server/subscriptions";
import { getOrCreateUserProfileByClerkId } from "@/lib/persistence";
import { MonitoringClient } from "./monitoring-client";
import { redirect } from "next/navigation";
import { getPlanEntitlements } from "@/lib/entitlements";

export default async function MonitoringPage({
  searchParams,
}: {
  searchParams: Promise<{ alert?: string | string[] }>;
}) {
  const user = await currentUser();
  const clerkId = user?.id;

  if (!clerkId) {
    redirect("/sign-in?redirect_url=/monitoring");
  }

  const profile = await getOrCreateUserProfileByClerkId(
    clerkId,
    user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress ?? "",
    { landingPage: "/monitoring" }
  );

  const userId = profile.id;

  const [subscriptions, alerts] = await Promise.all([
    getSubscriptions(userId, getPlanEntitlements(profile.plan).emailAlerts),
    getAlerts(userId),
  ]);

  const requestedAlert = (await searchParams).alert;
  const requestedAlertId = typeof requestedAlert === "string" ? requestedAlert : null;
  const focusedAlertId = requestedAlertId && alerts.some((alert) => alert.id === requestedAlertId)
    ? requestedAlertId
    : null;

  // Enrich alerts with domain info from subscriptions
  const subMap = new Map(subscriptions.map((s) => [s.id, s]));
  const enrichedAlerts = alerts.map((alert) => ({
    ...alert,
    domain: subMap.get(alert.subscription_id)?.domain,
  }));

  const displayName = user?.username ?? user?.firstName ?? "there";

  return (
    <MonitoringClient
      data={{
        subscriptions,
        alerts: enrichedAlerts,
        displayName,
        focusedAlertId,
      }}
    />
  );
}
