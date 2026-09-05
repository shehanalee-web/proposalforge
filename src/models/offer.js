import { createRecordId } from './ids.js'
import {
  COMMERCIAL_MODULE,
  lineAmount,
  reorderListById,
  roundMoney,
} from './commercial.js'

/**
 * Authored offer groups for Living Proposal Phase 2.
 *
 * Universal commercial structures (packages, optional add-ons, alternatives)
 * stored on the Pricing block. Not industry SKUs. Not client selections.
 */

export const OFFER_KIND = Object.freeze({
  PACKAGE: 'package',
  ADDON: 'addon',
  ALTERNATIVE: 'alternative',
})

export const OFFER_KINDS = Object.freeze(Object.values(OFFER_KIND))

export const OFFER_KIND_LABELS = Object.freeze({
  [OFFER_KIND.PACKAGE]: 'Offer option',
  [OFFER_KIND.ADDON]: 'Optional add-on',
  [OFFER_KIND.ALTERNATIVE]: 'Alternative',
})

export const OFFER_GROUP_KEYS = Object.freeze({
  [OFFER_KIND.PACKAGE]: 'packages',
  [OFFER_KIND.ADDON]: 'addons',
  [OFFER_KIND.ALTERNATIVE]: 'alternatives',
})

const ID_PREFIX = Object.freeze({
  [OFFER_KIND.PACKAGE]: 'pkg',
  [OFFER_KIND.ADDON]: 'oadd',
  [OFFER_KIND.ALTERNATIVE]: 'alt',
})

function asObject(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  return input
}

function asText(value) {
  if (typeof value === 'string') return value
  if (value == null) return ''
  return String(value)
}

function asAmount(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) return 0
  return roundMoney(amount)
}

