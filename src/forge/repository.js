import { ForbiddenError, NotFoundError, ValidationError } from '../services/errors.js'
import { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
import { resolveWorkflowActor } from '../workflow/actors.js'
import { studioCanMutateFollowup, studioCanViewFollowup } from '../followup/permissions.js'
import {
  createManualFollowup,
  getProposalFollowupView,
  listStudioFollowups,
  startFollowup,
  syncFollowupsForProposal,
} from '../followup/repository.js'
import {
  resolveFollowupInteractions,
  resolveFollowupLivingSession,
  resolveFollowupProposal,
} from '../followup/lookups.js'
import { isOpenFollowupStatus } from '../followup/statuses.js'
import { FOLLOWUP_REASON, FOLLOWUP_STATUS } from '../followup/types.js'
import { summarizeLivingEngagement } from '../living/eventRepository.js'
import { listLivingEngagementEventsForProposal } from '../living/eventStore.js'
import { getLivingPublicationState } from '../living/publicationRepository.js'
import { deriveSelectedCommercialState } from '../living/totals.js'
import { LIVING_CAPABILITIES } from '../living/types.js'
import {
  findCommercialCloseByProposal,
  presentCommercialCloseCompletionSummary,
} from '../commercialClose/index.js'
import { buildForgeLivingSummary } from './summary.js'
import { draftFollowupMessage, suggestForgeNextAction } from './suggest.js'
import { FORGE_ACTION, FORGE_ACTIONS, FORGE_CAPABILITIES } from './types.js'

function scopedCompany(companyId) {
  return String(companyId ?? '').trim() || DEFAULT_COMPANY_ID
}

function actorOf(input) {
  return resolveWorkflowActor(input)
}

function assertCompanyActor(actor, companyId) {
  if (actor.companyId !== companyId) {
    throw new ForbiddenError('You cannot access another company workspace.')
  }
}

function assertForgeEnabled() {
  if (!LIVING_CAPABILITIES.forgeActions || !FORGE_CAPABILITIES.studioActions) {
    throw new ValidationError('Studio Forge actions are not enabled.', [
      { field: 'capabilities', message: 'forgeActions capability is off.' },
    ])
  }
}

function requireProposal(companyId, proposalId) {
  const pid = String(proposalId ?? '').trim()
  if (!pid) {
    throw new ValidationError('proposalId is required.', [
      { field: 'proposalId', message: 'proposalId is required.' },
    ])
  }
  const proposal = resolveFollowupProposal(pid, companyId)
  if (!proposal) {
    throw new NotFoundError('Proposal not found.')
  }
  return proposal
}

/**
 * Public clients must never reach Forge.
 */
export function clientForgeApiDenied() {
  throw new ForbiddenError('Forge is studio-only.')
}

/**
 * Collect living + H12 + H13 context for a proposal (company-scoped).
 */
export function collectForgeContext({ companyId, proposalId, actor, now } = {}) {
  assertForgeEnabled()
  const scoped = scopedCompany(companyId)
  const user = actorOf(actor)
  assertCompanyActor(user, scoped)
  if (!studioCanViewFollowup(user)) {
    throw new ForbiddenError('You do not have permission to use Forge.')
  }

  const proposal = requireProposal(scoped, proposalId)
  const livingSession = resolveFollowupLivingSession(scoped, proposal.id, proposal)
  const interactions = resolveFollowupInteractions(scoped, proposal.id)
  const events = listLivingEngagementEventsForProposal(proposal.id, scoped)
  const engagement = summarizeLivingEngagement(events)
  const followupView = getProposalFollowupView({
    companyId: scoped,
    proposalId: proposal.id,
    actor: user,
    now,
  })
  let publication = null
  try {
    publication = getLivingPublicationState({
      proposalId: proposal.id,
      companyId: scoped,
    })
  } catch {
    publication = null
  }
  const commercialState = deriveSelectedCommercialState(proposal, livingSession)
  const closeRecord = findCommercialCloseByProposal(proposal.id, scoped)
  const commercialCloseCompletion = presentCommercialCloseCompletionSummary(closeRecord)

  const summary = buildForgeLivingSummary({
    proposal,
    livingSession,
    engagement,
    interactions,
    followups: followupView.followups,
    publication,
    commercialState,
    commercialCloseCompletion,
  })
  const suggestion = suggestForgeNextAction(summary)

  return {
    companyId: scoped,
    actor: user,
    proposal,
    livingSession,
    summary,
    suggestion,
    followups: followupView.followups,
    nextFollowupAction: followupView.nextAction,
  }
}

/**
 * Studio Forge view: summary + deterministic suggestion + drafts.
 */
export function getForgeProposalView(input = {}) {
  const context = collectForgeContext(input)
  return {
    kind: 'forge_proposal_view',
    capabilities: FORGE_CAPABILITIES,
    livingCapabilities: LIVING_CAPABILITIES,
    summary: context.summary,
    suggestion: context.suggestion,
    draftMessage: draftFollowupMessage(
      context.summary,
      context.suggestion.reason || null,
    ),
    nextFollowupAction: context.nextFollowupAction,
  }
}

/**
 * Explicit human-triggered Forge action.
 * Never mutates proposals or publications.
 */
export function runForgeAction({
  companyId,
  proposalId,
  actor,
  action,
  followupId,
  title,
  description,
  now,
} = {}) {
  assertForgeEnabled()
  const name = String(action ?? '').trim()
  if (!FORGE_ACTIONS.includes(name)) {
    throw new ValidationError('Unknown Forge action.', [
      { field: 'action', message: `Unsupported action: ${name || '(empty)'}` },
    ])
  }

  // Snapshot open follow-ups before sync materializes H13 signals.
  let priorOpenIds = null
  if (name === FORGE_ACTION.CREATE_FOLLOWUP) {
    const scopedEarly = scopedCompany(companyId)
    const userEarly = actorOf(actor)
    assertCompanyActor(userEarly, scopedEarly)
    if (!studioCanMutateFollowup(userEarly)) {
      throw new ForbiddenError('You do not have permission to create a follow-up.')
    }
    if (!FORGE_CAPABILITIES.followupActions) {
      throw new ValidationError('Forge follow-up actions are not enabled.')
    }
    const pid = String(proposalId ?? '').trim()
    priorOpenIds = new Set(
      listStudioFollowups({
        companyId: scopedEarly,
        proposalId: pid,
        actor: userEarly,
        now,
        sync: false,
      })
        .filter((item) => isOpenFollowupStatus(item.status))
        .map((item) => item.id),
    )
  }

  const context = collectForgeContext({ companyId, proposalId, actor, now })
  const scoped = context.companyId
  const user = context.actor

  if (name === FORGE_ACTION.SUMMARIZE_LIVING_STATE) {
    return {
      kind: 'forge_action_result',
      action: name,
      summary: context.summary,
      suggestion: context.suggestion,
      draftMessage: draftFollowupMessage(context.summary, context.suggestion.reason),
    }
  }

  if (name === FORGE_ACTION.SUGGEST_NEXT_ACTION) {
    return {
      kind: 'forge_action_result',
      action: name,
      suggestion: context.suggestion,
      draftMessage: draftFollowupMessage(context.summary, context.suggestion.reason),
    }
  }

  if (name === FORGE_ACTION.DRAFT_FOLLOWUP_MESSAGE) {
    if (!FORGE_CAPABILITIES.draftFollowupMessage) {
      throw new ValidationError('Draft messages are not enabled.')
    }
    return {
      kind: 'forge_action_result',
      action: name,
      draftMessage: draftFollowupMessage(
        context.summary,
        context.suggestion.reason || null,
      ),
      suggestion: context.suggestion,
    }
  }

  if (name === FORGE_ACTION.CREATE_FOLLOWUP) {
    const open = (context.followups || []).filter((item) => isOpenFollowupStatus(item.status))
    if (open.length) {
      const primary = open[0]
      const appeared = !(priorOpenIds && priorOpenIds.has(primary.id))
      return {
        kind: 'forge_action_result',
        action: name,
        created: appeared,
        deduped: !appeared,
        followup: primary,
        message: appeared
          ? 'Follow-up materialized from living signals.'
          : 'An open follow-up already exists. No duplicate was created.',
        suggestion: context.suggestion,
      }
    }

    const suggestion = context.suggestion
    if (
      suggestion.reason === FOLLOWUP_REASON.COMMERCIAL_SELECTION &&
      context.summary.selection?.hasSelection
    ) {
      syncFollowupsForProposal({
        companyId: scoped,
        proposalId: context.proposal.id,
        actor: user,
        now,
      })
      const after = listStudioFollowups({
        companyId: scoped,
        proposalId: context.proposal.id,
        actor: user,
        now,
        sync: false,
      })
      const commercial = after.find(
        (item) =>
          item.reason === FOLLOWUP_REASON.COMMERCIAL_SELECTION &&
          isOpenFollowupStatus(item.status),
      )
      if (commercial) {
        return {
          kind: 'forge_action_result',
          action: name,
          created: true,
          deduped: false,
          followup: commercial,
          message: 'Commercial selection follow-up reconciled via H13 signals.',
          suggestion,
        }
      }
    }

    const created = createManualFollowup({
      companyId: scoped,
      proposalId: context.proposal.id,
      actor: user,
      title: title || suggestion.title || 'Follow up with client',
      description:
        description ||
        suggestion.description ||
        context.summary.narrative ||
        'Studio Forge suggested this follow-up.',
      now,
    })

    return {
      kind: 'forge_action_result',
      action: name,
      created: true,
      deduped: false,
      followup: created,
      message: 'Follow-up created.',
      suggestion,
    }
  }

  if (name === FORGE_ACTION.UPDATE_FOLLOWUP) {
    if (!studioCanMutateFollowup(user)) {
      throw new ForbiddenError('You do not have permission to update a follow-up.')
    }
    if (!FORGE_CAPABILITIES.followupActions) {
      throw new ValidationError('Forge follow-up actions are not enabled.')
    }

    const targetId =
      String(followupId ?? '').trim() ||
      context.suggestion.updateFollowupId ||
      context.followups.find((item) => isOpenFollowupStatus(item.status))?.id ||
      ''

    if (!targetId) {
      throw new ValidationError('No follow-up available to update.', [
        { field: 'followupId', message: 'followupId is required when no open follow-up exists.' },
      ])
    }

    const existing = context.followups.find((item) => item.id === targetId)
    if (existing?.status === FOLLOWUP_STATUS.IN_PROGRESS) {
      return {
        kind: 'forge_action_result',
        action: name,
        created: false,
        deduped: false,
        followup: existing,
        message: 'Follow-up is already in progress.',
        suggestion: context.suggestion,
      }
    }

    const updated = startFollowup({
      companyId: scoped,
      followupId: targetId,
      actor: user,
      now,
    })

    return {
      kind: 'forge_action_result',
      action: name,
      created: false,
      deduped: false,
      followup: updated,
      message: 'Follow-up marked in progress.',
      suggestion: context.suggestion,
    }
  }

  throw new ValidationError('Unknown Forge action.', [
    { field: 'action', message: `Unsupported action: ${name}` },
  ])
}
