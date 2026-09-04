import { createRecordId } from '../models/ids.js'
import { CONTENT_BLOCK_TYPE_LABELS, defaultBlockSettings } from '../models/contentBlock.js'
import { BLOCK_TYPE, BUILTIN_BLOCK_TYPES } from './ids.js'
import { makeBlockData } from './schemas.js'

/**
 * A proposal block instance.
 *
 * Order is the array order on the proposal. Drag-and-drop can reorder this
 * list later without a schema change. `enabled: false` hides the block in
 * every renderer and never drops `data`.
 *
 * @typedef {object} BlockInstance
 * @property {string} id
 * @property {string} type
 * @property {boolean} enabled
 * @property {object} data
 * @property {string | null} libraryId
 * @property {object} settings
 */

export function getBlockLabel(type) {
  return CONTENT_BLOCK_TYPE_LABELS[type] ?? 'Block'
}

/**
 * @param {Partial<BlockInstance>} [input]
 * @returns {BlockInstance}
 */
export function makeBlock(input = {}) {
  const type = BUILTIN_BLOCK_TYPES.includes(input.type)
    ? input.type
    : BLOCK_TYPE.CUSTOM

  return {
    id: input.id ?? createRecordId('blk'),
    type,
    enabled: input.enabled !== false,
    data: makeBlockData(type, input.data ?? {}),
    libraryId: input.libraryId ?? null,
    settings: defaultBlockSettings(input.settings ?? {}),
  }
}

export function listEnabledBlocks(blocks) {
  return (blocks ?? []).filter((block) => block.enabled)
}

export function moveBlock(blocks, id, offset) {
  const list = [...(blocks ?? [])]
  const index = list.findIndex((block) => block.id === id)

  if (index < 0) return list

  const next = index + offset

  if (next < 0 || next >= list.length) return list

  const copy = list[index]
  list[index] = list[next]
  list[next] = copy

  return list
}

export function setBlockEnabled(blocks, id, enabled) {
  return (blocks ?? []).map((block) =>
    block.id === id ? { ...block, enabled: Boolean(enabled) } : block,
  )
}

export function updateBlockData(blocks, id, data) {
  return (blocks ?? []).map((block) => {
    if (block.id !== id) return block

    return {
      ...block,
      data: makeBlockData(block.type, { ...block.data, ...data }),
    }
  })
}

export function updateBlocksByType(blocks, type, data) {
  return (blocks ?? []).map((block) => {
    if (block.type !== type) return block

    return {
      ...block,
      data: makeBlockData(block.type, { ...block.data, ...data }),
    }
  })
}

export function addBlock(blocks, type = BLOCK_TYPE.CUSTOM) {
  return [...(blocks ?? []), makeBlock({ type, enabled: true })]
}

export function duplicateBlock(blocks, id) {
  const list = blocks ?? []
  const index = list.findIndex((block) => block.id === id)
  if (index < 0) return list

  const source = list[index]
  const copy = makeBlock({
    type: source.type,
    enabled: source.enabled,
    data: JSON.parse(JSON.stringify(source.data)),
    libraryId: source.libraryId ?? null,
    settings: source.settings,
  })

  const next = [...list]
  next.splice(index + 1, 0, copy)
  return next
}

export function removeBlock(blocks, id) {
  return (blocks ?? []).filter((block) => block.id !== id)
}

export function reorderBlocks(blocks, fromIndex, toIndex) {
  if (fromIndex === toIndex) return blocks
  const list = [...(blocks ?? [])]
  const [item] = list.splice(fromIndex, 1)
  list.splice(toIndex, 0, item)
  return list
}

export function insertLibraryBlock(blocks, libraryBlock, index = null) {
  const created = makeBlock({
    type: libraryBlock.type,
    enabled: true,
    data: JSON.parse(JSON.stringify(libraryBlock.data ?? {})),
    libraryId: libraryBlock.id,
    settings: libraryBlock.settings,
  })
  const list = [...(blocks ?? [])]
  const at = index == null ? list.length : Math.max(0, Math.min(index, list.length))
  list.splice(at, 0, created)
  return { blocks: list, created }
}

export function updateBlockSettings(blocks, id, settings) {
  return (blocks ?? []).map((block) => {
    if (block.id !== id) return block
    return {
      ...block,
      settings: defaultBlockSettings({ ...block.settings, ...settings }),
    }
  })
}

export function pasteBlock(blocks, source, index = null) {
  if (!source) return { blocks, created: null }
  const created = makeBlock({
    type: source.type,
    enabled: source.enabled !== false,
    data: JSON.parse(JSON.stringify(source.data ?? {})),
    libraryId: source.libraryId ?? null,
    settings: source.settings,
  })
  const list = [...(blocks ?? [])]
  const at = index == null ? list.length : Math.max(0, Math.min(index, list.length))
  list.splice(at, 0, created)
  return { blocks: list, created }
}
