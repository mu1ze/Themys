"use client"

import { useRef, useState, type ChangeEvent } from "react"
import { isClerkAPIResponseError } from "@clerk/nextjs/errors"
import { useUser } from "@clerk/nextjs"
import { Camera, Loader2, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/cn"
import { useHasHydrated } from "@/lib/use-has-hydrated"

function errorMessage(error: unknown): string {
  if (isClerkAPIResponseError(error)) {
    return error.errors[0]?.longMessage ?? error.errors[0]?.message ?? "Unable to update profile photo"
  }
  return error instanceof Error ? error.message : "Unable to update profile photo"
}

export function ProfileImageForm({
  displayName,
  email,
  initialImageUrl,
  initialHasImage,
}: {
  displayName: string
  email: string
  initialImageUrl: string | null
  initialHasImage: boolean
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const { isLoaded, user } = useUser()
  const hydrated = useHasHydrated()
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [message, setMessage] = useState<string | null>(null)

  const fallback = (displayName || email || "U")
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  async function updateImage(file: File | null) {
    if (!user) return
    setStatus("saving")
    setMessage(null)

    try {
      await user.setProfileImage({ file })
      await user.reload()
      setStatus("saved")
      setMessage(file ? "Profile photo updated" : "Profile photo removed")
      router.refresh()
    } catch (error) {
      setStatus("error")
      setMessage(errorMessage(error))
    } finally {
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setStatus("error")
      setMessage("Choose an image file")
      event.target.value = ""
      return
    }
    void updateImage(file)
  }

  const isSaving = status === "saving"
  const imageUrl = hydrated ? user?.imageUrl : initialImageUrl
  const hasImage = hydrated ? (user?.hasImage ?? false) : initialHasImage

  return (
    <div className="flex flex-col gap-4 rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card-hover)]/40 p-4 sm:flex-row sm:items-center">
      <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--ds-border)] bg-[var(--ds-card)] font-[family-name:var(--ds-doc-font)] text-lg text-[var(--ds-text)]">
        {imageUrl ? (
          // Clerk serves user-managed images from its image CDN.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="Current profile" className="h-full w-full object-cover" />
        ) : (
          fallback || "U"
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--ds-text-dim)]">
          Profile photo
        </p>
        <p className="mt-1 text-[12px] leading-5 text-[var(--ds-text-muted)]">
          Choose an image that will appear with your account across Themys.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="Choose profile photo"
            onChange={handleFileChange}
            disabled={!isLoaded || isSaving}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={!isLoaded || isSaving}
            className="inline-flex h-9 items-center gap-2 rounded-[var(--ds-radius-sm)] bg-[var(--ds-accent)] px-4 text-[13px] font-semibold text-[var(--primary-foreground)] shadow-[var(--shadow-card)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {isSaving ? "Updating" : hasImage ? "Change photo" : "Upload photo"}
          </button>
          {hasImage ? (
            <button
              type="button"
              onClick={() => void updateImage(null)}
              disabled={isSaving}
              className="inline-flex h-9 items-center gap-2 rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card)] px-4 text-[13px] font-semibold text-[var(--ds-text-secondary)] transition hover:border-[var(--ds-border-hover)] hover:bg-[var(--ds-card-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </button>
          ) : null}
        </div>
        {message ? (
          <p
            aria-live="polite"
            className={cn(
              "mt-2 text-[12px]",
              status === "error" ? "text-[var(--ds-danger)]" : "text-[var(--ds-success)]"
            )}
          >
            {message}
          </p>
        ) : null}
      </div>
    </div>
  )
}
