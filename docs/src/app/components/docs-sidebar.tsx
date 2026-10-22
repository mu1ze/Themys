'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/lib/theme-context';

interface SidebarPage {
  slug: string;
  title: string;
}

interface SidebarSection {
  title: string;
  pages: SidebarPage[];
}

const sidebarSections: SidebarSection[] = [
  {
    title: 'Getting Started',
    pages: [
      { slug: 'quick-start', title: 'Quick Start' },
      { slug: 'installation', title: 'Installation' },
      { slug: 'understanding-results', title: 'Understanding Results' },
    ],
  },
  {
    title: 'For Users',
    pages: [
      { slug: 'risk-scoring', title: 'Risk Scoring' },
      { slug: 'extraction', title: 'Extraction View' },
      { slug: 'account', title: 'Account & Settings' },
      { slug: 'monitoring', title: 'Monitoring' },
    ],
  },
  {
    title: 'For Developers',
    pages: [
      { slug: 'api-overview', title: 'API Overview' },
      { slug: 'api-keys', title: 'API Keys' },
      { slug: 'api-extract', title: 'POST /api/extract' },
      { slug: 'api-analyze', title: 'POST /api/analyze' },
      { slug: 'api-batch', title: 'POST /api/analyze/batch' },
    ],
  },
  {
    title: 'Resources',
    pages: [
      { slug: 'faq', title: 'FAQ' },
      { slug: 'changelog', title: 'Changelog' },
      { slug: 'legal#privacy', title: 'Privacy Policy' },
      { slug: 'legal#terms', title: 'Terms of Service' },
    ],
  },
];

const C = {
  dark: { text: '#f9fafb', textSec: '#9ca3af', textMuted: '#6b7280', accent: '#2563eb', hoverBg: '#1f2937', activeBg: 'rgba(37,99,235,0.15)', border: '#1f2937' },
  light: { text: '#0f172a', textSec: '#475569', textMuted: '#94a3b8', accent: '#2563eb', hoverBg: '#f1f5f9', activeBg: 'rgba(37,99,235,0.1)', border: '#e2e8f0' },
};

export function DocsSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const currentSlug = pathname.split('/').pop() ?? '';
  const { theme } = useTheme();
  const c = C[theme];
  const [currentHash, setCurrentHash] = useState('');

  useEffect(() => {
    const syncHash = () => setCurrentHash(window.location.hash);
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const section of sidebarSections) {
      const hasActive = section.pages.some((p) => p.slug.split('#')[0] === currentSlug);
      initial[section.title] = hasActive;
    }
    return initial;
  });

  function toggleSection(title: string) {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  }

  return (
    <nav aria-label="Documentation navigation" className="w-64 shrink-0 pr-8">
      <ul className="space-y-1">
        {sidebarSections.map((section) => {
          const open = openSections[section.title] ?? false;
          return (
            <li key={section.title}>
              <button
                onClick={() => toggleSection(section.title)}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 font-semibold transition"
                style={{ color: c.textSec }}
              >
                <span className="text-xs uppercase tracking-wider">{section.title}</span>
                <svg
                  className={`h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
              {open && (
                <ul className="mt-1 ml-3 space-y-0.5 border-l pl-3" style={{ borderColor: c.border }}>
                  {section.pages.map((page) => {
                    const pagePath = page.slug.split('#')[0];
                    const isHashLink = page.slug.includes('#');
                    const isActive = pagePath === currentSlug
                      && (!isHashLink || (currentHash.length > 0 && page.slug.endsWith(currentHash)));
                    return (
                      <li key={page.slug}>
                        <Link
                          href={`/${page.slug}`}
                          onClick={onNavigate}
                          className="block rounded-md px-3 py-1.5 text-sm transition"
                          style={{
                            color: isActive ? c.accent : c.textMuted,
                            backgroundColor: isActive ? c.activeBg : 'transparent',
                          }}
                        >
                          {page.title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
