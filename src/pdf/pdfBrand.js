import { PROPOSAL_STATUS } from '../models/proposal.js'

/**
 * Brand tokens and PDF-only chrome derived from Brand Kit + proposal status.
 * Presentation only — never written back onto the proposal.
 */

export function resolvePdfWatermark(proposal, brand) {
  if (brand?.watermarkEnabled) {
    return brand.watermarkText?.trim() || 'CONFIDENTIAL'
  }

  if (proposal?.status === PROPOSAL_STATUS.DRAFT) {
    return 'DRAFT'
  }

  return ''
}

export function resolvePdfLogo(brand, surface = 'dark') {
  if (surface === 'dark') {
    return brand?.logos?.dark || brand?.logos?.light || brand?.logos?.primary || ''
  }

  return brand?.logos?.light || brand?.logos?.primary || brand?.logos?.dark || ''
}
