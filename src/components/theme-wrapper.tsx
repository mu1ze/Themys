"use client";

import type { ReactNode } from "react";

export function ThemeWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--ds-bg)] text-[var(--ds-text)] transition-colors duration-300">
      {children}
    </div>
  );
}
