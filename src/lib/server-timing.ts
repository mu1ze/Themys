const MAX_REQUEST_ID_LENGTH = 96

function timingName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 48)
}

export function requestIdFrom(request: Request): string {
  const supplied = request.headers.get("x-request-id")?.trim()
  if (supplied) {
    const safe = supplied.replace(/[^a-zA-Z0-9._:-]/g, "-").slice(0, MAX_REQUEST_ID_LENGTH)
    if (safe) return safe
  }
  return crypto.randomUUID()
}

export class ServerTiming {
  private readonly durations = new Map<string, number>()

  async measure<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const startedAt = Date.now()
    try {
      return await operation()
    } finally {
      this.durations.set(timingName(name), Math.max(0, Date.now() - startedAt))
    }
  }

  header(): string | null {
    if (this.durations.size === 0) return null

    return Array.from(this.durations.entries())
      .map(([name, duration]) => `${name};dur=${duration}`)
      .join(", ")
  }
}
