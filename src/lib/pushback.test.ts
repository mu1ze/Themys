import assert from "node:assert/strict"
import test from "node:test"
import { buildPushbackList } from "./pushback.ts"

test("buildPushbackList returns empty array for no clauses", () => {
  assert.deepEqual(buildPushbackList([]), [])
})

test("buildPushbackList drops clauses missing recommendedAction or whyItMatters", () => {
  const result = buildPushbackList([
    { text: "A", whyItMatters: "reason", recommendedAction: "Ask the provider for mutual indemnity." },
    { text: "B", whyItMatters: null, recommendedAction: "Ask the provider for mutual indemnity." },
    { text: "C", whyItMatters: "reason", recommendedAction: "" },
    { text: "D", whyItMatters: "  ", recommendedAction: "Ask the provider for mutual indemnity." },
  ])
  assert.equal(result.length, 1)
  assert.equal(result[0]?.quote, "A")
})

test("buildPushbackList ranks target clauses before higher risk non-targets", () => {
  const result = buildPushbackList([
    {
      id: "high-risk",
      text: "High risk clause",
      whyItMatters: "Bad",
      recommendedAction: "Negotiate a liability cap with the provider.",
      riskScore: 9,
      isTargetClause: false,
    },
    {
      id: "target",
      text: "Target clause",
      whyItMatters: "Playbook hit",
      recommendedAction: "Request mutual indemnity from the provider.",
      riskScore: 3,
      isTargetClause: true,
    },
  ])
  assert.equal(result[0]?.clauseId, "target")
  assert.equal(result[1]?.clauseId, "high-risk")
})

test("buildPushbackList truncates to max", () => {
  const clauses = Array.from({ length: 5 }, (_, i) => ({
    id: `c${i}`,
    text: `Clause ${i}`,
    whyItMatters: "Matters",
    recommendedAction: `Ask the provider for protection ${i}.`,
    riskScore: i,
  }))
  assert.equal(buildPushbackList(clauses, 3).length, 3)
})

test("buildPushbackList maps fields to PushbackItem shape", () => {
  const result = buildPushbackList([
    {
      id: "x1",
      text: "Quote text",
      whyItMatters: "Why",
      recommendedAction: "Request mutual indemnity from the provider.",
    },
  ])
  assert.deepEqual(result, [
    {
      clauseId: "x1",
      quote: "Quote text",
      whyItMatters: "Why",
      suggestedAsk: "Request mutual indemnity from the provider.",
      title: "Negotiation Ask",
      actionType: "negotiation_ask",
      actionLabel: "Negotiation Counter-Language",
      isDirectAction: false,
      category: undefined,
    },
  ])
})

test("buildPushbackList prioritizes direct actionable rights and settings toggles over raw high risk clauses", () => {
  const result = buildPushbackList([
    {
      id: "flag-indemnity",
      category: "Unilateral Indemnity & Legal Fees",
      text: "User shall indemnify company for all attorney fees.",
      whyItMatters: "Unlimited exposure",
      recommendedAction: "Request mutual indemnity",
      riskScore: 9,
      isFlagged: true,
    },
    {
      id: "aur-ai-opt-out",
      category: "AI Model Training Opt-Out Toggle",
      text: "You can opt-out of model training in team settings.",
      whyItMatters: "Stop data ingestion",
      recommendedAction: "Account Settings Toggle: Navigate to Team Settings > AI to turn off Model Training",
      riskScore: 1,
      isFlagged: false,
      riskLevel: "green",
    },
  ])

  assert.equal(result[0]?.clauseId, "aur-ai-opt-out")
  assert.equal(result[0]?.title, "AI Model Training Opt-Out Toggle")
  assert.equal(result[0]?.actionLabel, "Account Settings Toggle")
  assert.equal(result[0]?.isDirectAction, true)

  assert.equal(result[1]?.clauseId, "flag-indemnity")
  assert.equal(result[1]?.isDirectAction, false)
})

test("a suggestion to check for an opt-out is not an actionable insight", () => {
  const items = buildPushbackList([{
    id: "flag-mandatory-arbitration",
    category: "Mandatory Binding Arbitration",
    text: "Disputes must be resolved by binding arbitration.",
    whyItMatters: "Court access is limited.",
    recommendedAction: "Check whether a 30-day arbitration opt-out procedure exists.",
    riskLevel: "red",
    isFlagged: true,
  }])

  assert.deepEqual(items, [])
})

test("keeps concrete steps while excluding awareness, preparation, and future remedies", () => {
  const items = buildPushbackList([
    { id: "monitor", text: "Terms may change.", whyItMatters: "Terms can change.", recommendedAction: "Bookmark and periodically review the legal terms page." },
    { id: "prepare", text: "Your subscription renews.", whyItMatters: "Charges recur.", recommendedAction: "Set calendar reminders before each billing cycle." },
    { id: "awareness", text: "Indemnity survives.", whyItMatters: "Obligations continue.", recommendedAction: "Be aware that indemnities survive account deletion." },
    { id: "conditional", text: "Accounts may be suspended.", whyItMatters: "Access could be lost.", recommendedAction: "If your account is suspended, submit an appeal." },
    { id: "vague", text: "Terms are complex.", whyItMatters: "Meaning is unclear.", recommendedAction: "Ask the provider for clarification about this clause." },
    { id: "browse", text: "Controls may exist.", whyItMatters: "Settings might help.", recommendedAction: "Open account settings to review the options." },
    { id: "appeal", category: "DSA Content & Suspension Appeal Channel", text: "You may appeal a suspension.", whyItMatters: "Appeal is possible.", recommendedAction: "Submit an appeal through the internal complaint system." },
    { id: "aur-settings", category: "AI Model Training Opt-Out Toggle", riskLevel: "green", text: "Opt out in team settings.", whyItMatters: "Stops future training.", recommendedAction: "Account Settings Toggle: Navigate to Team Settings > AI and turn off Model Training." },
    { id: "aur-privacy", category: "Data Portability & Erasure", riskLevel: "green", text: "Contact privacy to request a copy.", whyItMatters: "You can get your data.", recommendedAction: "Send a data access request to the privacy contact listed in this clause." },
    { id: "ask", category: "Unilateral Indemnity", text: "You must indemnify us.", whyItMatters: "Legal exposure.", recommendedAction: "Request mutual indemnity from the provider." },
    { id: "backup", category: "Termination Without Notice", text: "We may terminate your account.", whyItMatters: "Your data may become inaccessible.", recommendedAction: "Maintain independent external backups of project data." },
  ])

  assert.deepEqual(items.map((item) => item.clauseId), ["aur-settings", "aur-privacy", "ask"])
})

test("shows a remedy once with the clause that grants it", () => {
  const action = "Account Settings Toggle: Navigate to Team Settings > AI and turn off Model Training."
  const items = buildPushbackList([
    { id: "flag-ai", category: "AI & ML Model Training", text: "We may use content to train models.", whyItMatters: "Content could train models.", recommendedAction: action, riskScore: 8, isFlagged: true },
    { id: "aur-ai", category: "AI Model Training Opt-Out Toggle", text: "Turn off model training in Team Settings > AI.", whyItMatters: "You can stop future training.", recommendedAction: action, riskLevel: "green", isFlagged: false },
  ])

  assert.deepEqual(items.map((item) => item.clauseId), ["aur-ai"])
})
