import { canClientRespond } from './proposal.js'

/**
 * Client Portal permission model.
 *
 * The portal is a separate product surface from the studio. Clients never
 * receive content-editing capabilities. Future interaction modules (comments,
 * uploads, questionnaires, approval, signature, payment) declare a required
 * capability here and stay disabled until that milestone turns the flag on.
 */

export const PORTAL_ACTOR = Object.freeze({
  CLIENT: 'client',
  STUDIO: 'studio',
})

export const PORTAL_CAPABILITY = Object.freeze({
  VIEW_PROPOSAL: 'view_proposal',
  DOWNLOAD_PDF: 'download_pdf',
  PRINT: 'print',
  SHARE_LINK: 'share_link',
  SAVE_LOCAL: 'save_local',
  ACCEPT: 'accept',
  DECLINE: 'decline',
  REQUEST_REVISION: 'request_revision',
  EDIT_CONTENT: 'edit_content',
  MANAGE_BLOCKS: 'manage_blocks',
  COMMENT: 'comment',
  UPLOAD: 'upload',
  QUESTIONNAIRE: 'questionnaire',
  APPROVE: 'approve',
  SIGN: 'sign',
  PAY: 'pay',
})

const ALWAYS_DENIED_TO_CLIENT = Object.freeze([
  PORTAL_CAPABILITY.EDIT_CONTENT,
  PORTAL_CAPABILITY.MANAGE_BLOCKS,
])

/**
 * @typedef {object} PortalCapabilities
 * @property {boolean} view_proposal
 * @property {boolean} download_pdf
 * @property {boolean} print
 * @property {boolean} share_link
 * @property {boolean} save_local
 * @property {boolean} accept
 * @property {boolean} decline
 * @property {boolean} request_revision
 * @property {boolean} edit_content
 * @property {boolean} manage_blocks
 * @property {boolean} comment
 * @property {boolean} upload
 * @property {boolean} questionnaire
 * @property {boolean} approve
 * @property {boolean} sign
 * @property {boolean} pay
 */

/**
 * Capabilities for a client opening a share link.
 *
 * Content editing is always false. Interaction modules are live; write
 * actions stay gated by lock and submission state in the service layer.
 *
 * @param {import('./proposal.js').Proposal | null | undefined} proposal
 * @returns {PortalCapabilities}
 */
export function resolveClientCapabilities(proposal) {
  const respond = proposal ? canClientRespond(proposal) : false

  return {
    [PORTAL_CAPABILITY.VIEW_PROPOSAL]: Boolean(proposal),
    [PORTAL_CAPABILITY.DOWNLOAD_PDF]: Boolean(proposal),
    [PORTAL_CAPABILITY.PRINT]: Boolean(proposal),
    [PORTAL_CAPABILITY.SHARE_LINK]: Boolean(proposal),
    [PORTAL_CAPABILITY.SAVE_LOCAL]: Boolean(proposal),
    [PORTAL_CAPABILITY.ACCEPT]: respond,
    [PORTAL_CAPABILITY.DECLINE]: respond,
    [PORTAL_CAPABILITY.REQUEST_REVISION]: respond,
    [PORTAL_CAPABILITY.EDIT_CONTENT]: false,
    [PORTAL_CAPABILITY.MANAGE_BLOCKS]: false,
    [PORTAL_CAPABILITY.COMMENT]: Boolean(proposal),
    [PORTAL_CAPABILITY.UPLOAD]: Boolean(proposal),
    [PORTAL_CAPABILITY.QUESTIONNAIRE]: Boolean(
      proposal?.questionnaire?.questions?.length,
    ),
    [PORTAL_CAPABILITY.APPROVE]: Boolean(proposal),
    [PORTAL_CAPABILITY.SIGN]: Boolean(proposal),
    [PORTAL_CAPABILITY.PAY]: Boolean(proposal),
  }
}

/**
 * @param {PortalCapabilities} capabilities
 * @param {string} capability
 * @returns {boolean}
 */
export function hasCapability(capabilities, capability) {
  return Boolean(capabilities?.[capability])
}

/**
 * Clients must never be able to mutate proposal content, even if a caller
 * accidentally spreads extra flags.
 *
 * @param {Partial<PortalCapabilities>} capabilities
 * @returns {PortalCapabilities}
 */
export function enforceClientReadOnly(capabilities = {}) {
  const next = { ...resolveClientCapabilities(null), ...capabilities }
  ALWAYS_DENIED_TO_CLIENT.forEach((key) => {
    next[key] = false
  })
  return next
}

/**
 * @param {PortalCapabilities} capabilities
 * @returns {boolean}
 */
export function canEditProposalContent(capabilities) {
  return hasCapability(capabilities, PORTAL_CAPABILITY.EDIT_CONTENT)
}
