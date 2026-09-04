import { useMemo } from 'react'
import { analyzeProposalHealth } from '../insights/index.js'

/**
 * Live proposal health for the editor. Recomputes from current blocks;
 * nothing is persisted.
 *
 * @param {object} [proposal]
 * @param {object[]} [blocks]
 */
export function useProposalHealth(proposal, blocks) {
  return useMemo(
    () => analyzeProposalHealth({ proposal, blocks }),
    [proposal, blocks],
  )
}
