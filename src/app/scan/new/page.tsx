import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { ExternalLink } from "lucide-react";

import { ScanWorkflow } from "@/components/scan-workflow";
import { listRecentScansByClerkId } from "@/lib/persistence";
import { buildCompanyLogoUrl, formatCompanyName } from "@/lib/scan-display";

function formatRelativeTime(isoString: string): string {
  const createdAt = new Date(isoString).getTime();
  const diffMs = Math.max(0, Date.now() - createdAt);
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 60) {
    return `${Math.max(1, diffMinutes)} minute${diffMinutes === 1 ? "" : "s"} ago`;
  }

  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

function extractHostname(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

const STATIC_POPULAR_SERVICES = [
  { id: "google", name: "Google", domain: "google.com", targetUrl: "https://policies.google.com/terms" },
  { id: "apple", name: "Apple", domain: "apple.com", targetUrl: "https://www.apple.com/legal/internet-services/terms/site.html" },
  { id: "meta", name: "Meta", domain: "meta.com", targetUrl: "https://www.facebook.com/terms.php" },
  { id: "amazon", name: "Amazon", domain: "amazon.com", targetUrl: "https://www.amazon.com/conditions-of-use" },
  { id: "microsoft", name: "Microsoft", domain: "microsoft.com", targetUrl: "https://www.microsoft.com/en-us/servicesagreement" },
];

export default async function NewScanPage() {
  const { userId } = await auth();
  const userScans = userId
    ? await listRecentScansByClerkId(userId, 5)
    : [];
  const latestScan = userScans[0] ?? null;

  // Build recent scan tiles from user's scans, or fall back to static popular services
  const recentScanTiles = userScans.length > 0
    ? userScans.map((scan) => ({
        id: scan.id,
        name: formatCompanyName(scan),
        domain: scan.domain || extractHostname(scan.url) || "",
        targetUrl: scan.url?.trim() || `https://${scan.domain}`,
        logoUrl: buildCompanyLogoUrl(scan),
        riskScore: scan.riskScore,
        relativeDate: formatRelativeTime(scan.createdAt),
      }))
    : STATIC_POPULAR_SERVICES.map((svc) => ({
        ...svc,
        logoUrl: `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(svc.domain)}`,
        riskScore: null,
        relativeDate: null,
      }));

  const latestLabel = latestScan
    ? `${latestScan.title ?? latestScan.domain ?? "Latest scan"} (${formatRelativeTime(latestScan.createdAt)})`
    : "Your last scan: none yet";

  return (
    <>
      <div className="pb-6">
        <ScanWorkflow recentScanTiles={recentScanTiles} />
      </div>

      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 border-t border-[var(--ds-border)] py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-[11px] text-[var(--ds-text-secondary)]">
            <span className="break-words">{latestLabel}</span>
          </div>

          {latestScan && <Link
            href={`/scan/results?id=${encodeURIComponent(latestScan.id)}`}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 self-start text-[12px] font-medium text-[var(--ds-accent)] transition hover:opacity-80 sm:self-auto"
          >
            <span>View Results</span>
            <ExternalLink className="h-4 w-4" />
          </Link>}
        </div>
      </div>
    </>
  );
}
