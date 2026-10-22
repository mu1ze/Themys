"use client"

import { useState, useEffect, useRef } from "react"
import { X } from "lucide-react"
import { trackEvent } from "@/lib/track"
import { cn } from "@/lib/cn"

type SurveyType = "nps" | "blocker"

type Props = {
  kind: SurveyType
  triggerKey: string // localStorage key to avoid re-showing
  question?: string
  scorePrompt?: string
  blockerPrompt?: string
  onDismiss?: () => void
  className?: string
  variant?: "popup" | "rail"
}

const RATINGS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const DETRACTOR = [0, 1, 2, 3, 4, 5, 6]
const PASSIVE = [7, 8]
const PROMOTER = [9, 10]

export function NpsSurvey({
  kind,
  triggerKey,
  question = "How likely are you to recommend Themys to a friend or colleague?",
  scorePrompt = "Not at all likely",
  blockerPrompt = "What almost stopped you?",
  onDismiss,
  className,
  variant = "popup",
}: Props) {
  const [visible, setVisible] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [blocker, setBlocker] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const dismissed = useRef(false)

  useEffect(() => {
    if (dismissed.current) return
    if (typeof window === "undefined") return
    const stored = localStorage.getItem(triggerKey)
    if (stored === "done") return
    if (variant === "rail") {
      setVisible(true)
      return
    }
    // Delay 3s so it doesn't ambush the user mid-action
    const timer = setTimeout(() => setVisible(true), 3000)
    return () => clearTimeout(timer)
  }, [triggerKey, variant])

  function dismiss() {
    setVisible(false)
    dismissed.current = true
    onDismiss?.()
    localStorage.setItem(triggerKey, "done")
  }

  function handleScore(n: number) {
    setScore(n)
    trackEvent("cta_click", { kind: `${kind}_score`, score: n })
    if (kind === "nps" || variant === "rail") {
      finishSurvey(n)
    }
  }

  function finishSurvey(n: number | null = score) {
    const bucket = n !== null
      ? (PROMOTER.includes(n) ? "promoter" : PASSIVE.includes(n) ? "passive" : "detractor")
      : "unknown"
    trackEvent("cta_click", {
      kind: `${kind}_complete`,
      score: n,
      bucket,
      blockerText: blocker.trim().slice(0, 200),
    })
    setSubmitted(true)
    // Auto-dismiss after 5s
    setTimeout(dismiss, 5000)
  }

  function submitBlocker() {
    if (!blocker.trim()) return
    finishSurvey()
  }

  if (!visible) return null

  if (variant === "rail") {
    return (
      <div className={cn("flex flex-wrap items-center gap-1 py-1.5", className)}>
        <span className="mb-0.5 w-full text-[15px] text-[var(--ds-text-dim)]">{blockerPrompt}</span>
        {RATINGS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => handleScore(n)}
            title={n === 0 ? "Not at all" : n === 10 ? "Absolutely" : String(n)}
            className={cn(
              "flex h-[22px] w-[22px] items-center justify-center rounded-full border text-[15px] font-medium transition",
              score === n
                ? "border-[var(--ds-accent)] bg-[var(--ds-accent)] text-white"
                : "border-[var(--ds-border)] bg-transparent text-[var(--ds-text-dim)] hover:border-[var(--ds-accent)] hover:bg-[var(--ds-accent-glow)] hover:text-[var(--ds-accent)]"
            )}
          >
            {n}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 w-full max-w-sm rounded-xl border border-[var(--ds-border)] bg-[var(--ds-card)] p-5 shadow-xl animate-in slide-in-from-bottom-4 ${className ?? ""}`}>
      <button
        onClick={dismiss}
        className="absolute right-3 top-3 rounded-full p-1 text-[var(--ds-text-muted)] hover:bg-[var(--ds-card-hover)] hover:text-[var(--ds-text)]"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>

      {submitted ? (
        <div className="py-3 text-center text-sm text-[var(--ds-text-secondary)]">
          Thanks — your feedback helps us improve Themys.
        </div>
      ) : kind === "nps" || score !== null ? (
        <div className="space-y-4">
          <p className="text-sm font-medium text-[var(--ds-text)]">{blockerPrompt}</p>
          <textarea
            value={blocker}
            onChange={(e) => setBlocker(e.target.value)}
            placeholder={"Something like \"too expensive,\" \"already use a free alternative,\" or \"didn't understand the value\"..."}
            className="w-full rounded-lg border border-[var(--ds-border)] bg-[var(--ds-bg)] p-3 text-sm text-[var(--ds-text)] placeholder:text-[var(--ds-text-dim)] resize-none focus:border-[var(--ds-accent)] focus:ring-1 focus:ring-[var(--ds-accent-glow)]"
            rows={3}
            maxLength={500}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submitBlocker()}
          />
          <button
            onClick={submitBlocker}
            disabled={!blocker.trim()}
            className="w-full rounded-lg bg-[var(--ds-accent)] py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            Submit
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm font-medium text-[var(--ds-text)]">{question}</p>
          <div className="flex justify-between gap-1">
            {RATINGS.map((n) => (
              <button
                key={n}
                onClick={() => handleScore(n)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--ds-border)] text-sm font-medium text-[var(--ds-text-secondary)] transition hover:border-[var(--ds-accent)] hover:bg-[var(--ds-accent-glow)] hover:text-[var(--ds-accent)]"
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-[15px] text-[var(--ds-text-dim)]">
            <span>{scorePrompt}</span>
            <span>Extremely likely</span>
          </div>
        </div>
      )}
    </div>
  )
}
