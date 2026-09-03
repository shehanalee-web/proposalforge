import { createRecordId } from './ids.js'

/**
 * Testimonial library record.
 */

/**
 * @typedef {object} Testimonial
 * @property {string} id
 * @property {string} quote
 * @property {string} authorName
 * @property {string} authorRole
 * @property {string} company
 * @property {string | null} portraitAssetId
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @param {Partial<Testimonial>} [input]
 * @returns {Testimonial}
 */
export function makeTestimonial(input = {}) {
  const timestamp = new Date().toISOString()

  return {
    id: input.id ?? createRecordId('quote'),
    quote: input.quote ?? '',
    authorName: input.authorName ?? '',
    authorRole: input.authorRole ?? '',
    company: input.company ?? '',
    portraitAssetId: input.portraitAssetId ?? null,
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp,
  }
}

/**
 * @param {Partial<Testimonial>} testimonial
 * @returns {{ field: string, message: string }[]}
 */
export function validateTestimonial(testimonial) {
  const errors = []

  if (!testimonial.quote || !testimonial.quote.trim()) {
    errors.push({ field: 'quote', message: 'Quote is required.' })
  }

  if (!testimonial.authorName || !testimonial.authorName.trim()) {
    errors.push({ field: 'authorName', message: 'Author name is required.' })
  }

  return errors
}
