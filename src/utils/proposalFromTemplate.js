import { makeBlock } from '../blocks/instance.js'
import { makeLineItem, makeSection } from '../models/proposal.js'
import { cloneQuestionnaireForProposal } from '../models/questionnaire.js'

/**
 * Copy Block Engine instances onto a new record. Instance ids are minted so
 * the copy never shares identity with the source. Data is JSON-cloned using
 * the same kernel as duplicateBlock / pasteBlock.
 *
 * @param {import('../blocks/instance.js').BlockInstance[]} [blocks]
 * @returns {import('../blocks/instance.js').BlockInstance[] | undefined}
 */
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
 * Deep-copy a template into new-proposal payload shape.
 *
 * When `template.blocks` is a non-empty Block Engine assembly, that list is
 * copied with new instance ids and becomes the proposal document. Legacy
 * sections and line items are still copied for compatibility fields; they are
 * not used to rebuild a default block sequence.
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
  const blocks = copyBlocksWithNewIds(template.blocks)

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
    ...(blocks ? { blocks } : {}),
    questionnaire: cloneQuestionnaireForProposal(template.questionnaire, {
      templateId: template.id,
    }),
  }
}
