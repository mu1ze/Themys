"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { getErrorMessage } from "@/lib/json-value";

import { PLAN_DISPLAY_NAME, type Plan } from "@/lib/entitlements";

const plans = ["free", "base", "advanced", "lifetime"] as const;

export function ChangePlanForm({
  userId,
  currentPlan,
}: {
  userId: string;
  currentPlan: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(currentPlan);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const hasChanged = selected !== currentPlan;

  async function handleSubmit() {
    if (!hasChanged) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/users/${userId}/plan`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: selected }),
        });

        if (!res.ok) {
          const data: unknown = await res.json().catch(() => null);
          setResult({ ok: false, message: getErrorMessage(data, "Failed to update plan") });
          return;
        }

        setResult({ ok: true, message: `Plan changed to ${PLAN_DISPLAY_NAME[selected as Plan] ?? selected}` });
        router.refresh();
      } catch (err) {
        setResult({
          ok: false,
          message: err instanceof Error ? err.message : "Network error",
        });
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label htmlFor="admin-plan" className="sr-only">Account plan</label>
        <select
          id="admin-plan"
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setResult(null);
          }}
          disabled={isPending}
          className="admin-field"
        >
          {plans.map((plan) => (
            <option key={plan} value={plan}>
              {PLAN_DISPLAY_NAME[plan]}
            </option>
          ))}
        </select>

        <button
          onClick={handleSubmit}
          disabled={!hasChanged || isPending}
          className="min-h-10 rounded-lg bg-[var(--admin-ink)] px-4 py-2 text-sm font-semibold text-[var(--admin-paper)] transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? "Saving…" : "Update"}
        </button>
      </div>

      {result && (
        <p role="status" aria-live="polite" className={`text-sm font-medium ${result.ok ? "text-[var(--admin-green)]" : "text-[var(--admin-rose)]"}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
