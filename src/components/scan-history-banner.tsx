"use client";

import Link from "next/link";
import { History, ChevronRight } from "lucide-react";
import { CollapsibleBanner } from "@/components/collapsible-banner";
import { documentTypeLabel, type DocumentType } from "@/lib/document-types";

type ScanHistoryBannerProps = {
  domain: string;
  documentIdentityKey: string | null;
  documentType: DocumentType;
  scanCount: number; // total scans for this domain, including current
  previousScanId?: string; // if provided, enables quick "compare with last" link
  currentScanId?: string;
};

export function ScanHistoryBanner({
  domain,
  documentIdentityKey,
  documentType,
  scanCount,
  previousScanId,
  currentScanId,
}: ScanHistoryBannerProps) {
  if (scanCount < 2 || !documentIdentityKey) return null;

  const prevCount = scanCount - 1;

  return (
    <div className="mb-6">
      <CollapsibleBanner
        title={
          <>
            You&apos;ve scanned <span className="text-[var(--ds-primary)]">{domain}</span>{" "}
            {documentTypeLabel(documentType)}{" "}
            {prevCount} time{prevCount !== 1 ? "s" : ""} before
          </>
        }
        description="Track changes and compare attention levels over time"
        icon={<History className="h-3.5 w-3.5" />}
        action={
          <div className="flex items-center gap-2">
            {previousScanId && currentScanId && (
              <Link
                href={`/scan/diff/${previousScanId}/${currentScanId}`}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--ds-border)] px-3 py-1.5 text-xs font-semibold text-[var(--ds-text-muted)] hover:bg-[var(--ds-card-hover)] hover:text-[var(--ds-text)] transition"
              >
                Compare with last
              </Link>
            )}
            <Link
              href={`/scan/history/${encodeURIComponent(domain)}?identity=${encodeURIComponent(documentIdentityKey)}`}
              className="flex items-center gap-1 rounded-lg bg-[var(--ds-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition"
            >
              View history
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        }
      />
    </div>
  );
}
