import { BLOCK_TYPE } from './ids.js'
import { makeBlock } from './instance.js'
import {
  makeGalleryItem,
  makePricingData,
  makeRichTextData,
  makeExecutiveSummaryData,
  makeTermsData,
} from './schemas.js'
import { flattenCommercialItems } from '../models/commercial.js'
import { computeCommercials } from '../utils/commercialTotals.js'

/**
 * Default assembly for a new proposal. Every built-in type is present so
 * disabling never has to create a type from scratch. Extra rich-text and
 * custom blocks can be appended; order is the array order.
 */
export const DEFAULT_BLOCK_SEQUENCE = Object.freeze([
  { type: BLOCK_TYPE.COVER, enabled: true },
  { type: BLOCK_TYPE.EXECUTIVE_SUMMARY, enabled: true },
  { type: BLOCK_TYPE.RICH_TEXT, enabled: true },
  { type: BLOCK_TYPE.GALLERY, enabled: false },
  { type: BLOCK_TYPE.PRICING, enabled: true },
  { type: BLOCK_TYPE.TIMELINE, enabled: false },
  { type: BLOCK_TYPE.DELIVERABLES, enabled: false },
  { type: BLOCK_TYPE.SPECIFICATIONS, enabled: false },
  { type: BLOCK_TYPE.TEAM, enabled: true },
  { type: BLOCK_TYPE.TESTIMONIALS, enabled: true },
  { type: BLOCK_TYPE.FAQ, enabled: false },
  { type: BLOCK_TYPE.TERMS, enabled: true },
  { type: BLOCK_TYPE.SIGNATURE, enabled: true },
  { type: BLOCK_TYPE.ATTACHMENTS, enabled: false },
])

function galleryFromProposal(proposal) {
  const images = Array.isArray(proposal.images) ? proposal.images : []
  return images.map((image) => makeGalleryItem(image))
}

/**
 * Build a full block list from legacy proposal fields (summary, sections,
 * items, terms, images). Used when a record has no `blocks` yet.
 *
 * @param {Partial<import('../models/proposal.js').Proposal>} proposal
 */
export function hydrateBlocksFromProposal(proposal = {}) {
  const sections = proposal.sections ?? []
  const galleryItems = galleryFromProposal(proposal)
  const hasPricing = (proposal.items ?? []).length > 0 || Number(proposal.amount) > 0

  const blocks = []

  for (const step of DEFAULT_BLOCK_SEQUENCE) {
    if (step.type === BLOCK_TYPE.RICH_TEXT) {
      if (sections.length > 0) {
        sections.forEach((section) => {
          blocks.push(
            makeBlock({
              type: BLOCK_TYPE.RICH_TEXT,
              enabled: true,
              data: makeRichTextData({
                heading: section.heading,
                body: section.body,
              }),
            }),
          )
        })
      } else {
        blocks.push(makeBlock({ type: BLOCK_TYPE.RICH_TEXT, enabled: true }))
      }
      continue
    }

    let data = {}
    let enabled = step.enabled

    if (step.type === BLOCK_TYPE.EXECUTIVE_SUMMARY) {
      data = makeExecutiveSummaryData({ body: proposal.summary ?? '' })
      enabled = Boolean(proposal.summary?.trim()) || step.enabled
    }

    if (step.type === BLOCK_TYPE.PRICING) {
      data = makePricingData({ items: proposal.items ?? [] })
      enabled = hasPricing || step.enabled
    }

    if (step.type === BLOCK_TYPE.TERMS) {
      data = makeTermsData({ body: proposal.terms ?? '' })
      enabled = Boolean(proposal.terms?.trim()) || step.enabled
    }

    if (step.type === BLOCK_TYPE.GALLERY) {
      data = { items: galleryItems }
      enabled = galleryItems.length > 0
    }

    blocks.push(makeBlock({ type: step.type, enabled, data }))
  }

  return blocks
}

/**
 * Normalise a stored list, or hydrate from legacy fields when missing.
 *
 * @param {Partial<import('../models/proposal.js').Proposal>} proposal
 */
export function ensureProposalBlocks(proposal = {}) {
  if (Array.isArray(proposal.blocks) && proposal.blocks.length > 0) {
    return proposal.blocks.map((block) => makeBlock(block))
  }

  return hydrateBlocksFromProposal(proposal)
}

/**
 * Mirror block content back onto legacy proposal fields so search, pricing
 * totals and any remaining readers stay in sync.
 *
 * @param {import('./instance.js').BlockInstance[]} blocks
 * @param {Partial<import('../models/proposal.js').Proposal>} proposal
 */
export function syncLegacyFromBlocks(blocks, proposal = {}) {
  const list = blocks ?? []
  const summaryBlock = list.find((block) => block.type === BLOCK_TYPE.EXECUTIVE_SUMMARY)
  const termsBlock = list.find((block) => block.type === BLOCK_TYPE.TERMS)
  const pricingBlock = list.find((block) => block.type === BLOCK_TYPE.PRICING)
  const galleryBlock = list.find((block) => block.type === BLOCK_TYPE.GALLERY)
  const richText = list.filter((block) => block.type === BLOCK_TYPE.RICH_TEXT)

  const items = Array.isArray(pricingBlock?.data.modules)
    ? flattenCommercialItems(pricingBlock.data.modules)
    : pricingBlock?.data.items ?? proposal.items ?? []
  const commercialTotal = Array.isArray(pricingBlock?.data.modules)
    ? computeCommercials(pricingBlock.data.modules).grandTotal
    : items.reduce((total, item) => total + (Number(item.amount) || 0), 0)

  return {
    summary: summaryBlock?.data.body?.trim() || proposal.summary || '',
    terms: termsBlock?.data.body?.trim() || proposal.terms || '',
    sections: richText.map((block) => ({
      id: block.id,
      heading: block.data.heading ?? '',
      body: block.data.body ?? '',
    })),
    items,
    amount:
      Array.isArray(pricingBlock?.data.modules) || items.length > 0
        ? commercialTotal
        : Number(proposal.amount ?? 0),
    images: (galleryBlock?.data.items ?? []).map((item) => ({
      id: item.id,
      url: item.url,
      assetId: item.assetId,
      caption: item.caption,
    })),
  }
}
