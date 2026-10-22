export const MAX_ANALYSIS_CHARS = 200_000

export type AnalysisSourceKind = "paste" | "upload" | "url" | "cached-url"

export class AnalysisInputTooLargeError extends Error {
  readonly status = 413
  readonly source: AnalysisSourceKind
  readonly actualCharacters: number
  readonly maximumCharacters: number

  constructor(
    source: AnalysisSourceKind,
    actualCharacters: number,
    maximumCharacters = MAX_ANALYSIS_CHARS,
  ) {
    super(`Analysis text exceeds the ${maximumCharacters.toLocaleString("en-US")} character limit`)
    this.name = "AnalysisInputTooLargeError"
    this.source = source
    this.actualCharacters = actualCharacters
    this.maximumCharacters = maximumCharacters
  }
}

export function assertAnalysisTextSize(
  text: string,
  source: AnalysisSourceKind,
): void {
  if (text.length > MAX_ANALYSIS_CHARS) {
    throw new AnalysisInputTooLargeError(source, text.length)
  }
}
