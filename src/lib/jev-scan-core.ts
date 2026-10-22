/** Pure scan helpers kept separate from the provider so they can be tested offline. */

export type JevClauseSpan = {
  id: string
  text: string
  start: number
  end: number
}

export const JEV_MAX_CLAUSE_CHARS = 2_000

/** Preserve exact source slices and offsets, including short but meaningful clauses. */
export function segmentDocumentIntoClauseSpans(source: string): JevClauseSpan[] {
  const spans: JevClauseSpan[] = []

  function add(start: number, end: number) {
    while (start < end && /\s/.test(source[start])) start++
    while (end > start && /\s/.test(source[end - 1])) end--
    if (start === end) return
    const text = source.slice(start, end)
    if (text.toLowerCase().startsWith("this is the trace id")) return
    spans.push({ id: `C${String(spans.length + 1).padStart(2, "0")}`, text, start, end })
  }

  function addParagraph(start: number, end: number) {
    while (start < end) {
      if (end - start <= JEV_MAX_CLAUSE_CHARS) {
        add(start, end)
        return
      }

      const limit = start + JEV_MAX_CLAUSE_CHARS
      const candidate = source.slice(start + 400, limit)
      const sentenceEnds = [...candidate.matchAll(/[.!?;](?=\s)|\n/g)]
      const lastSentence = sentenceEnds.at(-1)
      const lastSpace = candidate.lastIndexOf(" ")
      const cut = lastSentence
        ? start + 400 + lastSentence.index! + 1
        : lastSpace >= 0 ? start + 400 + lastSpace + 1 : limit
      add(start, cut)
      start = cut
    }
  }

  // A single newline only separates clauses when the next line has an
  // explicit section/list marker; ordinary wrapped lines stay together.
  const separators = /\r?\n(?:[ \t]*\r?\n)+|\r?\n(?=[ \t]*(?:\d{1,3}[.)]\s|\([a-z0-9]{1,3}\)\s|[A-Z][A-Z \t]{3,}:))/g
  let start = 0
  for (const match of source.matchAll(separators)) {
    addParagraph(start, match.index!)
    start = match.index! + match[0].length
  }
  addParagraph(start, source.length)
  return spans
}

/** Keep result order stable while limiting the number of live provider calls. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  work: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError("Concurrency limit must be positive")
  const results = new Array<R>(items.length)
  let next = 0
  let failure: unknown
  let failed = false

  async function worker() {
    while (next < items.length && !failed) {
      const index = next++
      try {
        results[index] = await work(items[index], index)
      } catch (error) {
        failed = true
        failure = error
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  if (failed) throw failure
  return results
}

export const JEV_NO_MATCH = "none"
// Provisional shortlist threshold; evaluate recall on labeled agreements.
export const JEV_SECONDARY_CHOICE_MIN_PROBABILITY = 0.15

/** Choice nominates evidence; a separate focused judgment verifies every nominee. */
export function choiceCandidateIds(
  answer: { choice: string; probabilities?: Record<string, number> },
  availableIds: ReadonlySet<string>,
  maxCandidates = 3,
): string[] {
  if (answer.choice !== JEV_NO_MATCH && !availableIds.has(answer.choice)) return []
  const candidates = answer.choice === JEV_NO_MATCH ? [] : [answer.choice]
  const alternatives = Object.entries(answer.probabilities ?? {})
    .filter(([id, probability]) =>
      id !== answer.choice && availableIds.has(id) && Number.isFinite(probability) && probability >= JEV_SECONDARY_CHOICE_MIN_PROBABILITY,
    )
    .sort((a, b) => b[1] - a[1])
  for (const [id] of alternatives) {
    if (candidates.length >= maxCandidates) break
    candidates.push(id)
  }
  return candidates
}
