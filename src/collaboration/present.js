import { listClientVisibleComments } from './threads.js'
import {
  isActivityVisibleToClient,
  makeActivityEvent,
} from '../models/clientActivity.js'

/**
 * Strip internal-only comments and activity before the record leaves the
 * portal service. Studio fetches keep the full proposal.
 *
 * @param {import('../models/proposal.js').Proposal | null | undefined} proposal
 * @returns {import('../models/proposal.js').Proposal | null | undefined}
 */
export function presentProposalForClient(proposal) {
  if (!proposal) return proposal

  const rest = { ...proposal }
  delete rest.versions
  delete rest.currentVersion

  const questionnaire = rest.questionnaire
    ? {
        ...rest.questionnaire,
        questions: (rest.questionnaire.questions ?? []).map((question) => ({
          ...question,
          internalNotes: '',
        })),
      }
    : rest.questionnaire

  return {
    ...rest,
    notes: '',
    questionnaire,
    comments: listClientVisibleComments(proposal.comments),
    activity: (proposal.activity ?? [])
      .map((item) => makeActivityEvent(item))
      .filter(isActivityVisibleToClient),
    clientActivity: [],
  }
}
