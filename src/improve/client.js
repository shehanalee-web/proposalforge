import { makeImprovementDraft } from './draft.js'
import { ImproveError, IMPROVE_ERROR_CODE, isImproveAbort } from './errors.js'
import { slimBlocksForFinding } from './context.js'

function publicProposal(proposal = {}) {
  return {
    id: proposal.id ?? null,
    title: proposal.title,
    clientName: proposal.clientName,
    company: proposal.company,
    projectType: proposal.projectType,
    summary: proposal.summary,
  }
}

function publicFinding(finding = {}) {
  return {
    id: finding.id,
    code: finding.code,
    title: finding.title,
    severity: finding.severity,
    message: finding.message,
    suggestion: finding.suggestion,
  }
}

function payload(request = {}) {
  const proposal = request.proposal ?? {}
  return {
    proposal: publicProposal(proposal),
    finding: publicFinding(request.finding),
    blocks: slimBlocksForFinding(request.blocks, request.finding),
    company: request.company ?? {
      name: proposal.company,
      tone: request.options?.companyTone ?? '',
      voice: request.options?.brandVoice ?? '',
    },
    client: request.client ?? { name: proposal.clientName },
    options: {
      companyTone: request.options?.companyTone ?? '',
      brandVoice: request.options?.brandVoice ?? '',
      retry: Boolean(request.options?.retry),
      language: request.options?.language ?? 'English',
    },
  }
}

async function readSseDraft(response, onDelta) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let draft = null

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const chunks = buffer.split('\n\n')
      buffer = chunks.pop() ?? ''
      for (const chunk of chunks) {
        const data = chunk
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim())
          .join('\n')
        if (!data) continue
        let event
        try {
          event = JSON.parse(data)
        } catch {
          continue
        }
        if (event.type === 'delta') onDelta?.(event.text)
        if (event.type === 'done') draft = event.draft
        if (event.type === 'error') {
          throw new ImproveError(event.message || 'Generation failed.', {
            code: IMPROVE_ERROR_CODE.UNKNOWN,
            retryable: event.retryable !== false,
          })
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  if (!draft) {
    throw new ImproveError('Generation failed.', {
      code: IMPROVE_ERROR_CODE.MALFORMED,
      retryable: true,
    })
  }

  return makeImprovementDraft(draft)
}

/**
 * Browser entry. Never receives API keys — the Vite plugin owns providers.
 *
 * @param {object} request
 * @param {{ signal?: AbortSignal, onDelta?: (text: string) => void, stream?: boolean }} [hooks]
 */
export async function generateImprovement(request, hooks = {}) {
  const stream = hooks.stream !== false
  let response
  try {
    response = await fetch(stream ? '/api/ai/improve?stream=1' : '/api/ai/improve', {
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

  const type = response.headers.get('content-type') || ''

  if (type.includes('text/event-stream')) {
    return readSseDraft(response, hooks.onDelta)
  }

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ImproveError(body.message || 'Generation failed.', {
      retryable: body.retryable !== false,
    })
  }

  const draft = makeImprovementDraft(body.draft)
  hooks.onDelta?.(draft.previewBody)
  return draft
}

export async function fetchAiSettings() {
  const response = await fetch('/api/ai/settings')
  if (!response.ok) {
    return {
      provider: 'mock',
      model: 'mock',
      streaming: false,
      configuredVia: 'environment',
    }
  }
  return response.json()
}
