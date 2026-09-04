import {
  enforceClientReadOnly,
  PORTAL_ACTOR,
  resolveClientCapabilities,
} from '../models/portalPermissions.js'
import { ForbiddenError } from './errors.js'
import { presentProposalForClient } from '../collaboration/present.js'
import {
  acceptProposal,
  addClientComment,
  addClientUpload,
  declineProposal,
  deleteClientUpload,
  editClientComment,
  fetchClientProposal,
  replaceClientUpload,
  requestProposalChanges,
  resolveClientThread,
  saveQuestionnaireResponses,
  submitQuestionnaireResponses,
} from './proposalService.js'

/**
 * Client Portal service boundary.
 *
 * The studio proposal service remains the source of truth. This module is the
 * only portal entry point: it loads by share token, records a view, accepts,
 * comments, and refuses any content mutation. Internal notes are stripped
 * before anything returns to the client.
 */

function presentPortal(proposal, token) {
  const visible = presentProposalForClient(proposal)
  return {
    proposal: visible,
    session: getPortalSession(visible, token),
  }
}

export function getPortalSession(proposal, token) {
  const capabilities = enforceClientReadOnly(resolveClientCapabilities(proposal))
  return {
    actor: PORTAL_ACTOR.CLIENT,
    token: token ?? proposal?.shareToken ?? '',
    proposalId: proposal?.id ?? null,
    capabilities,
    readOnly: true,
  }
}

export async function loadPortalProposal(token) {
  const proposal = await fetchClientProposal(token)
  return presentPortal(proposal, token)
}

export async function acceptPortalProposal(token) {
  const proposal = await acceptProposal(token)
  return presentPortal(proposal, token)
}

export async function declinePortalProposal(token, input = {}) {
  const proposal = await declineProposal(token, input)
  return presentPortal(proposal, token)
}

export async function savePortalQuestionnaire(token, responses) {
  const proposal = await saveQuestionnaireResponses(token, responses)
  return presentPortal(proposal, token)
}

export async function submitPortalQuestionnaire(token) {
  const proposal = await submitQuestionnaireResponses(token)
  return presentPortal(proposal, token)
}

export async function addPortalComment(token, input) {
  const proposal = await addClientComment(token, input)
  return presentPortal(proposal, token)
}

export async function editPortalComment(token, commentId, message) {
  const proposal = await editClientComment(token, commentId, message)
  return presentPortal(proposal, token)
}

export async function resolvePortalThread(token, commentId) {
  const proposal = await resolveClientThread(token, commentId)
  return presentPortal(proposal, token)
}

export async function requestPortalChanges(token, input) {
  const proposal = await requestProposalChanges(token, input)
  return presentPortal(proposal, token)
}

export async function addPortalUpload(token, file) {
  const proposal = await addClientUpload(token, file)
  return presentPortal(proposal, token)
}

export async function replacePortalUpload(token, uploadId, file) {
  const proposal = await replaceClientUpload(token, uploadId, file)
  return presentPortal(proposal, token)
}

export async function deletePortalUpload(token, uploadId) {
  const proposal = await deleteClientUpload(token, uploadId)
  return presentPortal(proposal, token)
}

/**
 * Hard stop for any attempt to patch proposal content from the portal.
 * Later milestones must not bypass this — add a dedicated interaction API.
 *
 * @returns {never}
 */
export function refusePortalContentEdit() {
  throw new ForbiddenError('Clients cannot edit proposal content.')
}

export function refusePortalModule(name) {
  throw new ForbiddenError(`${name} is not available on this proposal yet.`)
}
