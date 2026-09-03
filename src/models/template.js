import { DEFAULT_CURRENCY, makeLineItem, makeSection } from './proposal.js'
import { DEFAULT_LAYOUT_ID } from '../layouts/ids.js'
import { resolveLayoutId } from '../layouts/registry.js'

/**
 * Proposal template model.
 *
 * Templates are stored separately from proposals. A proposal created from a
 * template is a deep copy — later edits to that proposal never write back here.
 */

/**
 * @typedef {object} ProposalTemplate
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {import('./proposal.js').ProposalSection[]} sections
 * @property {import('./proposal.js').ProposalLineItem[]} items
 * @property {number} amount                  Sum of line items (pricing total).
 * @property {string} currency
 * @property {string} terms
 * @property {string} notes
 * @property {string} defaultLayoutId         Layout applied to new proposals from this template.
 * @property {string} proposalType            Catalog id from proposal types, if any.
 * @property {boolean} isDefault              Preferred template for its proposal type.
 * @property {string} createdAt
 * @property {string} updatedAt
 */

function createId(prefix) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

/**
 * @param {import('./proposal.js').ProposalLineItem[]} items
 * @returns {number}
 */
export function sumItemAmounts(items) {
  return (items ?? []).reduce((total, item) => {
    const amount = Number(item.amount ?? 0)
    return total + (Number.isFinite(amount) ? amount : 0)
  }, 0)
}

/**
 * @param {Partial<ProposalTemplate>} [input]
 * @returns {ProposalTemplate}
 */
export function makeTemplate(input = {}) {
  const timestamp = new Date().toISOString()
  const items = (input.items ?? []).map(makeLineItem)

  return {
    id: input.id ?? createId('tpl'),
    title: input.title ?? '',
    description: input.description ?? '',
    sections: (input.sections ?? []).map(makeSection),
    items,
    amount: sumItemAmounts(items),
    currency: DEFAULT_CURRENCY,
    terms: input.terms ?? '',
    notes: input.notes ?? '',
    defaultLayoutId: resolveLayoutId(input.defaultLayoutId ?? DEFAULT_LAYOUT_ID),
    proposalType: input.proposalType ?? '',
    isDefault: Boolean(input.isDefault),
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp,
  }
}

/**
 * @param {Partial<ProposalTemplate>} template
 * @returns {{ field: string, message: string }[]}
 */
export function validateTemplate(template) {
  const errors = []

  if (!template.title || !template.title.trim()) {
    errors.push({ field: 'title', message: 'Title is required.' })
  }

  const items = template.items ?? []

  items.forEach((item, index) => {
    if (!Number.isFinite(item.amount) || item.amount < 0) {
      errors.push({
        field: `items.${index}.amount`,
        message: 'Line item amounts must be zero or greater.',
      })
    }
  })

  return errors
}
