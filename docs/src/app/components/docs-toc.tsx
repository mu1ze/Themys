'use client';

import { useEffect, useState } from 'react';
import { useTheme } from '@/lib/theme-context';

type Heading = { id: string; text: string; level: number };

const C = {
  dark: { text: '#f9fafb', textSec: '#9ca3af', textMuted: '#6b7280', accent: '#2563eb', border: '#1f2937' },
  light: { text: '#0f172a', textSec: '#475569', textMuted: '#94a3b8', accent: '#2563eb', border: '#e2e8f0' },
};

export function DocsTOC({ headings }: { headings: Heading[] }) {
  const [activeId, setActiveId] = useState<string>('');
  const { theme } = useTheme();
  const c = C[theme];

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -80% 0px' }
    );

    for (const h of headings) {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  if (!headings.length) return null;

  return (
    <nav>
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: c.textMuted }}>
        On this page
      </p>
      <ul className="space-y-1">
        {headings.map((h) => {
          const isActive = h.id === activeId;
          return (
            <li key={h.id} style={{ marginLeft: h.level === 3 ? '12px' : '0' }}>
              <a
                href={`#${h.id}`}
                className="block py-1 text-sm transition"
                style={{ color: isActive ? c.accent : c.textMuted }}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                {h.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
