'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';

type SearchResult = {
  slug: string;
  title: string;
  description: string;
  section: string;
  snippet: string;
};

const DOCS_INDEX: SearchResult[] = [
  { slug: 'quick-start', title: 'Quick Start', description: 'Get up and running with the Themys web app in minutes', section: 'Getting Started', snippet: 'Create an account and scan your first Terms of Service' },
  { slug: 'installation', title: 'Installation', description: 'Use the Themys web app today; the Chrome extension is coming soon', section: 'Getting Started', snippet: 'Web app account setup and the future extension release' },
  { slug: 'understanding-results', title: 'Understanding Results', description: 'How to read the six scan result views', section: 'Getting Started', snippet: 'Summary, flagged clauses, actionable insights, compliance, extraction, full document' },
  { slug: 'risk-scoring', title: 'Attention Levels', description: 'How to use Themys review guidance', section: 'For Users', snippet: 'Categories: data privacy, arbitration, liability, content IP, billing, account' },
  { slug: 'extraction', title: 'Extraction View', description: 'Read generated sections and compare them with the full document', section: 'For Users', snippet: 'Sections, key points, quotes, original wording, full document' },
  { slug: 'account', title: 'Account & Settings', description: 'Manage your profile, subscription, and preferences', section: 'For Users', snippet: 'Profile editing, plan management, credit balance, invoice history, delete account' },
  { slug: 'monitoring', title: 'Monitoring', description: 'Track legal documents and manage change alerts', section: 'For Users', snippet: 'Document limits, email alerts, notification preferences, unsubscribe' },
  { slug: 'api-overview', title: 'API Overview', description: 'Public endpoints and authentication for supported integrations', section: 'For Developers', snippet: 'API key, REST endpoints, JSON responses' },
  { slug: 'api-keys', title: 'API Keys', description: 'Create, scope, revoke, and monitor API keys', section: 'For Developers', snippet: 'tmys API keys, extract and analyze scopes, key rotation, usage tracking' },
  { slug: 'api-extract', title: 'POST /api/extract', description: 'Extract text from a Terms of Service URL', section: 'For Developers', snippet: 'Public URL, clean text, word count' },
  { slug: 'api-analyze', title: 'POST /api/analyze', description: 'Analyze Terms of Service text for review guidance', section: 'For Developers', snippet: 'Attention guidance, flagged clauses, extraction' },
  { slug: 'api-batch', title: 'POST /api/analyze/batch', description: 'Analyze up to five Terms items in one request', section: 'For Developers', snippet: 'Batch API and per-item results' },
  { slug: 'faq', title: 'FAQ', description: 'Frequently asked questions about Themys', section: 'Resources', snippet: 'How accurate is the analysis, data privacy, extension permissions, billing questions' },
  { slug: 'changelog', title: 'Changelog', description: 'What\'s new in Themys', section: 'Resources', snippet: 'Latest features, bug fixes, improvements, version history' },
  { slug: 'legal#privacy', title: 'Privacy Policy', description: 'How Themys collects, processes, retains, and deletes data', section: 'Resources', snippet: 'Providers, AI processing, monitoring, retention, privacy rights, account deletion' },
  { slug: 'legal#terms', title: 'Terms of Service', description: 'Terms that govern use of Themys', section: 'Resources', snippet: 'Automated analysis, accounts, monitoring, payments, cancellation, liability' },
];

function searchDocs(query: string): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return DOCS_INDEX.filter((doc) =>
    doc.title.toLowerCase().includes(q) ||
    doc.description.toLowerCase().includes(q) ||
    doc.snippet.toLowerCase().includes(q) ||
    doc.section.toLowerCase().includes(q)
  ).slice(0, 8);
}

export function SearchModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const results = useMemo(() => searchDocs(query), [query]);

  // Open on ⌘K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setIsOpen(false);
    }
    function handleOpenRequest() {
      setIsOpen(true);
    }
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('themys:open-docs-search', handleOpenRequest);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('themys:open-docs-search', handleOpenRequest);
    };
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      setQuery('');
      setActiveIndex(0);
      inputRef.current?.focus();
    }, 50);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  const navigateTo = useCallback((slug: string) => {
    setIsOpen(false);
    router.push(`/${slug}`);
  }, [router]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      navigateTo(results[activeIndex].slug);
    }
  }, [results, activeIndex, navigateTo]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

      {/* Modal */}
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search documentation..."
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
          />
          <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-2">
          {query.trim() === '' ? (
            <div className="px-3 py-8 text-center text-sm text-slate-400">
              Type to search documentation...
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-slate-400">
              No results found for &quot;{query}&quot;
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((result, idx) => (
                <button
                  key={result.slug}
                  onClick={() => navigateTo(result.slug)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`w-full rounded-lg px-3 py-2.5 text-left transition ${
                    idx === activeIndex ? 'bg-blue-50 text-blue-900' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-400">{result.section}</span>
                    <span className="text-xs text-slate-300">/</span>
                    <span className="text-sm font-semibold">{result.title}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{result.description}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
          <span className="flex items-center gap-1"><kbd className="rounded border border-slate-200 px-1 py-0.5 font-mono">↑↓</kbd> navigate</span>
          <span className="flex items-center gap-1"><kbd className="rounded border border-slate-200 px-1 py-0.5 font-mono">↵</kbd> open</span>
          <span className="flex items-center gap-1"><kbd className="rounded border border-slate-200 px-1 py-0.5 font-mono">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
