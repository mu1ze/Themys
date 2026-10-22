import {
  buildSummary,
  calculateDocumentScore,
  dedupeByText,
  getRiskLevel,
  inferDomain,
  lookupTosdr,
  type ClauseAnalysis,
  type EngineAnalysisResult,
  type RiskCategory,
  validateFlagCompliance,
} from "@/lib/analysis-engine"
import {
  getCachedExplanation,
  storeCachedExplanation,
} from "@/lib/persistence"
import { checkRateLimit, type RateLimitTier } from "@/lib/rate-limit"
import { consumeCreditForClerkId } from "@/lib/persistence"
import { type ComplianceTagRef } from "@/lib/compliance"
import { validateComplianceTagsSync } from "@/lib/compliance-shared"
import { isJsonRecord } from "@/lib/json-value"
import { getRuntimeEnvironment } from "@/lib/runtime-env"
import { fetchJsonWithTimeout } from "@/lib/fetch-timeout"
import { buildOpenRouterChatRequest } from "@/lib/openrouter-policy"
import { isJevConfigured } from "@/lib/jev"
import { scanTermsWithJev, type JevScanDiagnostics } from "@/lib/jev-scanner"
import {
  scanStrictDocument,
  type StrictScanChunk,
  type StrictScanDiagnostics,
} from "@/lib/strict-scan-core"

export type { ComplianceTagRef }

export type FullExtractionPoint = {
  title: string
  detail: string
  quote: string
  severity: "info" | "caution" | "warning"
}

export type FullExtractionSection = {
  section: string
  icon?: string
  keyPoints: FullExtractionPoint[]
}

export type ClauseFlag = {
  id?: string
  category: string
  categoryLabel?: string
  severity: "low" | "medium" | "high"
  text: string
  fullClauseText?: string
  explanation: string
  whyItMatters?: string
  recommendedAction?: string
  riskScore?: number
  confidence?: number
  keywords?: string[]
  source?: "prebuilt" | "llm" | "fallback" | "llm-credit" | "prebuilt-limit"
  complianceTags?: ComplianceTagRef[]
  isStandardPractice?: boolean
  isTargetClause?: boolean
  sourceStart?: number
  sourceEnd?: number
  sourceChunk?: number
}

export type AnalysisResult = Omit<EngineAnalysisResult, "flags"> & {
  flags: ClauseFlag[]
  jevDiagnostics?: JevScanDiagnostics
  strictDiagnostics?: StrictScanDiagnostics
}

type LegacyLlmResult = {
  riskScore: number
  summary: string
  flags: ClauseFlag[]
}

