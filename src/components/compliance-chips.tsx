"use client";

import { cn } from "@/lib/cn";
import { getRegulationColor, formatArticleId } from "@/lib/compliance-display";
import { Tooltip } from "@/components/tooltip";
import type { ComplianceTagRef } from "@/lib/compliance-shared";

type ComplianceChipsProps = {
  tags: ComplianceTagRef[];
  maxVisible?: number;
};

export function ComplianceChips({ tags, maxVisible = 3 }: ComplianceChipsProps) {
  const filtered = tags.filter((t) => t.relevance >= 0.5);

  if (filtered.length === 0) return null;

  const visible = filtered.slice(0, maxVisible);
  const overflow = filtered.length - maxVisible;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((tag, i) => (
        <ComplianceChip key={`${tag.regulationCode}-${tag.articleId}-${i}`} tag={tag} />
      ))}
      {overflow > 0 && (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ border: '1px solid var(--ds-border)', background: 'var(--ds-card-hover)', color: 'var(--ds-text-muted)' }}>
          +{overflow} more
        </span>
      )}
    </div>
  );
}

function ComplianceChip({ tag }: { tag: ComplianceTagRef }) {
  const colors = getRegulationColor(tag.regulationCode);
  const displayArticle = formatArticleId(tag.articleId);
  const label = `${tag.regulationCode} ${displayArticle}`;

  return (
    <Tooltip
      side="top"
      contentClassName="max-w-[320px]"
      label={
        <span className="block max-w-[320px] whitespace-normal px-1 py-0.5">
          <span className="block font-semibold">{tag.articleTitle}</span>
          {tag.quote && (
            <span className="mt-1.5 block border-l-2 pl-2 italic" style={{ borderColor: 'var(--ds-accent)', color: 'var(--ds-text-secondary)' }}>
              &ldquo;{tag.quote}&rdquo;
            </span>
          )}
          <span className="mt-1 block" style={{ color: 'var(--ds-text-muted)' }}>
            Relevance: {Math.round(tag.relevance * 100)}%
          </span>
        </span>
      }
    >
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-tight cursor-default transition-colors",
          colors.bg, colors.text, colors.border
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", colors.dot)} />
        {label}
      </span>
    </Tooltip>
  );
}
