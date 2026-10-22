import "server-only"

import { createHash } from "node:crypto"

import { getLatestSnapshot, type TosSnapshot } from "@/lib/monitoring"

// ── Types ───────────────────────────────────────────────────────────────────

export type ChangeDetectionResult = {
  /** Whether the text has changed at all (hash comparison). */
  changed: boolean
  /** If changed, whether the change is meaningful (not cosmetic). */
  meaningful?: boolean
  /** The previous snapshot, provided when a meaningful change is detected. */
  oldSnapshot?: TosSnapshot
  /** The new text hash, provided when a change is detected. */
  newHash?: string
  /** The new word count, provided when a change is detected. */
  newWordCount?: number
}

// ── Layer 1: Text Hash (no LLM) ────────────────────────────────────────────

/**
 * Normalize text for stable hashing:
 * - lowercase
 * - collapse all whitespace (tabs, newlines, multiple spaces) to single space
 * - strip common HTML artifacts that don't affect content
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, "") // strip HTML tags
    .replace(/&[a-z]+;/gi, " ") // decode HTML entities to space
    .replace(/&#\d+;/gi, " ") // numeric HTML entities
    .replace(/\s+/g, " ") // collapse whitespace
    .trim()
}

/**
 * Compute SHA-256 hex digest of the normalized text.
 */
export function computeTextHash(text: string): string {
  const normalized = normalizeText(text)
  return createHash("sha256").update(normalized).digest("hex")
}

/**
 * Layer 1 check: compare the freshly computed hash against the latest snapshot's hash.
 */
export function hasTextChanged(
  newHash: string,
  latestSnapshotHash: string
): boolean {
  if (latestSnapshotHash === "initial-snapshot-no-text") return false;
  return newHash !== latestSnapshotHash
}

// ── Layer 2: Structural Diff (no LLM) ──────────────────────────────────────

/**
 * Compute the absolute word-count delta between two documents.
 */
export function computeWordCountDelta(
  newCount: number,
  oldCount: number
): number {
  return Math.abs(newCount - oldCount)
}

/**
 * Split text into sentences for Jaccard similarity.
 * Handles common sentence boundaries (. ! ? followed by space/newline).
 */
function splitIntoSentences(text: string): string[] {
  const normalized = normalizeText(text)
  return normalized
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/**
 * Compute Jaccard similarity at the sentence level.
 * J(A, B) = |A ∩ B| / |A ∪ B|
 *
 * Returns a value between 0 (completely different) and 1 (identical).
 */
export function computeJaccardSimilarity(
  text1: string,
  text2: string
): number {
  const sentences1 = splitIntoSentences(text1)
  const sentences2 = splitIntoSentences(text2)

  const set1 = new Set(sentences1)
  const set2 = new Set(sentences2)

  // Intersection: sentences present in both
  let intersectionSize = 0
  for (const sentence of set1) {
    if (set2.has(sentence)) intersectionSize++
  }

  // Union size = |A| + |B| - |A ∩ B|
  const unionSize = set1.size + set2.size - intersectionSize

  if (unionSize === 0) return 1 // both empty → identical

  return intersectionSize / unionSize
}

/**
 * Layer 2 check: determine if a change is merely cosmetic.
 *
 * A change is considered cosmetic when:
 * - Jaccard similarity > 0.95 (nearly identical sentence sets)
 * - Word-count delta < 50 words
 */
export function isCosmeticChange(
  jaccard: number,
  wordCountDelta: number
): boolean {
  return jaccard > 0.95 && wordCountDelta < 50
}

// ── Layer 3: Full Change Detection Pipeline ─────────────────────────────────

/**
 * Run the 3-layer change detection pipeline for a URL.
 *
 * 1. Fetch the latest snapshot from the DB
 * 2. Compute the new text hash
 * 3. Layer 1: If hash matches → no change
 * 4. Layer 2: If hash differs → compute Jaccard + word-count delta
 *    - Cosmetic change → { changed: true, meaningful: false }
 *    - Meaningful change → { changed: true, meaningful: true, oldSnapshot, newHash, newWordCount }
 *
 * Layer 3 (risk re-analysis with LLM) is handled by the caller,
 * since meaningful=true signals that a re-analysis is needed.
 */
export async function detectChanges(
  url: string,
  newText: string,
  newWordCount: number
): Promise<ChangeDetectionResult> {
  // 1. Get latest snapshot from DB
  const latestSnapshot = await getLatestSnapshot(url)

  // 2. Compute new text hash
  const newHash = computeTextHash(newText)

  // 3. Layer 1: No snapshot yet → treat as first scan (not a "change")
  if (!latestSnapshot) {
    return { changed: false }
  }

  // 4. Layer 1: Hash comparison
  if (!hasTextChanged(newHash, latestSnapshot.text_hash)) {
    return { changed: false }
  }

  // 5. Layer 2: Structural diff — use word-count delta as initial signal.
  //    Without the old text we can't compute true Jaccard.
  //    When old text IS available (e.g. passed in from the monitoring pipeline),
  //    callers should use detectChangesWithOldText for full Jaccard analysis.
  const oldWordCount = latestSnapshot.word_count ?? 0
  const wordCountDelta = computeWordCountDelta(newWordCount, oldWordCount)

  // Treat any hash change with < 50 word delta as cosmetic (proxy for Jaccard).
  const isCosmetic = wordCountDelta < 50

  if (isCosmetic) {
    return {
      changed: true,
      meaningful: false,
      newHash,
      newWordCount,
    }
  }

  // 6. Meaningful change — caller should trigger Layer 3 (risk re-analysis)
  return {
    changed: true,
    meaningful: true,
    oldSnapshot: latestSnapshot,
    newHash,
    newWordCount,
  }
}

/**
 * Extended detection variant that has access to the old text.
 * Computes true Jaccard similarity at the sentence level.
 *
 * Use this when the old extracted text is available (e.g. stored in cache).
 */
export async function detectChangesWithOldText(
  url: string,
  newText: string,
  newWordCount: number,
  oldText: string
): Promise<ChangeDetectionResult> {
  const latestSnapshot = await getLatestSnapshot(url)
  const newHash = computeTextHash(newText)

  if (!latestSnapshot) {
    return { changed: false }
  }

  if (!hasTextChanged(newHash, latestSnapshot.text_hash)) {
    return { changed: false }
  }

  const oldWordCount = latestSnapshot.word_count ?? 0
  const wordCountDelta = computeWordCountDelta(newWordCount, oldWordCount)
  const jaccard = computeJaccardSimilarity(newText, oldText)
  const cosmetic = isCosmeticChange(jaccard, wordCountDelta)

  if (cosmetic) {
    return {
      changed: true,
      meaningful: false,
      newHash,
      newWordCount,
    }
  }

  return {
    changed: true,
    meaningful: true,
    oldSnapshot: latestSnapshot,
    newHash,
    newWordCount,
  }
}