function getSystemPrompt(targetClauses: string[] = [], strictMode = false): string {
  let prompt = `You are a legal analysis AI. Analyze the following Terms of Service text for risky clauses.

Return a JSON object with:
- riskScore: number (1-10, 10=most risky overall document score)
- summary: string (2-3 sentence summary of key risks across the document)
- flags: array of objects with:
  - category: string (A short, descriptive title/category for the clause, e.g. "Broad data sharing with ad partners", "Mandatory arbitration in California", "Auto-renewal without prior notice")
  - severity: "low" | "medium" | "high"
    * IMPORTANT SEVERITY RULES:
    * "high" (Warning) MUST be strictly reserved for EGREGIOUS clauses that severely harm the user, strip standard rights, or deviate from fair consumer norms (e.g., unilateral modification without notice or right to cancel, claiming broad commercial ownership/license of user IP, selling sensitive personal data without consent/opt-out, total liability waivers even for gross negligence, gag clauses prohibiting honest reviews, immediate termination with forfeiture of paid balances).
    * If a clause is common or standard practice across most providers in the industry (e.g., standard auto-renewal with regular billing notices, routine operational telemetry/analytics, standard limited liability caps, standard service suspension for abuse), you MUST set isStandardPractice: true, and set severity to "medium" (Noteworthy) or "low", NEVER "high".
  - text: string (The exact verbatim text quoted from the Terms of Service that is risky. This MUST match a part of the text exactly.)
  - explanation: string (1-2 sentence plain-English explanation of what this clause means)
  - whyItMatters: string (Why the user should care about this risk. If isStandardPractice is true, note that while it is standard across most providers, it limits their rights or options.)
  - recommendedAction: string (Practical recommendation on what the user should do, including what alternative options to look for if this is standard practice.)
  - riskScore: number (Risk score 1-10 for this individual clause. Standard practice clauses should have riskScore <= 5.)
  - isStandardPractice: boolean (Set to true if the flagged clause is common or standard practice across most services in this industry. Standard practice clauses are noteworthy so users can consider alternatives, but they are NOT egregious warnings.)
  - isTargetClause: boolean (true if the clause is related to any of the user's specific Target Clauses)
  - complianceTags: array of objects (include ONLY when there is a genuine regulatory connection to a known regulation). Each tag has:
    - regulationCode: one of GDPR, CCPA, CPRA, COPPA, CAN_SPAM, FTC_ACT, ECPA, PIPEDA, UK_DPA, AU_PRIVACY, DSA, DMA, EU_ECOMMERCE, LGPD
    - articleId: the specific article/section reference (e.g., 'Art. 6(1)(a)', '§1798.100')
    - articleTitle: a brief descriptive title for the article
    - relevance: a number from 0 to 1 indicating how relevant this regulation is to the clause (0.5+ for meaningful connections)
    - quote: the exact text from the ToS that violates or potentially violates this regulation (copy the relevant sentence or phrase verbatim)

`

  if (targetClauses.length > 0) {
    prompt += `\nThe user has specified the following Target Clauses to look out for:\n- ${targetClauses.join("\n- ")}\n`
    if (strictMode) {
      prompt += `\nSTRICT MODE IS ENABLED: You must ONLY flag clauses that are related to the user's Target Clauses provided above. Ignore every unrelated risk, even if severe. A source-grounded clause related to a target is reportable even when it is standard, neutral, beneficial, or low-risk; describe that distinction honestly with the appropriate severity and isStandardPractice value. Do not omit a related clause merely because it is not egregious. For every flag you create, you MUST set isTargetClause to true. If no source text in this document slice relates to a target, return an empty flags array.`
    } else {
      prompt += `\nYou must flag both standard risky clauses AND any clauses related to the user's Target Clauses. If a clause matches a Target Clause, set isTargetClause to true.`
    }
  } else {
    prompt += `Be thorough and flag specific clauses that could harm the user.`
  }

  return prompt
}


const FULL_EXTRACTION_PROMPT = `You are a legal document analyst. Break down the following Terms of Service into a comprehensive, structured summary that a regular person can understand.

Organize ALL important information into these sections (omit any section that has no relevant content):
1. Account & Registration
2. Privacy & Data Collection
3. Payment & Billing
4. Content & Intellectual Property
5. Security & Account Protection
6. Liability & Disclaimers
7. Termination & Cancellation
8. Dispute Resolution
9. Changes to Terms
10. Miscellaneous / Other

Return a JSON object with:
- sections: array of objects with:
  - section: string (the section name from the list above)
  - keyPoints: array of objects with:
    - title: string (short label, e.g. "Email required for signup", "30-day cancellation notice")
    - detail: string (one plain-English sentence explaining what this means for the user)
    - quote: string (the exact verbatim text from the Terms of Service that this point is based on. MUST match the original text exactly.)
    - severity: "info" | "caution" | "warning" (info=neutral/standard, caution=worth knowing, warning=pay close attention)

Cover the most important information from across the entire document, including neutral terms and user rights. Return at most three distinct key points per section. Keep each detail to one clear sentence so the response stays concise and complete JSON. The full source document remains available separately.`

function dedupeFlags(flags: ClauseFlag[]): ClauseFlag[] {
  return dedupeByText(flags, (flag) => `${flag.category}:::${flag.text}`)
}

