import { ImproveError, IMPROVE_ERROR_CODE, isImproveAbort } from '../improve/errors.js'
import { COACH_ACTION } from './types.js'
import { resolveCompanyVoice, sectionTextFor } from './context.js'

function payload(request = {}) {
  const proposal = request.proposal ?? {}
  const item = request.item ?? {}
  const voice = resolveCompanyVoice(proposal)
  const companyTone = request.options?.companyTone ?? voice.companyTone
  const brandVoice = request.options?.brandVoice ?? voice.brandVoice
  const sectionText =
    request.sectionText ??
    sectionTextFor(request.blocks ?? proposal.blocks, item.section, {
      code: item.findingType,
      blockType: item.blockType,
    })

  return {
    action: request.action ?? COACH_ACTION.ASK,
    mode: request.mode,
    proposal: {
      id: proposal.id ?? null,
      title: proposal.title,
      clientName: proposal.clientName,
      company: proposal.company,
      projectType: proposal.projectType,
    },
    item: {
      id: item.id,
      title: item.title,
      findingType: item.findingType,
      sourceEngine: item.sourceEngine,
      severity: item.severity,
      section: item.section,
      sectionLabel: item.sectionLabel,
      explanation: item.explanation,
      whyItMatters: item.whyItMatters,
      recommendation: item.recommendation,
      riskIfIgnored: item.riskIfIgnored,
      goodExample: item.goodExample,
      flaggedBecause: item.flaggedBecause,
      nextAction: item.nextAction,
    },
    sectionText,
    proposalType: proposal.projectType,
    industry: proposal.projectType,
    client: proposal.clientName,
    companyName: proposal.company,
    intelligenceNote: request.intelligenceNote ?? '',
    consistencyNote: request.consistencyNote ?? '',
    company: {
      name: proposal.company,
      tone: companyTone,
      voice: brandVoice,
    },
    options: {
      companyTone,
      brandVoice,
    },
  }
}

/**
 * Browser entry for AI Coach. Keys stay on the server.
 *
 * @param {object} request
 * @param {{ signal?: AbortSignal }} [hooks]
 */
export async function generateCoachAdvice(request, hooks = {}) {
  let response
  try {
    response = await fetch('/api/ai/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload(request)),
      signal: hooks.signal,
    })
  } catch (error) {
    if (isImproveAbort(error)) {
      throw new ImproveError('Generation failed.', { code: IMPROVE_ERROR_CODE.CANCELLED })
    }
    throw new ImproveError('Generation failed.', {
      code: IMPROVE_ERROR_CODE.NETWORK,
      retryable: true,
    })
  }

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ImproveError(body.message || 'Generation failed.', {
      retryable: body.retryable !== false,
    })
  }

  return String(body.text ?? '').trim()
}
