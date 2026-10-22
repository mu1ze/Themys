import assert from "node:assert/strict"
import test from "node:test"
import {
  CREDIT_EXPIRY_MONTHS,
  PLAN_ENTITLEMENTS,
  getPlanEntitlements,
  isUnlimitedContractUpload,
  planDisplayName,
} from "./entitlements.ts"

test("entitlement matrix exposes the documented plan boundaries", () => {
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(PLAN_ENTITLEMENTS).map(([plan, value]) => [
        plan,
        [
          value.monthlyReviews,
          value.monthlyAiExplanations,
          value.monitorLimit,
          value.contractUploads,
          value.emailAlerts,
        ],
      ]),
    ),
    {
      free: [15, 15, 1, 1, false],
      base: [30, 30, 10, 0, true],
      advanced: [50, 50, 25, -1, true],
      lifetime: [50, 50, 25, -1, true],
    },
  )
  assert.equal(CREDIT_EXPIRY_MONTHS, 12)
})

test("unknown plans fail closed to the Free entitlements", () => {
  assert.equal(getPlanEntitlements("unknown").emailAlerts, false)
  assert.equal(getPlanEntitlements(null).monitorLimit, 1)
})

test("planDisplayName maps internal plan keys to product labels", () => {
  assert.equal(planDisplayName("free"), "Free")
  assert.equal(planDisplayName("base"), "Personal")
  assert.equal(planDisplayName("advanced"), "Founder")
  assert.equal(planDisplayName("lifetime"), "Lifetime")
  assert.equal(planDisplayName("unknown"), "Free")
})

test("isUnlimitedContractUpload is true only when contractUploads is negative", () => {
  assert.equal(isUnlimitedContractUpload("free"), false)
  assert.equal(isUnlimitedContractUpload("base"), false)
  assert.equal(isUnlimitedContractUpload("advanced"), true)
  assert.equal(isUnlimitedContractUpload("lifetime"), true)
})