function getOpenRouterContent(value: unknown): string | undefined {
  if (!isJsonRecord(value) || !Array.isArray(value.choices)) return undefined
  const firstChoice = value.choices[0]
  if (!isJsonRecord(firstChoice) || !isJsonRecord(firstChoice.message)) return undefined
  return typeof firstChoice.message.content === "string"
    ? firstChoice.message.content
    : undefined
}

async function callOpenRouter(
  model: string,
  text: string,
  tier: number,
  modelLabel: string,
  systemPrompt: string
): Promise<AnalysisResult> {
  const apiKey = getRuntimeEnvironment().OPENROUTER_API_KEY
  if (!apiKey) throw new Error("OPENROUTER_API_KEY environment variable is not set")

  const res = await fetchJsonWithTimeout(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildOpenRouterChatRequest(model, systemPrompt, text)),
    },
    20_000,
  )

  if (!res.ok) {
    throw new Error(`OpenRouter ${model} responded with ${res.status}`)
  }

  const data = res.data
  const content = getOpenRouterContent(data)
  if (!content) throw new Error(`OpenRouter ${model} returned empty response`)

  const parsed = safeJsonParse<LegacyLlmResult>(content)
  const flags = validateFlagCompliance(dedupeFlags(parsed.flags))
  return {
    ...parsed,
    riskLevel: scoreToRiskLevel(parsed.riskScore),
    flags: flags.map(flag => ({
      ...flag,
      source: "llm" as const
    })),
    clauses: [],
    tosdr: null,
    stats: {
      totalClauses: 0,
      flaggedClauses: flags.length,
      highConfidenceClauses: 0,
      llmRoutedClauses: flags.length,
    },
    model: modelLabel,
    tier,
  }
}

function extractJson(text: string): string {
  const block = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
  if (block) return block[1]
  
  const obj = text.match(/\{[\s\S]*\}/)
  if (obj) return obj[0]
  
  const firstBrace = text.indexOf('{')
  if (firstBrace !== -1) {
    return text.slice(firstBrace)
  }
  
  return text
}

function tryRepairJson(repaired: string): string {
  let inString = false;
  let isEscaped = false;
  const stack: ("{" | "[")[] = [];
  let result = "";
  
  for (let i = 0; i < repaired.length; i++) {
    const char = repaired[i];
    
    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        result += char;
      } else if (char === "\\") {
        isEscaped = true;
        result += char;
      } else if (char === '"') {
        let isStructural = false;
        let j = i + 1;
        while (j < repaired.length && /\s/.test(repaired[j])) {
          j++;
        }
        
        if (j >= repaired.length) {
          isStructural = true;
        } else {
          const nextChar = repaired[j];
          if (nextChar === "," || nextChar === "}" || nextChar === "]" || nextChar === ":") {
            isStructural = true;
          }
        }
        
        if (isStructural) {
          inString = false;
          result += char;
        } else {
          result += '\\"';
        }
      } else if (char === "\n" || char === "\r") {
        result += "\\n";
      } else {
        result += char;
      }
    } else {
      if (char === '"') {
        inString = true;
        result += char;
      } else if (char === "{") {
        stack.push("{");
        result += char;
      } else if (char === "}") {
        if (stack[stack.length - 1] === "{") {
          stack.pop();
        }
        result += char;
      } else if (char === "[") {
        stack.push("[");
        result += char;
      } else if (char === "]") {
        if (stack[stack.length - 1] === "[") {
          stack.pop();
        }
        result += char;
      } else {
        result += char;
      }
    }
  }
  
  if (inString) {
    result += '"';
  }
  
  while (stack.length > 0) {
    const last = stack.pop();
    if (last === "{") {
      result += "}";
    } else if (last === "[") {
      result += "]";
    }
  }
  
  return result;
}

