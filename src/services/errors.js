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
