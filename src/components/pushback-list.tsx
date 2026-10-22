"use client";

import { CopyButton } from "@/components/copy-button";
import { cn } from "@/lib/cn";
import type { PushbackItem } from "@/lib/pushback";

type PushbackListProps = {
  items: PushbackItem[];
  vendor: string;
  className?: string;
};

function buildEmailBody(items: PushbackItem[]): string {
  const asks = items.map((item, index) => `${index + 1}. ${item.suggestedAsk}`).join("\n");
  return asks;
}

export function buildPushbackEmail(vendor: string, items: PushbackItem[]): string {
  const subject = `Subject: Terms questions — ${vendor}`;
  const body = buildEmailBody(items);
  return body ? `${subject}\n\n${body}` : subject;
}

export function PushbackList({ items, vendor, className }: PushbackListProps) {
  const emailText = buildPushbackEmail(vendor, items);

  return (
    <section
      className={cn(
        "rounded-xl border border-[var(--ds-border)] bg-transparent p-5 md:p-6",
        className
      )}
      aria-labelledby="pushback-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="pushback-heading"
            className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--ds-text-muted)]"
          >
            Pushback
          </h2>
          <p className="mt-2 text-sm text-[var(--ds-text-secondary)]">
            Suggested asks to send before you sign or renew.
          </p>
        </div>
        {items.length > 0 && (
          <CopyButton
            value={emailText}
            label="Copy all as email"
            copiedLabel="Copied"
            className="shrink-0"
          />
        )}
      </div>

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--ds-text-muted)]">
          No suggested asks yet. Review flagged clauses below for context.
        </p>
      ) : (
        <ol className="mt-6 space-y-4">
          {items.map((item, index) => (
            <li
              key={item.clauseId ?? index}
              className="rounded-lg border border-[var(--ds-border)] bg-[var(--ds-card-hover)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="font-mono text-[10px] tracking-widest text-[var(--ds-text-muted)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <CopyButton
                  value={item.suggestedAsk}
                  label="Copy ask"
                  copiedLabel="Copied"
                  className="shrink-0"
                />
              </div>
              <blockquote className="mt-3 border-l-2 border-[var(--ds-border-hover)] pl-3 text-sm italic leading-6 text-[var(--ds-text-secondary)]">
                &ldquo;{item.quote}&rdquo;
              </blockquote>
              <p className="mt-3 text-sm leading-6 text-[var(--ds-text-secondary)]">
                <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--ds-text-muted)]">
                  Why it matters
                </span>
                <span className="mt-1 block">{item.whyItMatters}</span>
              </p>
              <p className="mt-3 text-sm leading-6 text-[var(--ds-text)]">
                <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--ds-text-muted)]">
                  Suggested ask
                </span>
                <span className="mt-1 block font-medium">{item.suggestedAsk}</span>
              </p>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-6 text-xs leading-5 text-[var(--ds-text-muted)]">
        This is not legal advice.
      </p>
    </section>
  );
}
