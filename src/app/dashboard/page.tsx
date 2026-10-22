import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateUserProfileByClerkId } from "@/lib/persistence";
import { getVendorDashboardForUser } from "@/lib/dashboard-data";
import { getUtmFromCookies } from "@/lib/utm-utils";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const { isAuthenticated, userId } = await auth();

  if (!isAuthenticated || !userId) {
    redirect("/sign-in?redirect_url=/dashboard");
  }

  const user = await currentUser();
  if (!user) {
    redirect("/sign-in?redirect_url=/dashboard");
  }

  const clerkId = user.id;
  const utm = await getUtmFromCookies();

  await getOrCreateUserProfileByClerkId(
    clerkId,
    user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? "",
    { ...utm, landingPage: "/" }
  );

  const vendor = await getVendorDashboardForUser(clerkId);
  const displayName = user.username ?? user.firstName ?? "there";

  return (
    <DashboardClient
      data={{
        ...vendor,
        displayName,
      }}
    />
  );
}
