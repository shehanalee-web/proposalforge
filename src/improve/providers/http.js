import { ImproveError, IMPROVE_ERROR_CODE, isImproveAbort } from '../errors.js'

function mergeSignals(timeoutMs, external) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  const onAbort = () => controller.abort()
  if (external) {
    if (external.aborted) controller.abort()
    else external.addEventListener('abort', onAbort, { once: true })
  }

  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer)
      external?.removeEventListener('abort', onAbort)
    },
  }
}

export function mapProviderHttpError(status) {
  if (status === 429) {
    return new ImproveError('Generation failed.', {
      code: IMPROVE_ERROR_CODE.RATE_LIMIT,
      retryable: true,
      status,
    })
  }

  if (status === 401 || status === 403) {
    return new ImproveError('Generation failed.', {
      code: IMPROVE_ERROR_CODE.INVALID_KEY,
      retryable: false,
      status,
    })
  }

  if (status === 400 || status === 422) {
    return new ImproveError('Generation failed.', {
      code: IMPROVE_ERROR_CODE.MALFORMED,
      retryable: true,
      status,
    })
  }

  return new ImproveError('Generation failed.', {
    code: status >= 500 ? IMPROVE_ERROR_CODE.UNAVAILABLE : IMPROVE_ERROR_CODE.UNKNOWN,
    retryable: true,
    status,
  })
}

export function mapProviderFailure(error) {
  if (error instanceof ImproveError) return error
  if (isImproveAbort(error)) {
    return new ImproveError('Generation failed.', {
      code: IMPROVE_ERROR_CODE.CANCELLED,
      retryable: true,
    })
  }

  const message = String(error?.message ?? '')
  if (/timeout|timed out/i.test(message)) {
    return new ImproveError('Generation failed.', {
      code: IMPROVE_ERROR_CODE.TIMEOUT,
      retryable: true,
    })
  }

  if (/network|fetch|ECONN|ENOTFOUND|Failed to fetch/i.test(message) || error?.name === 'TypeError') {
    return new ImproveError('Generation failed.', {
      code: IMPROVE_ERROR_CODE.NETWORK,
      retryable: true,
    })
  }

  return new ImproveError('Generation failed.', {
    code: IMPROVE_ERROR_CODE.UNKNOWN,
    retryable: true,
  })
}

export async function providerFetch(url, options, timeoutMs) {
  const gate = mergeSignals(timeoutMs, options.signal)
  try {
    return await fetch(url, { ...options, signal: gate.signal })
  } catch (error) {
    throw mapProviderFailure(error)
  } finally {
    gate.dispose()
  }
}

export async function readSse(response, onEvent) {
  if (!response.body) {
    throw new ImproveError('Generation failed.', {
      code: IMPROVE_ERROR_CODE.MALFORMED,
      retryable: true,
    })
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const chunks = buffer.split('\n\n')
      buffer = chunks.pop() ?? ''
      for (const chunk of chunks) {
        const dataLines = chunk
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim())
          .join('\n')
        if (!dataLines || dataLines === '[DONE]') {
          if (dataLines === '[DONE]') onEvent({ done: true, raw: dataLines })
          continue
        }
        try {
          onEvent({ done: false, data: JSON.parse(dataLines), raw: dataLines })
        } catch {
          onEvent({ done: false, data: null, raw: dataLines })
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export function usageFrom(input = {}) {
  const promptTokens = Number(input.prompt_tokens ?? input.promptTokens) || 0
  const completionTokens = Number(input.completion_tokens ?? input.completionTokens) || 0
  const totalTokens = Number(input.total_tokens ?? input.totalTokens) || 0
  return {
    promptTokens,
    completionTokens,
    totalTokens,
  }
}
