import { IMPROVE_PROVIDER } from '../improve/ids.js'
import { loadAiProvider } from '../improve/engine.js'
import { makeAiActivityRecord, estimateTokenCount, estimateCostUsd } from '../improve/activity.js'
import { ImproveError, IMPROVE_ERROR_CODE, isImproveAbort } from '../improve/errors.js'
import { logAi } from '../improve/log.js'
import { COACH_ACTION } from './types.js'
import { resolveCoachMode } from './modes.js'
import { buildCoachPrompt } from './prompt.js'

function publicProposal(proposal = {}) {
  return {
    id: proposal.id ?? null,
    title: proposal.title,
    clientName: proposal.clientName,
    company: proposal.company,
    projectType: proposal.projectType,
  }
}

function publicItem(item = {}) {
  return {
    id: item.id ?? '',
    title: item.title ?? '',
    findingType: item.findingType ?? item.code ?? '',
    sourceEngine: item.sourceEngine ?? '',
    severity: item.severity ?? '',
    section: item.section ?? '',
    sectionLabel: item.sectionLabel ?? '',
    explanation: item.explanation ?? '',
    whyItMatters: item.whyItMatters ?? '',
    riskIfIgnored: item.riskIfIgnored ?? '',
    recommendation: item.recommendation ?? '',
    goodExample: item.goodExample ?? '',
    flaggedBecause: item.flaggedBecause ?? '',
    nextAction: item.nextAction ?? '',
  }
}

function normalizeCoachRequest(input = {}) {
  const proposal = input.proposal ?? {}
  const company = input.company ?? {}
  const options = input.options ?? {}
  return {
    action: String(input.action ?? COACH_ACTION.ASK),
    mode: resolveCoachMode(input.mode),
    proposal: publicProposal(proposal),
    item: publicItem(input.item),
    sectionText: String(input.sectionText ?? '').slice(0, 1200),
    proposalType: String(input.proposalType ?? proposal.projectType ?? '').trim(),
    industry: String(input.industry ?? proposal.projectType ?? '').trim(),
    client: String(input.client ?? proposal.clientName ?? '').trim(),
    companyName: String(input.companyName ?? company.name ?? proposal.company ?? '').trim(),
    companyTone: String(options.companyTone ?? company.tone ?? '').trim(),
    brandVoice: String(options.brandVoice ?? company.voice ?? company.brandVoice ?? '').trim(),
    intelligenceNote: String(input.intelligenceNote ?? '').trim(),
    consistencyNote: String(input.consistencyNote ?? '').trim(),
    company: {
      name: String(company.name ?? proposal.company ?? '').trim(),
      tone: String(options.companyTone ?? company.tone ?? '').trim(),
      voice: String(options.brandVoice ?? company.voice ?? company.brandVoice ?? '').trim(),
    },
  }
}

function fallbackCoachReply(request) {
  const item = request.item ?? {}
  const voice = [request.companyTone, request.brandVoice].filter(Boolean).join(' / ')
  const voiceLine = voice
    ? `Keep the company's configured voice (${voice}).`
    : 'No company voice profile is configured. Use neutral professional language.'

  const blocks = {
    [COACH_ACTION.EXPLAIN_DEEPER]: [
      item.flaggedBecause,
      item.explanation,
      item.whyItMatters,
      item.riskIfIgnored,
      item.goodExample,
    ],
    [COACH_ACTION.ALTERNATIVES]: [
      'These are generic approaches — not project-specific facts.',
      item.recommendation,
      item.goodExample,
    ],
    [COACH_ACTION.IMPROVE_SECTION]: [
      item.recommendation,
      item.nextAction,
      item.goodExample,
    ],
    [COACH_ACTION.SALES]: [
      item.whyItMatters,
      'Frame the repair as reducing buyer uncertainty so the offer is easier to evaluate.',
      item.recommendation,
    ],
    [COACH_ACTION.TECHNICAL]: [
      item.explanation,
      'Define the section as explicit outputs and boundaries. Do not invent specifications.',
      item.recommendation,
    ],
    [COACH_ACTION.ASK]: [
      item.explanation,
      item.whyItMatters,
      item.recommendation,
    ],
  }

  return [...(blocks[request.action] || blocks[COACH_ACTION.ASK]), voiceLine]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join('\n\n')
}

function isMockProvider(provider) {
  return (
    provider?.id === IMPROVE_PROVIDER.MOCK ||
    provider?.id === IMPROVE_PROVIDER.DETERMINISTIC
  )
}

/**
 * Server-side AI Coach. Uses the existing provider abstraction.
 * Never sends mail or client messages.
 *
 * @param {object} input
 * @param {Record<string, string | undefined>} env
 * @param {{ signal?: AbortSignal, onDelta?: (text: string) => void, onActivity?: (row: object) => void }} [hooks]
 */
export async function generateCoachAdvice(input = {}, env = {}, hooks = {}) {
  const started = Date.now()
  const request = normalizeCoachRequest(input)
  const { provider, settings } = await loadAiProvider(env)
  const prompts = buildCoachPrompt(request)
  const stream = Boolean(
    hooks.onDelta && settings.streaming && provider.supportsStreaming,
  )

  logAi('coach.start', {
    provider: provider.id,
    model: provider.model,
    action: request.action,
    findingType: request.item.findingType,
    streamed: stream,
  })

  try {
    let text = ''
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }

    if (isMockProvider(provider) || typeof provider.complete !== 'function') {
      text = fallbackCoachReply(request)
      hooks.onDelta?.(text)
    } else {
      const result = await provider.complete({
        prompts,
        request,
        options: {
          stream,
          timeoutMs: settings.timeoutMs,
          temperature: settings.temperature,
        },
        signal: hooks.signal,
        onDelta: stream ? hooks.onDelta : undefined,
      })
      text = String(result?.text ?? '').trim() || fallbackCoachReply(request)
      usage = result?.usage ?? usage
      if (!stream) hooks.onDelta?.(text)
    }

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
      proposalId: request.proposal.id ?? null,
      findingCode: request.item.findingType || null,
      status: 'ok',
      streamed: stream,
    })
    hooks.onActivity?.(activity)

    logAi('coach.ok', {
      provider: provider.id,
      action: request.action,
      durationMs: activity.durationMs,
    })

    return {
      text,
      activity,
      settings,
      provider: {
        id: provider.id,
        label: provider.label,
        model: provider.model,
      },
    }
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
      findingCode: request.item.findingType || null,
      status: failed.code,
      streamed: stream,
    })
    hooks.onActivity?.(activity)

    logAi('coach.error', {
      provider: provider.id,
      action: request.action,
      code: failed.code,
    })

    throw failed
  }
}
