import { getBlockLabel, listEnabledBlocks } from '../blocks/instance.js'

function asText(value) {
  return value == null ? '' : String(value)
}

function labelFromBlock(block) {
  const heading = asText(block?.data?.heading).trim()
  const title = asText(block?.data?.title).trim()
  const kicker = asText(block?.data?.kicker).trim()
  return heading || title || kicker || getBlockLabel(block?.type) || 'Section'
}

export function findProposalBlock(proposal, blockId) {
  const id = asText(blockId).trim()
  if (!id) return null
  const blocks = Array.isArray(proposal?.blocks) ? proposal.blocks : []
  return blocks.find((block) => block.id === id) ?? null
}

export function resolveBlockReference(proposal, blockId) {
  const id = asText(blockId).trim()
  if (!id) {
    return { blockId: '', blockLabel: '', missing: false }
  }
  const found = findProposalBlock(proposal, id)
  if (!found) {
    return { blockId: id, blockLabel: '', missing: true }
  }
  return { blockId: id, blockLabel: labelFromBlock(found), missing: false }
}

export function listBlockTargets(proposal) {
  return listEnabledBlocks(proposal?.blocks ?? []).map((block) => ({
    blockId: block.id,
    label: labelFromBlock(block),
  }))
}
