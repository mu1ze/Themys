"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { useTheme } from "@/lib/theme-context";
import { ThemeToggle } from "@/components/theme-toggle";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://themys.ca";

export function LegalShell({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const colors = dark
    ? { bg: "#0b1120", surface: "#111827", border: "#263244", text: "#f8fafc", muted: "#a4b0c2", accent: "#60a5fa" }
    : { bg: "#f8fafc", surface: "#ffffff", border: "#dbe3ee", text: "#0f172a", muted: "#526176", accent: "#2563eb" };

  return (
    <div
      className="min-h-screen"
      style={{
        background: colors.bg,
        color: colors.text,
        "--legal-border": colors.border,
        "--legal-surface": colors.surface,
        "--legal-muted": colors.muted,
      } as CSSProperties}
    >
      <header className="border-b" style={{ borderColor: colors.border, background: colors.surface }}>
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="Themys" className="h-7 w-7 rounded-[20%]" width={28} height={28} />
            Themys
          </Link>
          <span style={{ color: colors.muted }}>/</span>
          <span className="text-sm font-medium" style={{ color: colors.muted }}>Legal</span>
          <div className="flex-1" />
          <ThemeToggle />
          <a href={APP_URL} className="rounded-full border px-3 py-1.5 text-sm font-medium" style={{ borderColor: colors.border, color: colors.muted }}>
            Back to app
          </a>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">{children}</div>
    </div>
  );
}
