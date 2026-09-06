import { useEffect, useMemo, useRef } from 'react'
import {
  emitLivingEvent,
  LIVING_EVENT,
  postLivingEngagementEvent,
  presentLivingProposal,
} from '../living/index.js'

/**
 * Living renderer contract for the client portal.
 *
 * Opens emit through the in-memory pipe and Phase 4 persistence.
 * Persistence failures never block rendering.
 *
 * @param {import('../models/proposal.js').Proposal | null | undefined} proposal
 */
export function useLivingProposal(proposal) {
  const living = useMemo(() => presentLivingProposal(proposal), [proposal])
  const openedFor = useRef(null)

  useEffect(() => {
    const proposalId = living.proposal?.id
    const shareToken = living.proposal?.shareToken ?? null
    if (!proposalId || !shareToken || openedFor.current === proposalId) return
    openedFor.current = proposalId
    emitLivingEvent(LIVING_EVENT.PROPOSAL_OPENED, {
      proposalId,
      shareToken,
    })
    void postLivingEngagementEvent(shareToken, {
      type: LIVING_EVENT.PROPOSAL_OPENED,
      dedupe: true,
    })
  }, [living.proposal?.id, living.proposal?.shareToken])

  return living
}
