function secretsEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length)
  let mismatch = left.length ^ right.length
  for (let index = 0; index < length; index++) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0)
  }
  return mismatch === 0
}

export function verifyCronAuthorization(
  request: Request,
  configuredSecret: string | undefined,
): "authorized" | "unauthorized" | "misconfigured" {
  if (!configuredSecret) return "misconfigured"
  const authorization = request.headers.get("authorization")
  const providedSecret = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : request.headers.get("x-cron-secret") ?? ""
  return secretsEqual(providedSecret, configuredSecret) ? "authorized" : "unauthorized"
}
