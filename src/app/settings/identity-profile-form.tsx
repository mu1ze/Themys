"use client"

import { useState, type FormEvent } from "react"
import { isClerkAPIResponseError } from "@clerk/nextjs/errors"
import { useReverification, useUser } from "@clerk/nextjs"
import { Check, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/cn"

function errorMessage(error: unknown): string {
  if (isClerkAPIResponseError(error)) {
    return error.errors[0]?.longMessage ?? error.errors[0]?.message ?? "Unable to update your profile"
  }
  return error instanceof Error ? error.message : "Unable to update your profile"
}

const inputClass =
  "mt-2 h-11 w-full rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card)] px-3.5 text-[14px] text-[var(--ds-text)] outline-none transition placeholder:text-[var(--ds-text-dim)] focus:border-[var(--ds-accent)] focus:ring-2 focus:ring-[var(--ds-accent)]/15"

export function IdentityProfileForm({
  initialFirstName,
  initialLastName,
  initialUsername,
}: {
  initialFirstName: string
  initialLastName: string
  initialUsername: string
}) {
  const router = useRouter()
  const { isLoaded, user } = useUser()
  const [firstName, setFirstName] = useState(initialFirstName)
  const [lastName, setLastName] = useState(initialLastName)
  const [username, setUsername] = useState(initialUsername)
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [message, setMessage] = useState<string | null>(null)

  const updateIdentity = useReverification(
    async (params: { firstName: string; lastName: string; username: string }) => {
      if (!user) throw new Error("Your account is still loading. Try again in a moment.")
      return user.update(params)
    },
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextFirstName = firstName.trim()
    const nextLastName = lastName.trim()
    const nextUsername = username.trim()

    if (!nextFirstName || !nextUsername) {
      setStatus("error")
      setMessage("First name and username are required")
      return
    }

    setStatus("saving")
    setMessage(null)
    try {
      await updateIdentity({
        firstName: nextFirstName,
        lastName: nextLastName,
        username: nextUsername,
      })
      await user?.reload()
      setStatus("saved")
      setMessage("Profile details updated")
      router.refresh()
    } catch (error) {
      setStatus("error")
      setMessage(errorMessage(error))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block" htmlFor="first-name">
          <span className="text-[12px] font-semibold text-[var(--ds-text-secondary)]">First name</span>
          <input
            id="first-name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            autoComplete="given-name"
            maxLength={100}
            required
            className={inputClass}
          />
        </label>
        <label className="block" htmlFor="last-name">
          <span className="text-[12px] font-semibold text-[var(--ds-text-secondary)]">Last name</span>
          <input
            id="last-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            autoComplete="family-name"
            maxLength={100}
            className={inputClass}
          />
        </label>
      </div>

      <label className="block" htmlFor="username">
        <span className="text-[12px] font-semibold text-[var(--ds-text-secondary)]">Username</span>
        <input
          id="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          spellCheck={false}
          required
          className={inputClass}
        />
        <span className="mt-1.5 block text-[11px] text-[var(--ds-text-muted)]">
          Used to identify your Themys account. Availability and allowed characters are checked when you save.
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!isLoaded || status === "saving"}
          className="inline-flex h-9 items-center gap-2 rounded-[var(--ds-radius-sm)] bg-[var(--ds-accent)] px-4 text-[13px] font-semibold text-[var(--primary-foreground)] shadow-[var(--shadow-card)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {status === "saving" ? "Saving" : "Save profile"}
        </button>
        {message ? (
          <p
            aria-live="polite"
            className={cn(
              "text-[12px]",
              status === "error" ? "text-[var(--ds-danger)]" : "text-[var(--ds-success)]",
            )}
          >
            {message}
          </p>
        ) : null}
      </div>
    </form>
  )
}
