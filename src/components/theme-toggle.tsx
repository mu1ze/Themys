"use client";

import { useTheme } from "@/lib/theme-context";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      className="relative h-8 w-8 shrink-0 rounded-full transition-all duration-500"
      style={{
        background: "var(--ds-card-hover)",
        border: "1px solid var(--ds-border)",
      }}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2"
      >
        <g
          className="origin-center transition-all duration-500"
          style={{
            transform: isDark ? "rotate(180deg) scale(0)" : "rotate(0deg) scale(1)",
            opacity: isDark ? 0 : 1,
          }}
        >
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <line
              key={deg}
              x1="12"
              y1="2"
              x2="12"
              y2="4"
              stroke="var(--ds-text)"
              strokeWidth="2"
              strokeLinecap="round"
              style={{
                transform: `rotate(${deg}deg)`,
                transformOrigin: "12px 12px",
              }}
            />
          ))}
        </g>
        <g className="origin-center transition-all duration-500">
          <circle
            cx="12"
            cy="12"
            r="5"
            className="transition-all duration-500"
            fill="var(--ds-text)"
            stroke="var(--ds-text)"
            strokeWidth="1"
          />
          <circle
            cx={isDark ? "14" : "10"}
            cy={isDark ? "10" : "12"}
            r={isDark ? "4" : "5"}
            className="transition-all duration-500"
            fill="var(--ds-card-hover)"
          />
        </g>
      </svg>
    </button>
  );
}
