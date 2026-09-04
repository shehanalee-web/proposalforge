import { IMPROVE_PROVIDER } from './ids.js'
import { makeAiActivityRecord, estimateTokenCount, estimateCostUsd } from './activity.js'
import { ImproveError, IMPROVE_ERROR_CODE, isImproveAbort } from './errors.js'
import { logAi } from './log.js'
import { parseImprovementResponse } from './parse.js'
import { buildImprovementPrompt } from './prompt.js'
import { resolveAiSettings } from './settings.js'
import { slimBlocksForFinding } from './context.js'

const LOADERS = {
  [IMPROVE_PROVIDER.OPENAI]: () =>
    import('./providers/openai.js').then((mod) => mod.createOpenAIProvider),
  [IMPROVE_PROVIDER.ANTHROPIC]: () =>
    import('./providers/anthropic.js').then((mod) => mod.createAnthropicProvider),
  [IMPROVE_PROVIDER.GEMINI]: () =>
    import('./providers/gemini.js').then((mod) => mod.createGeminiProvider),
  [IMPROVE_PROVIDER.LOCAL]: () =>
    import('./providers/local.js').then((mod) => mod.createLocalProvider),
  [IMPROVE_PROVIDER.MOCK]: () =>
    import('./providers/mock.js').then((mod) => mod.createMockProvider),
}

function normalizeRequest(input = {}) {
  const proposal = input.proposal ?? {}
  const finding = input.finding ?? {}
  const blocks = slimBlocksForFinding(input.blocks, finding)
  return {
    proposal,
    finding,
    blocks,
    company: input.company ?? {
      name: proposal.company,
      tone: input.options?.companyTone ?? '',
      voice: input.options?.brandVoice ?? '',
    },
    client: input.client ?? { name: proposal.clientName },
    options: {
      companyTone: input.options?.companyTone ?? input.company?.tone ?? '',
      brandVoice: input.options?.brandVoice ?? input.company?.voice ?? '',
      retry: Boolean(input.options?.retry),
      ...input.options,
    },
  }
}

function withUsage(draft, usage, provider) {
  const promptTokens = usage.promptTokens || estimateTokenCount(usage.prompt)
  const completionTokens = usage.completionTokens || estimateTokenCount(draft.previewBody)
  return {
    ...draft,
    provider: provider.id,
    usage: {
      provider: provider.id,
      model: provider.model,
      promptTokens,
      completionTokens,
      totalTokens: usage.totalTokens || promptTokens + completionTokens,
    },
  }
}

export async function loadAiProvider(env = {}) {
  const settings = resolveAiSettings(env)
  const loader = LOADERS[settings.provider] ?? LOADERS[IMPROVE_PROVIDER.MOCK]
  const create = await loader()
  const provider = create(env)
  return { provider, settings }
}

/**
 * Server-side generate. Providers only receive assembled prompts.
 *
 * @param {object} input
 * @param {Record<string, string | undefined>} env
 * @param {{ signal?: AbortSignal, onDelta?: (text: string) => void, onActivity?: (row: object) => void }} [hooks]
 */
export async function generateImprovement(input = {}, env = {}, hooks = {}) {
  const started = Date.now()
  const request = normalizeRequest(input)
  const { provider, settings } = await loadAiProvider(env)
  const prompts = buildImprovementPrompt(request)
  const stream = Boolean(
    hooks.onDelta && settings.streaming && provider.supportsStreaming,
  )

  logAi('generate.start', {
    provider: provider.id,
    model: provider.model,
    findingCode: request.finding.code,
    streamed: stream,
    promptChars: prompts.systemPrompt.length + prompts.userPrompt.length,
    fallback: settings.fallback,
  })

  try {
    let result
    if (provider.id === IMPROVE_PROVIDER.MOCK || typeof provider.complete !== 'function') {
      const draft = await provider.generateImprovement(request)
      hooks.onDelta?.(draft.previewBody)
      result = { text: draft.previewBody, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, draft }
    } else {
      result = await provider.complete({
        prompts,
        request,
        options: {
          stream,
          timeoutMs: settings.timeoutMs,
          temperature: settings.temperature,
          retry: request.options.retry,
        },
        signal: hooks.signal,
        onDelta: stream ? hooks.onDelta : undefined,
      })
    }

    const draft = withUsage(
      result.draft ??
        parseImprovementResponse(result.text, { ...request, provider: provider.id }),
      result.usage ?? {},
      provider,
    )

    if (!stream) hooks.onDelta?.(draft.previewBody)

    const activity = makeAiActivityRecord({
      provider: provider.id,
      model: provider.model,
      promptTokens: draft.usage.promptTokens,
      completionTokens: draft.usage.completionTokens,
      totalTokens: draft.usage.totalTokens,
      estimatedCostUsd: estimateCostUsd(
        provider.id,
        draft.usage.promptTokens,
        draft.usage.completionTokens,
      ),
      durationMs: Date.now() - started,
      proposalId: request.proposal.id ?? null,
      findingCode: request.finding.code ?? null,
      status: 'ok',
      streamed: stream,
    })
    hooks.onActivity?.(activity)

    logAi('generate.ok', {
      provider: provider.id,
      model: provider.model,
      findingCode: request.finding.code,
      durationMs: activity.durationMs,
      streamed: stream,
      promptTokens: activity.promptTokens,
      completionTokens: activity.completionTokens,
    })

    return { draft, activity, settings, provider: providerMetadata(provider) }
  } catch (error) {
    const failed = isImproveAbort(error)
      ? new ImproveError('Generation failed.', {
          code: IMPROVE_ERROR_CODE.CANCELLED,
          retryable: true,
        })
      : error instanceof ImproveError
        ? error
        : new ImproveError('Generation failed.', {
            code: IMPROVE_ERROR_CODE.UNKNOWN,
            retryable: true,
          })

    const activity = makeAiActivityRecord({
      provider: provider.id,
      model: provider.model,
      durationMs: Date.now() - started,
      proposalId: request.proposal.id ?? null,
      findingCode: request.finding.code ?? null,
      status: failed.code,
      streamed: stream,
    })
    hooks.onActivity?.(activity)

    logAi('generate.error', {
      provider: provider.id,
      model: provider.model,
      findingCode: request.finding.code,
      durationMs: activity.durationMs,
      code: failed.code,
      status: failed.status,
    })

    throw failed
  }
}

function providerMetadata(provider) {
  return {
    id: provider.id,
    label: provider.label,
    model: provider.model,
    supportsStreaming: Boolean(provider.supportsStreaming),
    supportsJSON: provider.supportsJSON !== false,
    supportsVision: Boolean(provider.supportsVision),
    supportsTools: Boolean(provider.supportsTools),
    maxTokens: provider.maxTokens,
  }
}

export async function describeAiEngine(env = {}) {
  const { provider } = await loadAiProvider(env)
  const { publicAiSettings } = await import('./settings.js')
  return publicAiSettings(env, providerMetadata(provider))
}
