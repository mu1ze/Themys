export type OpenRouterChatRequest = {
  model: string
  messages: Array<{ role: "system" | "user"; content: string }>
  response_format: { type: "json_object" }
  provider: { zdr: true }
}

/**
 * Keep the privacy boundary in one place so every OpenRouter analysis request
 * is restricted to provider endpoints that advertise zero data retention.
 */
export function buildOpenRouterChatRequest(
  model: string,
  systemPrompt: string,
  text: string,
): OpenRouterChatRequest {
  return {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ],
    response_format: { type: "json_object" },
    provider: { zdr: true },
  }
}
