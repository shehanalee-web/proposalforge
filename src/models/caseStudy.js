import { createRecordId } from './ids.js'

/**
 * Case study library record.
 *
 * Proof of past work. Proposals reference these; they do not copy the story
 * into layout-specific HTML.
 */

/**
 * @typedef {object} CaseStudy
 * @property {string} id
 * @property {string} title
 * @property {string} clientName
 * @property {string} summary
 * @property {string} body
 * @property {string | null} serviceId
 * @property {string[]} assetIds
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @param {Partial<CaseStudy>} [input]
 * @returns {CaseStudy}
 */
export function makeCaseStudy(input = {}) {
  const timestamp = new Date().toISOString()

  return {
    id: input.id ?? createRecordId('case'),
    title: input.title ?? '',
    clientName: input.clientName ?? '',
    summary: input.summary ?? '',
    body: input.body ?? '',
    serviceId: input.serviceId ?? null,
    assetIds: [...(input.assetIds ?? [])],
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp,
  }
}

/**
 * @param {Partial<CaseStudy>} study
 * @returns {{ field: string, message: string }[]}
 */
export function validateCaseStudy(study) {
  const errors = []

  if (!study.title || !study.title.trim()) {
    errors.push({ field: 'title', message: 'Title is required.' })
  }

  return errors
}
