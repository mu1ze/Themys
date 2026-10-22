export function isMonitoringEmailEligible(input: {
  isActive: boolean
  emailNotificationsEnabled: boolean
  emailAlertsAllowed: boolean
  email: string | null | undefined
}): boolean {
  return Boolean(
    input.isActive &&
      input.emailNotificationsEnabled &&
      input.emailAlertsAllowed &&
      input.email?.trim(),
  )
}
