import { type ReactNode } from 'react';

type CalloutType = 'info' | 'warning' | 'tip' | 'danger';

const config: Record<CalloutType, { border: string; bg: string; icon: ReactNode }> = {
  info: {
    border: 'border-l-blue-500',
    bg: 'bg-blue-500/5',
    icon: (
      <svg className="h-5 w-5 shrink-0 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
      </svg>
    ),
  },
  warning: {
    border: 'border-l-yellow-500',
    bg: 'bg-yellow-500/5',
    icon: (
      <svg className="h-5 w-5 shrink-0 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1 1 0 002.54 20h16.92a1 1 0 00.85-1.28l-8.6-14.86a1 1 0 00-1.72 0z" />
      </svg>
    ),
  },
  tip: {
    border: 'border-l-green-500',
    bg: 'bg-green-500/5',
    icon: (
      <svg className="h-5 w-5 shrink-0 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  danger: {
    border: 'border-l-red-500',
    bg: 'bg-red-500/5',
    icon: (
      <svg className="h-5 w-5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 2l10 18H2L12 2z" />
      </svg>
    ),
  },
};

export function Callout({ type, children }: { type: CalloutType; children: ReactNode }) {
  const c = config[type];
  return (
    <div className={`my-4 flex gap-3 rounded-xl border-l-4 ${c.border} ${c.bg} p-4`}>
      {c.icon}
      <div className="prose prose-sm prose-invert min-w-0 text-slate-300 [&>p]:m-0">
        {children}
      </div>
    </div>
  );
}
