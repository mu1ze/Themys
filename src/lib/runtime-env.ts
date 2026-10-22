import { getCloudflareContext } from "@opennextjs/cloudflare"

export type WorkerServiceBinding = {
  fetch(request: Request): Promise<Response>
}

export type RuntimeEnvironment = Record<string, string | undefined>

/**
 * Read configuration at request time from the Cloudflare Worker bindings.
 *
 * OpenNext also supports local Node development and tests, where no Worker
 * context exists, so retain process.env as a fallback. Merging preserves
 * framework values such as NODE_ENV while Worker secrets/vars take priority.
 */
export function getRuntimeEnvironment(): RuntimeEnvironment {
  const processEnvironment: RuntimeEnvironment = process.env

  try {
    const workerEnvironment: RuntimeEnvironment = {}
    for (const [name, value] of Object.entries(getCloudflareContext().env)) {
      if (typeof value === "string") workerEnvironment[name] = value
    }
    return {
      ...processEnvironment,
      ...workerEnvironment,
    }
  } catch {
    return processEnvironment
  }
}

export function getRequiredRuntimeEnvironmentValue(name: string): string {
  const value = getRuntimeEnvironment()[name]
  if (!value?.trim()) {
    throw new Error(`${name} must be configured in the runtime environment`)
  }
  return value
}
