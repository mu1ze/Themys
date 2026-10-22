'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/lib/theme-context';

type FeedbackWidgetProps = {
  slug: string;
};

const C = {
  dark: { text: '#f9fafb', textSec: '#9ca3af', textMuted: '#6b7280', accent: '#2563eb', border: '#1f2937', card: '#111827', input: '#1e293b', successBg: 'rgba(16,185,129,0.1)', successBorder: '#10b981', successText: '#6ee7b7' },
  light: { text: '#0f172a', textSec: '#475569', textMuted: '#94a3b8', accent: '#2563eb', border: '#e2e8f0', card: '#f8fafc', input: '#ffffff', successBg: '#f0fdf4', successBorder: '#86efac', successText: '#166534' },
};
const FEEDBACK_API_URL = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://themys.ca'}/api/docs/feedback`;

export function FeedbackWidget({ slug }: FeedbackWidgetProps) {
  const [sent, setSent] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challengeSiteKey, setChallengeSiteKey] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [pendingHelpful, setPendingHelpful] = useState<boolean | null>(null);
  const challengeRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const c = C[theme];

  useEffect(() => {
    if (!challengeSiteKey || !challengeRef.current) return;

    let cancelled = false;
    const render = () => {
      if (cancelled || !challengeRef.current || !window.turnstile) return;
      challengeRef.current.replaceChildren();
      window.turnstile.render(challengeRef.current, {
        sitekey: challengeSiteKey,
        callback: (token: string) => setTurnstileToken(token),
        'expired-callback': () => setTurnstileToken(null),
        theme,
      });
    };

    if (window.turnstile) {
      render();
      return () => { cancelled = true; };
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-themys-turnstile]');
    const script = existing ?? document.createElement('script');
    script.addEventListener('load', render, { once: true });
    if (!existing) {
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.themysTurnstile = 'true';
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      script.removeEventListener('load', render);
    };
  }, [challengeSiteKey, showForm, theme]);

  async function handleFeedback(helpful: boolean) {
    setSending(true);
    setError(null);
    setPendingHelpful(helpful);
    try {
      const deviceId = getFeedbackDeviceId();
      const response = await fetch(FEEDBACK_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          helpful,
          comment: helpful ? null : comment,
          deviceId,
          turnstileToken,
        }),
      });
      const body = await response.json().catch(() => ({})) as {
        error?: string;
        code?: string;
        siteKey?: string;
      };
      if (response.status === 403 && body.code === 'challenge_required' && body.siteKey) {
        setChallengeSiteKey(body.siteKey);
        setTurnstileToken(null);
        return;
      }
      if (!response.ok) {
        setError(body.error ?? 'Feedback could not be saved. Please try again.');
        return;
      }
      setSent(true);
    } catch {
      setError('Feedback could not be saved. Please try again.');
    } finally {
      setSending(false);
    }
  }

  const challenge = challengeSiteKey ? (
    <div className="mt-4 space-y-3">
      <p className="text-sm" style={{ color: c.textSec }}>Please verify you are human before submitting again.</p>
      <div ref={challengeRef} className="flex min-h-[65px] justify-center" />
      <button
        type="button"
        onClick={() => handleFeedback(pendingHelpful ?? false)}
        disabled={sending || !turnstileToken}
        className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
        style={{ backgroundColor: c.accent }}
      >
        {sending ? 'Sending...' : 'Submit verified feedback'}
      </button>
    </div>
  ) : null;

  if (sent) {
    return (
      <div className="mt-8 rounded-xl p-6 text-center" style={{ border: `1px solid ${c.successBorder}`, backgroundColor: c.successBg }}>
        <p className="text-sm font-medium" style={{ color: c.successText }}>Thanks for your feedback!</p>
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="mt-8 rounded-xl p-6" style={{ border: `1px solid ${c.border}`, backgroundColor: c.card }}>
        <p className="text-sm font-semibold mb-3" style={{ color: c.text }}>What could be improved?</p>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Tell us what was confusing, missing, or wrong..."
          rows={3}
          maxLength={1000}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none transition resize-none"
          style={{ border: `1px solid ${c.border}`, backgroundColor: c.input, color: c.text }}
        />
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => handleFeedback(false)}
            disabled={sending}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
            style={{ backgroundColor: c.accent }}
          >
            {sending ? 'Sending...' : 'Submit'}
          </button>
          <button
            onClick={() => setShowForm(false)}
            className="rounded-lg px-4 py-2 text-sm font-medium transition"
            style={{ border: `1px solid ${c.border}`, backgroundColor: c.card, color: c.textSec }}
          >
            Cancel
          </button>
        </div>
        {challenge}
        {error ? <p role="alert" className="mt-3 text-sm text-red-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-xl p-6 text-center" style={{ border: `1px solid ${c.border}`, backgroundColor: c.card }}>
      <p className="text-sm" style={{ color: c.textSec }}>Was this page helpful?</p>
      <div className="mt-3 flex justify-center gap-3">
        <button
          onClick={() => handleFeedback(true)}
          className="rounded-lg px-4 py-2 text-sm font-medium transition"
          style={{ border: `1px solid ${c.border}`, backgroundColor: c.card, color: c.text }}
        >
          👍 Yes
        </button>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg px-4 py-2 text-sm font-medium transition"
          style={{ border: `1px solid ${c.border}`, backgroundColor: c.card, color: c.text }}
        >
          👎 No
        </button>
      </div>
      {challenge}
      {error ? <p role="alert" className="mt-3 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function getFeedbackDeviceId(): string {
  const key = 'themys-feedback-device';
  const existing = window.localStorage.getItem(key);
  if (existing && /^[a-zA-Z0-9_-]{16,80}$/.test(existing)) return existing;
  const created = crypto.randomUUID().replaceAll('-', '');
  window.localStorage.setItem(key, created);
  return created;
}

declare global {
  interface Window {
    turnstile?: {
      render(
        container: HTMLElement,
        options: {
          sitekey: string;
          callback(token: string): void;
          'expired-callback'(): void;
          theme: 'light' | 'dark';
        },
      ): string;
    };
  }
}
