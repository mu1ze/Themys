export type ActionType =
  | "settings_toggle"
  | "arbitration_opt_out"
  | "appeal_channel"
  | "technical_exemption"
  | "statutory_right"
  | "refund_dispute"
  | "negotiation_ask"

export type PushbackItem = {
  clauseId?: string
  quote: string
  whyItMatters: string
  suggestedAsk: string
  title?: string
  actionType?: ActionType
  actionLabel?: string
  isDirectAction?: boolean
  category?: string
}

export type PushbackClauseInput = {
  id?: string
  text: string
  category?: string | null
  matchedCategory?: string | null
  whyItMatters?: string | null
  recommendedAction?: string | null
  isTargetClause?: boolean
  riskScore?: number | null
  riskLevel?: "green" | "yellow" | "red" | null
  isFlagged?: boolean
}

function hasContent(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0
}

// This section is for a step the reader can start now. Clause-level advice can
// still describe monitoring, research, and remedies for future events.
function isImmediateAction(clause: PushbackClauseInput): boolean {
  if (!hasContent(clause.recommendedAction)) return false

  const action = clause.recommendedAction.trim()
  const category = (clause.category || clause.matchedCategory || "").toLowerCase()
  const id = (clause.id || "").toLowerCase()

  // These procedures need an event or eligibility that a document scan cannot
  // establish. Keep them in the clause detail instead of promising a step now.
  if (/\b(appeal|counter-notice|copyright notice|security incident|price increase|cancellation remedy|withdrawal window|cooling-off|dispute resolution|settlement channel|safe harbor)\b/.test(category) ||
      /aur-(dsa_content_appeal|dmca_|account_security_incident_report|price_hike_cancellation|statutory_cooling_off|informal_dispute_period|security_research_safe_harbor)/.test(id)) {
    return false
  }

  // Remove a short generated label, such as "Account Settings Toggle:", before
  // checking the actual instruction. A label alone is not a next step.
  const instruction = action.replace(/^(?:Account Settings Toggle|Privacy Control Toggle|30-Day Written Notice|Data Portability & Erasure|Abuse Reporting API Token):\s*/i, "").trim()
  if (/\b(if|when|whenever|upon|in the event of|in case of|should .* arise|if permitted)\b/i.test(instruction)) return false
  if (/^(?:be aware|bookmark|check|consider|consult|document|ensure|evaluate|keep aware|look for|monitor|note|prepare|read|review|set (?:a |up )?reminder|verify|watch)\b/i.test(instruction)) return false
  if (/^(?:ask|contact|request|send)\b.*\b(?:clarification|more information|an explanation|about this|about the terms)\b/i.test(instruction)) return false
  if (/^ask\b.*\babout\b/i.test(instruction)) return false
  if (/^use (?:caution|care)\b/i.test(instruction)) return false
  if (instruction.split(/\s+/).length < 3) return false

  if (/^(?:go to|navigate|open)\b/i.test(instruction)) {
    return /\b(?:cancel|change|disable|enable|opt out|request|submit|switch|turn off|turn on)\b/i.test(instruction)
  }
  return /^(?:ask|cancel|change|delete|disable|enable|export|file|negotiate|opt out|remove|request|send|submit|switch|turn off|turn on|use)\b/i.test(instruction)
}

