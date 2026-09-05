import { BLOCK_TYPE } from '../blocks/ids.js'
import { listViewerSections } from '../viewer/sectionMeta.js'
import { LIVING_SECTION_KIND } from './types.js'

function livingSectionKind(type) {
  if (type === BLOCK_TYPE.PRICING) return LIVING_SECTION_KIND.COMMERCIAL
  if (type === BLOCK_TYPE.TERMS || type === BLOCK_TYPE.SIGNATURE) {
    return LIVING_SECTION_KIND.CLOSE
  }
  return LIVING_SECTION_KIND.CONTENT
}

/**
 * Living section contract over the existing Block Engine spine.
 *
 * `id` remains the viewer/scroll id. `blockId` is the same value so later
 * H12 interactions can attach without a second section identity.
 *
 * @param {import('../models/proposal.js').Proposal | null | undefined} proposal
 */
export function listLivingSections(proposal) {
  return listViewerSections(proposal?.blocks ?? [], proposal ?? {}).map((section) => ({
    id: section.id,
    blockId: section.id,
    type: section.type,
    title: section.title,
    kind: livingSectionKind(section.type),
    interactive: false,
  }))
}
