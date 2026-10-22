"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { getErrorMessage } from "@/lib/json-value";

export function SeedCachedScansButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function handleClick() {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/users/${userId}/seed-cached-scans`, {
          method: "POST",
        });
        const data: unknown = await res.json().catch(() => null);
        if (!res.ok) {
          setResult({ ok: false, message: getErrorMessage(data, "Failed to restore cached scans") });
          return;
        }

        const restored =
          data && typeof data === "object" && "restored" in data && typeof data.restored === "number"
            ? data.restored
            : 0;
        const skipped =
          data && typeof data === "object" && "skipped" in data && typeof data.skipped === "number"
            ? data.skipped
            : 0;
        const reason =
          data && typeof data === "object" && "reason" in data && typeof data.reason === "string"
            ? data.reason
            : null;

        const message =
          restored > 0
            ? `Restored ${restored} scan${restored === 1 ? "" : "s"} into history${skipped ? ` (${skipped} skipped)` : ""}.`
            : reason === "no_orphan_events"
              ? "No unsaved scans found for this account."
              : reason === "no_matching_cache"
                ? "Unsaved scans were found, but no matching public cache entries remain."
                : reason === "kv_unavailable"
                  ? "Scan cache is not available in this environment."
                  : "Nothing new to restore.";

        setResult({ ok: restored > 0 || !reason || reason === "no_orphan_events", message });
        if (restored > 0) router.refresh();
      } catch (err) {
        setResult({
          ok: false,
          message: err instanceof Error ? err.message : "Network error",
        });
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-lg border border-[var(--admin-line)] bg-[var(--admin-paper)] px-3 py-2 text-sm font-semibold text-[var(--admin-ink)] transition-colors hover:border-[var(--admin-line-hover)] hover:bg-[var(--admin-surface)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPending ? "Restoring…" : "Restore cached scans"}
      </button>
      {result && (
        <p role="status" aria-live="polite" className={`text-sm font-medium ${result.ok ? "text-[var(--admin-green)]" : "text-[var(--admin-rose)]"}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
