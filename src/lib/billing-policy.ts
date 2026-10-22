// Bump these identifiers when public wording changes. Checkout stores the
// versions that the customer saw; old purchase records keep their old values.
export const BILLING_POLICY = {
  termsVersion: "2026-09-22",
  privacyVersion: "2026-09-22",
  refundVersion: "2026-09-22",
  acknowledgementVersion: "checkout-2026-09-22",
  firstPurchaseDays: 14,
  renewalDays: 7,
  unusedCreditDays: 14,
} as const
