/**
 * Navigation metadata for section comments.
 * The editor uses existing scrollToBlock / setActiveBlockId — do not duplicate it.
 */
export function commentNavigation(comment) {
  const blockId = String(comment?.blockId ?? '').trim()
  if (!blockId) return null
  return {
    blockId,
    selector: `[data-block-id="${blockId}"]`,
    expandSection: true,
    selectBlock: true,
    openInspector: true,
  }
}
