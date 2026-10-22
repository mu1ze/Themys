"use server"

import { currentUser, clerkClient } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { getDatabase, getDatabaseBinding } from "@/lib/database"
import { getStripe } from "@/lib/stripe"
import {
  getUserProfileByClerkId,
  updateUserTargetClauses,
} from "@/lib/persistence"
import { deleteUserScanDocuments } from "@/lib/object-storage"
import { deleteCachedScansByTextHash, deleteCachedText } from "@/lib/cache"
import { isPlaybookId, type PlaybookId } from "@/lib/playbooks"
import { hashUsageActor, recordUsageEvent } from "@/lib/usage-accounting"
import { getAppOrigin } from "@/lib/app-origin"
import { queueBillingNotification } from "@/lib/billing-notifications"

export async function createBillingPortalSession(): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const user = await currentUser()
  if (!user?.id) return { ok: false, error: "Please sign in first." }
  const profile = await getUserProfileByClerkId(user.id)
  if (!profile?.stripeCustomerId) return { ok: false, error: "No billing account is linked yet." }
  try {
    const portal = await getStripe().billingPortal.sessions.create({
      customer: profile.stripeCustomerId,
      return_url: `${getAppOrigin()}/settings#subscription`,
    })
    return { ok: true, url: portal.url }
  } catch (error) {
    console.error("[billing portal] Unable to create session", error instanceof Error ? error.name : "UnknownError")
    return { ok: false, error: "Billing management is temporarily unavailable." }
  }
}

export async function resumeSubscription(): Promise<{ success: boolean; error?: string }> {
  const user = await currentUser()
  if (!user?.id) return { success: false, error: "Not authenticated" }
  const database = getDatabase()
  const { data } = await database.from("users")
    .select("id, stripe_subscription_id")
    .eq("clerk_id", user.id).maybeSingle()
  if (!data?.stripe_subscription_id) return { success: false, error: "No subscription found" }
  try {
    const subscription = await getStripe().subscriptions.retrieve(data.stripe_subscription_id)
    if (!subscription.cancel_at_period_end || subscription.status === "canceled") {
      return { success: false, error: "This subscription cannot be resumed" }
    }
    await getStripe().subscriptions.update(subscription.id, { cancel_at_period_end: false })
    const { error } = await database.from("users").update({
      subscription_status: "active", updated_at: new Date().toISOString(),
    }).eq("id", data.id)
    if (error) console.warn("[billing] Resume confirmed by Stripe; local state update pending")
    await queueBillingNotification("resume_confirmation", data.id, `resume:${subscription.id}:${Date.now()}`)
      .catch(() => console.warn("[billing] Resume email was not queued"))
    return { success: true }
  } catch (error) {
    console.error("[billing] Resume failed", error instanceof Error ? error.name : "UnknownError")
    return { success: false, error: "Unable to resume subscription" }
  }
}

