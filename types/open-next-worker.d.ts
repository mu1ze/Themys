// Public boundary of OpenNext's generated runtime, consumed by each custom-worker.ts.
declare const worker: {
  fetch(
    request: Request,
    env: Record<string, unknown>,
    ctx: { waitUntil(promise: Promise<unknown>): void },
  ): Response | Promise<Response>;
};

export default worker;
