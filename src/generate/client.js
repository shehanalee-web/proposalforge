import { ImproveError, IMPROVE_ERROR_CODE, isImproveAbort } from '../improve/errors.js'
import { normalizeProposalInputs } from './inputs.js'

function payload(request = {}) {
  const proposalInputs = normalizeProposalInputs(request)
  return {
    companyId: proposalInputs.companyId,
    proposalInputs,
    companyVoice: {
      companyTone: proposalInputs.companyTone,
      brandVoice: proposalInputs.brandVoice,
    },
    options: {
      retry: Boolean(request.options?.retry),
    },
  }
}

async function readSseResult(response, onDelta, onStatus) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result = null

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
        if (event.type === 'status') onStatus?.(event.status)
        if (event.type === 'delta') onDelta?.(event.text)
        if (event.type === 'done') result = event.result
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

  if (!result) {
    throw new ImproveError('Generation failed.', {
      code: IMPROVE_ERROR_CODE.MALFORMED,
      retryable: true,
    })
  }

  return result
}

/**
 * Browser entry. API keys stay on the server. Prompts are never returned.
 *
 * @param {object} request
 * @param {{ signal?: AbortSignal, onDelta?: (text: string) => void, onStatus?: (status: string) => void, stream?: boolean }} [hooks]
 */
export async function generateProposalDraft(request, hooks = {}) {
  const stream = hooks.stream !== false
  let response
  try {
    response = await fetch(
      stream ? '/api/ai/generate-proposal?stream=1' : '/api/ai/generate-proposal',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload(request)),
        signal: hooks.signal,
      },
    )
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
    return readSseResult(response, hooks.onDelta, hooks.onStatus)
  }

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ImproveError(body.message || 'Generation failed.', {
      retryable: body.retryable !== false,
    })
  }

  return body
}
