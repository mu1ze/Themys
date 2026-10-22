/**
 * Display helpers for compliance UI.
 */

const REGULATION_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  GDPR:      { bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200",   dot: "bg-blue-500" },
  CCPA:      { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  CPRA:      { bg: "bg-teal-50",   text: "text-teal-700",   border: "border-teal-200",   dot: "bg-teal-500" },
  COPPA:     { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", dot: "bg-purple-500" },
  CAN_SPAM:  { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", dot: "bg-orange-500" },
  FTC_ACT:   { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200",  dot: "bg-amber-500" },
  ECPA:      { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", dot: "bg-indigo-500" },
  PIPEDA:    { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200",    dot: "bg-red-500" },
  UK_DPA:    { bg: "bg-sky-50",    text: "text-sky-700",    border: "border-sky-200",    dot: "bg-sky-500" },
  AU_PRIVACY:{ bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", dot: "bg-yellow-500" },
  DSA:       { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200", dot: "bg-violet-500" },
  DMA:       { bg: "bg-pink-50",   text: "text-pink-700",   border: "border-pink-200",   dot: "bg-pink-500" },
  EU_ECOMMERCE:{ bg: "bg-cyan-50", text: "text-cyan-700",   border: "border-cyan-200",   dot: "bg-cyan-500" },
  LGPD:      { bg: "bg-lime-50",   text: "text-lime-700",   border: "border-lime-200",   dot: "bg-lime-500" },
};

const DEFAULT_COLOR = { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200", dot: "bg-slate-500" };

/** Returns Tailwind color classes for a regulation code. */
export function getRegulationColor(code: string): { bg: string; text: string; border: string; dot: string } {
  return REGULATION_COLORS[code.toUpperCase()] ?? DEFAULT_COLOR;
}

/** Returns green/amber/red classes based on score thresholds. */
export function getScoreColor(score: number): { bar: string; text: string; bg: string } {
  if (score >= 80) {
    return { bar: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50" };
  }
  if (score >= 50) {
    return { bar: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50" };
  }
  return { bar: "bg-rose-500", text: "text-rose-700", bg: "bg-rose-50" };
}

/**
 * Normalize article ID for display.
 * e.g. 'art_6_1_a' -> 'Art. 6(1)(a)', 'Art. 6(1)(a)' -> 'Art. 6(1)(a)'
 */
export function formatArticleId(articleId: string): string {
  // Already formatted
  if (/^Art\.\s*\d/i.test(articleId)) return articleId;

  // Pattern: art_6_1_a or art_6_1_a_b
  const match = articleId.match(/^art(?:icle)?[_\s]?(\d+)(?:[_\s](\d+))?(?:[_\s]([a-z]))?$/i);
  if (match) {
    let result = `Art. ${match[1]}`;
    if (match[2]) result += `(${match[2]})`;
    if (match[3]) result += `(${match[3].toLowerCase()})`;
    return result;
  }

  // Numeric like 1798.100 -> Section 1798.100
  if (/^\d+\.\d+/.test(articleId)) return `§ ${articleId}`;

  return articleId;
}
