import { makeTemplate, validateTemplate } from '../models/template.js'
import { NotFoundError, ValidationError } from './errors.js'
import * as store from './templateStore.js'

/**
 * Public data access layer for proposal templates.
 *
 * Async and returning plain data so a future templates API is a change inside
 * this file only.
 */

const MOCK_LATENCY_MS = 200

function delay(ms = MOCK_LATENCY_MS) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function compareUpdatedDesc(a, b) {
  return String(b.updatedAt).localeCompare(String(a.updatedAt))
}

/**
 * @returns {Promise<import('../models/template.js').ProposalTemplate[]>}
 */
export async function fetchTemplates() {
  await delay()

  return store.all().sort(compareUpdatedDesc)
}

/**
 * @param {string} id
 * @returns {Promise<import('../models/template.js').ProposalTemplate>}
 * @throws {NotFoundError}
 */
export async function fetchTemplateById(id) {
  await delay()

  const template = store.findById(id)

  if (!template) {
    throw new NotFoundError(`No template found with id "${id}".`)
  }

  return template
}

/**
 * @param {Partial<import('../models/template.js').ProposalTemplate>} input
 * @returns {Promise<import('../models/template.js').ProposalTemplate>}
 * @throws {ValidationError}
 */
export async function createTemplate(input) {
  const template = makeTemplate(input)
  const errors = validateTemplate(template)

  if (errors.length > 0) {
    throw new ValidationError('Template is not valid.', errors)
  }

  await delay()

  return store.insert(template)
}

/**
 * @param {string} id
 * @param {Partial<import('../models/template.js').ProposalTemplate>} changes
 * @returns {Promise<import('../models/template.js').ProposalTemplate>}
 * @throws {NotFoundError|ValidationError}
 */
export async function updateTemplate(id, changes = {}) {
  const existing = store.findById(id)

  if (!existing) {
    throw new NotFoundError(`No template found with id "${id}".`)
  }

  const updated = makeTemplate({
    ...existing,
    ...changes,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  })

  const errors = validateTemplate(updated)

  if (errors.length > 0) {
    throw new ValidationError('Template is not valid.', errors)
  }

  await delay()

  return store.replace(id, updated)
}

/**
 * @param {string} id
 * @returns {Promise<{ id: string }>}
 * @throws {NotFoundError}
 */
export async function deleteTemplate(id) {
  await delay()

  const deleted = store.remove(id)

  if (!deleted) {
    throw new NotFoundError(`No template found with id "${id}".`)
  }

  return { id }
}

/**
 * Mark a template as the workspace default. Clears `isDefault` on every other
 * template so only one default exists.
 *
 * @param {string} id
 * @returns {Promise<import('../models/template.js').ProposalTemplate>}
 * @throws {NotFoundError}
 */
export async function setDefaultTemplate(id) {
  const existing = store.findById(id)

  if (!existing) {
    throw new NotFoundError(`No template found with id "${id}".`)
  }

  await delay()

  const now = new Date().toISOString()

  for (const record of store.all()) {
    const isDefault = record.id === id

    if (record.isDefault === isDefault) continue

    store.replace(
      record.id,
      makeTemplate({
        ...record,
        isDefault,
        id: record.id,
        createdAt: record.createdAt,
        updatedAt: isDefault ? now : record.updatedAt,
      }),
    )
  }

  return store.findById(id)
}

export function resetTemplates() {
  store.reset()
}
