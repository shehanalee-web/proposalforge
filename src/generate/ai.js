import { IMPROVE_PROVIDER } from '../improve/ids.js'
import { loadAiProvider } from '../improve/engine.js'
import { makeAiActivityRecord, estimateTokenCount, estimateCostUsd } from '../improve/activity.js'
import { ImproveError, IMPROVE_ERROR_CODE, isImproveAbort } from '../improve/errors.js'
import { logAi } from '../improve/log.js'
import { buildProposalGenerationContext } from './context.js'
import { assertRequiredInputs } from './inputs.js'
import { buildMockGeneratedDraft } from './mock.js'
import { buildProposalGenerationPrompt } from './prompt.js'
import { parseGeneratedProposal } from './schema.js'
import { collectGenerationWarnings, validateGeneratedFacts } from './validate.js'
import { proposalFromGeneratedDraft } from './assemble.js'
import { sanitizeGenerationMetadata } from './metadata.js'

function isMockProvider(provider) {
  return (
    provider?.id === IMPROVE_PROVIDER.MOCK ||
    provider?.id === IMPROVE_PROVIDER.DETERMINISTIC
  )
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw new ImproveError('Generation failed.', {
      code: IMPROVE_ERROR_CODE.CANCELLED,
      retryable: true,
    })
  }
}

function publicResult({
  draft,
  warnings,
  review,
  context,
  activity,
  provider,
  settings,
  payload,
}) {
  const generation = sanitizeGenerationMetadata({
    provider: provider.id,
    model: provider.model,
    proposalType: context.proposalInputs.proposalType,
    knowledgeIdsUsed: context.knowledgeIds,
    durationMs: activity.durationMs,
    promptTokens: activity.promptTokens,
    completionTokens: activity.completionTokens,
    totalTokens: activity.totalTokens,
    estimatedCostUsd: activity.estimatedCostUsd,
    warnings,
    reviewRequired: review.reviewRequired,
  })

  return {
    draft: {
      ...draft,
      warnings,
      reviewRequired: review.reviewRequired,
      issues: review.issues,
      knowledgeUsed: (context.knowledge.items ?? []).map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type,
      })),
    },
    proposalPayload: {
      ...payload,
      generation,
    },
    knowledgeIds: context.knowledgeIds,
    warnings,
    activity,
    settings,
    provider: {
      id: provider.id,
      label: provider.label,
      model: provider.model,
    },
    created: false,
  }
}

/**
 * Server-side proposal generation. Uses the existing provider abstraction.
 * Never creates a proposal record.
 *
 * @param {object} input
 * @param {Record<string, string | undefined>} env
 * @param {{ signal?: AbortSignal, onDelta?: (text: string) => void, onActivity?: (row: object) => void, onStatus?: (status: string) => void }} [hooks]
 */
export async function generateProposal(input = {}, env = {}, hooks = {}) {
  const started = Date.now()
  let provider
  let settings
  let stream = false
  let context
  hooks.onStatus?.('preparing')
  context = buildProposalGenerationContext(input)
  assertRequiredInputs(context.proposalInputs)
  throwIfAborted(hooks.signal)

  ;({ provider, settings } = await loadAiProvider(env))
  const prompts = buildProposalGenerationPrompt({
    proposalInputs: context.proposalInputs,
    facts: context.facts,
    knowledge: context.knowledge,
    sectionPlan: context.sectionPlan,
    companyVoice: context.companyVoice,
  })
  stream = Boolean(hooks.onDelta && settings.streaming && provider.supportsStreaming)

  logAi('generate-proposal.start', {
    provider: provider.id,
    model: provider.model,
    streamed: stream,
    promptChars: prompts.userPrompt.length,
  })

  try {
    throwIfAborted(hooks.signal)
    hooks.onStatus?.('retrieving_knowledge')
    hooks.onStatus?.('generating')

    let text = ''
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    let parsed

    if (isMockProvider(provider) || typeof provider.complete !== 'function') {
      parsed = buildMockGeneratedDraft(context)
      text = JSON.stringify(parsed)
      hooks.onDelta?.(text)
    } else {
      const result = await provider.complete({
        prompts,
        request: {
          proposalType: context.proposalInputs.proposalType,
          clientName: context.proposalInputs.clientName,
        },
        options: {
          stream,
          timeoutMs: settings.timeoutMs,
          temperature: settings.temperature,
        },
        signal: hooks.signal,
        onDelta: stream ? hooks.onDelta : undefined,
      })
      text = String(result?.text ?? '').trim()
      usage = result?.usage ?? usage
      if (!stream) hooks.onDelta?.(text)
      parsed = parseGeneratedProposal(text)
    }

    throwIfAborted(hooks.signal)
    hooks.onStatus?.('validating')
    const review = validateGeneratedFacts(parsed, context.facts)
    const warnings = collectGenerationWarnings({
      proposalInputs: context.proposalInputs,
      knowledgeItems: context.knowledge.items,
      review,
    })
    const payload = proposalFromGeneratedDraft({
      draft: parsed,
      context,
      generation: {
        provider: provider.id,
        model: provider.model,
        durationMs: Date.now() - started,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        estimatedCostUsd: estimateCostUsd(
          provider.id,
          usage.promptTokens || estimateTokenCount(prompts.userPrompt),
          usage.completionTokens || estimateTokenCount(text),
        ),
        warnings,
        reviewRequired: review.reviewRequired,
      },
    })

    const promptTokens = usage.promptTokens || estimateTokenCount(prompts.userPrompt)
    const completionTokens = usage.completionTokens || estimateTokenCount(text)
    const activity = makeAiActivityRecord({
      provider: provider.id,
      model: provider.model,
      promptTokens,
      completionTokens,
      totalTokens: usage.totalTokens || promptTokens + completionTokens,
      estimatedCostUsd: estimateCostUsd(provider.id, promptTokens, completionTokens),
      durationMs: Date.now() - started,
      proposalId: null,
      findingCode: 'generate-proposal',
      status: 'ok',
      streamed: stream,
      capability: 'generate-proposal',
      knowledgeIds: context.knowledgeIds,
      result: 'ok',
    })
    hooks.onActivity?.(activity)

    logAi('generate-proposal.ok', {
      provider: provider.id,
      durationMs: activity.durationMs,
      promptTokens,
      completionTokens,
    })

    return publicResult({
      draft: parsed,
      warnings,
      review,
      context,
      activity,
      provider,
      settings,
      payload,
    })
  } catch (error) {
    const failed = isImproveAbort(error)
      ? new ImproveError('Generation failed.', {
          code: IMPROVE_ERROR_CODE.CANCELLED,
          retryable: true,
        })
      : error instanceof ImproveError
        ? error
        : error?.name === 'ValidationError'
          ? error
          : new ImproveError('Generation failed.', {
              code: IMPROVE_ERROR_CODE.UNKNOWN,
              retryable: true,
            })

    const activity = makeAiActivityRecord({
      provider: provider?.id,
      model: provider?.model,
      durationMs: Date.now() - started,
      proposalId: null,
      findingCode: 'generate-proposal',
      status: failed.code ?? 'failed',
      streamed: stream,
      capability: 'generate-proposal',
      knowledgeIds: context?.knowledgeIds ?? [],
      result: failed.code === IMPROVE_ERROR_CODE.CANCELLED ? 'cancelled' : 'failed',
    })
    hooks.onActivity?.(activity)

    logAi('generate-proposal.error', {
      provider: provider?.id,
      code: failed.code,
    })

    throw failed
  }
}
