import { makeLineItem, makeSection } from '../models/proposal.js'
import { cloneQuestionnaireForProposal } from '../models/questionnaire.js'

/**
 * Deep-copy a template into new-proposal payload shape.
 *
 * Section and line-item ids are regenerated so the proposal never shares
 * identity with the template. Client fields stay empty unless the caller
 * supplies them — they belong on the proposal, not the reusable template.
 *
 * When a Service Library record is passed, `projectType` is the service name
 * at create time (a snapshot) and `serviceIds` holds the live reference.
 *
 * @param {import('../models/template.js').ProposalTemplate} template
 * @param {import('../models/service.js').Service} [service]
 */
export function proposalFromTemplate(template, service) {
  return {
    title: template.title ?? '',
    clientName: '',
    clientEmail: '',
    company: '',
    projectType: service?.name,
    serviceIds: service ? [service.id] : [],
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
    questionnaire: cloneQuestionnaireForProposal(template.questionnaire, {
      templateId: template.id,
    }),
  }
}
