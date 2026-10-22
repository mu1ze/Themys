"use client";

import { useEffect, useMemo, useRef } from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/cn";

type RawDocumentViewerProps = {
  text: string;
  highlightText?: string | null;
  mode?: "embedded" | "focus" | "page";
  compact?: boolean;
};

// Collapse all whitespace runs to single spaces and normalize curly quotes /
// dashes so that clause text extracted by the LLM still lines up with the raw
// source document even when their whitespace or punctuation differs slightly.
function normalizeForMatch(value: string): string {
  return value
    .replace(/[‘’´‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

// Build a map from normalized-index → original-index so we can translate a
// match found in the normalized string back into offsets in the real text.
function buildIndexMap(original: string): number[] {
  const map: number[] = [];
  let collapsed = false;
  for (let i = 0; i < original.length; i++) {
    const ch = original[i];
    const isSpace = /\s/.test(ch);
    if (isSpace) {
      if (collapsed) continue; // skip — this char maps to nothing
      collapsed = true;
      // Only emit a space if we already have content (avoid leading space).
      if (map.length > 0) {
        map.push(i);
      }
      continue;
    }
    collapsed = false;
    map.push(i);
  }
  return map;
}

export function RawDocumentViewer({
  text,
  highlightText,
  mode = "embedded",
  compact = false,
}: RawDocumentViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLElement>(null);

  // Locate the highlight span inside the raw text. Returns [start, end) in the
  // ORIGINAL string, or null when no reasonable match can be found.
  const matchSpan = useMemo<[number, number] | null>(() => {
    if (!highlightText) return null;

    const needle = normalizeForMatch(highlightText);
    if (!needle) return null;

    const normalizedText = normalizeForMatch(text);
    const indexMap = buildIndexMap(text);

    const normStart = normalizedText.indexOf(needle);
    if (normStart !== -1) {
      const origStart = indexMap[normStart];
      const origEnd =
        normStart + needle.length - 1 < indexMap.length
          ? indexMap[normStart + needle.length - 1] + 1
          : text.length;
      if (origStart !== undefined) return [origStart, origEnd];
    }

    // Fallback: match on the longest distinctive word run of the clause. This
    // handles cases where the extraction includes/excludes surrounding text.
    // Attempts are capped so very large documents can't trigger hundreds of
    // full-text indexOf scans on a single locate action.
    const words = needle.split(" ").filter((w) => w.length > 3);
    let result: [number, number] | null = null;
    let attempts = 0;
    for (let len = Math.min(6, words.length); !result && len >= 2 && attempts <= 24; len--) {
      for (let s = 0; !result && s + len <= words.length; s++) {
        attempts++;
        const phrase = words.slice(s, s + len).join(" ");
        const at = normalizedText.indexOf(phrase);
        if (at !== -1) {
          const origStart = indexMap[at];
          const origEnd =
            at + phrase.length - 1 < indexMap.length
              ? indexMap[at + phrase.length - 1] + 1
              : text.length;
          if (origStart !== undefined) result = [origStart, origEnd];
        }
      }
    }

    return result;
  }, [text, highlightText]);

  useEffect(() => {
    if (highlightText && markRef.current) {
      markRef.current.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    }
  }, [highlightText]);

  // Render the document text, wrapping the matched span (if any) in a <mark>.
  const renderText = () => {
    if (!matchSpan) {
      return text;
    }
    const [start, end] = matchSpan;
    const before = text.slice(0, start);
    const match = text.slice(start, end);
    const after = text.slice(end);
    return (
      <>
        {before}
        <mark
          ref={markRef}
          className="bg-[var(--ds-warning)]/30 text-[var(--ds-text)] rounded px-1 -mx-1 font-semibold transition-all"
        >
          {match}
        </mark>
        {after}
      </>
    );
  };

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden border border-[var(--ds-border)] bg-[var(--ds-card)] shadow-sm",
        mode === "focus"
          ? "h-full max-h-none rounded-none border-0 shadow-none"
          : mode === "page"
            ? "rounded-2xl"
            : "max-h-[70vh] rounded-2xl lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)]"
      )}
    >
      <div className={cn("border-b border-[var(--ds-border)] bg-[var(--ds-card-hover)]", compact ? "p-2.5" : "p-4")}>
        <h3 className={cn(
          "flex items-center gap-2 font-medium uppercase tracking-[0.2em] text-[var(--ds-text-muted)]",
          "text-[10px] sm:text-[11px]",
        )}>
          <FileText className={compact ? "h-3 w-3" : "h-4 w-4"} />
          Original Document
        </h3>
      </div>
      <div
        ref={containerRef}
        className={cn(
          "flex-1 overflow-y-auto whitespace-pre-wrap break-words font-[family-name:var(--ds-doc-font)] leading-[1.8] text-[var(--ds-text-secondary)] selection:bg-[var(--ds-accent)]/20",
          compact ? "p-3 text-[13px]" : "p-4 text-[14px] sm:p-6 sm:text-[15px]",
        )}
      >
        {renderText()}
      </div>
    </div>
  );
}