function safeJsonParse<T>(text: string): T {
  const cleaned = extractJson(text);
  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    const repaired = tryRepairJson(cleaned);
    try {
      return JSON.parse(repaired) as T;
    } catch (e2) {
      console.error(
        "[llm] JSON response parse failed",
        e2 instanceof Error ? e2.name : "UnknownError",
      )
      throw e;
    }
  }
}

function fallbackResult(): AnalysisResult {
  const flags: ClauseFlag[] = [
    {
      category: "Unable to analyze",
      severity: "medium",
      text: "N/A",
      explanation: "Automated analysis was unavailable. Review the full document yourself.",
      whyItMatters: "Without automated detection, you must manually inspect the agreement for risks.",
      recommendedAction: "Carefully read all terms and conditions manually.",
      riskScore: 5,
      source: "fallback",
    },
  ]

  return {
    riskScore: 5,
    riskLevel: "yellow",
    summary: "This document could not be fully analyzed. Please review manually.",
    flags,
    clauses: [],
    tosdr: null,
    stats: {
      totalClauses: 0,
      flaggedClauses: flags.length,
      highConfidenceClauses: 0,
      llmRoutedClauses: flags.length,
    },
    model: "fallback",
    tier: 6,
  }
}

function scoreToRiskLevel(score: number): "green" | "yellow" | "red" {
  if (score <= 3) return "green"
  if (score <= 6) return "yellow"
  return "red"
}

function severityToRiskLevel(severity?: string): "green" | "yellow" | "red" {
  if (severity === "high") return "red"
  if (severity === "medium") return "yellow"
  return "green"
}

function alignQuoteToText(quote: string, fullText: string): string | null {
  const normalizedQuote = quote.trim().replace(/\s+/g, " ")
  if (!normalizedQuote) return null

  // 1. If it's already an exact match, return it
  if (fullText.includes(normalizedQuote)) {
    return normalizedQuote
  }

  // 2. Try case-insensitive matching
  const index = fullText.toLowerCase().indexOf(normalizedQuote.toLowerCase())
  if (index !== -1) {
    return fullText.slice(index, index + normalizedQuote.length)
  }

  // 3. Try to split original text into sentences and find the best match
  const sentences = fullText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5)

  let bestMatch: string | null = null
  let highestScore = 0

  const quoteWords = new Set(normalizedQuote.toLowerCase().split(/\W+/).filter(Boolean))
  if (quoteWords.size === 0) return null

  for (const sentence of sentences) {
    const sentenceWords = sentence.toLowerCase().split(/\W+/).filter(Boolean)
    if (sentenceWords.length === 0) continue

    const overlap = sentenceWords.filter((w) => quoteWords.has(w)).length
    const score = overlap / Math.max(quoteWords.size, sentenceWords.length)

    if (score > highestScore && score > 0.4) {
      highestScore = score
      bestMatch = sentence
    }
  }

  return bestMatch
}

type ComplianceAnnotation = {
  index: number
  tags: ComplianceTagRef[]
}

