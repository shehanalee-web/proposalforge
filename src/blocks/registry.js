import { CONTENT_BLOCK_TYPE_LABELS } from '../models/contentBlock.js'
import { BLOCK_TYPE, BUILTIN_BLOCK_TYPES } from './ids.js'
import { makeBlockData, isBlockDataEmpty } from './schemas.js'

/**
 * Block type catalog without renderers so the editor and Proposal Engine do
 * not pull PDF packages into the screen bundle.
 */
export function getBlockType(type) {
  const resolved = BUILTIN_BLOCK_TYPES.includes(type) ? type : BLOCK_TYPE.CUSTOM

  return {
    type: resolved,
    label: CONTENT_BLOCK_TYPE_LABELS[resolved] ?? 'Block',
    makeData: (input) => makeBlockData(resolved, input),
    isEmpty: (data) => isBlockDataEmpty(resolved, data),
  }
}

export function listBlockTypes() {
  return BUILTIN_BLOCK_TYPES.map((type) => getBlockType(type))
}