function deriveActionMeta(clause: PushbackClauseInput): {
  title: string
  actionType: ActionType
  actionLabel: string
  isDirectAction: boolean
} {
  const action = (clause.recommendedAction || "").toLowerCase()
  const rawCat = clause.category || clause.matchedCategory || ""
  const category = rawCat.toLowerCase()
  const text = (clause.text || "").toLowerCase()
  const isDirectClause = Boolean(clause.id?.startsWith("aur-"))

  // 1. In-app / account settings toggle
  if (isDirectClause && (
    action.includes("settings") ||
    action.includes("toggle") ||
    category.includes("settings") ||
    category.includes("toggle") ||
    text.includes("team settings") ||
    text.includes("account settings")
  )) {
    let title = clause.category || "In-App Settings Toggle"
    if (category.includes("ai") || category.includes("training")) {
      title = "AI Model Training Opt-Out Toggle"
    } else if (category.includes("telemetry") || category.includes("ad") || category.includes("data")) {
      title = "Telemetry & Ad Tracking Opt-Out"
    }
    return {
      title,
      actionType: "settings_toggle",
      actionLabel: "Account Settings Toggle",
      isDirectAction: true,
    }
  }

  // 2. 30-day arbitration / class action opt-out window
  if (isDirectClause && category.includes("arbitration opt-out")) {
    return {
      title: "30-Day Arbitration Opt-Out Window",
      actionType: "arbitration_opt_out",
      actionLabel: "30-Day Written Notice",
      isDirectAction: true,
    }
  }

  // 3. Technical & developer safe harbors (robots.txt, security research, abuse token)
  if (isDirectClause && (
    category.includes("robots.txt") ||
    category.includes("safe harbor") ||
    category.includes("abuse api") ||
    action.includes("robots.txt") ||
    action.includes("safe harbor") ||
    action.includes("api token")
  )) {
    let title = clause.category || "Developer Safe Harbor"
    let label = "Developer Safe Harbor"
    if (category.includes("security") || action.includes("vulnerability")) {
      title = "Security Vulnerability Disclosure Safe Harbor"
      label = "Researcher Safe Harbor"
    } else if (category.includes("abuse") || action.includes("abuse api")) {
      title = "Automated Abuse Reporting API Access"
      label = "API Token Exemption"
    } else if (category.includes("robots.txt") || action.includes("robots.txt")) {
      title = "Robots.txt Scraping Safe Harbor"
      label = "Robots.txt Safe Harbor"
    }
    return {
      title,
      actionType: "technical_exemption",
      actionLabel: label,
      isDirectAction: true,
    }
  }

  // 4. Formal appeal channels (DSA, DMCA counter-notice, dispute resolution)
  if (isDirectClause && (
    category.includes("dsa") ||
    category.includes("dmca") ||
    category.includes("appeal") ||
    action.includes("appeal") ||
    action.includes("counter-notice") ||
    action.includes("informal settlement")
  )) {
    let title = clause.category || "Formal Appeal Channel"
    let label = "Internal Appeal Channel"
    if (category.includes("dmca") || action.includes("dmca")) {
      title = "DMCA Counter-Notice Procedure"
      label = "DMCA Counter-Notice"
    } else if (category.includes("dsa") || action.includes("dsa")) {
      title = "DSA Content Removal Appeal Portal"
      label = "Internal Appeal Portal"
    } else if (action.includes("informal") || category.includes("informal")) {
      title = "Mandatory Pre-Dispute Negotiation Window"
      label = "Pre-Dispute Negotiation"
    }
    return {
      title,
      actionType: "appeal_channel",
      actionLabel: label,
      isDirectAction: true,
    }
  }

  // 5. Statutory consumer rights (California mail terms, GDPR/CCPA, 14-day cooling-off)
  if (isDirectClause && (
    category.includes("california") ||
    category.includes("gdpr") ||
    category.includes("ccpa") ||
    category.includes("withdrawal") ||
    action.includes("california") ||
    action.includes("gdpr") ||
    action.includes("withdrawal") ||
    action.includes("dsar")
  )) {
    let title = clause.category || "Statutory Consumer Right"
    let label = "Statutory Consumer Right"
    if (category.includes("california") || action.includes("california")) {
      title = "California Consumer Written Terms Right"
      label = "California Resident Right"
    } else if (category.includes("withdrawal") || action.includes("withdrawal") || action.includes("14-day")) {
      title = "14-Day Statutory Right of Withdrawal"
      label = "14-Day Cooling-Off"
    } else if (category.includes("gdpr") || category.includes("ccpa") || action.includes("erasure")) {
      title = "Data Portability & Erasure (GDPR/CCPA)"
      label = "Data Erasure Right"
    }
    return {
      title,
      actionType: "statutory_right",
      actionLabel: label,
      isDirectAction: true,
    }
  }

  // 6. Cancellation on modification or price hikes (only if action explicitly describes cancellation)
  if (isDirectClause &&
    action.includes("cancel") &&
    (category.includes("modification") || action.includes("effective date") || category.includes("price"))
  ) {
    return {
      title: "Notice-Period Cancellation Remedy",
      actionType: "refund_dispute",
      actionLabel: "Notice-Period Cancellation",
      isDirectAction: true,
    }
  }

  // 7. General negotiation pushback for risk clauses
  const isDirect = isDirectClause
  let baseTitle = "Negotiation Ask"
  if (rawCat) {
    const clean = rawCat
      .replace(/^Disclaimer of\s+/i, "")
      .replace(/^Waiver of\s+/i, "")
      .replace(/\s*\(.*?\)\s*/g, " ")
      .trim()
    baseTitle = `${clean} Protection`
  }

  return {
    title: isDirect ? (rawCat || "Actionable Remedy") : baseTitle,
    actionType: isDirect ? "statutory_right" : "negotiation_ask",
    actionLabel: isDirect ? "Actionable Remedy" : "Negotiation Counter-Language",
    isDirectAction: isDirect,
  }
}

export function buildPushbackList(
  clauses: PushbackClauseInput[],
  max = 10,
): PushbackItem[] {
  const seenActions = new Set<string>()
  return clauses
    .filter((clause) => hasContent(clause.whyItMatters) && isImmediateAction(clause))
    .map((clause) => {
      const meta = deriveActionMeta(clause)
      const rawCat = clause.category || clause.matchedCategory
      return {
        clause,
        item: {
          clauseId: clause.id,
          quote: clause.text,
          whyItMatters: clause.whyItMatters!.trim(),
          suggestedAsk: clause.recommendedAction!.trim(),
          title: meta.title,
          actionType: meta.actionType,
          actionLabel: meta.actionLabel,
          isDirectAction: meta.isDirectAction,
          category: rawCat ?? undefined,
        },
      }
    })
    .sort((a, b) => {
      // 1. Direct Actionable User Rights / Remedies always come first!
      const directDelta = Number(Boolean(b.item.isDirectAction)) - Number(Boolean(a.item.isDirectAction))
      if (directDelta !== 0) return directDelta

      // 2. Target clauses prioritized next
      const targetDelta = Number(Boolean(b.clause.isTargetClause)) - Number(Boolean(a.clause.isTargetClause))
      if (targetDelta !== 0) return targetDelta

      // 3. For negotiation asks, prioritize highest-risk clauses
      return (b.clause.riskScore ?? 0) - (a.clause.riskScore ?? 0)
    })
    .filter(({ item }) => {
      // A verified right can also be copied onto its matching risk clause.
      // Show the right with its own supporting quote only once.
      const key = item.suggestedAsk.toLowerCase().replace(/\s+/g, " ")
      if (seenActions.has(key)) return false
      seenActions.add(key)
      return true
    })
    .slice(0, max)
    .map(({ item }) => item)
}
