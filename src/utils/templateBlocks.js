import { DEFAULT_LAYOUT_ID } from '../layouts/ids.js'
import {
  ensureProposalBlocks,
  hydrateBlocksFromProposal,
  syncLegacyFromBlocks,
} from '../blocks/hydrate.js'
import { insertLibraryBlock, makeBlock } from '../blocks/instance.js'
import { BLOCK_TYPE } from '../blocks/ids.js'
import { makeGalleryItem } from '../blocks/schemas.js'
import { normalizeIdList } from '../models/ids.js'
import { findTemplateForService } from '../models/service.js'
import { normalizeContentBlockIds } from '../models/template.js'
import { NotFoundError } from '../services/errors.js'
import { fetchAssetById } from '../services/assetService.js'
import { fetchLibraryBlockById } from '../services/libraryBlockService.js'
import {
  loadStoredProposalById,
  updateProposal,
} from '../services/proposalService.js'
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

/**
 * Create Proposal path: hydrate the initial assembly, then compose the
 * service's Content Library intent into it. Does not persist. Empty or
 * absent contentBlockIds leave the payload unchanged so createProposal
 * stays on the existing hydrate path and the library is not fetched.
 *
 * @param {Partial<import('../models/proposal.js').Proposal>} [payload]
 * @param {Pick<import('../models/service.js').Service, 'contentBlockIds'>} [service]
 */
export async function composeServiceComponentsForCreate(payload = {}, service) {
  const requested = normalizeContentBlockIds(service?.contentBlockIds)
  if (requested.length === 0) {
    return payload
  }

  const initialBlocks = ensureProposalBlocks(payload)
  const composed = await composeTemplateFromService(
    { ...payload, blocks: initialBlocks },
    service,
  )

  return {
    ...payload,
    blocks: composed.blocks,
  }
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

/**
 * Proposal Editor Apply path: load the stored proposal (no studio view),
 * compose into that record, and persist only when new instances appear.
 *
 * @param {string} proposalId
 * @param {Pick<import('../models/service.js').Service, 'contentBlockIds'>} [service]
 */
export async function applyServiceComponentsToProposal(proposalId, service) {
  const stored = await loadStoredProposalById(proposalId)
  const composed = await composeTemplateFromService(stored, service)
  const storedIds = new Set(blockIds(stored.blocks))
  const added = (composed.blocks ?? []).filter((block) => !storedIds.has(block.id))

  if (added.length === 0) {
    return { proposal: stored, updated: false }
  }

  const proposal = await updateProposal(stored.id, {
    blocks: composed.blocks,
  })

  return { proposal, updated: true }
}

function galleryAssetIds(blocks) {
  const ids = []

  for (const block of blocks ?? []) {
    if (block?.type !== BLOCK_TYPE.GALLERY) continue
    for (const item of block.data?.items ?? []) {
      const id = String(item?.assetId ?? '').trim()
      if (id) ids.push(id)
    }
  }

  return ids
}

function cloneAssemblyBlocks(assembly = []) {
  const current = Array.isArray(assembly) ? assembly : assembly?.blocks ?? []
  return current.map((block) => makeBlock(block))
}

/**
 * Materialize Asset Library ids into Block Engine gallery items.
 * Does not persist. Empty assetIds skip fetching. Existing gallery items
 * that already carry a requested assetId are left alone.
 *
 * @param {import('../models/template.js').ProposalTemplate | import('../blocks/instance.js').BlockInstance[]} [assembly]
 * @param {string[]} [assetIds]
 */
export async function composeTemplateAssets(assembly = [], assetIds = []) {
  const requested = normalizeIdList(assetIds)
  const currentBlocks = cloneAssemblyBlocks(assembly)

  if (requested.length === 0) {
    return { blocks: currentBlocks, added: [] }
  }

  const present = new Set(galleryAssetIds(currentBlocks))
  const missing = requested.filter((id) => !present.has(id))

  if (missing.length === 0) {
    return { blocks: currentBlocks, added: [] }
  }

  const fetched = []
  for (const id of missing) {
    fetched.push(await fetchAssetById(id))
  }

  const added = fetched.map((asset) =>
    makeGalleryItem({
      assetId: asset.id,
      url: asset.url ?? asset.thumbnailUrl ?? '',
      caption: asset.caption ?? asset.alt ?? asset.name ?? '',
    }),
  )

  const galleryIndex = currentBlocks.findIndex((block) => block.type === BLOCK_TYPE.GALLERY)

  if (galleryIndex >= 0) {
    const gallery = currentBlocks[galleryIndex]
    const items = [...(gallery.data?.items ?? []), ...added]
    const nextBlocks = currentBlocks.map((block, index) =>
      index === galleryIndex
        ? makeBlock({
            ...gallery,
            enabled: true,
            data: { ...gallery.data, items },
          })
        : block,
    )
    return { blocks: nextBlocks, added }
  }

  const gallery = makeBlock({
    type: BLOCK_TYPE.GALLERY,
    enabled: true,
    data: { items: added },
  })

  return { blocks: [...currentBlocks, gallery], added }
}

/**
 * Service Editor Asset Apply path: resolve the linked canonical template,
 * compose gallery items, and persist only when new items appear.
 *
 * @param {import('../models/template.js').ProposalTemplate[]} templates
 * @param {Pick<import('../models/service.js').Service, 'id' | 'templateId' | 'assetIds'>} service
 */
export async function applyServiceAssetsToTemplate(templates, service) {
  const resolved = findTemplateForService(templates, service)
  if (!resolved) {
    throw new NotFoundError('No default template is linked to this service.')
  }

  const stored = await fetchTemplateById(resolved.id)
  if (!hasCanonicalBlocks(stored.blocks)) {
    throw new NotFoundError('Linked template has no Block Engine assembly.')
  }

  const composed = await composeTemplateAssets(stored, service?.assetIds)
  if (composed.added.length === 0) {
    return { template: stored, updated: false }
  }

  const template = await updateTemplate(stored.id, {
    blocks: composed.blocks,
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
