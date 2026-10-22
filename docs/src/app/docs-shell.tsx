"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useTheme } from "@/lib/theme-context";
import { DocsSidebar } from "./components/docs-sidebar";
import { SearchModal } from "./components/search-modal";
import { ThemeToggle } from "@/components/theme-toggle";
import { usePathname } from "next/navigation";
import { LegalShell } from "./legal-shell";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://themys.ca";

const C = {
  dark: {
    bg: "#0b1120",
    header: "rgba(11,17,32,0.95)",
    border: "#1f2937",
    text: "#f9fafb",
    textSec: "#9ca3af",
    textMuted: "#6b7280",
    card: "#111827",
    accent: "#2563eb",
    searchBg: "#111827",
    searchBorder: "#1f2937",
    searchText: "#9ca3af",
    kbdBg: "#1f2937",
    kbdBorder: "#374151",
  },
  light: {
    bg: "#ffffff",
    header: "rgba(255,255,255,0.95)",
    border: "#e2e8f0",
    text: "#0f172a",
    textSec: "#475569",
    textMuted: "#64748b",
    card: "#ffffff",
    accent: "#2563eb",
    searchBg: "#f8fafc",
    searchBorder: "#e2e8f0",
    searchText: "#64748b",
    kbdBg: "#ffffff",
    kbdBorder: "#cbd5e1",
  },
};

export function DocsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { theme } = useTheme();
  const c = C[theme];
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (pathname === "/legal" || pathname.startsWith("/legal/")) {
    return <LegalShell>{children}</LegalShell>;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: c.bg, color: c.text }}>
      <SearchModal />

      {/* Top bar */}
      <header
        className="sticky top-0 z-50 border-b backdrop-blur"
        style={{ borderColor: c.border, backgroundColor: c.header }}
      >
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          {/* This intentionally leaves the docs deployment for the main app. */}
          <a href={APP_URL} className="flex items-center gap-2">
            {/* A fixed SVG does not benefit from Next image optimization. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="Themys" className="h-7 w-7 rounded-[20%]" width={28} height={28} />
            <span className="text-sm font-semibold" style={{ color: c.text }}>Themys</span>
          </a>
          <span className="text-sm" style={{ color: c.textMuted }}>/</span>
          <Link href="/" className="text-sm font-medium transition" style={{ color: c.textSec }}>Docs</Link>
          <div className="flex-1" />
          <button
            type="button"
            aria-label={sidebarOpen ? "Hide documentation navigation" : "Show documentation navigation"}
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen((open) => !open)}
            className="inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition"
            style={{ borderColor: c.border, backgroundColor: c.card, color: c.textSec }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>
            <span className="hidden sm:inline">Contents</span>
          </button>
          <ThemeToggle />
          <a
            href={`${APP_URL}/dashboard`}
            className="hidden min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition sm:inline-flex"
            style={{ borderColor: c.border, backgroundColor: c.card, color: c.textSec, border: `1px solid ${c.border}` }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            Back to App
          </a>
          <button
            aria-label="Search documentation"
            onClick={() => window.dispatchEvent(new Event("themys:open-docs-search"))}
            className="flex min-h-9 shrink-0 items-center gap-2 rounded-full px-2.5 text-sm transition sm:px-3"
            style={{ borderColor: c.searchBorder, backgroundColor: c.searchBg, color: c.searchText, border: `1px solid ${c.searchBorder}` }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <span className="hidden sm:inline">Search docs...</span>
            <kbd className="ml-2 hidden rounded px-1.5 py-0.5 text-[10px] font-mono md:block" style={{ backgroundColor: c.kbdBg, borderColor: c.kbdBorder, border: `1px solid ${c.kbdBorder}`, color: c.textMuted }}>⌘K</kbd>
          </button>
        </div>
      </header>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Documentation navigation">
          <button
            type="button"
            aria-label="Close documentation navigation"
            onClick={() => setSidebarOpen(false)}
            className="absolute inset-0 cursor-default"
            style={{ backgroundColor: "rgba(2, 6, 23, 0.62)" }}
          />
          <aside id="docs-navigation-mobile" className="relative h-full w-[min(20rem,86vw)] overflow-y-auto border-r px-5 py-7 shadow-2xl" style={{ backgroundColor: c.bg, borderColor: c.border }}>
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm font-semibold" style={{ color: c.text }}>Documentation</p>
              <button type="button" onClick={() => setSidebarOpen(false)} className="rounded-md p-2" aria-label="Close documentation navigation" style={{ color: c.textSec }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            <DocsSidebar onNavigate={() => setSidebarOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="mx-auto flex max-w-[1400px] gap-8 px-4 sm:px-6 lg:px-8">
        {/* Left sidebar */}
        {sidebarOpen ? (
          <aside id="docs-navigation-desktop" className="hidden w-[250px] shrink-0 py-8 lg:block">
            <DocsSidebar />
          </aside>
        ) : null}

        {/* Main content */}
        <main className="min-w-0 flex-1 py-8">
          {children}
        </main>

        {/* Right TOC spacer */}
        <div className="hidden xl:block w-[200px] shrink-0" />
      </div>
    </div>
  );
}
