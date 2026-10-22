export type SidebarItem = {
  slug: string;
  title: string;
  order: number;
};

export type SidebarSection = {
  title: string;
  items: SidebarItem[];
};

export const sidebar: SidebarSection[] = [
  {
    title: "Getting Started",
    items: [
      { slug: "quick-start", title: "Quick Start", order: 1 },
      { slug: "installation", title: "Installation", order: 2 },
      { slug: "understanding-results", title: "Understanding Results", order: 3 },
    ],
  },
  {
    title: "For Users",
    items: [
      { slug: "risk-scoring", title: "Risk Scoring", order: 4 },
      { slug: "extraction", title: "Extraction View", order: 5 },
      { slug: "account", title: "Account & Settings", order: 6 },
      { slug: "monitoring", title: "Monitoring", order: 7 },
    ],
  },
  {
    title: "For Developers",
    items: [
      { slug: "api-overview", title: "API Overview", order: 8 },
      { slug: "api-keys", title: "API Keys", order: 9 },
      { slug: "api-extract", title: "POST /api/extract", order: 10 },
      { slug: "api-analyze", title: "POST /api/analyze", order: 11 },
      { slug: "api-batch", title: "POST /api/analyze/batch", order: 12 },
    ],
  },
  {
    title: "Resources",
    items: [
      { slug: "faq", title: "FAQ", order: 14 },
      { slug: "changelog", title: "Changelog", order: 15 },
    ],
  },
];

export function getAllSlugs(): string[] {
  return sidebar.flatMap((s) => s.items.map((i) => i.slug));
}

export function getAdjacentPages(slug: string): { prev: SidebarItem | null; next: SidebarItem | null } {
  const all = sidebar.flatMap((s) => s.items).sort((a, b) => a.order - b.order);
  const idx = all.findIndex((i) => i.slug === slug);
  return {
    prev: idx > 0 ? all[idx - 1] : null,
    next: idx < all.length - 1 ? all[idx + 1] : null,
  };
}
