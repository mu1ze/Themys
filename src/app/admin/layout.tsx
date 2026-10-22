import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { getAdminNavigationSummary } from "@/features/admin/server/queries";
import { AdminLayoutWrapper } from "@/components/admin/admin-layout-wrapper";

export const metadata: Metadata = {
  title: "Admin Panel",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  const navigation = await getAdminNavigationSummary();

  return <AdminLayoutWrapper navigation={navigation}>{children}</AdminLayoutWrapper>;
}