async function annotateJevCompliance(flags: ClauseFlag[]): Promise<ClauseFlag[]> {
  if (flags.length === 0) return flags
  const apiKey = getRuntimeEnvironment().OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is unavailable for compliance annotation")
  }

  const prompt = `Identify genuine regulatory connections for the numbered Terms of Service findings. Return JSON only: {"findings":[{"index":0,"tags":[{"regulationCode":"GDPR","articleId":"Art. 6","articleTitle":"Lawful basis","relevance":0.8,"quote":"exact source excerpt"}]}]}. Use only GDPR, CCPA, CPRA, COPPA, CAN_SPAM, FTC_ACT, ECPA, PIPEDA, UK_DPA, AU_PRIVACY, DSA, DMA, EU_ECOMMERCE, or LGPD. The quote must be an exact substring of that finding's source text. Do not invent an article, violation, or jurisdiction. Omit a finding if no specific regulatory connection is supported. These are potential connections, not legal conclusions.`
  const source = JSON.stringify(flags.map((flag, index) => ({ index, text: flag.text })))
  for (const model of ["inception/mercury-2.5", "deepseek/deepseek-v4-flash"]) {
    const startedAt = Date.now()
    try {
      const request = buildOpenRouterChatRequest(model, prompt, source)
      const response = await fetchJsonWithTimeout(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ ...request, provider: { zdr: true, sort: "throughput" }, max_tokens: 2_500 }),
        },
        45_000,
      )
      if (!response.ok) throw new Error(`OpenRouter ${model} responded with ${response.status}`)
      const content = getOpenRouterContent(response.data)
      if (!content) throw new Error("Empty compliance response")
      const parsed = safeJsonParse<{ findings?: ComplianceAnnotation[] }>(content)
      if (!Array.isArray(parsed.findings)) throw new Error("Invalid compliance response")

      const annotatedFlags = flags.map((flag, index) => {
        const rawTags = parsed.findings?.find((finding) => finding.index === index)?.tags
        const tags = validateComplianceTagsSync(Array.isArray(rawTags) ? rawTags : [])
          .filter((tag) => tag.articleId && tag.quote && flag.text.includes(tag.quote))
        return tags.length > 0 ? { ...flag, complianceTags: tags } : flag
      })
      console.info("[llm:compliance] Completed", {
        model,
        flags: flags.length,
        taggedFlags: annotatedFlags.filter((flag) => flag.complianceTags?.length).length,
        durationMs: Date.now() - startedAt,
      })
      return annotatedFlags
    } catch (error) {
      console.warn("[llm:compliance] Annotation failed", {
        model,
        durationMs: Date.now() - startedAt,
      }, error instanceof Error ? error.message : "Unknown error")
      if (error instanceof Error && error.name === "AbortError") break
    }
  }
  throw new Error("Compliance annotation providers unavailable")
}

async function analyzeStrictChunk(
  chunk: StrictScanChunk,
  systemPrompt: string,
): Promise<AnalysisResult> {
  const providers = [
    ["inception/mercury-2.5", 1],
    ["deepseek/deepseek-v4-flash", 2],
    ["z-ai/glm-5.3-flash", 3],
  ] as const

  for (const [model, tier] of providers) {
    try {
      return await callOpenRouter(model, chunk.text, tier, model, systemPrompt)
    } catch (error) {
      console.warn("[llm:strict] Chunk provider failed", {
        chunk: chunk.index,
        model,
        name: error instanceof Error ? error.name : "UnknownError",
      })
    }
  }

  const error = new Error(`Strict scan providers unavailable for chunk ${chunk.index + 1}`)
  error.name = "StrictScanProviderError"
  throw error
}

function strictClauseAnalysis(flag: ClauseFlag): ClauseAnalysis {
  const riskScore = flag.riskScore ?? (flag.severity === "high" ? 8 : flag.severity === "medium" ? 5 : 2)
  return {
    id: flag.id ?? "",
    text: flag.text,
    fullClauseText: flag.fullClauseText ?? flag.text,
    category: flag.category,
    categoryLabel: flag.categoryLabel ?? flag.category,
    riskScore,
    riskLevel: severityToRiskLevel(flag.severity),
    confidence: flag.confidence ?? 1,
    keywords: flag.keywords ?? [],
    explanation: flag.explanation,
    whyItMatters: flag.whyItMatters ?? "",
    recommendedAction: flag.recommendedAction ?? "",
    source: flag.source ?? "llm",
    isStandardPractice: flag.isStandardPractice,
    isTargetClause: true,
  }
}

