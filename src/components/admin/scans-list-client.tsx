"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Trash2 } from "lucide-react";

import { AdminTable, Pagination } from "@/components/admin/admin-table";
import { RiskBadge } from "@/components/admin/plan-badge";
import { DeleteScanButton } from "@/components/admin/delete-scan-button";
import type { AdminScanRow } from "@/features/admin/server/queries";
import { getErrorMessage } from "@/lib/json-value";

type ScansListClientProps = {
  scans: AdminScanRow[];
  total: number;
  page: number;
  pageSize: number;
  basePath: string;
  searchParams: Record<string, string>;
};

export function ScansListClient({
  scans,
  total,
  page,
  pageSize,
  basePath,
  searchParams,
}: ScansListClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const columns = [
    {
      key: "domain",
      header: "Domain / Title",
      render: (row: AdminScanRow) => (
        <span className="font-medium text-[var(--admin-ink)]">
          {row.domain ?? row.title ?? "Untitled"}
        </span>
      ),
    },
    {
      key: "user",
      header: "User",
      render: (row: AdminScanRow) => (
        <Link
          href={`/admin/users/${row.userId}`}
          className="text-[var(--admin-muted)] hover:text-[var(--admin-ink)] hover:underline hover:underline-offset-4"
        >
          {row.userEmail ?? "—"}
        </Link>
      ),
    },
    {
      key: "risk",
      header: "Risk",
      render: (row: AdminScanRow) => <RiskBadge score={row.riskScore} />,
    },
    {
      key: "clauses",
      header: "Clauses",
      render: (row: AdminScanRow) => (
        <span className="font-mono text-[var(--admin-muted)]">
          {row.clauseCount}
          {row.flaggedCount > 0 && (
            <span className="ml-1 text-[var(--admin-rose)]">({row.flaggedCount})</span>
          )}
        </span>
      ),
    },
    {
      key: "source",
      header: "Source",
      render: (row: AdminScanRow) => (
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
            row.source === "web"
              ? "border-[var(--admin-line)] bg-[var(--admin-surface)] text-[var(--admin-muted)]"
              : row.source === "extension"
                ? "border-[color-mix(in_srgb,var(--admin-sienna)_20%,var(--admin-line))] bg-[var(--admin-peach)] text-[var(--admin-sienna)]"
                : "border-[color-mix(in_srgb,var(--admin-green)_20%,var(--admin-line))] bg-[var(--admin-green-bg)] text-[var(--admin-green)]"
          }`}
        >
          {row.source}
        </span>
      ),
    },
    {
      key: "date",
      header: "Date",
      render: (row: AdminScanRow) => (
        <span className="font-mono text-xs text-[var(--admin-dim)]">
          {new Date(row.createdAt).toISOString().slice(0, 10)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-10 text-right",
      render: (row: AdminScanRow) => (
        <div className="flex justify-end">
          <DeleteScanButton scanId={row.id} iconOnly />
        </div>
      ),
    },
  ];

  const allSelected = useMemo(
    () => scans.length > 0 && scans.every((row) => selectedIds.has(row.id)),
    [scans, selectedIds]
  );

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const row of scans) {
          next.delete(row.id);
        }
      } else {
        for (const row of scans) {
          next.add(row.id);
        }
      }
      return next;
    });
  }

  function handleBulkDelete() {
    if (!confirm(`Delete ${selectedIds.size} selected scan(s)? This cannot be undone.`)) {
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/scans/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: Array.from(selectedIds) }),
        });

        if (!res.ok) {
          const data: unknown = await res.json().catch(() => null);
          alert(getErrorMessage(data, "Failed to delete scans"));
          return;
        }

        setSelectedIds(new Set());
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Network error");
      }
    });
  }

  async function handleBulkExport() {
    if (selectedIds.size === 0) return;

    setIsExporting(true);
    try {
      const res = await fetch("/api/admin/scans/bulk/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      if (!res.ok) {
        const data: unknown = await res.json().catch(() => null);
        alert(getErrorMessage(data, "Failed to export scans"));
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scans-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Network error");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-rose)_24%,var(--admin-line))] bg-[var(--admin-rose-bg)] px-4 py-3">
          <span className="text-sm font-medium text-[var(--admin-rose)]">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              disabled={isPending || isExporting}
              className="rounded-lg border border-[var(--admin-line)] bg-[var(--admin-paper)] px-3 py-1.5 text-sm font-medium text-[var(--admin-muted)] hover:border-[var(--admin-line-hover)] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleBulkExport}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--admin-line)] bg-[var(--admin-paper)] px-3 py-1.5 text-sm font-semibold text-[var(--admin-ink)] hover:border-[var(--admin-line-hover)] disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {isExporting ? "Exporting..." : "Download CSV"}
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--admin-rose)] px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {isPending ? "Deleting..." : "Delete selected"}
            </button>
          </div>
        </div>
      )}

      <AdminTable
        columns={columns}
        rows={scans}
        getRowKey={(row) => row.id}
        rowHref={(row) => `/admin/scans/${row.id}`}
        selection={{
          selectedIds,
          onSelect: toggleSelect,
          onSelectAll: toggleSelectAll,
        }}
        emptyMessage="No scans found matching your filters."
      />

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        basePath={basePath}
        searchParams={searchParams}
      />
    </div>
  );
}
