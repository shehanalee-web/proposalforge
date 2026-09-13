import { DEFAULT_LAYOUT_ID } from '../layouts/ids.js'
import {
  hydrateBlocksFromProposal,
  syncLegacyFromBlocks,
} from '../blocks/hydrate.js'
import { makeBlock } from '../blocks/instance.js'

/**
 * Whether a template owns a canonical Block Engine assembly.
 * Empty or missing `blocks` stays on the legacy sections/items path.
 *
 * @param {import('../blocks/instance.js').BlockInstance[] | undefined} blocks
 */
export function hasCanonicalBlocks(blocks) {
  return Array.isArray(blocks) && blocks.length > 0
}

/**
 * Normalise stored template instances without minting new ids.
 *
 * @param {import('../blocks/instance.js').BlockInstance[] | undefined} blocks
 * @returns {import('../blocks/instance.js').BlockInstance[]}
 */
export function loadTemplateBlocks(blocks) {
  if (!hasCanonicalBlocks(blocks)) return []
  return blocks.map((block) => makeBlock(block))
}

function numericItems(items) {
  return (items ?? []).map((item) => ({
    id: item.id,
    description: item.description ?? '',
    amount: item.amount === '' || item.amount == null ? 0 : Number(item.amount),
  }))
}

function proposalLike(input = {}) {
  const items = numericItems(input.items)
  return {
    summary: input.description ?? input.summary ?? '',
    sections: input.sections ?? [],
    items,
    terms: input.terms ?? '',
    amount: items.reduce((total, item) => total + (Number(item.amount) || 0), 0),
  }
}

/**
 * Explicit legacy → Block Engine conversion. Uses the existing hydrate helper
 * so conversion is the same path proposals already use when `blocks` is empty.
 *
 * @param {Partial<import('../models/template.js').ProposalTemplate>} input
 * @returns {import('../blocks/instance.js').BlockInstance[]}
 */
export function convertLegacyTemplateToBlocks(input = {}) {
  return hydrateBlocksFromProposal(proposalLike(input))
}

/**
 * Mirror canonical blocks onto template compatibility fields.
 *
 * @param {import('../blocks/instance.js').BlockInstance[]} blocks
 * @param {Partial<import('../models/template.js').ProposalTemplate>} [input]
 */
export function mirrorLegacyFromBlocks(blocks, input = {}) {
  const legacy = syncLegacyFromBlocks(blocks, proposalLike(input))
  return {
    description: legacy.summary,
    sections: legacy.sections,
    items: legacy.items,
    terms: legacy.terms,
  }
}

/**
 * Build the template service payload from editor values.
 *
 * Legacy forms omit `blocks` so a details save cannot invent DEFAULT_BLOCK_SEQUENCE.
 * Canonical forms persist the assembly and synced sections/items/terms.
 *
 * @param {object} values
 */
export function buildTemplateEditorPayload(values) {
  const canonical = hasCanonicalBlocks(values.blocks)
  const mirrored = canonical ? mirrorLegacyFromBlocks(values.blocks, values) : null
  const sections = (mirrored?.sections ?? values.sections ?? [])
    .filter((section) => String(section.heading ?? '').trim() || String(section.body ?? '').trim())
    .map((section) => ({
      id: section.id,
      heading: section.heading,
      body: section.body,
    }))

  const items = (mirrored?.items ?? values.items ?? [])
    .filter((item) => String(item.description ?? '').trim() || item.amount !== '')
    .map((item) => ({
      id: item.id,
      description: item.description,
      amount: item.amount === '' ? 0 : Number(item.amount),
    }))

  return {
    title: values.title,
    description: canonical ? mirrored.description : values.description,
    sections,
    items,
    terms: canonical ? mirrored.terms : values.terms,
    notes: values.notes,
    defaultLayoutId: values.defaultLayoutId ?? DEFAULT_LAYOUT_ID,
    questionnaire: values.questionnaire,
    ...(canonical ? { blocks: values.blocks.map((block) => makeBlock(block)) } : {}),
  }
}
