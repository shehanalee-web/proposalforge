import { createRecordId } from '../models/ids.js'
import { IMPROVE_PROVIDER } from './ids.js'

const COST_PER_MILLION = Object.freeze({
  [IMPROVE_PROVIDER.OPENAI]: { input: 0.15, output: 0.6 },
  [IMPROVE_PROVIDER.ANTHROPIC]: { input: 0.8, output: 4 },
  [IMPROVE_PROVIDER.GEMINI]: { input: 0.1, output: 0.4 },
  [IMPROVE_PROVIDER.LOCAL]: { input: 0, output: 0 },
  [IMPROVE_PROVIDER.MOCK]: { input: 0, output: 0 },
  [IMPROVE_PROVIDER.DETERMINISTIC]: { input: 0, output: 0 },
})

export function estimateTokenCount(text) {
  const chars = String(text ?? '').length
  if (!chars) return 0
  return Math.max(1, Math.ceil(chars / 4))
}

export function estimateCostUsd(provider, promptTokens, completionTokens) {
  const rates = COST_PER_MILLION[provider] ?? COST_PER_MILLION[IMPROVE_PROVIDER.MOCK]
  const input = (Number(promptTokens) || 0) / 1_000_000
  const output = (Number(completionTokens) || 0) / 1_000_000
  return Number((input * rates.input + output * rates.output).toFixed(6))
}

/**
 * @param {object} [input]
 */
export function makeAiActivityRecord(input = {}) {
  const promptTokens = Number(input.promptTokens) || 0
  const completionTokens = Number(input.completionTokens) || 0
  const totalTokens =
    Number(input.totalTokens) || promptTokens + completionTokens

  return {
    id: input.id ?? createRecordId('ai'),
    timestamp: input.timestamp ?? new Date().toISOString(),
    provider: String(input.provider ?? IMPROVE_PROVIDER.MOCK),
    model: String(input.model ?? ''),
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCostUsd:
      input.estimatedCostUsd ??
      estimateCostUsd(input.provider, promptTokens, completionTokens),
    durationMs: Number(input.durationMs) || 0,
    proposalId: input.proposalId ?? null,
    findingCode: input.findingCode ?? null,
    status: String(input.status ?? 'ok'),
    streamed: Boolean(input.streamed),
  }
}
