export const IMPROVE_ERROR_CODE = Object.freeze({
  CANCELLED: 'cancelled',
  TIMEOUT: 'timeout',
  RATE_LIMIT: 'rate_limit',
  INVALID_KEY: 'invalid_key',
  NETWORK: 'network',
  MALFORMED: 'malformed',
  UNAVAILABLE: 'unavailable',
  UNKNOWN: 'unknown',
})

export const IMPROVE_ERROR_CODES = Object.freeze(Object.values(IMPROVE_ERROR_CODE))

/**
 * Provider failure. The UI always shows a generic message; `code` stays
 * on the server log.
 */
export class ImproveError extends Error {
  constructor(message, extra = {}) {
    super(message || 'Generation failed.')
    this.name = 'ImproveError'
    this.code = IMPROVE_ERROR_CODES.includes(extra.code)
      ? extra.code
      : IMPROVE_ERROR_CODE.UNKNOWN
    this.retryable = extra.retryable !== false
    this.status = extra.status ?? 0
  }
}

export function isImproveAbort(error) {
  return (
    error?.name === 'AbortError' ||
    error?.code === IMPROVE_ERROR_CODE.CANCELLED ||
    /aborted|AbortError/i.test(String(error?.message ?? ''))
  )
}
