import { BLOCK_TYPE } from '../blocks/ids.js'
import { FINDING_CODE } from '../insights/ids.js'
import { IMPROVE_PATCH } from './ids.js'

const PRICING_AFTER = [
  BLOCK_TYPE.COVER,
  BLOCK_TYPE.EXECUTIVE_SUMMARY,
  BLOCK_TYPE.DELIVERABLES,
  BLOCK_TYPE.RICH_TEXT,
]

/**
 * The insert target for a diagnostic. Models fill copy; they do not choose
 * which block to patch, so they cannot invent pricing or move unrelated
 * sections.
 *
 * @param {object} [finding]
 */
export function planPatchForFinding(finding = {}) {
  switch (finding.code) {
    case FINDING_CODE.MISSING_TIMELINE:
      return {
        kind: IMPROVE_PATCH.FILL_BLOCK,
        blockType: BLOCK_TYPE.TIMELINE,
        label: 'Timeline',
        dataShape: 'timeline-items',
        summary: false,
      }
    case FINDING_CODE.MISSING_DELIVERABLES:
      return {
        kind: IMPROVE_PATCH.FILL_BLOCK,
        blockType: BLOCK_TYPE.DELIVERABLES,
        label: 'Deliverables',
        dataShape: 'deliverable-items',
        summary: false,
      }
    case FINDING_CODE.MISSING_EXCLUSIONS:
      return {
        kind: IMPROVE_PATCH.APPEND_BODY,
        blockType: BLOCK_TYPE.TERMS,
        label: 'Terms — exclusions',
        dataShape: 'append',
        summary: false,
      }
    case FINDING_CODE.MISSING_WARRANTY:
      return {
        kind: IMPROVE_PATCH.APPEND_BODY,
        blockType: BLOCK_TYPE.TERMS,
        label: 'Terms — warranty',
        dataShape: 'append',
        summary: false,
      }
    case FINDING_CODE.MISSING_PAYMENT_TERMS:
      return {
        kind: IMPROVE_PATCH.APPEND_BODY,
        blockType: BLOCK_TYPE.TERMS,
        label: 'Terms — payment',
        dataShape: 'append',
        summary: false,
      }
    case FINDING_CODE.MISSING_CTA:
      return {
        kind: IMPROVE_PATCH.FILL_BLOCK,
        blockType: BLOCK_TYPE.SIGNATURE,
        label: 'Signature',
        dataShape: 'signature',
        summary: false,
      }
    case FINDING_CODE.PRICING_TOO_EARLY:
      return {
        kind: IMPROVE_PATCH.MOVE_AFTER,
        blockType: BLOCK_TYPE.PRICING,
        label: 'Pricing placement',
        dataShape: 'move',
        afterTypes: [...PRICING_AFTER],
        summary: false,
      }
    case FINDING_CODE.WEAK_VALUE_PROPOSITION:
    case FINDING_CODE.MISSING_OBJECTIVES:
    case FINDING_CODE.WEAK_SUMMARY:
    case FINDING_CODE.LONG_SUMMARY:
    case FINDING_CODE.LONG_PROPOSAL:
    default:
      return {
        kind: IMPROVE_PATCH.FILL_BLOCK,
        blockType: BLOCK_TYPE.EXECUTIVE_SUMMARY,
        label: 'Executive summary',
        dataShape: 'summary-body',
        summary: true,
      }
  }
}
