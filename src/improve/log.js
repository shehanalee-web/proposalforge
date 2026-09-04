/**
 * Structured provider logs. Never print API keys or full prompts.
 *
 * @param {string} event
 * @param {object} [payload]
 */
export function logAi(event, payload = {}) {
  const line = {
    scope: 'ai',
    event,
    ts: new Date().toISOString(),
    provider: payload.provider ?? null,
    model: payload.model ?? null,
    findingCode: payload.findingCode ?? null,
    durationMs: payload.durationMs ?? null,
    status: payload.status ?? null,
    code: payload.code ?? null,
    streamed: payload.streamed ?? null,
    promptChars: payload.promptChars ?? null,
    completionChars: payload.completionChars ?? null,
    promptTokens: payload.promptTokens ?? null,
    completionTokens: payload.completionTokens ?? null,
  }

  if (payload.code || payload.status >= 400) {
    console.warn(JSON.stringify(line))
    return
  }

  console.info(JSON.stringify(line))
}
