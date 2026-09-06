import { DEFAULT_ACTOR_ID, getWorkflowActor, WORKFLOW_ACTORS } from '../workflow/actors.js'
import { WORKFLOW_ROLE } from '../workflow/types.js'
import { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
import { LIVING_CAPABILITIES } from './types.js'
import { syncFollowupsForProposal } from '../followup/repository.js'
import { resolveFollowupWorkflow } from '../followup/lookups.js'

function actorIdForCompany(companyId) {
  const scoped = String(companyId ?? '').trim() || DEFAULT_COMPANY_ID
  const owner = WORKFLOW_ACTORS.find(
    (actor) => actor.companyId === scoped && actor.role === WORKFLOW_ROLE.OWNER,
  )
  if (owner) return owner.id
  const any = WORKFLOW_ACTORS.find((actor) => actor.companyId === scoped)
  if (any) return any.id
  return DEFAULT_ACTOR_ID
}

/**
 * Best-effort H13 reconciliation after a living commercial decision.
 * Never throws to callers. Never writes proposals.json.
 * Does not expose follow-up records to the client.
 *
 * @param {{
 *   companyId?: string,
 *   proposalId: string,
 *   now?: number | Date | string,
 * }} input
 */
export function reconcileLivingCommercialSelectionFollowup(input = {}) {
  if (!LIVING_CAPABILITIES.commercialSelectionFollowup) return null
  const proposalId = String(input.proposalId ?? '').trim()
  if (!proposalId) return null
  const companyId = String(input.companyId ?? '').trim() || DEFAULT_COMPANY_ID

  try {
    const workflow = resolveFollowupWorkflow(companyId, proposalId)
    const ownerId = String(workflow?.ownerId ?? '').trim()
    const actorId =
      (ownerId && getWorkflowActor(ownerId)?.companyId === companyId && ownerId) ||
      actorIdForCompany(companyId)

    return syncFollowupsForProposal({
      companyId,
      proposalId,
      actor: { id: actorId },
      now: input.now,
    })
  } catch {
    return null
  }
}
