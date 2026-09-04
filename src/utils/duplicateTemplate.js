import { makeLineItem, makeSection } from '../models/proposal.js'
import { cloneQuestionnaireForTemplate } from '../models/questionnaire.js'

/**
 * Copy a template into create-payload shape.
 *
 * Ids are regenerated so the duplicate is a new record, not an alias of the
 * original.
 *
 * @param {import('../models/template.js').ProposalTemplate} template
 */
export function toDuplicateTemplate(template) {
  const alreadyCopy = template.title.startsWith('Copy of ')

  return {
    title: alreadyCopy ? template.title : `Copy of ${template.title}`,
    description: template.description ?? '',
    sections: (template.sections ?? []).map((section) =>
      makeSection({ heading: section.heading, body: section.body }),
    ),
    items: (template.items ?? []).map((item) =>
      makeLineItem({ description: item.description, amount: item.amount }),
    ),
    terms: template.terms ?? '',
    notes: template.notes ?? '',
    defaultLayoutId: template.defaultLayoutId,
    proposalType: template.proposalType ?? '',
    isDefault: false,
    questionnaire: cloneQuestionnaireForTemplate(template.questionnaire),
  }
}
