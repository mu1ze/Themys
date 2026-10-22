"use client"

import { useCallback, useEffect, useState } from "react"
import { useSession, useUser } from "@clerk/nextjs"
import { isClerkAPIResponseError } from "@clerk/nextjs/errors"
import { Laptop, Loader2, MapPin, RefreshCw, Smartphone, X } from "lucide-react"

import { Badge } from "@/components/ui"
import { cn } from "@/lib/cn"

type AccountSession = {
  id: string
  status: string
  lastActiveAt: Date
  latestActivity: {
    browserName?: string
    browserVersion?: string
    deviceType?: string
    city?: string
    country?: string
    isMobile?: boolean
  }
  revoke: () => Promise<unknown>
}

function errorMessage(error: unknown): string {
  if (isClerkAPIResponseError(error)) {
    return error.errors[0]?.longMessage ?? error.errors[0]?.message ?? "Unable to update active sessions"
  }
  return error instanceof Error ? error.message : "Unable to update active sessions"
}

function formatActivity(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

export function ActiveSessionsManager() {
  const { user } = useUser()
  const { session: currentSession } = useSession()
  const [sessions, setSessions] = useState<AccountSession[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [hasError, setHasError] = useState(false)

  const loadSessions = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      setSessions(await user.getSessions())
      setHasError(false)
    } catch (error) {
      setHasError(true)
      setMessage(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    let cancelled = false

    user
      .getSessions()
      .then((result) => {
        if (cancelled) return
        setSessions(result)
        setHasError(false)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setHasError(true)
        setMessage(errorMessage(error))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user])

  async function revoke(sessionId: string) {
    const target = sessions.find((item) => item.id === sessionId)
    if (!target || sessionId === currentSession?.id) return
    setBusyId(sessionId)
    setMessage(null)
    try {
      await target.revoke()
      setSessions((current) => current.filter((item) => item.id !== sessionId))
      setConfirmId(null)
      setHasError(false)
      setMessage("Session revoked")
    } catch (error) {
      setHasError(true)
      setMessage(errorMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mt-7 border-t border-[var(--ds-border)] pt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-semibold text-[var(--ds-text)]">Active devices</h3>
          <p className="mt-0.5 text-[12px] leading-5 text-[var(--ds-text-muted)]">Review browsers and devices signed in to your account.</p>
        </div>
        <button type="button" onClick={() => void loadSessions()} disabled={loading} aria-label="Refresh active devices" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] text-[var(--ds-text-muted)] hover:bg-[var(--ds-card-hover)] disabled:opacity-60">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)]">
        {loading ? (
          <div className="flex items-center gap-2 px-4 py-4 text-[13px] text-[var(--ds-text-muted)]"><Loader2 className="h-4 w-4 animate-spin" /> Loading active devices…</div>
        ) : sessions.length === 0 ? (
          <p className="px-4 py-4 text-[13px] text-[var(--ds-text-muted)]">No active sessions found.</p>
        ) : (
          <ul className="divide-y divide-[var(--ds-border)]">
            {sessions.map((item) => {
              const activity = item.latestActivity
              const current = item.id === currentSession?.id
              const device = activity.deviceType || (activity.isMobile ? "Mobile device" : "Computer")
              const browser = [activity.browserName, activity.browserVersion].filter(Boolean).join(" ")
              const location = [activity.city, activity.country].filter(Boolean).join(", ")
              return (
                <li key={item.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ds-radius-sm)] bg-[var(--ds-card-hover)] text-[var(--ds-text-secondary)]">
                        {activity.isMobile ? <Smartphone className="h-4 w-4" /> : <Laptop className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[13px] font-semibold text-[var(--ds-text)]">{browser || device}</p>
                          {current ? <Badge tone="success">This device</Badge> : null}
                        </div>
                        <p className="mt-1 text-[12px] text-[var(--ds-text-muted)]">{device} · Last active {formatActivity(item.lastActiveAt)}</p>
                        {location ? <p className="mt-1 flex items-center gap-1 text-[11px] text-[var(--ds-text-dim)]"><MapPin className="h-3 w-3" /> Approx. {location}</p> : null}
                      </div>
                    </div>
                    {!current ? (
                      <button type="button" onClick={() => setConfirmId(item.id)} aria-label={`Revoke session on ${browser || device}`} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] text-[var(--ds-text-muted)] hover:border-[var(--ds-danger)]/40 hover:text-[var(--ds-danger)]">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                  {confirmId === item.id ? (
                    <div className="mt-3 rounded-[var(--ds-radius-sm)] bg-[var(--ds-danger-bg)] p-3">
                      <p className="text-[12px] text-[var(--ds-text-secondary)]">Sign this device out of Themys?</p>
                      <div className="mt-2 flex gap-2">
                        <button type="button" onClick={() => void revoke(item.id)} disabled={busyId === item.id} className="inline-flex h-8 items-center gap-1.5 rounded-[var(--ds-radius-sm)] bg-[var(--ds-danger)] px-3 text-[11px] font-semibold text-white disabled:opacity-60">
                          {busyId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Revoke session
                        </button>
                        <button type="button" onClick={() => setConfirmId(null)} disabled={busyId === item.id} className="h-8 px-2 text-[11px] font-medium text-[var(--ds-text-muted)]">Cancel</button>
                      </div>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {message ? <p aria-live="polite" className={cn("mt-3 text-[12px]", hasError ? "text-[var(--ds-danger)]" : "text-[var(--ds-success)]")}>{message}</p> : null}
    </div>
  )
}
