"use client"

import { useTheme } from "@/lib/theme-context"

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === "dark"

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex h-9 w-9 items-center justify-center rounded-full border transition"
      style={{
        background: isDark ? "#141e35" : "#e8eef8",
        borderColor: isDark ? "#1c2a47" : "#d0daea",
        color: isDark ? "#93c5fd" : "#b45309",
      }}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      <span aria-hidden="true">{isDark ? "☾" : "☀"}</span>
    </button>
  )
}
