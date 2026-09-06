import { PROPOSAL_STATUS } from '../models/proposal.js'
import { INTERACTION_STATUS, INTERACTION_TYPE } from '../interactions/types.js'
import {
  describeLivingCommercialSelection,
  livingSessionHasCommercialSelection,
} from '../followup/commercialSelection.js'
import { isOpenFollowupStatus } from '../followup/statuses.js'
import { FOLLOWUP_REASON } from '../followup/types.js'
import { presentAuthoredOffers } from '../living/offers.js'
import { deriveSelectedCommercialState } from '../living/totals.js'

function asList(value) {
  return Array.isArray(value) ? value : []
}

function openInteractions(interactions) {
  return asList(interactions).filter(
    (item) =>
      item?.status === INTERACTION_STATUS.OPEN ||
      item?.status === INTERACTION_STATUS.ACKNOWLEDGED,
  )
}

function latestInteraction(interactions) {
  const list = asList(interactions)
  if (!list.length) return null
  return [...list].sort((left, right) =>
    String(right.createdAt || '').localeCompare(String(left.createdAt || '')),
  )[0]
}

function openFollowups(followups) {
  return asList(followups).filter((item) => isOpenFollowupStatus(item?.status))
}

function selectionTitles(proposal, session) {
  if (!livingSessionHasCommercialSelection(session)) {
    return { packageTitle: null, alternativeTitle: null, addonTitles: [] }
  }
  const offers = presentAuthoredOffers(proposal)
  return {
    packageTitle:
      offers.packages.find((item) => item.id === session.selectedPackageId)?.title || null,
    alternativeTitle:
      offers.alternatives.find((item) => item.id === session.selectedAlternativeId)?.title ||
      null,
    addonTitles: asList(session.selectedAddonIds)
      .map((id) => offers.addons.find((item) => item.id === id)?.title || id)
      .filter(Boolean),
  }
}

/**
 * Deterministic studio summary of living + H12 + H13 state.
 * Derived only — never a new source of truth.
 */
export function buildForgeLivingSummary({
  proposal,
  livingSession = null,
  engagement = null,
  interactions = [],
  followups = [],
  publication = null,
  commercialState = null,
} = {}) {
  if (!proposal?.id) {
    return {
      kind: 'forge_living_summary',
      proposalId: '',
      available: false,
    }
  }

  const openIx = openInteractions(interactions)
  const latestIx = latestInteraction(interactions)
  const openFu = openFollowups(followups)
  const commercial = commercialState || deriveSelectedCommercialState(proposal, livingSession)
  const titles = selectionTitles(proposal, livingSession)
  const hasSelection = livingSessionHasCommercialSelection(livingSession)
  const accepted =
    proposal.status === PROPOSAL_STATUS.ACCEPTED || Boolean(proposal.acceptedAt)
  const changeRequests = openIx.filter((item) => item.type === INTERACTION_TYPE.CHANGE_REQUEST)
  const questions = openIx.filter((item) => item.type === INTERACTION_TYPE.QUESTION)
  const comments = openIx.filter((item) => item.type === INTERACTION_TYPE.COMMENT)

  const facts = []
  if ((engagement?.opens ?? 0) > 0) {
    facts.push(
      engagement.opens === 1
        ? 'Client opened the living proposal once.'
        : `Client opened the living proposal ${engagement.opens} times.`,
    )
  } else if (proposal.lastViewedAt) {
    facts.push('Client has viewed the proposal.')
  } else {
    facts.push('No living open events recorded yet.')
  }

  if ((engagement?.pricingViewed ?? 0) > 0) {
    facts.push('Pricing was viewed.')
  }
  if (hasSelection) {
    facts.push(describeLivingCommercialSelection(proposal, livingSession))
  }
  if (questions.length) {
    facts.push(
      questions.length === 1
        ? 'Client has an open question.'
        : `Client has ${questions.length} open questions.`,
    )
  }
  if (changeRequests.length) {
    facts.push(
      changeRequests.length === 1
        ? 'Client requested changes.'
        : `Client has ${changeRequests.length} open change requests.`,
    )
  }
  if (comments.length) {
    facts.push(
      comments.length === 1
        ? 'Client left an open comment.'
        : `Client has ${comments.length} open comments.`,
    )
  }
  if (accepted) {
    facts.push('Proposal is accepted.')
  } else {
    facts.push('Proposal has not been accepted yet.')
  }
  if (openFu.length) {
    facts.push(
      openFu.length === 1
        ? `Active follow-up: ${openFu[0].title || openFu[0].reason}.`
        : `${openFu.length} active follow-ups on this proposal.`,
    )
  } else {
    facts.push('No open follow-up currently.')
  }

  const narrative = facts.join(' ')

  return {
    kind: 'forge_living_summary',
    available: true,
    proposalId: proposal.id,
    companyId: proposal.companyId || '',
    title: proposal.title || '',
    clientName: proposal.clientName || '',
    status: proposal.status || '',
    accepted,
    publication: {
      source: publication?.source || publication?.current?.id ? 'published' : 'authored',
      snapshotNumber: publication?.current?.snapshotNumber ?? null,
      publishedAt: publication?.current?.publishedAt ?? null,
      hasUnpublishedChanges: Boolean(publication?.hasUnpublishedChanges),
    },
    engagement: {
      opens: engagement?.opens ?? 0,
      sectionsViewed: engagement?.sectionsViewed ?? 0,
      pricingViewed: engagement?.pricingViewed ?? 0,
      packageSelections: engagement?.packageSelections ?? 0,
      addonSelections: engagement?.addonSelections ?? 0,
      acceptanceStarted: engagement?.acceptanceStarted ?? 0,
      lastEngagementAt: engagement?.lastEngagementAt ?? null,
      lastEngagementType: engagement?.lastEngagementType ?? null,
    },
    selection: {
      hasSelection,
      selectedPackageId: livingSession?.selectedPackageId ?? null,
      selectedAlternativeId: livingSession?.selectedAlternativeId ?? null,
      selectedAddonIds: asList(livingSession?.selectedAddonIds),
      packageTitle: titles.packageTitle,
      alternativeTitle: titles.alternativeTitle,
      addonTitles: titles.addonTitles,
      description: hasSelection
        ? describeLivingCommercialSelection(proposal, livingSession)
        : '',
      selectedTotal: Number.isFinite(commercial?.selectedTotal)
        ? commercial.selectedTotal
        : null,
      currency: proposal.currency || 'USD',
    },
    interactions: {
      openCount: openIx.length,
      questionCount: questions.length,
      changeRequestCount: changeRequests.length,
      commentCount: comments.length,
      latest: latestIx
        ? {
            id: latestIx.id,
            type: latestIx.type,
            status: latestIx.status,
            message: String(latestIx.message || '').slice(0, 280),
            createdAt: latestIx.createdAt || null,
          }
        : null,
    },
    followups: {
      openCount: openFu.length,
      open: openFu.map((item) => ({
        id: item.id,
        reason: item.reason,
        title: item.title,
        description: item.description,
        status: item.status,
        dueAt: item.dueAt,
      })),
      hasCommercialSelection: openFu.some(
        (item) => item.reason === FOLLOWUP_REASON.COMMERCIAL_SELECTION,
      ),
      hasClientInteraction: openFu.some(
        (item) =>
          item.reason === FOLLOWUP_REASON.CLIENT_INTERACTION ||
          item.reason === FOLLOWUP_REASON.CHANGES_REQUESTED,
      ),
    },
    facts,
    narrative,
  }
}
