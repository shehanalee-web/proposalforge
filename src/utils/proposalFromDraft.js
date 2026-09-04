import { BLOCK_TYPE } from '../blocks/ids.js'
import { hydrateBlocksFromProposal } from '../blocks/hydrate.js'
import { makeBlockData } from '../blocks/schemas.js'
import {
  DEFAULT_CURRENCY,
  makeLineItem,
  makeSection,
} from '../models/proposal.js'
import { findServiceForName } from '../models/service.js'
import {
  matchProjectType,
  suggestTitle,
} from '../models/proposalDraft.js'

const DEFAULT_TERMS = `Payment is due according to the schedule in this proposal. Work begins on receipt of the signed proposal or first payment. Two rounds of revisions are included unless noted otherwise. This proposal is valid for 30 days.`

/**
 * Turn wizard answers into a create-proposal payload the editor already
 * understands. Cover, summary, scope, approach, deliverables, timeline,
 * pricing and terms land on Block Engine instances so the editor opens
 * with a complete, editable draft.
 *
 * @param {import('../models/proposalDraft.js').ProposalDraft} draft
 * @param {import('../models/service.js').Service[]} [services]
 * @returns {Partial<import('../models/proposal.js').Proposal>}
 */
export function proposalFromDraft(draft, services = []) {
  const clientName = draft.client?.trim() || draft.company?.trim() || 'New client'
  const company = draft.company?.trim() || clientName
  const matchedService = findServiceForName(services, draft.projectType)
  const projectType =
    matchedService?.name || matchProjectType(draft.projectType) || 'Consulting'
  const title = draft.title?.trim() || suggestTitle(draft) || `${projectType} proposal`
  const amount = Number(draft.pricing?.amount ?? 0) || 0
  const feeLabel = draft.pricing?.notes?.trim() || `${projectType} fee`
  const deliverables = draft.deliverables ?? []
  const summary = buildSummary(draft, clientName, projectType)
  const terms = draft.terms?.trim() || DEFAULT_TERMS
  const items =
    amount > 0 ? [makeLineItem({ description: feeLabel, amount })] : []
  const sections = buildSections(draft, deliverables)

  const payload = {
    title,
    clientName,
    company,
    projectType,
    serviceIds: matchedService ? [matchedService.id] : [],
    amount,
    currency: draft.pricing?.currency || DEFAULT_CURRENCY,
    summary,
    sections,
    items,
    terms,
    notes: draft.notes?.trim() || '',
    tags: [draft.industry, draft.style].map((value) => value?.trim()).filter(Boolean),
  }

  let blocks = hydrateBlocksFromProposal(payload)

  blocks = setBlock(blocks, BLOCK_TYPE.COVER, {
    kicker: draft.industry?.trim() || projectType,
    heading: title,
    subheading: [clientName, company].filter((value, index, list) => list.indexOf(value) === index).join(' · '),
  })

  if (deliverables.length > 0) {
    blocks = setBlock(
      blocks,
      BLOCK_TYPE.DELIVERABLES,
      {
        items: deliverables.map((item) => ({ title: item, body: '' })),
      },
      { enabled: true },
    )
  }

  if (draft.timeline?.trim()) {
    blocks = setBlock(
      blocks,
      BLOCK_TYPE.TIMELINE,
      {
        items: timelineItems(draft.timeline.trim()),
      },
      { enabled: true },
    )
  }

  return { ...payload, blocks }
}

function buildSummary(draft, client, projectType) {
  if (draft.notes?.trim() && !draft.industry && !draft.style) {
    return draft.notes.trim()
  }

  const industry = draft.industry?.trim()
  const timeline = draft.timeline?.trim()
  const style = draft.style?.trim()
  const parts = []

  if (client && projectType) {
    const industryBit = industry ? ` in ${industry}` : ''
    parts.push(
      `This proposal outlines a ${projectType.toLowerCase()} engagement for ${client}${industryBit}.`,
    )
  } else if (projectType) {
    parts.push(`This proposal outlines a ${projectType.toLowerCase()} engagement.`)
  }

  if (draft.deliverables?.length) {
    parts.push(`The scope includes ${draft.deliverables.join(', ')}.`)
  }

  if (timeline) {
    parts.push(`The work is planned over ${timeline}.`)
  }

  if (style) {
    parts.push(`The document is written in a ${style} tone.`)
  }

  if (draft.notes?.trim()) {
    parts.push(draft.notes.trim())
  }

  return parts.join(' ')
}

function buildSections(draft, deliverables) {
  const sections = []

  if (deliverables.length > 0) {
    sections.push(
      makeSection({
        heading: 'Scope of work',
        body: deliverables.map((item) => `• ${item}`).join('\n'),
      }),
    )
  }

  if (draft.style?.trim()) {
    sections.push(
      makeSection({
        heading: 'Approach',
        body: `The proposal and the work it describes should feel ${draft.style.trim()}. Language, pacing and presentation follow that register throughout.`,
      }),
    )
  }

  if (draft.industry?.trim() && !deliverables.length) {
    sections.push(
      makeSection({
        heading: 'Context',
        body: `Prepared for a ${draft.industry.trim()} client. Edit this section with the specific brief, constraints and success criteria.`,
      }),
    )
  }

  return sections
}

function timelineItems(timeline) {
  const parts = timeline
    .split(/\n|;|•|\u2022/)
    .map((part) => part.replace(/^[\s\-–—*]+/, '').trim())
    .filter(Boolean)

  if (parts.length > 1) {
    return parts.map((part, index) => ({
      title: `Phase ${index + 1}`,
      date: '',
      body: part,
    }))
  }

  return [
    {
      title: 'Schedule',
      date: '',
      body: timeline,
    },
  ]
}

function setBlock(blocks, type, data, extras = {}) {
  return blocks.map((block) => {
    if (block.type !== type) return block

    return {
      ...block,
      enabled: extras.enabled ?? block.enabled,
      data: makeBlockData(type, { ...block.data, ...data }),
    }
  })
}
