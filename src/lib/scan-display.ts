type ScanIdentity = {
  title?: string | null;
  url?: string | null;
  domain?: string | null;
};

export type ClauseLike = {
  category: string | null;
  riskLevel: "green" | "yellow" | "red" | null;
  riskScore?: number | null;
  text: string;
  explanation?: string | null;
  whyItMatters?: string | null;
  position?: number | null;
};

export type FlaggedClauseLike = {
  id?: string | null;
  riskLevel: ClauseLike["riskLevel"];
  isFlagged?: boolean;
  isTargetClause?: boolean;
};

const COMPANY_ALIASES: Record<string, string> = {
  doordash: "DoorDash",
  sentry: "Sentry",
  supabase: "Supabase",
  google: "Google",
  amazon: "Amazon",
  spotify: "Spotify",
  netflix: "Netflix",
  instagram: "Instagram",
  tiktok: "TikTok",
  twitter: "X",
  x: "X",
};

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function riskLevelRank(level: ClauseLike["riskLevel"]): number {
  if (level === "red") return 3;
  if (level === "yellow") return 2;
  return 1;
}

function clauseRichness(clause: ClauseLike): number {
  return (
    clause.text.length +
    (clause.explanation?.length ?? 0) +
    (clause.whyItMatters?.length ?? 0)
  );
}

export function extractHostname(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function formatClauseTitle(category: string | null): string {
  if (!category) {
    return "Risk clause";
  }

  if (category.includes(" ") && /[A-Z]/.test(category)) {
    return category.trim();
  }

  return category
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatCompanyName(scan: ScanIdentity): string {
  const hostname =
    extractHostname(scan.domain) ??
    extractHostname(scan.url) ??
    extractHostname(scan.title) ??
    null;

  if (!hostname) {
    return scan.title?.trim() || scan.domain?.trim() || "Untitled scan";
  }

  const parts = hostname.split(".").filter(Boolean);
  const baseLabel =
    parts.length >= 2 ? parts[parts.length - 2] : parts[0] ?? hostname;

  return (
    COMPANY_ALIASES[baseLabel] ??
    baseLabel
      .split(/[-_]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

export function buildCompanyLogoUrl(scan: ScanIdentity): string | null {
  const hostname =
    extractHostname(scan.domain) ??
    extractHostname(scan.url) ??
    extractHostname(scan.title) ??
    null;

  if (!hostname) return null;

  return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(hostname)}`;
}

function isBetterRepresentative(next: ClauseLike, current: ClauseLike): boolean {
  const levelDelta = riskLevelRank(next.riskLevel) - riskLevelRank(current.riskLevel);
  if (levelDelta !== 0) return levelDelta > 0;

  const scoreDelta = (next.riskScore ?? -1) - (current.riskScore ?? -1);
  if (scoreDelta !== 0) return scoreDelta > 0;

  const richnessDelta = clauseRichness(next) - clauseRichness(current);
  if (richnessDelta !== 0) return richnessDelta > 0;

  const nextPosition = next.position ?? Number.POSITIVE_INFINITY;
  const currentPosition = current.position ?? Number.POSITIVE_INFINITY;
  return nextPosition < currentPosition;
}

export function dedupeClausesByTitle<T extends ClauseLike>(clauses: T[]): T[] {
  const grouped = new Map<string, T>();

  for (const clause of clauses) {
    const key = `${normalize(formatClauseTitle(clause.category))}::${normalize(clause.text)}`;
    const existing = grouped.get(key);

    if (!existing || isBetterRepresentative(clause, existing)) {
      grouped.set(key, clause);
    }
  }

  return Array.from(grouped.values());
}

export function isFlaggedClause(clause: FlaggedClauseLike): boolean {
  if (clause.isTargetClause) return true;
  const isGreenRight = clause.riskLevel === "green" || clause.id?.startsWith("aur-") === true;
  return !isGreenRight && Boolean(
    clause.isFlagged || clause.riskLevel === "red" || clause.riskLevel === "yellow",
  );
}
