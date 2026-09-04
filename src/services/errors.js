/**
 * Error types shared by the service layer.
 *
 * Distinct classes let callers branch on failure type (`instanceof`) instead of
 * matching on message strings. When a real API is introduced these same errors
 * can be thrown from HTTP status codes, so UI error handling written against
 * them keeps working unchanged.
 */

export class NotFoundError extends Error {
  constructor(message) {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class ForbiddenError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export class ValidationError extends Error {
  /**
   * @param {string} message
   * @param {{ field: string, message: string }[]} [errors] Per-field details.
   */
  constructor(message, errors = []) {
    super(message)
    this.name = 'ValidationError'
    this.errors = errors
  }
}

export class MailError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, retryable?: boolean, status?: number, errors?: { field: string, message: string }[] }} [options]
   */
  constructor(message, options = {}) {
    super(message)
    this.name = 'MailError'
    this.code = options.code ?? 'rejected'
    this.retryable = options.retryable !== false
    this.status = options.status ?? 0
    this.errors = options.errors ?? []
  }
}
