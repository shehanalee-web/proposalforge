/**
 * Sanitized generation metadata. Never stores API keys, prompts, or raw provider payloads.
 *
 * @param {object} [input]
 */
export function sanitizeGenerationMetadata(input) {
  if (!input || typeof input !== 'object') return null
  const knowledgeIds = Array.isArray(input.knowledgeIdsUsed ?? input.knowledgeIds)
    ? [...new Set((input.knowledgeIdsUsed ?? input.knowledgeIds).map((id) => String(id).trim()).filter(Boolean))]
    : []

  return {
    generatedAt: String(input.generatedAt ?? new Date().toISOString()),
    provider: String(input.provider ?? ''),
    model: String(input.model ?? ''),
    proposalType: String(input.proposalType ?? ''),
    knowledgeIdsUsed: knowledgeIds,
    generationDurationMs: Number(input.generationDurationMs ?? input.durationMs) || 0,
    promptTokens: Number(input.promptTokens) || 0,
    completionTokens: Number(input.completionTokens) || 0,
    totalTokens: Number(input.totalTokens) || 0,
    estimatedCostUsd: Number(input.estimatedCostUsd) || 0,
    warnings: Array.isArray(input.warnings)
      ? input.warnings.map((entry) => ({
          code: String(entry.code ?? ''),
          message: String(entry.message ?? ''),
          action: String(entry.action ?? ''),
        }))
      : [],
    reviewRequired: Boolean(input.reviewRequired),
  }
}
