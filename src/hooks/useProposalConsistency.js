import { useMemo } from 'react'
import { analyzeConsistency } from '../consistency/index.js'
import { useProposalHealth } from './useProposalHealth.js'

/**
 * Live consistency report. Independent of Health Score.
 *
 * @param {object} [proposal]
 * @param {object[]} [blocks]
 */
export function useProposalConsistency(proposal, blocks) {
  const health = useProposalHealth(proposal, blocks)
  return useMemo(
    () =>
      analyzeConsistency({
        proposal,
        blocks,
        diagnostics: health.suggestions,
        health,
      }),
    [proposal, blocks, health],
  )
}
