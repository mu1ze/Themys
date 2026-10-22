"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, Menu } from "lucide-react";
import { AdminSidebar } from "./admin-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import type { AdminNavigationSummary } from "@/features/admin/server/queries";

/**
 * Admin v3 shell: ledger rail + mono topbar (01·C). The old telemetry HUD
 * (fake "KV Cache 99.2%" pills, D1 Active ping) was removed — claims the
 * page cannot back do not belong in the frame (KPIS.md honesty rules).
 */
export function AdminLayoutWrapper({
  children,
  navigation,
}: {
  children: React.ReactNode;
  navigation: AdminNavigationSummary;
}) {
  const menuRef = useRef<HTMLButtonElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="admin-surface flex min-h-screen">
      <a href="#admin-main" className="sr-only focus:not-sr-only focus:fixed focus:z-[100] focus:bg-[var(--admin-ink)] focus:text-[var(--admin-surface)] focus:p-4">
        Skip to content
      </a>
      <AdminSidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        navigation={navigation}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="admin-topbar">
          <button
            ref={menuRef}
            type="button"
            className="admin-mobile-menu"
            aria-label="Open admin navigation"
            aria-controls="admin-mobile-navigation"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <Menu aria-hidden="true" />
          </button>
          <span className="admin-topbar-title">
            THEMYS · <b>ADMIN</b>
          </span>
          <span className="right">
            <span
              className="live"
              data-state={navigation.dataState}
              title={navigation.dataState === "connected" ? "Verified by a live D1 count query" : "The admin shell could not read D1"}
            >
              <i aria-hidden="true" />
              {navigation.dataState === "connected" ? "D1 · CONNECTED" : "D1 · UNAVAILABLE"}
            </span>
            <ThemeToggle />
            <Link href="https://themys.ca/dashboard" className="admin-back-link">
              App <ExternalLink aria-hidden="true" />
            </Link>
          </span>
        </header>

        <main id="admin-main" className="flex-1 overflow-x-hidden">
          <div className="mx-auto w-full max-w-[1180px] px-4 py-7 sm:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
