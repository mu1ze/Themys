"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CheckCircle2, Loader2 } from "lucide-react"

export default function CheckoutSuccessPage() {
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/dashboard")
    }, 3000)

    return () => clearTimeout(timer)
  }, [router])

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#6cf8bb]/20">
          <CheckCircle2 className="h-8 w-8 text-[#006c49]" strokeWidth={2} />
        </div>

        <h1 className="mt-6 text-[28px] font-medium tracking-[-0.035em] leading-tight text-foreground">
          Payment successful!
        </h1>
        <p className="mt-3 text-[16px] leading-6 text-[var(--ds-text-secondary)]">
          Your subscription is now active. Redirecting to your dashboard...
        </p>

        <div className="mt-6 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>

        <div className="mt-8">
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-white transition hover:opacity-90"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