async function analyzeTermsStrict(
  text: string,
  targetClauses: string[],
  tosdrPromise: Promise<Awaited<ReturnType<typeof lookupTosdr>>>,
): Promise<AnalysisResult> {
  const systemPrompt = getSystemPrompt(targetClauses, true)
  const models = new Set<string>()
  const strict = await scanStrictDocument(text, async (chunk) => {
    const result = await analyzeStrictChunk(chunk, systemPrompt)
    models.add(result.model)
    return result.flags
  }, { targetClauses })
  console.info("[llm:strict] Completed", strict.diagnostics)
  const flags = validateFlagCompliance(strict.flags)
  const analyses = flags.map(strictClauseAnalysis)
  const tosdr = await tosdrPromise
  const riskScore = calculateDocumentScore(analyses, null)

  return {
    riskScore,
    riskLevel: scoreToRiskLevel(riskScore),
    summary: flags.length > 0
      ? `Detected ${flags.length} clause${flags.length === 1 ? "" : "s"} matching the strict targets: ${targetClauses.join(", ")}.`
      : `No source-grounded clauses matching the strict targets were detected: ${targetClauses.join(", ")}.`,
    flags,
    clauses: flags.map((flag, index) => {
      const analysis = analyses[index]
      return {
        id: flag.id || `clause-${index + 1}`,
        text: flag.text,
        position: flag.sourceStart,
        keywords: flag.keywords ?? [],
        matchedCategory: flag.category,
        confidence: flag.confidence ?? 1,
        riskScore: analysis.riskScore,
        riskLevel: analysis.riskLevel,
        isStandardPractice: flag.isStandardPractice,
        isTargetClause: true,
      }
    }),
    tosdr,
    stats: {
      totalClauses: strict.diagnostics.sourceClauses,
      flaggedClauses: flags.length,
      highConfidenceClauses: flags.filter((flag) => (flag.confidence ?? 1) >= 0.8).length,
      llmRoutedClauses: strict.diagnostics.sourceClauses,
    },
    model: `strict/chunked:${[...models].join("+")}`,
    tier: 1,
    strictDiagnostics: strict.diagnostics,
  }
}

