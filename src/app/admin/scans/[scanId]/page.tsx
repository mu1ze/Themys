import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getAdminScanDetail } from "@/features/admin/server/queries";
import { DeleteScanButton } from "@/components/admin/delete-scan-button";
import { ScanResultsView } from "@/components/scan-results-view";

export default async function AdminScanDetailPage({
  params,
}: {
  params: Promise<{ scanId: string }>;
}) {
  const { scanId } = await params;
  const detail = await getAdminScanDetail(scanId);

  if (!detail) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/scans"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--admin-dim)] hover:text-[var(--admin-ink)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to scans
        </Link>
        <p className="text-[var(--admin-muted)]">Scan not found.</p>
      </div>
    );
  }

  const { scan, clauses, fullExtraction } = detail;

  const backButton = (
    <Link
      href="/admin/scans"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--admin-dim)] hover:text-[var(--admin-ink)]"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Back to scans
    </Link>
  );

  const actions = (
    <>
      <span className="text-sm text-[var(--admin-muted)]">Scan ID: <code className="text-xs">{scan.id}</code></span>
      <DeleteScanButton scanId={scan.id} />
    </>
  );

  return (
    <ScanResultsView
      scan={scan}
      clauses={clauses}
      fullExtraction={fullExtraction}
      headerBackButton={backButton}
      headerActions={actions}
      isAdmin={true}
    />
  );
}
