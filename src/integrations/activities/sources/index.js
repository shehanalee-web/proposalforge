/**
 * H16.7 — TimelineSource registry.
 *
 * Every source is read-only by contract. Registration refuses any source that
 * does not declare `readOnly: true`, which makes the "no write path" guarantee
 * structural rather than a convention someone can forget.
 */

import { ValidationError } from '../../../services/errors.js'
import {
  TIMELINE_SOURCE_IDS,
  TIMELINE_SOURCE_PRIORITY,
  TIMELINE_UNSCOPED_SOURCE_IDS,
} from '../types.js'

const registry = new Map()

function invalid(message, field) {
  return new ValidationError(message, [{ field, message }])
}

/**
 * Validate a source against the TimelineSource contract.
 *
 * @param {object} source
 */
export function assertTimelineSourceContract(source) {
  if (!source || typeof source !== 'object') {
    throw invalid('TimelineSource must be an object.', 'source')
  }

  const id = String(source.id ?? '').trim()
  if (!TIMELINE_SOURCE_IDS.includes(id)) {
    throw invalid(`Unknown timeline source id: ${id || '(empty)'}.`, 'source.id')
  }

  if (typeof source.isEnabled !== 'function') {
    throw invalid('TimelineSource must implement isEnabled().', 'source.isEnabled')
  }

  if (typeof source.list !== 'function') {
    throw invalid('TimelineSource must implement list().', 'source.list')
  }

  if (typeof source.describe !== 'function') {
    throw invalid('TimelineSource must implement describe().', 'source.describe')
  }

  const descriptor = source.describe()
  if (!descriptor || typeof descriptor !== 'object') {
    throw invalid('TimelineSource.describe() must return a descriptor.', 'source.describe')
  }

  if (descriptor.readOnly !== true) {
    throw invalid(
      `Timeline source ${id} must declare readOnly: true. H16.7 has no write path.`,
      'source.describe.readOnly',
    )
  }

  if (descriptor.id !== id) {
    throw invalid('TimelineSource descriptor id must match source id.', 'source.describe.id')
  }

  return descriptor
}

/**
 * @param {object} source
 */
export function registerTimelineSource(source) {
  const descriptor = assertTimelineSourceContract(source)
  const id = descriptor.id

  if (registry.has(id)) {
    throw invalid(`Timeline source ${id} is already registered.`, 'source.id')
  }

  const priority = TIMELINE_SOURCE_PRIORITY[id]
  if (!Number.isInteger(priority)) {
    throw invalid(`Timeline source ${id} has no declared priority.`, 'source.priority')
  }

  for (const existing of registry.values()) {
    if (existing.priority === priority) {
      throw invalid(
        `Timeline source priority ${priority} is already used by ${existing.id}.`,
        'source.priority',
      )
    }
  }

  const entry = Object.freeze({
    id,
    priority,
    companyScoped: !TIMELINE_UNSCOPED_SOURCE_IDS.includes(id),
    storeRef: String(descriptor.storeRef ?? '').trim() || null,
    canonicalFor: Object.freeze([...(source.canonicalFor ?? [])].map(String)),
    source,
  })

  registry.set(id, entry)
  return entry
}

/**
 * @param {string} id
 */
export function unregisterTimelineSource(id) {
  return registry.delete(String(id ?? '').trim())
}

export function resetTimelineSources() {
  registry.clear()
}

/**
 * Registered sources ordered by descending priority.
 */
export function listRegisteredTimelineSources() {
  return [...registry.values()].sort((left, right) => right.priority - left.priority)
}

/**
 * @param {string} id
 */
export function getTimelineSource(id) {
  return registry.get(String(id ?? '').trim()) ?? null
}

/**
 * Diagnostic descriptors. Never exposes the source implementation itself.
 *
 * @param {object} [context]
 */
export function describeTimelineSources(context = {}) {
  return listRegisteredTimelineSources().map((entry) => {
    let enabled = false
    try {
      enabled = entry.source.isEnabled(context) === true
    } catch {
      enabled = false
    }
    return Object.freeze({
      id: entry.id,
      priority: entry.priority,
      companyScoped: entry.companyScoped,
      storeRef: entry.storeRef,
      canonicalFor: entry.canonicalFor,
      enabled,
      readOnly: true,
    })
  })
}
