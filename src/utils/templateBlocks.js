import { DEFAULT_LAYOUT_ID } from '../layouts/ids.js'
import {
  hydrateBlocksFromProposal,
  syncLegacyFromBlocks,
} from '../blocks/hydrate.js'
import { insertLibraryBlock, makeBlock } from '../blocks/instance.js'
import { findTemplateForService } from '../models/service.js'
import { normalizeContentBlockIds } from '../models/template.js'
import { NotFoundError } from '../services/errors.js'
import { fetchLibraryBlockById } from '../services/libraryBlockService.js'
import { fetchTemplateById, updateTemplate } from '../services/templateService.js'

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

/**
 * Unique Content Library ids represented by a Block Engine assembly.
 * Order follows first appearance of a non-empty `libraryId`.
 *
 * @param {import('../blocks/instance.js').BlockInstance[] | undefined} blocks
 * @returns {string[]}
 */
export function contentBlockIdsFromBlocks(blocks) {
  return normalizeContentBlockIds(
    (blocks ?? []).map((block) => block?.libraryId).filter(Boolean),
  )
}

/**
 * Materialize Content Library records into a Block Engine assembly.
 *
 * Existing instances that already carry a requested `libraryId` are left
 * alone. Missing library records throw the service `NotFoundError`. The
 * source library definition is not written.
 *
 * @param {import('../blocks/instance.js').BlockInstance[] | { blocks?: import('../blocks/instance.js').BlockInstance[] }} [assembly]
 * @param {string[]} [libraryIds]
 * @param {(id: string) => Promise<import('../models/contentBlock.js').ContentBlock>} [fetchLibraryBlock]
 */
export async function composeTemplateContentBlocks(
  assembly = [],
  libraryIds = [],
  fetchLibraryBlock = fetchLibraryBlockById,
) {
  const currentBlocks = Array.isArray(assembly)
    ? [...assembly]
    : [...(assembly?.blocks ?? [])]
  const requested = normalizeContentBlockIds(libraryIds)
  const present = new Set(contentBlockIdsFromBlocks(currentBlocks))
  let nextBlocks = currentBlocks

  for (const id of requested) {
    if (present.has(id)) continue

    const libraryBlock = await fetchLibraryBlock(id)
    const inserted = insertLibraryBlock(nextBlocks, libraryBlock)
    nextBlocks = inserted.blocks
    present.add(libraryBlock.id)
  }

  return {
    blocks: nextBlocks,
    contentBlockIds: contentBlockIdsFromBlocks(nextBlocks),
  }
}

/**
 * Apply a service's Content Library composition intent onto a template.
 * Delegates to composeTemplateContentBlocks; does not invent a second composer.
 *
 * @param {import('../models/template.js').ProposalTemplate | import('../blocks/instance.js').BlockInstance[]} template
 * @param {Pick<import('../models/service.js').Service, 'contentBlockIds'>} [service]
 */
export async function composeTemplateFromService(template, service) {
  return composeTemplateContentBlocks(template, service?.contentBlockIds ?? [])
}

function blockIds(blocks) {
  return (blocks ?? []).map((block) => block.id)
}

/**
 * Service Editor Apply path: resolve the linked template, fetch the stored
 * record, compose into that record, and persist only when new instances appear.
 *
 * @param {import('../models/template.js').ProposalTemplate[]} templates
 * @param {Pick<import('../models/service.js').Service, 'id' | 'templateId' | 'contentBlockIds'>} service
 */
export async function applyServiceComponentsToTemplate(templates, service) {
  const resolved = findTemplateForService(templates, service)
  if (!resolved) {
    throw new NotFoundError('No default template is linked to this service.')
  }

  const stored = await fetchTemplateById(resolved.id)
  const composed = await composeTemplateFromService(stored, service)
  const storedIds = new Set(blockIds(stored.blocks))
  const added = (composed.blocks ?? []).filter((block) => !storedIds.has(block.id))

  if (added.length === 0) {
    return { template: stored, updated: false }
  }

  const template = await updateTemplate(stored.id, {
    blocks: composed.blocks,
    contentBlockIds: composed.contentBlockIds,
  })

  return { template, updated: true }
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
 * Legacy forms omit `blocks` and `contentBlockIds` so a details save cannot
 * invent DEFAULT_BLOCK_SEQUENCE or compose the Content Library.
 * Canonical forms persist the assembly, derive contentBlockIds from libraryId,
 * and sync sections/items/terms.
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

  const blocks = canonical ? values.blocks.map((block) => makeBlock(block)) : null

  return {
    title: values.title,
    description: canonical ? mirrored.description : values.description,
    sections,
    items,
    terms: canonical ? mirrored.terms : values.terms,
    notes: values.notes,
    defaultLayoutId: values.defaultLayoutId ?? DEFAULT_LAYOUT_ID,
    questionnaire: values.questionnaire,
    ...(canonical
      ? {
          blocks,
          contentBlockIds: contentBlockIdsFromBlocks(blocks),
        }
      : {}),
  }
}
