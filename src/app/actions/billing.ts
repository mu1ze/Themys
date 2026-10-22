"use server"

import { currentUser } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"

import { isAdmin } from "@/lib/admin"
import {
  createBillingCase,
  transitionBillingCase,
  type BillingCaseKind,
} from "@/lib/billing-operations"
import { queueBillingNotification } from "@/lib/billing-notifications"

const CUSTOMER_KINDS = new Set<BillingCaseKind>([
  "refund_request", "unrecognized_charge", "duplicate_charge", "billing_error",
  "cancellation_problem", "missing_entitlement",
])

export async function submitBillingCase(formData: FormData): Promise<
  { ok: true; caseId: string } | { ok: false; error: string }
> {
  const user = await currentUser()
  if (!user?.id) return { ok: false, error: "Please sign in first." }
  const kind = formData.get("kind")
  const invoiceId = formData.get("invoiceId")
  const reason = formData.get("reason")
  const details = formData.get("details")
  if (formData.get("confirmEmail") !== "yes") {
    return { ok: false, error: "Please confirm your account email is current." }
  }
  if (typeof kind !== "string" || !CUSTOMER_KINDS.has(kind as BillingCaseKind)) {
    return { ok: false, error: "Choose a request type." }
  }
  if (typeof invoiceId !== "string" || invoiceId.length > 80 ||
    typeof reason !== "string" || reason.trim().length < 3 || reason.length > 120 ||
    typeof details !== "string" || details.trim().length < 10 || details.length > 2000) {
    return { ok: false, error: "Choose a payment and add a short description (10–2,000 characters)." }
  }
  if (/(?:\d[\s-]*?){13,19}/.test(`${reason} ${details}`)) {
    return { ok: false, error: "Please remove card numbers from your request." }
  }
  try {
    const caseId = await createBillingCase({
      clerkId: user.id, kind: kind as BillingCaseKind,
      invoiceId: invoiceId || null,
      reason: reason.trim(), details: details.trim(),
    })
    await queueBillingNotification("case_received", caseId, `case-received:${caseId}`)
    if (kind === "unrecognized_charge" || kind === "cancellation_problem") {
      await queueBillingNotification("urgent_case_alert", caseId, `urgent-case:${caseId}`)
    }
    revalidatePath("/settings")
    return { ok: true, caseId }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Request could not be saved." }
  }
}

export async function updateBillingCase(formData: FormData): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const user = await currentUser()
  if (!user?.id || !isAdmin(user.id)) return { ok: false, error: "Forbidden" }
  const caseId = formData.get("caseId")
  const status = formData.get("status")
  const note = formData.get("note")
  const allowed = new Set(["triaged", "awaiting_customer", "under_review", "approved", "denied", "closed"])
  if (typeof caseId !== "string" || caseId.length > 80 ||
    typeof status !== "string" || !allowed.has(status) ||
    typeof note !== "string" || note.trim().length < 5 || note.length > 1000) {
    return { ok: false, error: "Choose a status and add a brief decision note." }
  }
  try {
    await transitionBillingCase({
      caseId, status: status as Parameters<typeof transitionBillingCase>[0]["status"],
      actorId: user.id, note: note.trim(),
    })
    await queueBillingNotification("case_updated", caseId, `case-updated:${caseId}:${status}:${Date.now()}`)
    revalidatePath("/admin/billing")
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Update failed" }
  }
}
