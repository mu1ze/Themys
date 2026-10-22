"use client"

import { useState, type FormEvent } from "react"
import { useReverification, useUser } from "@clerk/nextjs"
import { isClerkAPIResponseError } from "@clerk/nextjs/errors"
import { Check, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react"

import { cn } from "@/lib/cn"
import { useHasHydrated } from "@/lib/use-has-hydrated"

function errorMessage(error: unknown): string {
  if (isClerkAPIResponseError(error)) {
    return error.errors[0]?.longMessage ?? error.errors[0]?.message ?? "Unable to update password"
  }
  return error instanceof Error ? error.message : "Unable to update password"
}

function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
}) {
  const [visible, setVisible] = useState(false)

  return (
    <label className="block" htmlFor={id}>
      <span className="text-[12px] font-semibold text-[var(--ds-text-secondary)]">{label}</span>
      <span className="relative mt-2 block">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required
          minLength={8}
          className="h-11 w-full rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card)] px-3.5 pr-11 text-[14px] text-[var(--ds-text)] outline-none transition placeholder:text-[var(--ds-text-dim)] focus:border-[var(--ds-accent)] focus:ring-2 focus:ring-[var(--ds-accent)]/15"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--ds-text-dim)] transition hover:text-[var(--ds-text)]"
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </span>
    </label>
  )
}

export function PasswordForm({ passwordEnabled }: { passwordEnabled: boolean }) {
  const { isLoaded, user } = useUser()
  const hydrated = useHasHydrated()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [signOutOthers, setSignOutOthers] = useState(true)
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [message, setMessage] = useState<string | null>(null)
  const hasPassword = hydrated ? (user?.passwordEnabled ?? passwordEnabled) : passwordEnabled
  const updatePassword = useReverification(
    (params: {
      currentPassword?: string
      newPassword: string
      signOutOfOtherSessions?: boolean
    }) => {
      if (!user) throw new Error("Your account is still loading. Try again in a moment.")
      return user.updatePassword(params)
    }
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)

    if (!user) {
      setStatus("error")
      setMessage("Your account is still loading. Try again in a moment.")
      return
    }
    if (newPassword !== confirmPassword) {
      setStatus("error")
      setMessage("New passwords do not match")
      return
    }
    if (newPassword.length < 8) {
      setStatus("error")
      setMessage("Password must be at least 8 characters")
      return
    }

    setStatus("saving")
    try {
      await updatePassword({
        ...(hasPassword ? { currentPassword } : {}),
        newPassword,
        signOutOfOtherSessions: signOutOthers,
      })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setStatus("saved")
      setMessage(hasPassword ? "Password updated" : "Password created")
    } catch (error) {
      setStatus("error")
      setMessage(errorMessage(error))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ds-radius-sm)] bg-[var(--ds-accent-glow)] text-[var(--ds-accent)]">
          <KeyRound className="h-[18px] w-[18px]" />
        </span>
        <div>
          <h3 className="text-[14px] font-semibold text-[var(--ds-text)]">
            {hasPassword ? "Change password" : "Create a password"}
          </h3>
          <p className="mt-0.5 text-[12px] leading-5 text-[var(--ds-text-muted)]">
            {hasPassword
              ? "Use at least 8 characters and avoid passwords you use elsewhere."
              : "Add a password so you can sign in without your connected provider."}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {hasPassword ? (
          <PasswordInput
            id="current-password"
            label="Current password"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
          />
        ) : null}
        <PasswordInput
          id="new-password"
          label="New password"
          value={newPassword}
          onChange={setNewPassword}
          autoComplete="new-password"
        />
        <PasswordInput
          id="confirm-password"
          label="Confirm new password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
        />
      </div>

      <label className="flex cursor-pointer items-start gap-3 text-[12px] text-[var(--ds-text-secondary)]">
        <input
          type="checkbox"
          checked={signOutOthers}
          onChange={(event) => setSignOutOthers(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-[var(--ds-border)] text-[var(--ds-accent)] focus:ring-[var(--ds-accent)]"
        />
        Sign out of my other sessions after changing the password
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!hydrated || !isLoaded || status === "saving"}
          className="inline-flex h-9 items-center gap-2 rounded-[var(--ds-radius-sm)] bg-[var(--ds-accent)] px-4 text-[13px] font-semibold text-[var(--primary-foreground)] shadow-[var(--shadow-card)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {status === "saving" ? "Saving" : hasPassword ? "Update password" : "Create password"}
        </button>
        {message ? (
          <p
            aria-live="polite"
            className={cn(
              "text-[12px]",
              status === "error" ? "text-[var(--ds-danger)]" : "text-[var(--ds-success)]"
            )}
          >
            {message}
          </p>
        ) : null}
      </div>
    </form>
  )
}
