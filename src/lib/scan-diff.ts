/**
 * scan-diff.ts — Pure client-safe module for clause-level diff computation.
 * No server-only imports. Safe to use in both Server and Client Components.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type DiffClause = {
  id: string
  text: string
  category: string | null
  riskScore: number | null
  riskLevel: "green" | "yellow" | "red" | null
  explanation: string | null
  whyItMatters?: string | null
  recommendedAction?: string | null
  isFlagged?: boolean
}

export type ClauseDiffResult = {
  added: DiffClause[]       // In new scan, not in old
  removed: DiffClause[]     // In old scan, not in new
  changed: Array<{ old: DiffClause; new: DiffClause }> // Same category, different text
  unchanged: DiffClause[]   // Effectively the same
  riskDelta: number         // newScore - oldScore (positive = riskier)
  flaggedDelta: number      // newFlagged - oldFlagged
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function similarityScore(a: string, b: string): number {
  const na = normalizeText(a)
  const nb = normalizeText(b)

  if (na === nb) return 1

  // Jaccard at word level (fast approximation for short texts)
  const wordsA = new Set(na.split(" "))
  const wordsB = new Set(nb.split(" "))

  let intersection = 0
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++
  }

  const union = wordsA.size + wordsB.size - intersection
  return union === 0 ? 1 : intersection / union
}

// ─── Core Diff ──────────────────────────────────────────────────────────────

/**
 * Compare two arrays of clauses and classify each as added / removed / changed / unchanged.
 *
 * Matching strategy (in priority order):
 * 1. Same category + similarity > 0.85 → "unchanged"
 * 2. Same category + similarity 0.40–0.85 → "changed"
 * 3. Not matched → "added" (newClauses) or "removed" (oldClauses)
 */
export function diffClauses(
  oldClauses: DiffClause[],
  newClauses: DiffClause[],
  oldScore: number | null,
  newScore: number | null,
  oldFlagged: number,
  newFlagged: number,
): ClauseDiffResult {
  const UNCHANGED_THRESHOLD = 0.85
  const CHANGED_THRESHOLD = 0.40

  const matchedOld = new Set<string>()
  const matchedNew = new Set<string>()

  const added: DiffClause[] = []
  const removed: DiffClause[] = []
  const changed: Array<{ old: DiffClause; new: DiffClause }> = []
  const unchanged: DiffClause[] = []

  // Group new clauses by category for faster lookup
  const newByCategory = new Map<string, DiffClause[]>()
  for (const c of newClauses) {
    const key = c.category ?? "__none__"
    if (!newByCategory.has(key)) newByCategory.set(key, [])
    newByCategory.get(key)!.push(c)
  }

  // Try to match each old clause to a new clause
  for (const oldClause of oldClauses) {
    const key = oldClause.category ?? "__none__"
    const candidates = newByCategory.get(key) ?? []

    let bestScore = -1
    let bestCandidate: DiffClause | null = null

    for (const candidate of candidates) {
      if (matchedNew.has(candidate.id)) continue
      const score = similarityScore(oldClause.text, candidate.text)
      if (score > bestScore) {
        bestScore = score
        bestCandidate = candidate
      }
    }

    if (bestCandidate && bestScore >= UNCHANGED_THRESHOLD) {
      unchanged.push(bestCandidate)
      matchedOld.add(oldClause.id)
      matchedNew.add(bestCandidate.id)
    } else if (bestCandidate && bestScore >= CHANGED_THRESHOLD) {
      changed.push({ old: oldClause, new: bestCandidate })
      matchedOld.add(oldClause.id)
      matchedNew.add(bestCandidate.id)
    }
  }

  // Unmatched old → removed
  for (const c of oldClauses) {
    if (!matchedOld.has(c.id)) removed.push(c)
  }

  // Unmatched new → added
  for (const c of newClauses) {
    if (!matchedNew.has(c.id)) added.push(c)
  }

  return {
    added,
    removed,
    changed,
    unchanged,
    riskDelta: Math.round(((newScore ?? 0) - (oldScore ?? 0)) * 10) / 10,
    flaggedDelta: newFlagged - oldFlagged,
  }
}
