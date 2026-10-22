import { mapWithConcurrency, segmentDocumentIntoClauseSpans } from "./jev-scan-core.ts"

export const STRICT_SCAN_MAX_CHARS_PER_CHUNK = 12_000
export const STRICT_SCAN_MAX_CONCURRENCY = 3

export type StrictScanChunk = {
  index: number
  start: number
  end: number
  text: string
}

export type StrictCandidateFlag = {
  category: string
  text: string
  isTargetClause?: boolean
}

export type StrictGroundedFlag<T extends StrictCandidateFlag> = T & {
  isTargetClause: true
  sourceStart: number
  sourceEnd: number
  sourceChunk: number
}

export type StrictScanDiagnostics = {
  sourceChars: number
  sourceClauses: number
  chunksTotal: number
  chunksAnalyzed: number
  coveredChars: number
  rejectedNonTarget: number
  rejectedUngrounded: number
  groundingRepairs: number
  duplicatesRemoved: number
}

export type StrictScanOutput<T extends StrictCandidateFlag> = {
  flags: StrictGroundedFlag<T>[]
  diagnostics: StrictScanDiagnostics
}

function preferredBreak(source: string, start: number, hardEnd: number): number {
  if (hardEnd >= source.length) return source.length

  const minimum = start + Math.floor((hardEnd - start) * 0.6)
  const window = source.slice(minimum, hardEnd)
  const paragraph = window.lastIndexOf("\n\n")
  if (paragraph >= 0) return minimum + paragraph + 2

  const sentenceEnds = [...window.matchAll(/[.!?;](?=\s)/g)]
  const sentence = sentenceEnds.at(-1)
  if (sentence?.index !== undefined) return minimum + sentence.index + 1

  const whitespace = Math.max(window.lastIndexOf("\n"), window.lastIndexOf(" "))
  return whitespace >= 0 ? minimum + whitespace + 1 : hardEnd
}

/**
 * Split a source into contiguous, non-overlapping slices. Concatenating every
 * chunk always reconstructs the original document byte-for-byte.
 */
export function splitStrictScanDocument(
  source: string,
  maxChars = STRICT_SCAN_MAX_CHARS_PER_CHUNK,
): StrictScanChunk[] {
  if (!Number.isInteger(maxChars) || maxChars < 1) {
    throw new RangeError("Strict scan chunk size must be a positive integer")
  }
  if (!source) return []

  const chunks: StrictScanChunk[] = []
  let start = 0
  while (start < source.length) {
    const hardEnd = Math.min(source.length, start + maxChars)
    const end = preferredBreak(source, start, hardEnd)
    if (end <= start) throw new Error("Strict scan chunker did not advance")
    chunks.push({ index: chunks.length, start, end, text: source.slice(start, end) })
    start = end
  }
  return chunks
}

function quotePattern(quote: string): RegExp | null {
  const parts = quote.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return null
  return new RegExp(parts.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+"), "iu")
}

/** Locate a purported verbatim quote without fuzzy substitution. */
export function findGroundedQuote(source: string, quote: string): { start: number; end: number; text: string } | null {
  const direct = source.indexOf(quote)
  if (direct >= 0) return { start: direct, end: direct + quote.length, text: quote }

  const pattern = quotePattern(quote)
  const match = pattern?.exec(source)
  if (!match || match.index === undefined) return null
  return { start: match.index, end: match.index + match[0].length, text: match[0] }
}

function signature(flag: StrictCandidateFlag): string {
  return `${flag.category}:::${flag.text}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function findTargetGrounding(
  source: string,
  candidate: StrictCandidateFlag,
  targetClauses: readonly string[],
): { start: number; end: number; text: string } | null {
  const spans = segmentDocumentIntoClauseSpans(source)
  const matches = spans.filter((span) =>
    targetClauses.some((target) => findGroundedQuote(span.text, target) !== null),
  )
  if (matches.length === 0) return null
  if (matches.length === 1) return matches[0]

  const candidateWords = new Set(candidate.text.toLowerCase().split(/\W+/).filter((word) => word.length > 3))
  let best: (typeof matches)[number] | null = null
  let bestOverlap = 0
  for (const match of matches) {
    const words = new Set(match.text.toLowerCase().split(/\W+/).filter((word) => word.length > 3))
    const overlap = [...candidateWords].filter((word) => words.has(word)).length
    if (overlap > bestOverlap) {
      best = match
      bestOverlap = overlap
    }
  }
  return bestOverlap >= 2 ? best : null
}

/**
 * Run every strict chunk. Any provider failure rejects the whole operation,
 * preventing a partial document from being presented as fully scanned.
 */
export async function scanStrictDocument<T extends StrictCandidateFlag>(
  source: string,
  analyzeChunk: (chunk: StrictScanChunk) => Promise<readonly T[]>,
  options: { maxChars?: number; concurrency?: number; targetClauses?: readonly string[] } = {},
): Promise<StrictScanOutput<T>> {
  const chunks = splitStrictScanDocument(source, options.maxChars)
  const results = await mapWithConcurrency(
    chunks,
    options.concurrency ?? STRICT_SCAN_MAX_CONCURRENCY,
    async (chunk) => ({ chunk, flags: await analyzeChunk(chunk) }),
  )

  let rejectedNonTarget = 0
  let rejectedUngrounded = 0
  let groundingRepairs = 0
  let duplicatesRemoved = 0
  const seen = new Set<string>()
  const flags: StrictGroundedFlag<T>[] = []

  for (const { chunk, flags: candidates } of results) {
    for (const candidate of candidates) {
      if (candidate.isTargetClause !== true) {
        rejectedNonTarget++
        continue
      }
      const directGrounding = findGroundedQuote(chunk.text, candidate.text)
      const grounded = directGrounding ?? findTargetGrounding(
        chunk.text,
        candidate,
        options.targetClauses ?? [],
      )
      if (!grounded) {
        rejectedUngrounded++
        continue
      }
      if (!directGrounding) groundingRepairs++
      const accepted = {
        ...candidate,
        text: grounded.text,
        isTargetClause: true as const,
        sourceStart: chunk.start + grounded.start,
        sourceEnd: chunk.start + grounded.end,
        sourceChunk: chunk.index,
      }
      const key = signature(accepted)
      if (seen.has(key)) {
        duplicatesRemoved++
        continue
      }
      seen.add(key)
      flags.push(accepted)
    }
  }

  flags.sort((left, right) => left.sourceStart - right.sourceStart)
  return {
    flags,
    diagnostics: {
      sourceChars: source.length,
      sourceClauses: segmentDocumentIntoClauseSpans(source).length,
      chunksTotal: chunks.length,
      chunksAnalyzed: results.length,
      coveredChars: chunks.reduce((total, chunk) => total + chunk.text.length, 0),
      rejectedNonTarget,
      rejectedUngrounded,
      groundingRepairs,
      duplicatesRemoved,
    },
  }
}
