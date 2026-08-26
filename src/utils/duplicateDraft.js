import { PROJECT_TYPES } from '../models/proposal.js'

/**
 * Shape carried through router location state when duplicating a proposal.
 * Intentionally omits id, status and timestamps so the create flow treats it
 * as a new draft rather than an update of the original.
 *
 * @param {import('../models/proposal.js').Proposal} proposal
 */
export function toDuplicateDraft(proposal) {
  const alreadyCopy = proposal.title.startsWith('Copy of ')

  return {
    title: alreadyCopy ? proposal.title : `Copy of ${proposal.title}`,
    clientName: proposal.clientName ?? '',
    clientEmail: proposal.clientEmail ?? '',
    company: proposal.company ?? '',
    projectType: proposal.projectType ?? PROJECT_TYPES[0],
    amount: proposal.amount ? String(proposal.amount) : '',
    summary: proposal.summary ?? '',
    validUntil: proposal.validUntil ?? '',
    sections: proposal.sections ?? [],
    items: proposal.items ?? [],
    terms: proposal.terms ?? '',
    notes: proposal.notes ?? '',
    tags: proposal.tags ?? [],
  }
}