export async function cancelSubscription(): Promise<{ success: boolean; error?: string }> {
  const user = await currentUser()
  if (!user?.id) {
    return { success: false, error: "Not authenticated" }
  }

  const profile = await getUserProfileByClerkId(user.id)
  if (!profile?.stripeCustomerId) {
    return { success: false, error: "No active subscription found" }
  }

  try {
    const database = getDatabase()
    const { data: userData } = await database
      .from("users")
      .select("id, stripe_subscription_id")
      .eq("clerk_id", user.id)
      .maybeSingle()

    if (!userData?.stripe_subscription_id) {
      return { success: false, error: "No active subscription found" }
    }

    const stripe = getStripe()
    const subscription = await stripe.subscriptions.update(userData.stripe_subscription_id, {
      cancel_at_period_end: true,
    })
    const periodEnd = subscription.items.data[0]?.current_period_end

    const updated = await database
      .from("users")
      .update({
        subscription_status: "canceling",
        subscription_ends_at: periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : profile.subscriptionEndsAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userData.id)
    if (updated.error) console.warn("[billing] Cancellation confirmed by Stripe; local state update pending")
    await queueBillingNotification("cancellation_confirmation", userData.id,
      `cancel:${subscription.id}:${periodEnd ?? "period-end"}`)
      .catch(() => console.warn("[billing] Cancellation email was not queued"))

    return { success: true }
  } catch (err) {
    console.error("Failed to cancel subscription", err instanceof Error ? err.name : "UnknownError")
    return { success: false, error: "Failed to cancel subscription" }
  }
}

export async function deleteAccount(): Promise<{ success: boolean; error?: string }> {
  const user = await currentUser()
  if (!user?.id) {
    return { success: false, error: "Not authenticated" }
  }

  try {
    const database = getDatabase()
    const { data: userData } = await database
      .from("users")
      .select("id, stripe_subscription_id")
      .eq("clerk_id", user.id)
      .maybeSingle()

    // Stop billing before removing the account: a deleted user can no longer
    // manage or cancel a subscription, so they must never keep being charged.
    // Fail closed — if Stripe cannot confirm cancellation, abort the deletion.
    if (userData?.stripe_subscription_id) {
      const stripe = getStripe()
      const subscription = await stripe.subscriptions.retrieve(userData.stripe_subscription_id)
      const cancellable = new Set(["active", "trialing", "past_due", "unpaid", "paused"])
      if (cancellable.has(subscription.status)) {
        await stripe.subscriptions.cancel(subscription.id)
      }
    }

    if (userData?.id) {
      await getDatabaseBinding().prepare("UPDATE purchase_acceptances SET clerk_id = NULL, user_id = NULL WHERE clerk_id = ?")
        .bind(user.id).run()
      const { data: userScans, error: scanLookupError } = await database
        .from("scans")
        .select("raw_text_hash, url")
        .eq("user_id", userData.id)
      if (scanLookupError) throw scanLookupError
      const { data: apiKeys, error: apiKeyLookupError } = await database
        .from("api_keys")
        .select("id")
        .eq("user_id", userData.id)
      if (apiKeyLookupError) throw apiKeyLookupError

      // Remove private document bodies first. If R2 is temporarily unavailable,
      // keep the relational account so the user can retry without orphaning an
      // object prefix that can no longer be derived from their Clerk identity.
      await deleteUserScanDocuments(userData.id as string)

      const hashes = new Set<string>()
      const urls = new Set<string>()
      for (const scan of userScans ?? []) {
        if (typeof scan.raw_text_hash === "string" && scan.raw_text_hash) {
          hashes.add(scan.raw_text_hash)
        }
        if (typeof scan.url === "string" && scan.url) urls.add(scan.url)
      }
      await Promise.all([
        ...Array.from(hashes, (hash) => deleteCachedScansByTextHash(hash)),
        ...Array.from(urls, (url) => deleteCachedText(url)),
      ])

      const actorHashes = await Promise.all([
        hashUsageActor(user.id),
        ...(apiKeys ?? []).flatMap((key) =>
          typeof key.id === "string" ? [hashUsageActor(`${user.id}:${key.id}`)] : [],
        ),
      ])
      const { error: eventDeleteError } = await database
        .from("usage_events")
        .delete()
        .in("actor_hash", actorHashes)
      if (eventDeleteError) throw eventDeleteError

      const { error: deleteError } = await database.from("users").delete().eq("id", userData.id)
      if (deleteError) throw deleteError
    }

    const client = await clerkClient()
    await client.users.deleteUser(user.id)
  } catch (err) {
    console.error("Failed to delete account", err instanceof Error ? err.name : "UnknownError")
    return { success: false, error: "Failed to delete account" }
  }

  redirect("/")
}

export async function updateTargetClauses(
  targetClauses: string[],
  strictMode: boolean,
  playbookId: PlaybookId
): Promise<{ success: boolean; error?: string }> {
  const user = await currentUser()
  if (!user?.id) {
    return { success: false, error: "Not authenticated" }
  }

  if (!isPlaybookId(playbookId)) {
    return { success: false, error: "Invalid playbook" }
  }

  try {
    const profile = await getUserProfileByClerkId(user.id)
    const validClauses = targetClauses
      .map(c => c.trim())
      .filter(c => c.length > 0 && c.length <= 100)

    await updateUserTargetClauses(user.id, validClauses, strictMode, playbookId)

    if (profile && profile.playbookId !== playbookId) {
      await recordUsageEvent({
        actor: user.id,
        client: "web",
        operation: "playbook_used",
        outcome: "select",
        metadata: { playbookId },
      }).catch(() => undefined)
    }

    return { success: true }
  } catch (err) {
    console.error("Failed to update target clauses", err instanceof Error ? err.name : "UnknownError")
    return { success: false, error: "Failed to update target clauses" }
  }
}
