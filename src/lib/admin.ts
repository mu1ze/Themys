import "server-only"

import { auth, clerkClient } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { getRuntimeEnvironment } from "@/lib/runtime-env"

function getAdminIds(): Set<string> {
  return new Set(
    (getRuntimeEnvironment().ADMIN_CLERK_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
  )
}

export function isAdmin(clerkId: string): boolean {
  return getAdminIds().has(clerkId)
}

export async function requireAdmin(): Promise<string> {
  const { userId, sessionId } = await auth()
  if (!userId) {
    redirect("/sign-in")
  }
  if (!isAdmin(userId)) {
    if (sessionId) {
      try {
        await (await clerkClient()).sessions.revokeSession(sessionId)
      } catch {}
    }
    redirect("/sign-in?error=unauthorized")
  }
  return userId
}
