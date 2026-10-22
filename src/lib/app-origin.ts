const LOCAL_ORIGIN = "http://localhost:3000"

export const CANONICAL_PRODUCTION_ORIGIN = "https://themys.ca"

type AppEnvironment = {
  NODE_ENV?: string
  APP_URL?: string
  NEXT_PUBLIC_APP_URL?: string
}

function normalizeOrigin(value: string, variableName: string, production: boolean): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${variableName} must be an absolute URL`)
  }

  if (url.origin !== value.replace(/\/$/, "")) {
    throw new Error(`${variableName} must contain only an origin (no path, query, or fragment)`)
  }
  if (production && url.protocol !== "https:") {
    throw new Error(`${variableName} must use HTTPS in production`)
  }
  if (production && /^(?:localhost|127(?:\.\d+){3}|\[::1\])$/i.test(url.hostname)) {
    throw new Error(`${variableName} cannot use a loopback host in production`)
  }

  return url.origin
}

/**
 * Resolve the server-side application origin.
 *
 * APP_URL is the canonical setting. NEXT_PUBLIC_APP_URL is accepted only in
 * development for compatibility with older local environments; it is never
 * required by client code and therefore does not need to be bundled.
 */
export function getAppOrigin(env: AppEnvironment = getRuntimeEnvironment()): string {
  const production = env.NODE_ENV === "production"
  const configured = env.APP_URL ?? (!production ? env.NEXT_PUBLIC_APP_URL : undefined)

  if (!configured) {
    if (production) {
      throw new Error("APP_URL is required for production builds and runtime")
    }
    return LOCAL_ORIGIN
  }

  return normalizeOrigin(configured, env.APP_URL ? "APP_URL" : "NEXT_PUBLIC_APP_URL", production)
}
import { getRuntimeEnvironment } from "./runtime-env.ts"
