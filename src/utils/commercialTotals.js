import {
  COMMERCIAL_MODULE,
  DISCOUNT_KIND,
  RECURRING_INTERVAL_LABELS,
  flattenCommercialItems,
  lineAmount,
  makeCommercialModule,
  modulesFromLegacyItems,
  roundMoney,
} from '../models/commercial.js'
import { TAX_MODE } from '../models/brandKit.js'
import { BLOCK_TYPE } from '../blocks/ids.js'

export { flattenCommercialItems }

/**
 * Format a commercial amount with currency, keeping cents when needed.
 *
 * @param {number} amount
 * @param {string} [currency]
 */
export function formatMoney(amount, currency = 'USD') {
  if (!Number.isFinite(amount)) return '—'

  const rounded = roundMoney(amount)
  const fraction = Math.abs(rounded % 1) > 0.0001 ? 2 : 0

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: fraction,
    maximumFractionDigits: 2,
  }).format(rounded)
}

/**
 * Live totals for a list of commercial modules.
 *
 * @param {object[]} [modules]
 */
export function computeCommercials(modules = []) {
  let subtotal = 0
  let includedAddons = 0
  let optionalAddons = 0
  const tableSections = []
  const addonSections = []
  const recurring = []
  const discountModules = []
  let taxModule = null

  for (const module of modules) {
    if (module.type === COMMERCIAL_MODULE.TABLE) {
      const lines = (module.items ?? []).map((item) => ({
        ...item,
        total: lineAmount(item),
      }))
      const total = roundMoney(lines.reduce((sum, line) => sum + line.total, 0))
      subtotal = roundMoney(subtotal + total)
      tableSections.push({
        id: module.id,
        title: module.title,
        lines,
        total,
      })
    }

    if (module.type === COMMERCIAL_MODULE.ADDONS) {
      const lines = (module.items ?? []).map((item) => ({
        ...item,
        total: lineAmount(item),
      }))
      const included = roundMoney(
        lines.filter((line) => line.included).reduce((sum, line) => sum + line.total, 0),
      )
      const optional = roundMoney(
        lines.filter((line) => !line.included).reduce((sum, line) => sum + line.total, 0),
      )
      includedAddons = roundMoney(includedAddons + included)
      optionalAddons = roundMoney(optionalAddons + optional)
      addonSections.push({
        id: module.id,
        title: module.title,
        lines,
        included,
        optional,
      })
    }

    if (module.type === COMMERCIAL_MODULE.RECURRING) {
      for (const item of module.items ?? []) {
        recurring.push({
          ...item,
          total: roundMoney(item.amount),
          intervalLabel: RECURRING_INTERVAL_LABELS[item.interval] ?? item.interval,
        })
      }
    }

    if (module.type === COMMERCIAL_MODULE.DISCOUNT) {
      discountModules.push(module)
    }

    if (module.type === COMMERCIAL_MODULE.TAX) {
      taxModule = module
    }
  }

  const preDiscount = roundMoney(subtotal + includedAddons)
  let remaining = preDiscount
  const discounts = []

  for (const module of discountModules) {
    const value = Number(module.value) || 0
    let amount =
      module.kind === DISCOUNT_KIND.PERCENT
        ? roundMoney(remaining * (value / 100))
        : roundMoney(value)
    amount = Math.min(amount, remaining)
    remaining = roundMoney(remaining - amount)
    discounts.push({
      id: module.id,
      title: module.title || 'Discount',
      kind: module.kind,
      value,
      amount,
    })
  }

  const discountTotal = roundMoney(preDiscount - remaining)
  const afterDiscount = remaining

  let taxAmount = 0
  let grandTotal = afterDiscount
  const taxLabel = taxModule?.label?.trim() || taxModule?.title || 'VAT'
  const taxMode = taxModule?.mode ?? TAX_MODE.NONE
  const taxRate = Number(taxModule?.rate) || 0

  if (taxModule && taxMode === TAX_MODE.EXCLUSIVE && taxRate > 0) {
    taxAmount = roundMoney(afterDiscount * (taxRate / 100))
    grandTotal = roundMoney(afterDiscount + taxAmount)
  } else if (taxModule && taxMode === TAX_MODE.INCLUSIVE && taxRate > 0) {
    taxAmount = roundMoney(afterDiscount - afterDiscount / (1 + taxRate / 100))
    grandTotal = afterDiscount
  }

  const milestones = []

  for (const module of modules) {
    if (module.type !== COMMERCIAL_MODULE.MILESTONES) continue

    for (const item of module.items ?? []) {
      const percent = Number(item.percent) || 0
      const amount = item.amountExplicit
        ? roundMoney(item.amount)
        : roundMoney(grandTotal * (percent / 100))
      milestones.push({
        ...item,
        percent: item.amountExplicit && grandTotal > 0
          ? roundMoney((amount / grandTotal) * 100)
          : percent,
        amount,
        moduleTitle: module.title,
      })
    }
  }

  const milestonePercent = roundMoney(
    milestones.reduce((sum, item) => sum + (Number(item.percent) || 0), 0),
  )

  const recurringByInterval = {}
  for (const item of recurring) {
    const key = item.interval || 'monthly'
    recurringByInterval[key] = roundMoney(
      (recurringByInterval[key] ?? 0) + item.total,
    )
  }

  return {
    subtotal,
    includedAddons,
    optionalAddons,
    preDiscount,
    discounts,
    discountTotal,
    afterDiscount,
    taxAmount,
    taxLabel,
    taxMode,
    taxRate,
    grandTotal,
    tableSections,
    addonSections,
    milestones,
    milestonePercent,
    recurring,
    recurringByInterval,
    hasContent:
      tableSections.some((section) =>
        section.lines.some((line) => line.description?.trim() || line.total > 0),
      ) ||
      addonSections.some((section) => section.lines.length > 0) ||
      recurring.length > 0 ||
      discounts.length > 0 ||
      Boolean(taxModule) ||
      milestones.length > 0,
  }
}

/**
 * Resolve commercial modules from a pricing block or legacy items.
 *
 * @param {object} [instance]
 * @param {object} [proposal]
 */
export function getCommercialModules(instance, proposal = {}) {
  const data = instance?.data ?? {}

  if (Array.isArray(data.modules)) {
    return data.modules.map((module) => makeCommercialModule(module))
  }

  const items = data.items ?? proposal.items ?? []
  return modulesFromLegacyItems(items)
}

/**
 * @param {object} proposal
 */
export function getProposalCommercials(proposal = {}) {
  const pricing = (proposal.blocks ?? []).find(
    (block) => block.type === BLOCK_TYPE.PRICING && block.enabled !== false,
  )
  const modules = getCommercialModules(pricing, proposal)
  return {
    modules,
    notes: pricing?.data?.notes ?? '',
    totals: computeCommercials(modules),
    items: flattenCommercialItems(modules),
  }
}
