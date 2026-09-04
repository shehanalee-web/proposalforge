import { useMemo } from 'react'
import { useProposalHealth } from './useProposalHealth.js'
import { analyzeProposal } from '../intelligence/index.js'

/**
 * Live proposal intelligence for the editor. Consumes the existing Health
 * snapshot — never rescans document text.
 *
 * @param {object} [proposal]
 * @param {object[]} [blocks]
 */
export function useProposalIntelligence(proposal, blocks) {
  const health = useProposalHealth(proposal, blocks)
  return useMemo(
    () =>
      analyzeProposal({
        proposal,
        diagnostics: health.suggestions,
        health,
      }),
    [proposal, health],
  )
}
