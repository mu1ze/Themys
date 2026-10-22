"use client"

import { useState, type FormEvent } from "react"
import { Loader2, Save } from "lucide-react"
import { useRouter } from "next/navigation"

import { Field, Input } from "@/components/form"
import { cn } from "@/lib/cn"

type ProfileLocationFormProps = {
  defaultCountry?: string | null
  defaultState?: string | null
}

export function ProfileLocationForm({
  defaultCountry,
  defaultState,
}: ProfileLocationFormProps) {
  const router = useRouter()
  const [country, setCountry] = useState(defaultCountry ?? "")
  const [state, setState] = useState(defaultState ?? "")
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  )
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus("saving")
    setMessage(null)

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ country, state }),
      })

      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null

      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to save location")
      }

      setStatus("saved")
      setMessage("Location saved. Future scans will use this profile.")
      router.refresh()
    } catch (err) {
      setStatus("error")
      setMessage(err instanceof Error ? err.message : "Unable to save location")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Country"
          description="Used to prioritize clauses against the rules that matter where you live."
        >
          <Input
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            placeholder="United States"
            autoComplete="country-name"
          />
        </Field>
        <Field
          label="State / region"
          description="Use a state, province, territory, or region if it affects your rights."
        >
          <Input
            value={state}
            onChange={(event) => setState(event.target.value)}
            placeholder="California"
            autoComplete="address-level1"
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={status === "saving"}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-[var(--ds-radius-sm)] bg-[var(--ds-accent)] px-4 text-[13px] font-semibold text-[var(--primary-foreground)] shadow-[var(--shadow-card)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          )}
        >
          {status === "saving" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          <span>{status === "saving" ? "Saving" : "Save location"}</span>
        </button>

        <p
          className={cn(
            "text-sm",
            status === "error"
              ? "text-[var(--ds-danger)]"
              : status === "saved"
                ? "text-[var(--ds-success)]"
                : "text-[var(--ds-text-muted)]"
          )}
          aria-live="polite"
        >
          {message ?? "Update this when you move or need a different jurisdiction profile."}
        </p>
      </div>
    </form>
  )
}
