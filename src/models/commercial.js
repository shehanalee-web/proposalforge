import { createRecordId } from './ids.js'
import { TAX_MODE, TAX_MODES } from './brandKit.js'

/**
 * Commercial Builder — modular pricing stored on the Pricing / Commercials
 * block. Legacy `items` remain a flattened snapshot for search and totals.
 */

export const COMMERCIAL_MODULE = Object.freeze({
  TABLE: 'table',
  ADDONS: 'addons',
  MILESTONES: 'milestones',
  RECURRING: 'recurring',
  DISCOUNT: 'discount',
  TAX: 'tax',
})

export const COMMERCIAL_MODULES = Object.freeze(Object.values(COMMERCIAL_MODULE))

export const COMMERCIAL_MODULE_LABELS = Object.freeze({
  [COMMERCIAL_MODULE.TABLE]: 'Standard pricing',
  [COMMERCIAL_MODULE.ADDONS]: 'Optional add-ons',
  [COMMERCIAL_MODULE.MILESTONES]: 'Milestone payments',
  [COMMERCIAL_MODULE.RECURRING]: 'Recurring services',
  [COMMERCIAL_MODULE.DISCOUNT]: 'Discount',
  [COMMERCIAL_MODULE.TAX]: 'VAT / Tax',
})

export const DISCOUNT_KIND = Object.freeze({
  PERCENT: 'percent',
  FIXED: 'fixed',
})

export const DISCOUNT_KINDS = Object.freeze(Object.values(DISCOUNT_KIND))

export const RECURRING_INTERVAL = Object.freeze({
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  YEARLY: 'yearly',
})

export const RECURRING_INTERVALS = Object.freeze(Object.values(RECURRING_INTERVAL))

export const RECURRING_INTERVAL_LABELS = Object.freeze({
  [RECURRING_INTERVAL.WEEKLY]: 'week',
  [RECURRING_INTERVAL.MONTHLY]: 'month',
  [RECURRING_INTERVAL.QUARTERLY]: 'quarter',
  [RECURRING_INTERVAL.YEARLY]: 'year',
})

const DEFAULT_TITLES = {
  [COMMERCIAL_MODULE.TABLE]: 'Investment',
  [COMMERCIAL_MODULE.ADDONS]: 'Optional add-ons',
  [COMMERCIAL_MODULE.MILESTONES]: 'Payment schedule',
  [COMMERCIAL_MODULE.RECURRING]: 'Recurring services',
  [COMMERCIAL_MODULE.DISCOUNT]: 'Discount',
  [COMMERCIAL_MODULE.TAX]: 'VAT',
}

/**
 * @param {unknown[]} list
 * @param {(item: object) => object} makeItem
 */
function mapItems(list, makeItem) {
  return Array.isArray(list) ? list.map(makeItem) : []
}

/**
 * New modules start with one blank line so the table is ready to type.
 * Existing modules keep an empty list — deleting the last row must not
 * spawn a ghost replacement.
 */
function linesOrSeed(input, makeItem, seed) {
  const items = mapItems(input.items, makeItem)
  if (items.length > 0) return items
  return input.id ? items : [seed()]
}

/**
 * @param {Partial<{ id: string, description: string, quantity: number|string, unit: string, unitPrice: number|string, amount: number|string }>} [input]
 */
export function makeCommercialLine(input = {}) {
  const unitPrice = Number(input.unitPrice ?? input.amount ?? 0)

  return {
    id: input.id ?? createRecordId('cline'),
    description: input.description ?? '',
    quantity: Number.isFinite(Number(input.quantity)) ? Number(input.quantity) : 1,
    unit: input.unit ?? '',
    unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
  }
}

/**
 * @param {Partial<ReturnType<typeof makeCommercialLine> & { included?: boolean }>} [input]
 */
export function makeAddonLine(input = {}) {
  return {
    ...makeCommercialLine(input),
    included: Boolean(input.included),
  }
}

/**
 * @param {Partial<{ id: string, title: string, percent: number|string, amount: number|string, due: string, amountExplicit?: boolean }>} [input]
 */
export function makeMilestoneLine(input = {}) {
  return {
    id: input.id ?? createRecordId('mile'),
    title: input.title ?? '',
    percent: Number(input.percent ?? 0) || 0,
    amount: Number(input.amount ?? 0) || 0,
    due: input.due ?? '',
    amountExplicit: Boolean(input.amountExplicit),
  }
}

/**
 * @param {Partial<{ id: string, description: string, amount: number|string, interval: string }>} [input]
 */