export async function analyzeTerms(
  text: string,
  options: {
    url?: string | null
    domain?: string | null
    userContext?: { userId: string; tier: RateLimitTier } | null
    targetClauses?: string[]
    strictMode?: boolean
  } = {}
): Promise<AnalysisResult> {
  const domain = inferDomain(options.domain ?? options.url ?? null)
  // ToS;DR enriches the result but is not required to start provider work.
  // Start it concurrently so a slow third-party lookup cannot delay the first
  // LLM request. The promise is awaited only when the provider result is ready.
  const tosdrPromise = lookupTosdr(domain).catch(() => null)

  if (options.strictMode && options.targetClauses?.length) {
    return analyzeTermsStrict(text, options.targetClauses, tosdrPromise)
  }

  // Jev owns risk detection when configured. A valid empty result is still a result.
  if (isJevConfigured() && !options.targetClauses?.length) {
    try {
      const { flags: jevFlags, actionableRights: jevAurs, clauseCount, diagnostics } = await scanTermsWithJev(text, {
        targetClauses: options.targetClauses,
        strictMode: options.strictMode,
      })

      const tosdr = await tosdrPromise
      const validFlags = await annotateJevCompliance(validateFlagCompliance(dedupeFlags(jevFlags)))

      // Map true risks to clauses
      const riskClauses = validFlags.map((flag, idx) => ({
        id: flag.id || `clause-${idx + 1}`,
        text: flag.text,
        keywords: [] as string[],
        category: flag.category,
        matchedCategory: flag.category,
        confidence: flag.confidence ?? 1.0,
        riskScore: flag.riskScore ?? 5,
        riskLevel: severityToRiskLevel(flag.severity),
        isStandardPractice: flag.isStandardPractice,
        isTargetClause: flag.isTargetClause,
        explanation: flag.explanation,
        whyItMatters: flag.whyItMatters,
        recommendedAction: flag.recommendedAction,
      }))

      // Map Actionable User Rights to unflagged positive clauses (green, riskScore 1)
      const aurClauses = jevAurs.map((aur, idx) => ({
        id: aur.id || `aur-${idx + 1}`,
        text: aur.text,
        keywords: [] as string[],
        category: aur.category,
        matchedCategory: aur.category,
        confidence: aur.confidence ?? 1.0,
        riskScore: 1,
        riskLevel: "green" as const,
        isStandardPractice: false,
        isTargetClause: false,
        explanation: aur.explanation,
        whyItMatters: aur.whyItMatters,
        recommendedAction: aur.recommendedAction,
      }))

      const allClauses = [...riskClauses, ...aurClauses]

      const clauseAnalyses = validFlags.map((f) => ({
        id: f.id || "",
        text: f.text,
        fullClauseText: f.text,
        category: f.category,
        categoryLabel: f.category,
        riskScore: f.riskScore ?? 5,
        riskLevel: severityToRiskLevel(f.severity),
        confidence: f.confidence ?? 1.0,
        keywords: [] as string[],
        explanation: f.explanation,
        whyItMatters: f.whyItMatters ?? "",
        recommendedAction: f.recommendedAction ?? "",
        source: "llm" as const,
        isStandardPractice: f.isStandardPractice,
        isTargetClause: f.isTargetClause,
      }))

      const riskScore = calculateDocumentScore(clauseAnalyses, tosdr)

      return {
        riskScore,
        riskLevel: scoreToRiskLevel(riskScore),
        summary: buildSummary(clauseAnalyses, tosdr),
        flags: validFlags,
        clauses: allClauses,
        tosdr,
        stats: {
          totalClauses: clauseCount,
          flaggedClauses: validFlags.length,
          highConfidenceClauses: validFlags.length,
          llmRoutedClauses: 0,
        },
        model: `typesafe/${diagnostics.modelVersion}`,
        tier: 0,
        jevDiagnostics: diagnostics,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      console.warn(`[llm] Tier 0 (TypeSafe Jev) skipped or failed: ${message}`)
    }
  }

  const systemPrompt = getSystemPrompt(options.targetClauses, options.strictMode)
  const tiers: Array<() => Promise<AnalysisResult>> = [
    () => callOpenRouter("deepseek/deepseek-v4-flash", text, 1, "deepseek/deepseek-v4-flash", systemPrompt),
    () => callOpenRouter("z-ai/glm-5.3-flash", text, 2, "z-ai/glm-5.3-flash", systemPrompt),
    () => callOpenRouter("inception/mercury-2.5", text, 3, "inception/mercury-2.5", systemPrompt),
    () => Promise.resolve(fallbackResult()),
  ]

  for (let i = 0; i < tiers.length; i++) {
    try {
      const result = await tiers[i]()

      const alignedFlags = result.flags
        .map((flag) => {
          const alignedText = alignQuoteToText(flag.text, text)
          if (!alignedText) return null
          return { ...flag, text: alignedText }
        })
        .filter((flag): flag is ClauseFlag => flag !== null)

      result.flags = alignedFlags
      result.tosdr = await tosdrPromise

      // Map clauses to match flags (Option A: only store flagged clauses)
      result.clauses = result.flags.map((flag, idx) => {
        let riskScore = flag.riskScore ?? (flag.severity === "high" ? 8 : flag.severity === "medium" ? 5 : 2)
        let riskLevel = severityToRiskLevel(flag.severity)
        
        // Downgrade Standard Practice clauses to yellow/medium, unless they are user Target Clauses
        if (flag.isStandardPractice && !flag.isTargetClause) {
          riskLevel = "yellow"
          riskScore = Math.min(riskScore, 5)
          flag.severity = "medium"
        }

        return {
          id: flag.id || `clause-${idx + 1}`,
          text: flag.text,
          keywords: [],
          matchedCategory: flag.category,
          confidence: flag.confidence ?? 1.0,
          riskScore,
          riskLevel,
          isStandardPractice: flag.isStandardPractice,
          isTargetClause: flag.isTargetClause,
        }
      })

      // Recalculate document risk score based on the findings
      result.riskScore = calculateDocumentScore(
        result.flags.map((f) => {
          let riskScore = f.riskScore ?? (f.severity === "high" ? 8 : f.severity === "medium" ? 5 : 2)
          let riskLevel = severityToRiskLevel(f.severity)
          
          if (f.isStandardPractice && !f.isTargetClause) {
            riskLevel = "yellow"
            riskScore = Math.min(riskScore, 5)
          }

          return {
            id: f.id || "",
            text: f.text,
            fullClauseText: f.text,
            category: f.category,
            categoryLabel: f.category,
            riskScore,
            riskLevel,
            confidence: f.confidence ?? 1.0,
            keywords: [],
            explanation: f.explanation,
            whyItMatters: f.whyItMatters ?? "",
            recommendedAction: f.recommendedAction ?? "",
            source: f.source ?? "llm",
            isStandardPractice: f.isStandardPractice,
            isTargetClause: f.isTargetClause,
          }
        }),
        await tosdrPromise
      )
      result.riskLevel = scoreToRiskLevel(result.riskScore)

      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      console.warn(`[llm] Tier ${i + 1} failed: ${message}`)
    }
  }

  const fbResult = fallbackResult()
  fbResult.tosdr = await tosdrPromise
  return fbResult
}

/* ─── Full Extraction ─── */

type RawFullExtractionResult = {
  sections: FullExtractionSection[]
}

async function fullExtractionViaOpenRouter(
  model: string,
  text: string
): Promise<FullExtractionSection[]> {
  const apiKey = getRuntimeEnvironment().OPENROUTER_API_KEY
  if (!apiKey) throw new Error("OPENROUTER_API_KEY environment variable is not set")

  const request = buildOpenRouterChatRequest(model, FULL_EXTRACTION_PROMPT, text)
  const res = await fetchJsonWithTimeout(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...request, provider: { zdr: true, sort: "throughput" }, max_tokens: 6_000 }),
    },
    60_000,
  )

  if (!res.ok) {
    throw new Error(`OpenRouter ${model} responded with ${res.status}`)
  }

  const data = res.data
  const content = getOpenRouterContent(data)
  if (!content) throw new Error(`OpenRouter ${model} returned empty response`)

  const parsed = safeJsonParse<RawFullExtractionResult>(content)
  return normalizeFullExtractionSections(parsed.sections)
}

