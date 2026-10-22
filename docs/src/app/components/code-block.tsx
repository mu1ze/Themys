'use client';

import { useState } from 'react';

export function CodeBlock({
  children,
  language,
}: {
  children: string;
  language?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="group relative my-4">
      {language && (
        <span className="absolute top-2 left-4 text-xs font-medium text-slate-500">
          {language}
        </span>
      )}
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-400 opacity-0 transition hover:bg-slate-700 hover:text-slate-200 group-hover:opacity-100"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <pre className="overflow-x-auto rounded-lg bg-[#0f172a] p-4 text-sm leading-relaxed text-slate-300">
        <code className={language ? `language-${language}` : undefined}>
          {children}
        </code>
      </pre>
    </div>
  );
}
