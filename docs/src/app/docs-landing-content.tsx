"use client";

import Link from "next/link";
import { useTheme } from "@/lib/theme-context";

type DocMeta = { slug: string; title: string; description: string; order: number };
type SidebarSection = { title: string; items: { slug: string; title: string; order: number }[] };

const C = {
  dark: { text: "#f9fafb", textSec: "#9ca3af", textMuted: "#6b7280", accent: "#2563eb", border: "#1f2937", card: "#111827", cardHover: "#1a2332" },
  light: { text: "#0f172a", textSec: "#475569", textMuted: "#94a3b8", accent: "#2563eb", border: "#e2e8f0", card: "#ffffff", cardHover: "#f8fafc" },
};

export function DocsLandingContent({ docs, sidebarSections }: { docs: DocMeta[]; sidebarSections: SidebarSection[] }) {
  const { theme } = useTheme();
  const c = C[theme];

  return (
    <div className="max-w-3xl">
      <h1 className="text-4xl font-medium tracking-[-0.04em]" style={{ color: c.text }}>Documentation</h1>
      <p className="mt-4 text-lg leading-8" style={{ color: c.textSec }}>
        Everything you need to use Themys — from your first web-app scan to integrating the API. The Chrome extension is coming soon.
      </p>

      <div className="mt-10 space-y-10">
        {sidebarSections.map((section) => (
          <div key={section.title}>
            <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: c.textMuted }}>
              {section.title}
            </h2>
            <div className="grid border-y sm:grid-cols-2" style={{ borderColor: c.border }}>
              {section.items.map((item) => {
                const doc = docs.find((d) => d.slug === item.slug);
                return (
                  <Link
                    key={item.slug}
                    href={`/${item.slug}`}
                    className="group border-b p-4 transition hover:bg-[var(--ds-card-hover)] sm:odd:border-r"
                    style={{ borderColor: c.border }}
                  >
                    <h3 className="text-sm font-medium group-hover:text-[#2563eb]" style={{ color: c.text }}>
                      {item.title}
                    </h3>
                    {doc?.description && (
                      <p className="mt-1 text-xs leading-5 line-clamp-2" style={{ color: c.textMuted }}>
                        {doc.description}
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
