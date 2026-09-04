import { makeBlock, updateBlockData } from '../blocks/instance.js'
import { makeBlockData } from '../blocks/schemas.js'
import { IMPROVE_PATCH } from './ids.js'

function findIndexByType(blocks, type) {
  return (blocks ?? []).findIndex((block) => block.type === type)
}

function fillBlock(list, type, data) {
  const index = findIndexByType(list, type)
  if (index < 0) {
    return [...list, makeBlock({ type, enabled: true, data })]
  }

  const current = list[index]
  const next = [...list]
  next[index] = {
    ...current,
    enabled: true,
    data: makeBlockData(current.type, { ...current.data, ...data }),
  }
  return next
}

function appendBody(list, type, append) {
  const extra = String(append ?? '').trim()
  if (!extra) return list

  const index = findIndexByType(list, type)
  if (index < 0) {
    return fillBlock(list, type, { body: extra })
  }

  const current = list[index]
  const body = [current.data?.body, extra].filter(Boolean).join('\n\n')
  return updateBlockData(
    list.map((block, i) =>
      i === index ? { ...block, enabled: true } : block,
    ),
    current.id,
    { body },
  )
}

function lastIndexOfTypes(list, types) {
  let found = -1
  for (let index = 0; index < list.length; index += 1) {
    if (types.includes(list[index].type) && list[index].enabled !== false) {
      found = index
    }
  }
  return found
}

function moveAfter(list, type, afterTypes) {
  const from = findIndexByType(list, type)
  if (from < 0) return list

  const next = [...list]
  const [item] = next.splice(from, 1)
  const understanding = lastIndexOfTypes(next, afterTypes)
  if (understanding < 0) {
    return list
  }

  next.splice(understanding + 1, 0, { ...item, enabled: true })
  return next
}

/**
 * Apply a generated draft to the live block list. Pure — the editor owns
 * undo by snapshotting before it calls this.
 *
 * @param {object[]} [blocks]
 * @param {import('./draft.js').ImprovementDraft} draft
 */
export function applyImprovement(blocks, draft) {
  const list = [...(blocks ?? [])]
  const patch = draft?.patch ?? {}

  if (patch.kind === IMPROVE_PATCH.APPEND_BODY) {
    return {
      blocks: appendBody(list, patch.blockType, patch.append || patch.data?.body),
      summary: patch.summary,
    }
  }

  if (patch.kind === IMPROVE_PATCH.MOVE_AFTER) {
    return {
      blocks: moveAfter(list, patch.blockType, patch.afterTypes),
      summary: patch.summary,
    }
  }

  return {
    blocks: fillBlock(list, patch.blockType, patch.data),
    summary: patch.summary,
  }
}

export function draftPlainText(draft) {
  if (!draft) return ''
  return [draft.previewTitle, draft.previewBody].filter(Boolean).join('\n\n')
}
