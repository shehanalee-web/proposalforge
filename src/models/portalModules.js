import { PORTAL_CAPABILITY } from './portalPermissions.js'

/**
 * Future Client Portal interaction modules.
 *
 * Phase 8A registered the slots. Phase 8B turns the questionnaire live.
 * Phase 8C turns comments live. Phase 8D turns uploads, approval, signature
 * and payment live (signature and payment stay provider placeholders).
 */

export const PORTAL_MODULE = Object.freeze({
  QUESTIONNAIRE: 'questionnaire',
  COMMENTS: 'comments',
  UPLOADS: 'uploads',
  APPROVAL: 'approval',
  SIGNATURE: 'signature',
  PAYMENT: 'payment',
})

export const PORTAL_MODULE_STATUS = Object.freeze({
  COMING_SOON: 'coming_soon',
  LIVE: 'live',
})

/**
 * @typedef {object} PortalModuleDefinition
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {string} icon
 * @property {string} capability
 * @property {string} status
 */

/** @type {readonly PortalModuleDefinition[]} */
export const PORTAL_MODULES = Object.freeze([
  {
    id: PORTAL_MODULE.QUESTIONNAIRE,
    label: 'Questionnaire',
    description: 'Answer a short brief so the studio can lock scope.',
    icon: 'clipboard',
    capability: PORTAL_CAPABILITY.QUESTIONNAIRE,
    status: PORTAL_MODULE_STATUS.LIVE,
  },
  {
    id: PORTAL_MODULE.COMMENTS,
    label: 'Comments',
    description: 'Ask questions, reply, and follow this proposal.',
    icon: 'message',
    capability: PORTAL_CAPABILITY.COMMENT,
    status: PORTAL_MODULE_STATUS.LIVE,
  },
  {
    id: PORTAL_MODULE.UPLOADS,
    label: 'Uploads',
    description: 'Share reference files, logos and signed documents.',
    icon: 'upload',
    capability: PORTAL_CAPABILITY.UPLOAD,
    status: PORTAL_MODULE_STATUS.LIVE,
  },
  {
    id: PORTAL_MODULE.APPROVAL,
    label: 'Approval',
    description: 'Approve, decline, or request changes.',
    icon: 'check',
    capability: PORTAL_CAPABILITY.APPROVE,
    status: PORTAL_MODULE_STATUS.LIVE,
  },
  {
    id: PORTAL_MODULE.SIGNATURE,
    label: 'Signature',
    description: 'Sign when you are ready to proceed.',
    icon: 'pen',
    capability: PORTAL_CAPABILITY.SIGN,
    status: PORTAL_MODULE_STATUS.LIVE,
  },
  {
    id: PORTAL_MODULE.PAYMENT,
    label: 'Payment',
    description: 'Pay the deposit or invoice from this proposal.',
    icon: 'card',
    capability: PORTAL_CAPABILITY.PAY,
    status: PORTAL_MODULE_STATUS.LIVE,
  },
])

export function listPortalModules() {
  return PORTAL_MODULES
}
