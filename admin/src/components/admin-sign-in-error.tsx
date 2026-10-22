"use client";

import { useSyncExternalStore } from "react";
import { ShieldAlert } from "lucide-react";

function getSnapshot(): boolean {
  return new URLSearchParams(window.location.search).get("error") === "unauthorized";
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
}

export function AdminSignInError() {
  const denied = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!denied) return null;

  return (
    <div className="flex items-start gap-3 rounded-[var(--ds-radius-sm)] border border-[var(--ds-danger)]/30 bg-[var(--ds-danger-bg)] p-4">
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ds-danger)]" strokeWidth={2} />
      <div>
        <p className="text-sm font-semibold text-[var(--ds-danger)]">Access denied</p>
        <p className="mt-1 text-sm leading-6 text-[var(--ds-text-secondary)]">
          This account isn&apos;t authorized for admin access. If you believe this is a
          mistake, contact the platform team.
        </p>
      </div>
    </div>
  );
}
