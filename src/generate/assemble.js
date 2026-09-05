import { BLOCK_TYPE } from '../blocks/ids.js'
import { hydrateBlocksFromProposal } from '../blocks/hydrate.js'
import { makeBlockData } from '../blocks/schemas.js'
import { DEFAULT_CURRENCY, makeLineItem, makeSection } from '../models/proposal.js'
import { sanitizeGenerationMetadata } from './metadata.js'
import { makeProposalGeneratedEvent } from './events.js'
import { GENERATOR_SECTION, UNRESOLVED_FACT } from './types.js'
import { factValue } from './facts.js'

function sectionBody(section) {
  return (section?.blocks ?? [])
    .map((block) => {
      const heading = String(block.heading ?? '').trim()
      const body = String(block.body ?? '').trim()
      const items = (block.items ?? [])
        .map((item) => {
          const title = String(item.title ?? '').trim()
          const itemBody = String(item.body ?? '').trim()
          return [title, itemBody].filter(Boolean).join(' — ')
        })
        .filter(Boolean)
      return [heading, body, ...items].filter(Boolean).join('\n')
    })
    .filter(Boolean)
    .join('\n\n')
}

function findSection(draft, type) {
  return (draft.sections ?? []).find((section) => section.type === type) ?? null
}

function parseAmount(pricing) {
  const text = String(pricing ?? '')
  const match = text.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/)
  if (!match) return 0
  const amount = Number(match[1])
  return Number.isFinite(amount) ? amount : 0
}

function setBlock(blocks, type, data, extras = {}) {
  return blocks.map((block) => {
    if (block.type !== type) return block
    return {
      ...block,
      enabled: extras.enabled ?? true,
      data: makeBlockData(type, { ...block.data, ...data }),
    }
  })
}

function timelineItems(section) {
  const fromItems = (section?.blocks ?? []).flatMap((block) => block.items ?? [])
  if (fromItems.length > 0) {
    return fromItems.map((item) => ({
      title: item.title || 'Milestone',
      date: item.date || '',
      body: item.body || '',
    }))
  }
  const body = sectionBody(section)
  if (!body || body.includes(UNRESOLVED_FACT)) {
    return [{ title: 'Schedule', date: '', body: body || UNRESOLVED_FACT }]
  }
  return [{ title: 'Schedule', date: '', body }]
}

function deliverableItems(section, fallback) {
  const fromItems = (section?.blocks ?? []).flatMap((block) =>
    (block.items ?? []).map((item) => ({
      title: item.title || item.body,
      body: item.title ? item.body : '',
    })),
  ).filter((item) => item.title)
  if (fromItems.length) return fromItems
  const lines = String(fallback ?? '')
    .split(/\n/)
    .map((line) => line.replace(/^[\s\-–—*]+/, '').trim())
    .filter(Boolean)
  return lines.map((title) => ({ title, body: '' }))
}

function testimonialItems(section) {
  const body = sectionBody(section)
  if (!body) return []
  return [{ quote: body, authorName: '', authorRole: '', company: '' }]
}

/**
 * Map a validated generation draft onto the normal ProposalForge create payload.
 * Does not insert a record.
 *
 * @param {{ draft: object, context: object, generation?: object }} input
 */
export function proposalFromGeneratedDraft({ draft, context, generation } = {}) {
  const inputs = context?.proposalInputs ?? {}
  const ledger = context?.facts
  const clientName = draft?.metadata?.clientName || inputs.clientName || 'New client'
  const projectType = draft?.metadata?.proposalType || inputs.proposalType || 'Consulting'
  const title = String(draft?.title ?? '').trim() || `${projectType} proposal for ${clientName}`
  const summary = sectionBody(findSection(draft, GENERATOR_SECTION.EXECUTIVE_SUMMARY))
  const pricingText = factValue(ledger, 'pricing') || sectionBody(findSection(draft, GENERATOR_SECTION.PRICING))
  const amount = parseAmount(factValue(ledger, 'pricing'))
  const termsParts = [
    sectionBody(findSection(draft, GENERATOR_SECTION.TERMS)),
    sectionBody(findSection(draft, GENERATOR_SECTION.WARRANTY)),
    sectionBody(findSection(draft, GENERATOR_SECTION.EXCLUSIONS)),
  ].filter(Boolean)

  const richTypes = [
    GENERATOR_SECTION.CLIENT_OBJECTIVES,
    GENERATOR_SECTION.SCOPE,
    GENERATOR_SECTION.APPROACH,
    GENERATOR_SECTION.ASSUMPTIONS,
    GENERATOR_SECTION.EXCLUSIONS,
    GENERATOR_SECTION.WARRANTY,
    GENERATOR_SECTION.ABOUT_COMPANY,
    GENERATOR_SECTION.CASE_STUDIES,
    GENERATOR_SECTION.NEXT_STEPS,
    GENERATOR_SECTION.SPECIFICATIONS,
  ]

  const sections = (draft?.sections ?? [])
    .filter((section) => richTypes.includes(section.type))
    .map((section) =>
      makeSection({
        heading: section.title,
        body: sectionBody(section),
      }),
    )
    .filter((section) => section.body)

  const items =
    amount > 0
      ? [makeLineItem({ description: `${projectType} fee`, amount })]
      : []

  const metadata = sanitizeGenerationMetadata({
    ...generation,
    proposalType: projectType,
    knowledgeIdsUsed: context?.knowledgeIds ?? [],
  })

  const payload = {
    title,
    clientName,
    company: inputs.companyName || clientName,
    projectType,
    summary,
    sections,
    items,
    amount,
    currency: DEFAULT_CURRENCY,
    terms: termsParts.join('\n\n'),
    notes: inputs.notes || '',
    tags: [inputs.industry, 'generated'].filter(Boolean),
    generation: metadata,
    activity: [
      {
        type: 'proposal.generated',
        metadata: makeProposalGeneratedEvent({
          companyId: context?.companyId,
          knowledgeIds: context?.knowledgeIds ?? [],
          warnings: metadata?.warnings ?? [],
          generation: metadata,
        }),
      },
    ],
  }

  let blocks = hydrateBlocksFromProposal(payload)
  const cover = findSection(draft, GENERATOR_SECTION.COVER)
  blocks = setBlock(blocks, BLOCK_TYPE.COVER, {
    kicker: inputs.industry || projectType,
    heading: title,
    subheading: sectionBody(cover) || `${clientName} · ${projectType}`,
  })

  const deliverables = findSection(draft, GENERATOR_SECTION.DELIVERABLES)
  const deliverableList = deliverableItems(deliverables, factValue(ledger, 'deliverables'))
  if (deliverableList.length > 0) {
    blocks = setBlock(blocks, BLOCK_TYPE.DELIVERABLES, { items: deliverableList }, { enabled: true })
  }

  const timeline = findSection(draft, GENERATOR_SECTION.TIMELINE)
  if (timeline) {
    blocks = setBlock(blocks, BLOCK_TYPE.TIMELINE, { items: timelineItems(timeline) }, { enabled: true })
  }

  if (amount <= 0) {
    blocks = setBlock(
      blocks,
      BLOCK_TYPE.PRICING,
      { notes: pricingText || UNRESOLVED_FACT, items: [] },
      { enabled: true },
    )
  }

  const testimonials = findSection(draft, GENERATOR_SECTION.TESTIMONIALS)
  const quotes = testimonialItems(testimonials)
  if (quotes.length > 0) {
    blocks = setBlock(blocks, BLOCK_TYPE.TESTIMONIALS, { items: quotes }, { enabled: true })
  }

  return { ...payload, blocks }
}