function asIdList(value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const ids = []
  for (const entry of value) {
    const id = String(entry ?? '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

function asOptionalId(value) {
  if (value == null) return null
  const id = String(value).trim()
  return id || null
}

function asOrder(value, fallback) {
  const order = Number(value)
  return Number.isFinite(order) ? order : fallback
}

function asEnabled(value) {
  return value !== false
}

function sortOffers(list) {
  return [...list]
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    .map((item, index) => ({ ...item, order: index }))
}

function mapList(list, maker) {
  if (!Array.isArray(list)) return []
  return sortOffers(
    list
      .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
      .map((item, index) => maker(item, index)),
  )
}

/**
 * Named mutually exclusive offer option (Package A / B / C in product language).
 *
 * @param {object} [input]
 * @param {number} [index]
 */
export function makeOfferPackage(input = {}, index = 0) {
  const value = asObject(input)
  return {
    id:
      typeof value.id === 'string' && value.id.trim()
        ? value.id.trim()
        : createRecordId(ID_PREFIX[OFFER_KIND.PACKAGE]),
    kind: OFFER_KIND.PACKAGE,
    title: asText(value.title),
    description: asText(value.description),
    label: asText(value.label),
    itemIds: asIdList(value.itemIds),
    amount: asAmount(value.amount ?? value.price),
    order: asOrder(value.order, index),
    enabled: asEnabled(value.enabled),
  }
}

/**
 * Independently toggleable optional service. Selection is not stored in Phase 2.
 *
 * @param {object} [input]
 * @param {number} [index]
 */
export function makeOfferAddon(input = {}, index = 0) {
  const value = asObject(input)
  return {
    id:
      typeof value.id === 'string' && value.id.trim()
        ? value.id.trim()
        : createRecordId(ID_PREFIX[OFFER_KIND.ADDON]),
    kind: OFFER_KIND.ADDON,
    title: asText(value.title),
    description: asText(value.description),
    itemId: asOptionalId(value.itemId),
    amount: asAmount(value.amount ?? value.price),
    order: asOrder(value.order, index),
    enabled: asEnabled(value.enabled),
  }
}

/**
 * Mutually exclusive scoped option, using the existing Alternatives concept.
 *
 * @param {object} [input]
 * @param {number} [index]
 */
export function makeOfferAlternative(input = {}, index = 0) {
  const value = asObject(input)
  return {
    id:
      typeof value.id === 'string' && value.id.trim()
        ? value.id.trim()
        : createRecordId(ID_PREFIX[OFFER_KIND.ALTERNATIVE]),
    kind: OFFER_KIND.ALTERNATIVE,
    title: asText(value.title),
    description: asText(value.description),
    label: asText(value.label),
    itemIds: asIdList(value.itemIds),
    amount: asAmount(value.amount ?? value.price),
    order: asOrder(value.order, index),
    enabled: asEnabled(value.enabled),
  }
}

const MAKERS = Object.freeze({
  [OFFER_KIND.PACKAGE]: makeOfferPackage,
  [OFFER_KIND.ADDON]: makeOfferAddon,
  [OFFER_KIND.ALTERNATIVE]: makeOfferAlternative,
})

export function emptyOfferGroups() {
  return {
    packages: [],
    addons: [],
    alternatives: [],
  }
}

/**
 * Normalise authored offer groups. Unknown keys are dropped. Garbage input
 * becomes empty groups so existing proposals remain loadable.
 *
 * @param {unknown} [input]
 */
export function makeOfferGroups(input = {}) {
  const value = asObject(input)
  return {
    packages: mapList(value.packages, makeOfferPackage),
    addons: mapList(value.addons, makeOfferAddon),
    alternatives: mapList(value.alternatives, makeOfferAlternative),
  }
}

export function offerGroupKey(kind) {
  return OFFER_GROUP_KEYS[kind] ?? null
}

function makerForKind(kind) {
  return MAKERS[kind] ?? null
}

export function hasAuthoredOffers(groups) {
  const next = makeOfferGroups(groups)
  return (
    next.packages.length > 0 ||
    next.addons.length > 0 ||
    next.alternatives.length > 0
  )
}

export function listOffers(groups, kind) {
  const key = offerGroupKey(kind)
  if (!key) return []
  return makeOfferGroups(groups)[key]
}

export function listEnabledOffers(groups, kind) {
  return listOffers(groups, kind).filter((offer) => offer.enabled)
}

export function addOffer(groups, kind, input = {}) {
  const next = makeOfferGroups(groups)
  const key = offerGroupKey(kind)
  const maker = makerForKind(kind)
  if (!key || !maker) return next
  const created = maker({ ...asObject(input), order: next[key].length }, next[key].length)
  return { ...next, [key]: [...next[key], created] }
}

export function updateOffer(groups, kind, id, patch = {}) {
  const next = makeOfferGroups(groups)
  const key = offerGroupKey(kind)
  const maker = makerForKind(kind)
  const offerId = String(id ?? '').trim()
  if (!key || !maker || !offerId) return next
  return {
    ...next,
    [key]: next[key].map((item) =>
      item.id === offerId
        ? maker({ ...item, ...asObject(patch), id: item.id, kind: item.kind }, item.order)
        : item,
    ),
  }
}

export function removeOffer(groups, kind, id) {
  const next = makeOfferGroups(groups)
  const key = offerGroupKey(kind)
  const offerId = String(id ?? '').trim()
  if (!key || !offerId) return next
  return {
    ...next,
    [key]: sortOffers(next[key].filter((item) => item.id !== offerId)),
  }
}

export function setOfferEnabled(groups, kind, id, enabled) {
  return updateOffer(groups, kind, id, { enabled: Boolean(enabled) })
}

export function reorderOffers(groups, kind, fromId, toId) {
  const next = makeOfferGroups(groups)
  const key = offerGroupKey(kind)
  if (!key) return next
  const reordered = reorderListById(next[key], fromId, toId).map((item, index) => ({
    ...item,
    order: index,
  }))
  return { ...next, [key]: reordered }
}

/**
 * Commercial lines that an offer option may reference.
 *
 * @param {object[]} [modules]
 */
export function listOfferLineOptions(modules = []) {
  const options = []
  if (!Array.isArray(modules)) return options

  for (const module of modules) {
    if (
      module?.type !== COMMERCIAL_MODULE.TABLE &&
      module?.type !== COMMERCIAL_MODULE.ADDONS
    ) {
      continue
    }

    for (const item of module.items ?? []) {
      if (!item?.id) continue
      options.push({
        id: item.id,
        description: asText(item.description) || 'Untitled line',
        amount: lineAmount(item),
        moduleId: module.id,
        moduleType: module.type,
        moduleTitle: asText(module.title),
      })
    }
  }

  return options
}

function referencedIds(offer) {
  if (!offer) return []
  if (offer.kind === OFFER_KIND.ADDON) {
    return offer.itemId ? [offer.itemId] : []
  }
  return offer.itemIds ?? []
}

/**
 * Display amount for an authored offer. Explicit amount wins; otherwise sum
 * referenced commercial lines. Never writes back onto those lines.
 *
 * @param {object} offer
 * @param {object[]} [modules]
 */
export function resolveOfferAmount(offer, modules = []) {
  const explicit = asAmount(offer?.amount)
  if (explicit > 0) return explicit

  const lines = listOfferLineOptions(modules)
  const ids = new Set(referencedIds(offer))
  if (ids.size === 0) return explicit

  return roundMoney(
    lines.reduce((sum, line) => (ids.has(line.id) ? sum + line.amount : sum), 0),
  )
}

function presentOne(offer, modules) {
  return {
    id: offer.id,
    kind: offer.kind,
    title: offer.title,
    description: offer.description,
    label: offer.label ?? '',
    itemIds: offer.itemIds ? [...offer.itemIds] : undefined,
    itemId: offer.itemId ?? undefined,
    amount: resolveOfferAmount(offer, modules),
    order: offer.order,
    enabled: offer.enabled,
  }
}

/**
 * Client-safe authored offer projection. Copies values so later UI cannot
 * mutate proposal commercial lines through this object.
 *
 * @param {unknown} groups
 * @param {object[]} [modules]
 * @param {{ enabledOnly?: boolean }} [options]
 */
export function presentOfferGroups(groups, modules = [], options = {}) {
  const enabledOnly = options.enabledOnly !== false
  const next = makeOfferGroups(groups)
  const take = (list) =>
    (enabledOnly ? list.filter((offer) => offer.enabled) : list).map((offer) =>
      presentOne(offer, modules),
    )

  return {
    packages: take(next.packages),
    addons: take(next.addons),
    alternatives: take(next.alternatives),
  }
}

export function getBlockOfferGroups(data = {}) {
  return makeOfferGroups(data?.offers)
}
