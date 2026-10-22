import assert from "node:assert/strict"
import test from "node:test"
import { isMonitoringEmailEligible } from "./monitoring-email-policy.ts"

test("monitoring email eligibility follows plan, subscription, and account state", () => {
  assert.equal(isMonitoringEmailEligible({ isActive: true, emailNotificationsEnabled: true, emailAlertsAllowed: true, email: "person@example.com" }), true)
  assert.equal(isMonitoringEmailEligible({ isActive: true, emailNotificationsEnabled: true, emailAlertsAllowed: false, email: "person@example.com" }), false)
  assert.equal(isMonitoringEmailEligible({ isActive: true, emailNotificationsEnabled: false, emailAlertsAllowed: true, email: "person@example.com" }), false)
  assert.equal(isMonitoringEmailEligible({ isActive: false, emailNotificationsEnabled: true, emailAlertsAllowed: true, email: "person@example.com" }), false)
  assert.equal(isMonitoringEmailEligible({ isActive: true, emailNotificationsEnabled: true, emailAlertsAllowed: true, email: "   " }), false)
})