export function makeRecurringLine(input = {}) {
  const interval = RECURRING_INTERVALS.includes(input.interval)
    ? input.interval
    : RECURRING_INTERVAL.MONTHLY

  return {
    id: input.id ?? createRecordId('recur'),
    description: input.description ?? '',
    amount: Number(input.amount ?? 0) || 0,
    interval,
  }
}

/**
 * @param {Partial<object>} [input]
 */
export function makeCommercialModule(input = {}) {
  const type = COMMERCIAL_MODULES.includes(input.type)
    ? input.type
    : COMMERCIAL_MODULE.TABLE
  const title = input.title ?? DEFAULT_TITLES[type] ?? 'Pricing'

  if (type === COMMERCIAL_MODULE.TABLE) {
    return {
      id: input.id ?? createRecordId('cmod'),
      type,
      title,
      items: linesOrSeed(input, makeCommercialLine, () => makeCommercialLine()),
    }
  }

  if (type === COMMERCIAL_MODULE.ADDONS) {
    return {
      id: input.id ?? createRecordId('cmod'),
      type,
      title,
      items: linesOrSeed(input, makeAddonLine, () => makeAddonLine()),
    }
  }

  if (type === COMMERCIAL_MODULE.MILESTONES) {
    return {
      id: input.id ?? createRecordId('cmod'),
      type,
      title,
      items: linesOrSeed(input, makeMilestoneLine, () =>
        makeMilestoneLine({ percent: 50 }),
      ),
    }
  }

  if (type === COMMERCIAL_MODULE.RECURRING) {
    return {
      id: input.id ?? createRecordId('cmod'),
      type,
      title,
      items: linesOrSeed(input, makeRecurringLine, () => makeRecurringLine()),
    }
  }

  if (type === COMMERCIAL_MODULE.DISCOUNT) {
    const kind = DISCOUNT_KINDS.includes(input.kind)
      ? input.kind
      : DISCOUNT_KIND.PERCENT

    return {
      id: input.id ?? createRecordId('cmod'),
      type,
      title,
      kind,
      value: Number(input.value ?? 0) || 0,
    }
  }

  const mode = TAX_MODES.includes(input.mode) ? input.mode : TAX_MODE.EXCLUSIVE

  return {
    id: input.id ?? createRecordId('cmod'),
    type,
    title,
    label: input.label ?? 'VAT',
    rate: Number(input.rate ?? 0) || 0,
    mode,
  }
}

/**
 * Turn legacy proposal line items into a single standard pricing table.
 *
 * @param {object[]} [items]
 */
export function modulesFromLegacyItems(items = []) {
  const lines = (items ?? [])
    .filter((item) => item && (item.description || Number(item.amount) > 0))
    .map((item) => makeCommercialLine(item))

  return [
    makeCommercialModule({
      type: COMMERCIAL_MODULE.TABLE,
      title: DEFAULT_TITLES[COMMERCIAL_MODULE.TABLE],
      items: lines,
    }),
  ]
}

/**
 * Flatten commercial modules into legacy pricing items (one-time lines).
 *
 * @param {object[]} modules
 */
export function flattenCommercialItems(modules = []) {
  const items = []

  for (const module of modules) {
    if (module.type === COMMERCIAL_MODULE.TABLE) {
      for (const item of module.items ?? []) {
        items.push({
          id: item.id,
          description: item.description ?? '',
          amount: lineAmount(item),
        })
      }
    }

    if (module.type === COMMERCIAL_MODULE.ADDONS) {
      for (const item of module.items ?? []) {
        if (!item.included) continue
        items.push({
          id: item.id,
          description: item.description ?? '',
          amount: lineAmount(item),
        })
      }
    }
  }

  return items
}

export function lineAmount(item) {
  const quantity = Number(item.quantity)
  const unitPrice = Number(item.unitPrice ?? item.amount)
  const qty = Number.isFinite(quantity) ? quantity : 1
  const price = Number.isFinite(unitPrice) ? unitPrice : 0
  return roundMoney(qty * price)
}

export function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100
}

export function reorderList(list, fromIndex, toIndex) {
  if (fromIndex === toIndex) return list
  if (fromIndex < 0 || toIndex < 0) return list
  if (fromIndex >= list.length || toIndex >= list.length) return list

  const next = [...list]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}

export function reorderListById(list, fromId, toId) {
  if (fromId === toId) return list
  const from = list.findIndex((item) => item.id === fromId)
  const to = list.findIndex((item) => item.id === toId)
  return reorderList(list, from, to)
}

export function createCommercialModule(type, extras = {}) {
  return makeCommercialModule({ type, ...extras })
}
