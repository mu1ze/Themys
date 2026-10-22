import assert from "node:assert/strict"
import test from "node:test"
import worker, { DeliveryCoordinator } from "./index.ts"

class MemoryStorage {
  values = new Map<string, string>()

  async get(key: string) { return this.values.get(key) ? JSON.parse(this.values.get(key)!) : null }
  async put(key: string, value: unknown) { this.values.set(key, JSON.stringify(value)) }
  async delete(key: string) { this.values.delete(key) }
  async setAlarm() {}
}

class MemoryCoordinator {
  objects = new Map<string, DeliveryCoordinator>()
  private readonly send: (message: unknown) => Promise<void>

  constructor(send: (message: unknown) => Promise<void>) {
    this.send = send
  }

  idFromName(name: string) { return name }
  get(id: unknown) {
    let coordinator = this.objects.get(String(id))
    if (!coordinator) {
      const state = {
        storage: new MemoryStorage(),
        blockConcurrencyWhile: async <T>(callback: () => Promise<T>) => callback(),
      }
      coordinator = new DeliveryCoordinator(state, { SEND_EMAIL: { send: this.send } })
      this.objects.set(String(id), coordinator)
    }
    return { fetch: (request: Request) => coordinator!.fetch(request) }
  }
}

function deliveryRequest(payload: Record<string, unknown>, key: string): Request {
  const body = JSON.stringify({ ...payload, idempotencyKey: key })
  return new Request("https://email-worker.example/deliver", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      "x-themys-idempotency-key": key,
    },
  })
}

function environment(send: (message: unknown) => Promise<void>) {
  return {
    SEND_EMAIL: { send },
    DELIVERY_COORDINATOR: new MemoryCoordinator(send),
    MONITORING_EMAIL_FROM: "alerts@themys.ca",
    APP_URL: "https://themys.ca",
  }
}

test("service-bound delivery sends once and idempotency returns a duplicate response", async () => {
  const messages: unknown[] = []
  const env = environment(async (message) => { messages.push(message) })
  ;(globalThis as unknown as { EmailMessage: new (from: string, to: string, raw: string) => unknown }).EmailMessage = class {
    from: string
    to: string
    raw: string

    constructor(from: string, to: string, raw: string) {
      this.from = from
      this.to = to
      this.raw = raw
    }
  }
  const payload = { to: "person@example.com", subject: "Changed", text: "A change", html: "<p>A change</p>" }

  const first = await worker.fetch(deliveryRequest(payload, "alert-1"), env)
  const second = await worker.fetch(deliveryRequest(payload, "alert-1"), env)

  assert.equal(first.status, 200)
  assert.deepEqual(await first.json(), { ok: true, duplicate: false })
  assert.equal(second.status, 200)
  assert.deepEqual(await second.json(), { ok: true, duplicate: true })
  assert.equal(messages.length, 1)
})

test("a provider failure clears the key so the delivery can be retried", async () => {
  let attempts = 0
  const env = environment(async () => {
    attempts++
    if (attempts === 1) throw new Error("provider unavailable")
  })
  ;(globalThis as unknown as { EmailMessage: new (from: string, to: string, raw: string) => unknown }).EmailMessage = class {
    from: string
    to: string
    raw: string

    constructor(from: string, to: string, raw: string) {
      this.from = from
      this.to = to
      this.raw = raw
    }
  }
  const payload = { to: "person@example.com", subject: "Changed", text: "A change", html: "<p>A change</p>" }

  const failed = await worker.fetch(deliveryRequest(payload, "alert-2"), env)
  const retried = await worker.fetch(deliveryRequest(payload, "alert-2"), env)

  assert.equal(failed.status, 502)
  assert.equal(retried.status, 200)
  assert.deepEqual(await retried.json(), { ok: true, duplicate: false })
  assert.equal(attempts, 2)
})

test("malformed and wrong-method requests are rejected", async () => {
  const env = environment(async () => {})
  const unsigned = await worker.fetch(new Request("https://email-worker.example/deliver", { method: "POST", body: "{}" }), env)
  const malformed = await worker.fetch(deliveryRequest({ to: "not-an-email", subject: "Changed", text: "A change" }, "alert-3"), env)
  const wrongMethod = await worker.fetch(new Request("https://email-worker.example/deliver"), env)

  assert.equal(unsigned.status, 400)
  assert.equal(malformed.status, 400)
  assert.equal(wrongMethod.status, 404)
})
