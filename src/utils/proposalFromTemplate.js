import { makeLineItem, makeSection, PROJECT_TYPES } from '../models/proposal.js'

/**
 * Deep-copy a template into New Proposal form state.
 *
 * Section and line-item ids are regenerated so the proposal never shares
 * identity with the template. Client fields stay empty — they belong on the
 * proposal, not the reusable template.
 *
 * @param {import('../models/template.js').ProposalTemplate} template
 */
export function proposalFromTemplate(template) {
  return {
    title: template.title ?? '',
    clientName: '',
    clientEmail: '',
    company: '',
    projectType: PROJECT_TYPES[0],
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
  }
}
