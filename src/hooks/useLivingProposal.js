import { useEffect, useMemo, useRef } from 'react'
import {
  emitLivingEvent,
  LIVING_EVENT,
  presentLivingProposal,
} from '../living/index.js'

/**
 * Living renderer contract for the client portal.
 *
 * Domain projection stays outside the component. Opened is the only Phase 1
 * emit; later phases subscribe to `onLivingEvent` without a new store.
 *
 * @param {import('../models/proposal.js').Proposal | null | undefined} proposal
 */
export function useLivingProposal(proposal) {
  const living = useMemo(() => presentLivingProposal(proposal), [proposal])
  const openedFor = useRef(null)

  useEffect(() => {
    const proposalId = living.proposal?.id
    if (!proposalId || openedFor.current === proposalId) return
    openedFor.current = proposalId
    emitLivingEvent(LIVING_EVENT.PROPOSAL_OPENED, {
      proposalId,
      shareToken: living.proposal?.shareToken ?? null,
    })
  }, [living.proposal?.id, living.proposal?.shareToken])

  return living
}
