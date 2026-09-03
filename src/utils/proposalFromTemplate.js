import { makeLineItem, makeSection } from '../models/proposal.js'
import { getProposalType } from '../models/proposalType.js'

/**
 * Deep-copy a template into new-proposal payload shape.
 *
 * Section and line-item ids are regenerated so the proposal never shares
 * identity with the template. Client fields stay empty unless the caller
 * supplies them — they belong on the proposal, not the reusable template.
 *
 * @param {import('../models/template.js').ProposalTemplate} template
 */
export function proposalFromTemplate(template) {
  const type = getProposalType(template.proposalType)

  return {
    title: template.title ?? '',
    clientName: '',
    clientEmail: '',
    company: '',
    projectType: type?.projectType,
    amount: template.amount ? String(template.amount) : '',
    summary: template.description ?? '',
    validUntil: '',
    sections: (template.sections ?? []).map((section) =>
      makeSection({ heading: section.heading, body: section.body }),
    ),
    items: (template.items ?? []).map((item) =>
      makeLineItem({ description: item.description, amount: item.amount }),
    ),
    terms: template.terms ?? '',
    notes: template.notes ?? '',
    tags: [],
    layoutId: template.defaultLayoutId,
  }
}
