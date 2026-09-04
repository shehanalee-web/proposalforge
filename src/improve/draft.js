import { createRecordId } from '../models/ids.js'
import { FINDING_SEVERITIES, FINDING_SEVERITY } from '../insights/ids.js'
import { IMPROVE_PATCH, IMPROVE_PATCHES, IMPROVE_PROVIDER } from './ids.js'

/**
 * @typedef {object} ImprovePatch
 * @property {string} kind
 * @property {string | null} blockType
 * @property {object} data
 * @property {string} append
 * @property {string[]} afterTypes
 * @property {string | null} summary
 */

/**
 * @typedef {object} ImprovementDraft
 * @property {string} id
 * @property {string} findingId
 * @property {string} findingCode
 * @property {string} title
 * @property {string} severity
 * @property {string} reason
 * @property {string} suggestion
 * @property {string} provider
 * @property {string} previewTitle
 * @property {string} previewBody
 * @property {ImprovePatch} patch
 */

function makePatch(input = {}) {
  const kind = IMPROVE_PATCHES.includes(input.kind)
    ? input.kind
    : IMPROVE_PATCH.FILL_BLOCK

  return {
    kind,
    blockType: input.blockType ?? null,
    data: input.data && typeof input.data === 'object' ? { ...input.data } : {},
    append: String(input.append ?? ''),
    afterTypes: Array.isArray(input.afterTypes) ? [...input.afterTypes] : [],
    summary: input.summary ?? null,
  }
}

/**
 * @param {Partial<ImprovementDraft>} [input]
 * @returns {ImprovementDraft}
 */
export function makeImprovementDraft(input = {}) {
  const severity = FINDING_SEVERITIES.includes(input.severity)
    ? input.severity
    : FINDING_SEVERITY.INFO

  return {
    id: input.id ?? createRecordId('imp'),
    findingId: String(input.findingId ?? ''),
    findingCode: String(input.findingCode ?? ''),
    title: String(input.title ?? '').trim(),
    severity,
    reason: String(input.reason ?? '').trim(),
    suggestion: String(input.suggestion ?? '').trim(),
    provider: String(input.provider ?? IMPROVE_PROVIDER.MOCK),
    previewTitle: String(input.previewTitle ?? input.title ?? '').trim(),
    previewBody: String(input.previewBody ?? '').trim(),
    patch: makePatch(input.patch),
    usage: input.usage && typeof input.usage === 'object' ? { ...input.usage } : null,
  }
}
