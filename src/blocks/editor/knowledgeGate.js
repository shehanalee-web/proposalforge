/**
 * Gate for BlockEditor Knowledge persist and library use-count writes.
 *
 * `knowledgeCompanyId` is an existing BlockEditor prop. A bound id keeps
 * proposal-editor behavior. Null/empty disables those side effects so Template
 * Studio can reuse BlockEditor without Knowledge or H16 writes.
 */
export function isBlockEditorKnowledgeEnabled(knowledgeCompanyId) {
  return Boolean(knowledgeCompanyId)
}
