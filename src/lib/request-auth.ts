import "server-only"

import { auth } from "@clerk/nextjs/server"

import {
  ApiKeyScopeError,
  authenticateApiKey,
  enforceScope,
  type AuthenticatedApiKey,
} from "@/lib/api-keys"

export type RequestIdentity =
  | { kind: "clerk"; clerkId: string; apiKey: null }
  | { kind: "api-key"; clerkId: string; apiKey: AuthenticatedApiKey }

export type RequestAuthResult =
  | { ok: true; identity: RequestIdentity }
  | { ok: false; status: 401 | 403; error: string; requiredScope?: string; apiKey?: AuthenticatedApiKey }

type ResolveRequestAuthOptions = {
  apiKeyScope?: string
  allowApiKey?: boolean
}

/** Resolve identity only from credentials verified by Clerk or the API-key store. */
export async function resolveRequestAuth(
  request: Request,
  options: ResolveRequestAuthOptions = {},
): Promise<RequestAuthResult> {
  const authorization = request.headers.get("authorization")?.trim() ?? ""
  const hasApiKeyCredential = /^Bearer\s+tmys_/i.test(authorization)

  if (options.allowApiKey !== false) {
    const apiKey = await authenticateApiKey(request)
    if (apiKey) {
      if (options.apiKeyScope) {
        try {
          enforceScope(apiKey, options.apiKeyScope)
        } catch (error) {
          if (error instanceof ApiKeyScopeError) {
            return {
              ok: false,
              status: 403,
              error: error.message,
              requiredScope: error.required,
              apiKey,
            }
          }
          throw error
        }
      }

      return {
        ok: true,
        identity: { kind: "api-key", clerkId: apiKey.clerkId, apiKey },
      }
    }
  }

  // Never fall through from a malformed/revoked Themys key to another identity.
  if (hasApiKeyCredential) {
    return { ok: false, status: 401, error: "Invalid API key" }
  }

  try {
    const clerkAuth = await auth()
    if (clerkAuth.isAuthenticated && clerkAuth.userId) {
      return {
        ok: true,
        identity: { kind: "clerk", clerkId: clerkAuth.userId, apiKey: null },
      }
    }
  } catch {
    // Missing and invalid Clerk credentials have the same public response.
  }

  return { ok: false, status: 401, error: "Authentication required" }
}
