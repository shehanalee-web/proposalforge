import { BLOCK_TYPE } from '../blocks/ids.js'
import { listEnabledBlocks } from '../blocks/instance.js'
import { isBlockDataEmpty } from '../blocks/schemas.js'
import { COMMERCIAL_MODULE } from '../models/commercial.js'
import { flattenCommercialItems } from '../utils/commercialTotals.js'
import { PRICING_PLACEMENT } from './ids.js'

const SENTENCE_RE = /[.!?]+(?:\s|$)/

function textOf(...values) {
  return values
    .flat(2)
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => value.trim())
    .join(' ')
}

function wordsIn(text) {
  const trimmed = String(text ?? '').trim()
  if (!trimmed) return []
  return trimmed.split(/\s+/).filter(Boolean)
}

/**
 * @param {object} [block]
 */
export function blockPlainText(block = {}) {
  const data = block.data ?? {}
  const items = data.items ?? []
  const members = data.members ?? []
  const rows = data.rows ?? []

  return textOf(
    data.kicker,
    data.heading,
    data.subheading,
    data.body,
    data.notes,
    items.map((item) =>
      textOf(
        item.title,
        item.date,
        item.body,
        item.description,
        item.quote,
        item.authorName,
        item.question,
        item.answer,
        item.caption,
      ),
    ),
    members.map((member) => textOf(member.name, member.role, member.bio)),
    rows.map((row) => textOf(row.label, row.value)),
  )
}

/**
 * Enabled blocks the client will actually see.
 *
 * @param {object} [input]
 * @param {object[]} [input.blocks]
 * @param {object} [input.proposal]
 */
export function resolveBlocks(input = {}) {
  const proposal = input.proposal && typeof input.proposal === 'object' ? input.proposal : {}
  const blocks = Array.isArray(input.blocks) ? input.blocks : (proposal.blocks ?? [])
  return listEnabledBlocks(blocks)
}

/**
 * @param {object[]} [blocks]
 * @param {string} type
 */
export function findBlock(blocks, type) {
  return (blocks ?? []).find((block) => block.type === type) ?? null
}

/**
 * @param {object[]} [blocks]
 * @param {string} type
 */
export function hasFilledBlock(blocks, type) {
  const block = findBlock(blocks, type)
  if (!block) return false
  if (type === BLOCK_TYPE.SIGNATURE) return true
  return !isBlockDataEmpty(type, block.data)
}

/**
 * @param {object[]} [blocks]
 */
export function collectDocumentText(blocks = []) {
  return (blocks ?? []).map(blockPlainText).filter(Boolean).join('\n')
}

/**
 * Cheap reading heuristic. Not a readability library and not ML — average
 * sentence length is scored against a 12–22 word band that reads as a
 * confident sales document.
 *
 * @param {string} [text]
 * @returns {number}
 */
export function readingScoreFromText(text) {
  const words = wordsIn(text)
  if (words.length < 12) return 0

  const sentences = String(text)
    .split(SENTENCE_RE)
    .map((part) => part.trim())
    .filter(Boolean)
  const sentenceCount = Math.max(sentences.length, 1)
  const average = words.length / sentenceCount

  if (average >= 12 && average <= 22) return 100
  if (average < 12) return Math.max(40, Math.round(100 - (12 - average) * 8))
  return Math.max(35, Math.round(100 - (average - 22) * 4))
}

export function wordCount(text) {
  return wordsIn(text).length
}

/**
 * @param {object[]} [blocks]
 * @param {string} type
 */
export function blockPlacement(blocks, type) {
  const list = blocks ?? []
  const index = list.findIndex((block) => block.type === type)
  if (index < 0) return PRICING_PLACEMENT.MISSING
  if (list.length <= 1) return PRICING_PLACEMENT.MIDDLE

  const ratio = index / (list.length - 1)
  if (ratio <= 0.33) return PRICING_PLACEMENT.EARLY
  if (ratio >= 0.66) return PRICING_PLACEMENT.LATE
  return PRICING_PLACEMENT.MIDDLE
}

/**
 * @param {object | null} [pricingBlock]
 * @param {object} [proposal]
 */
export function pricingFacts(pricingBlock, proposal = {}) {
  const modules = pricingBlock?.data?.modules ?? []
  const items = flattenCommercialItems(modules)
  const amountFromItems = items.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0,
  )

  return {
    amount: amountFromItems || Number(proposal.amount ?? 0) || 0,
    currency: proposal.currency,
    lineCount: items.filter(
      (item) => String(item.description ?? '').trim() || Number(item.amount) > 0,
    ).length,
    hasMilestones: modules.some(
      (module) =>
        module.type === COMMERCIAL_MODULE.MILESTONES &&
        (module.items ?? []).some(
          (item) => String(item.title ?? '').trim() || Number(item.amount) > 0,
        ),
    ),
    hasRecurring: modules.some(
      (module) =>
        module.type === COMMERCIAL_MODULE.RECURRING &&
        (module.items ?? []).some(
          (item) => String(item.description ?? '').trim() || Number(item.amount) > 0,
        ),
    ),
  }
}
