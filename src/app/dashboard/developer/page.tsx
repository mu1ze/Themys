import { currentUser } from "@clerk/nextjs/server"
import { listApiKeys, getApiUsageStats } from "@/lib/api-keys"
import { DeveloperClient } from "./developer-client"

export default async function DeveloperPage() {
  const user = await currentUser()
  const clerkId = user?.id

  if (!clerkId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--ds-bg)]">
        <p className="text-[var(--ds-text-secondary)]">Please sign in to access the Developer Portal.</p>
      </div>
    )
  }

  const [keys, stats] = await Promise.all([
    listApiKeys(clerkId).catch(() => []),
    getApiUsageStats(clerkId, 30).catch(() => ({
      totalRequests: 0,
      successCount: 0,
      errorCount: 0,
      successRate: 0,
      errorRate: 0,
      dailyRequests: [],
      recentErrors: [],
    })),
  ])

  return <DeveloperClient initialKeys={keys} initialStats={stats} />
}
