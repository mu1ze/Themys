"use client"

import { useState } from "react"
import { useReverification, useUser } from "@clerk/nextjs"
import { isClerkAPIResponseError } from "@clerk/nextjs/errors"
import { Link2, Loader2, RefreshCw, Unlink } from "lucide-react"

import { Badge } from "@/components/ui"
import { cn } from "@/lib/cn"
import { useHasHydrated } from "@/lib/use-has-hydrated"

function errorMessage(error: unknown): string {
  if (isClerkAPIResponseError(error)) {
    return error.errors[0]?.longMessage ?? error.errors[0]?.message ?? "Unable to update the Google connection"
  }
  return error instanceof Error ? error.message : "Unable to update the Google connection"
}

function callbackUrl(): string {
  return `${window.location.origin}/sso-callback?redirect_url=${encodeURIComponent(`${window.location.origin}/settings#accounts`)}`
}

export function ConnectedAccountManager() {
  const { isLoaded, user } = useUser()
  const hydrated = useHasHydrated()
  const [busy, setBusy] = useState<"connect" | "reauthorize" | "disconnect" | null>(null)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [hasError, setHasError] = useState(false)

  const google = user?.externalAccounts.find((account) => account.provider === "google")
  const hasAnotherMethod = Boolean(
    user?.passwordEnabled ||
      user?.emailAddresses.some((email) => email.verification.status === "verified") ||
      (user?.externalAccounts.length ?? 0) > 1,
  )

  const disconnectGoogle = useReverification(async () => {
    if (!google) throw new Error("Google account is not connected")
    await google.destroy()
  })

  const createGoogle = useReverification(async () => {
    if (!user) throw new Error("Your account is still loading. Try again in a moment.")
    return user.createExternalAccount({
      strategy: "oauth_google",
      redirectUrl: callbackUrl(),
    })
  })

  const reauthorizeGoogle = useReverification(async () => {
    if (!google) throw new Error("Google account is not connected")
    return google.reauthorize({ redirectUrl: callbackUrl() })
  })

  async function connect() {
    if (!user) return
    setBusy("connect")
    setMessage(null)
    try {
      const account = await createGoogle()
      const redirect = account.verification?.externalVerificationRedirectURL
      if (!redirect) throw new Error("Google did not return an authorization URL")
      window.location.assign(redirect.toString())
    } catch (error) {
      setHasError(true)
      setMessage(errorMessage(error))
      setBusy(null)
    }
  }

  async function reauthorize() {
    if (!google) return
    setBusy("reauthorize")
    setMessage(null)
    try {
      const account = await reauthorizeGoogle()
      const redirect = account.verification?.externalVerificationRedirectURL
      if (!redirect) throw new Error("Google did not return an authorization URL")
      window.location.assign(redirect.toString())
    } catch (error) {
      setHasError(true)
      setMessage(errorMessage(error))
      setBusy(null)
    }
  }

  async function disconnect() {
    if (!hasAnotherMethod) {
      setHasError(true)
      setMessage("Add a verified email or password before disconnecting your only sign-in method")
      return
    }
    setBusy("disconnect")
    setMessage(null)
    try {
      await disconnectGoogle()
      await user?.reload()
      setConfirmDisconnect(false)
      setHasError(false)
      setMessage("Google account disconnected")
    } catch (error) {
      setHasError(true)
      setMessage(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  if (!hydrated || !isLoaded) {
    return <p className="text-[13px] text-[var(--ds-text-muted)]">Loading connected accounts…</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--ds-border)] bg-white text-[16px] font-bold text-slate-700">G</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[14px] font-semibold text-[var(--ds-text)]">Google</p>
              <Badge tone={google ? "success" : "neutral"}>{google ? "Connected" : "Not connected"}</Badge>
            </div>
            <p className="mt-1 truncate text-[12px] text-[var(--ds-text-muted)]">
              {google?.emailAddress || "Use Google as a sign-in method for Themys."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {google ? (
            <>
              <button type="button" onClick={() => void reauthorize()} disabled={busy !== null} className="inline-flex h-9 items-center gap-2 rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] px-3.5 text-[12px] font-semibold text-[var(--ds-text-secondary)] hover:bg-[var(--ds-card-hover)] disabled:opacity-60">
                {busy === "reauthorize" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Reauthorize
              </button>
              <button type="button" onClick={() => setConfirmDisconnect(true)} disabled={busy !== null} className="inline-flex h-9 items-center gap-2 rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] px-3.5 text-[12px] font-semibold text-[var(--ds-text-secondary)] hover:border-[var(--ds-danger)]/40 hover:text-[var(--ds-danger)] disabled:opacity-60">
                <Unlink className="h-4 w-4" /> Disconnect
              </button>
            </>
          ) : (
            <button type="button" onClick={() => void connect()} disabled={busy !== null} className="inline-flex h-9 items-center gap-2 rounded-[var(--ds-radius-sm)] bg-[var(--ds-accent)] px-4 text-[12px] font-semibold text-[var(--primary-foreground)] disabled:opacity-60">
              {busy === "connect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Connect Google
            </button>
          )}
        </div>
      </div>

      {confirmDisconnect ? (
        <div className="rounded-[var(--ds-radius-sm)] border border-[var(--ds-danger)]/30 bg-[var(--ds-danger-bg)] p-4">
          <p className="text-[13px] font-semibold text-[var(--ds-text)]">Disconnect Google?</p>
          <p className="mt-1 text-[12px] leading-5 text-[var(--ds-text-secondary)]">You will no longer be able to use this Google account to sign in.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => void disconnect()} disabled={busy !== null} className="inline-flex h-9 items-center gap-2 rounded-[var(--ds-radius-sm)] bg-[var(--ds-danger)] px-4 text-[12px] font-semibold text-white disabled:opacity-60">
              {busy === "disconnect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />} Disconnect
            </button>
            <button type="button" onClick={() => setConfirmDisconnect(false)} disabled={busy !== null} className="h-9 px-3 text-[12px] font-medium text-[var(--ds-text-muted)]">Cancel</button>
          </div>
        </div>
      ) : null}

      {message ? <p aria-live="polite" className={cn("text-[12px]", hasError ? "text-[var(--ds-danger)]" : "text-[var(--ds-success)]")}>{message}</p> : null}
    </div>
  )
}
