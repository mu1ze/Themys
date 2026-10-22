"use client"

import { useState, type FormEvent } from "react"
import { Loader2, Save, X, Plus } from "lucide-react"
import { useRouter } from "next/navigation"

import { Input } from "@/components/form"
import { updateTargetClauses } from "@/app/actions/account"
import { cn } from "@/lib/cn"
import { Badge } from "@/components/ui"
import {
  PLAYBOOK_IDS,
  PLAYBOOKS,
  mergePlaybookTopics,
  type PlaybookId,
} from "@/lib/playbooks"
import { trackEvent } from "@/lib/track"

type TargetClausesFormProps = {
  defaultTargetClauses: string[]
  defaultStrictMode: boolean
  defaultPlaybookId: PlaybookId
}

export function TargetClausesForm({
  defaultTargetClauses,
  defaultStrictMode,
  defaultPlaybookId,
}: TargetClausesFormProps) {
  const router = useRouter()
  const [clauses, setClauses] = useState<string[]>(defaultTargetClauses)
  const [strictMode, setStrictMode] = useState<boolean>(defaultStrictMode)
  const [playbookId, setPlaybookId] = useState<PlaybookId>(defaultPlaybookId)
  const [inputValue, setInputValue] = useState("")

  const [isEditing, setIsEditing] = useState(false)
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [message, setMessage] = useState<string | null>(null)

  function handleEdit() {
    setIsEditing(true)
    setClauses(defaultTargetClauses)
    setStrictMode(defaultStrictMode)
    setPlaybookId(defaultPlaybookId)
    setStatus("idle")
    setMessage(null)
  }

  function handleCancel() {
    setIsEditing(false)
    setClauses(defaultTargetClauses)
    setStrictMode(defaultStrictMode)
    setPlaybookId(defaultPlaybookId)
    setStatus("idle")
    setMessage(null)
    setInputValue("")
  }

  function handlePlaybookChange(nextPlaybookId: PlaybookId) {
    setPlaybookId(nextPlaybookId)
    setClauses(mergePlaybookTopics(nextPlaybookId, clauses))
  }

  function addClause() {
    const trimmed = inputValue.trim()
    if (trimmed && !clauses.includes(trimmed)) {
      setClauses([...clauses, trimmed])
    }
    setInputValue("")
  }

  function removeClause(clauseToRemove: string) {
    setClauses(clauses.filter((c) => c !== clauseToRemove))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    let finalClauses = [...clauses]
    if (inputValue.trim() && !clauses.includes(inputValue.trim())) {
      finalClauses.push(inputValue.trim())
      setClauses(finalClauses)
      setInputValue("")
    }

    setStatus("saving")
    setMessage(null)

    const playbookChanged = playbookId !== defaultPlaybookId

    try {
      const result = await updateTargetClauses(finalClauses, strictMode, playbookId)
      if (result.success) {
        if (playbookChanged) {
          trackEvent("playbook_used", { playbookId })
        }
        setStatus("saved")
        setMessage("Scan preferences updated successfully")
        setIsEditing(false)
        router.refresh()
      } else {
        throw new Error(result.error ?? "Failed to update preferences")
      }
    } catch (err) {
      setStatus("error")
      setMessage(err instanceof Error ? err.message : "Failed to update preferences")
    }
  }

  if (!isEditing) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card)] px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[14px] font-medium text-[var(--ds-text)]">Playbook</p>
            <p className="mt-1 text-[13px] text-[var(--ds-text-muted)]">
              Preset topics for your contract type.
            </p>
          </div>
          <Badge tone="primary">{PLAYBOOKS[defaultPlaybookId].label}</Badge>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card)] px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[14px] font-medium text-[var(--ds-text)]">
              Target clauses
            </p>
            <p className="mt-1 text-[13px] text-[var(--ds-text-muted)]">
              Keywords or topics to look out for in all scans.
            </p>
          </div>
          <button
            type="button"
            onClick={handleEdit}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card)] px-3.5 text-[12px] font-semibold text-[var(--ds-text-secondary)] transition hover:border-[var(--ds-border-hover)] hover:bg-[var(--ds-card-hover)] hover:text-[var(--ds-text)]"
          >
            Edit scan preferences
          </button>
        </div>

        {defaultTargetClauses.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {defaultTargetClauses.map((clause, idx) => (
              <span key={idx} className="inline-flex items-center rounded-full bg-[var(--ds-accent-glow)] px-2.5 py-1 text-[12px] font-medium text-[var(--ds-accent)] ring-1 ring-inset ring-[var(--ds-accent)]/15">
                {clause}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[13px] italic text-[var(--ds-text-muted)]">No custom target clauses set.</p>
        )}

        <div className="flex items-center justify-between rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card)] px-4 py-3.5">
          <div>
            <p className="text-[14px] font-medium text-[var(--ds-text)]">Strict mode</p>
            <p className="mt-1 text-[13px] text-[var(--ds-text-muted)]">
              Only flag clauses related to your targets.
            </p>
          </div>
          <Badge tone={defaultStrictMode ? "warning" : "neutral"}>
            {defaultStrictMode ? "Enabled" : "Disabled"}
          </Badge>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-[var(--ds-radius-sm)] border border-[var(--ds-accent)]/30 bg-[var(--ds-accent-glow)]/40 p-4">
      <div className="space-y-4">
        <div>
          <label className="mb-3 block text-[14px] font-medium text-[var(--ds-text)]">
            Playbook
          </label>
          <p className="mb-3 text-[13px] text-[var(--ds-text-muted)]">
            Choose a preset for your contract type. Switching replaces preset topics but keeps your custom ones.
          </p>
          <div className="space-y-2">
            {PLAYBOOK_IDS.map((id) => (
              <label
                key={id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-[var(--ds-radius-sm)] border px-3.5 py-3 transition",
                  playbookId === id
                    ? "border-[var(--ds-accent)] bg-[var(--ds-card)]"
                    : "border-[var(--ds-border)] bg-[var(--ds-card)]/60 hover:border-[var(--ds-border-hover)]"
                )}
              >
                <input
                  type="radio"
                  name="playbook"
                  value={id}
                  checked={playbookId === id}
                  onChange={() => handlePlaybookChange(id)}
                  className="mt-0.5 h-4 w-4 border-[var(--ds-border)] text-[var(--ds-accent)] focus:ring-[var(--ds-accent)]"
                />
                <span>
                  <span className="block text-[13px] font-medium text-[var(--ds-text)]">
                    {PLAYBOOKS[id].label}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-[var(--ds-text-muted)]">
                    {PLAYBOOKS[id].topics.join(", ")}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="border-t border-[var(--ds-border)] pt-4">
          <label className="mb-1 block text-[14px] font-medium text-[var(--ds-text)]">
            Target clauses
          </label>
          <p className="mb-3 text-[13px] text-[var(--ds-text-muted)]">
            Add keywords or phrases to flag. (e.g. &quot;Refunds&quot;, &quot;Money Back&quot;)
          </p>

          <div className="mb-3 flex flex-wrap gap-2">
            {clauses.map((clause, idx) => (
              <span key={idx} className="inline-flex items-center rounded-full bg-[var(--ds-accent-glow)] px-2.5 py-1 text-[12px] font-medium text-[var(--ds-accent)] ring-1 ring-inset ring-[var(--ds-accent)]/15">
                {clause}
                <button
                  type="button"
                  onClick={() => removeClause(clause)}
                  className="-mr-1 ml-1.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm text-[var(--ds-accent)]/70 transition-colors hover:bg-[var(--ds-accent)]/15 hover:text-[var(--ds-accent)]"
                >
                  <X className="h-3 w-3" />
                  <span className="sr-only">Remove {clause}</span>
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addClause()
                }
              }}
              placeholder="Add a new target clause..."
              className="flex-1"
            />
            <button
              type="button"
              onClick={addClause}
              disabled={!inputValue.trim()}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card)] px-3.5 text-[13px] font-medium text-[var(--ds-text)] transition hover:border-[var(--ds-border-hover)] hover:bg-[var(--ds-card-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-4 border-t border-[var(--ds-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <label htmlFor="strict-mode" className="cursor-pointer text-[14px] font-medium text-[var(--ds-text)]">
              Strict mode
            </label>
            <p className="mt-1 text-[13px] text-[var(--ds-text-muted)]">
              If enabled, we will ONLY look for your target clauses and ignore our standard high-risk checks.
            </p>
          </div>
          <label className="relative inline-flex h-6 w-11 cursor-pointer items-center sm:ml-4">
            <input
              id="strict-mode"
              type="checkbox"
              checked={strictMode}
              onChange={(e) => setStrictMode(e.target.checked)}
              className="peer sr-only"
            />
            <span className="absolute inset-0 rounded-full bg-[var(--ds-card-hover)] transition-colors peer-checked:bg-[var(--ds-accent)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--ds-accent)]" />
            <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow-[var(--shadow-card)] transition-transform peer-checked:translate-x-5" />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={status === "saving"}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-[var(--ds-radius-sm)] bg-[var(--ds-accent)] px-4 text-[13px] font-semibold text-[var(--primary-foreground)] shadow-[var(--shadow-card)] transition hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          )}
        >
          {status === "saving" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          <span>{status === "saving" ? "Saving" : "Save preferences"}</span>
        </button>

        <button
          type="button"
          onClick={handleCancel}
          disabled={status === "saving"}
          className="inline-flex h-9 items-center gap-1.5 rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card)] px-4 text-[13px] font-semibold text-[var(--ds-text-secondary)] transition hover:border-[var(--ds-border-hover)] hover:bg-[var(--ds-card-hover)] hover:text-[var(--ds-text)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <X className="h-4 w-4" />
          Cancel
        </button>

        {message && (
          <p
            className={cn(
              "text-[13px]",
              status === "error" ? "text-[var(--ds-danger)]" : "text-[var(--ds-success)]"
            )}
            aria-live="polite"
          >
            {message}
          </p>
        )}
      </div>
    </form>
  )
}
