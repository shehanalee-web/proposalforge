import { makeBlock } from '../blocks/instance.js'
import { makeLineItem, makeSection } from '../models/proposal.js'
import { cloneQuestionnaireForTemplate } from '../models/questionnaire.js'
import { normalizeContentBlockIds } from '../models/template.js'

function copyBlocksWithNewIds(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return undefined

  return blocks.map((source) =>
    makeBlock({
      type: source.type,
      enabled: source.enabled,
      data: JSON.parse(JSON.stringify(source.data ?? {})),
      libraryId: source.libraryId ?? null,
      settings: source.settings,
    }),
  )
}

/**
 * Copy a template into create-payload shape.
 *
 * Ids are regenerated so the duplicate is a new record, not an alias of the
 * original. A Block Engine assembly is copied with new instance ids when present.
 *
 * @param {import('../models/template.js').ProposalTemplate} template
 */
export function toDuplicateTemplate(template) {
  const alreadyCopy = template.title.startsWith('Copy of ')
  const blocks = copyBlocksWithNewIds(template.blocks)

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
    contentBlockIds: normalizeContentBlockIds(template.contentBlockIds),
    ...(blocks ? { blocks } : {}),
    questionnaire: cloneQuestionnaireForTemplate(template.questionnaire),
  }
}
