"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { getErrorMessage } from "@/lib/json-value";

export function DeleteScanButton({ scanId, iconOnly = false }: { scanId: string; iconOnly?: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleDelete() {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/scans/${scanId}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          const data: unknown = await res.json().catch(() => null);
          alert(getErrorMessage(data, "Failed to delete scan"));
          return;
        }

        // Successfully deleted, redirect to scans list
        router.push("/admin/scans");
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Network error");
      }
    });
  }

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        {!iconOnly && <span className="text-sm font-medium text-[var(--admin-muted)]">Are you sure?</span>}
        <button
          onClick={() => setShowConfirm(false)}
          disabled={isPending}
          className="rounded-lg border border-[var(--admin-line)] bg-[var(--admin-paper)] px-2 py-1.5 text-xs font-medium text-[var(--admin-muted)] hover:border-[var(--admin-line-hover)] disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="rounded-lg bg-[var(--admin-rose)] px-2 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "..." : "Confirm"}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      title="Delete Scan"
      className="inline-flex items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--admin-rose)_24%,var(--admin-line))] bg-[var(--admin-rose-bg)] px-3 py-1.5 text-sm font-medium text-[var(--admin-rose)] transition-opacity hover:opacity-85"
    >
      <Trash2 className="h-4 w-4" />
      {!iconOnly && "Delete Scan"}
    </button>
  );
}
