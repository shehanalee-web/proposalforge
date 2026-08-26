import { DEFAULT_CURRENCY, PROJECT_TYPES } from './proposal.js'

/**
 * Studio settings model.
 *
 * Kept separate from the proposal model so profile data can grow (branding,
 * defaults, later API keys) without mixing it into proposal records.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * @typedef {object} Settings
 * @property {string} studioName
 * @property {string} contactEmail
 * @property {string} defaultProjectType  One of PROJECT_TYPES.
 * @property {string} currency            ISO 4217 code. Always USD for now.
 * @property {string} about
 * @property {string} updatedAt           ISO timestamp.
 */

/**
 * @param {Partial<Settings>} [input]
 * @returns {Settings}
 */
export function makeSettings(input = {}) {
  return {
    studioName: input.studioName ?? '',
    contactEmail: input.contactEmail ?? '',
    defaultProjectType: input.defaultProjectType ?? PROJECT_TYPES[0],
    currency: DEFAULT_CURRENCY,
    about: input.about ?? '',
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  }
}

/**
 * @param {Partial<Settings>} settings
 * @returns {{ field: string, message: string }[]}
 */
export function validateSettings(settings) {
  const errors = []

  if (!settings.studioName || !settings.studioName.trim()) {
    errors.push({ field: 'studioName', message: 'Studio name is required.' })
  }

  if (settings.contactEmail && !EMAIL_PATTERN.test(settings.contactEmail)) {
    errors.push({
      field: 'contactEmail',
      message: 'Contact email is not valid.',
    })
  }

  if (!PROJECT_TYPES.includes(settings.defaultProjectType)) {
    errors.push({
      field: 'defaultProjectType',
      message: `Project type must be one of: ${PROJECT_TYPES.join(', ')}.`,
    })
  }

  return errors
}