function normalizeFullExtractionSections(
  raw: FullExtractionSection[] | undefined
): FullExtractionSection[] {
  if (!Array.isArray(raw)) return []

  return raw
    .filter((s) => s.section && Array.isArray(s.keyPoints) && s.keyPoints.length > 0)
    .map((s) => ({
      section: s.section,
      icon: s.icon || "",
      keyPoints: s.keyPoints
        .filter((kp) => kp.title && kp.detail)
        .map((kp) => ({
          title: kp.title,
          detail: kp.detail,
          quote: kp.quote || "",
          severity: (["info", "caution", "warning"] as const).includes(kp.severity)
            ? kp.severity
            : "info",
        })),
    }))
    .filter((s) => s.keyPoints.length > 0)
}

export async function fullExtraction(text: string): Promise<FullExtractionSection[]> {
  for (const model of ["inception/mercury-2.5", "deepseek/deepseek-v4-flash"]) {
    const startedAt = Date.now()
    try {
      const sections = await fullExtractionViaOpenRouter(model, text)
      if (sections.length > 0) {
        console.info("[llm:full-extraction] Completed", {
          model,
          sections: sections.length,
          durationMs: Date.now() - startedAt,
        })
        return sections
      }
      throw new Error("Empty extraction result")
    } catch (error) {
      console.warn("[llm:full-extraction] Provider failed", {
        model,
        durationMs: Date.now() - startedAt,
      }, error instanceof Error ? error.message : "Unknown error")
      if (error instanceof Error && error.name === "AbortError") break
    }
  }
  return []
}
