import { createRecordId } from './ids.js'

/**
 * Service Library model.
 *
 * Company-defined offerings. Replaces hardcoded project types on proposals
 * in a later phase. Proposals will reference service ids; they will not
 * embed a parallel industry-specific schema.
 */

export const PRICING_MODEL = Object.freeze({
  FIXED: 'fixed',
  UNIT: 'unit',
  HOURLY: 'hourly',
  MILESTONE: 'milestone',
  RETAINER: 'retainer',
  CUSTOM: 'custom',
})

export const PRICING_MODELS = Object.freeze(Object.values(PRICING_MODEL))

export const PRICING_MODEL_LABELS = Object.freeze({
  [PRICING_MODEL.FIXED]: 'Fixed fee',
  [PRICING_MODEL.UNIT]: 'Unit',
  [PRICING_MODEL.HOURLY]: 'Hourly',
  [PRICING_MODEL.MILESTONE]: 'Milestone',
  [PRICING_MODEL.RETAINER]: 'Retainer',
  [PRICING_MODEL.CUSTOM]: 'Custom',
})

/**
 * @typedef {object} Service
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} defaultDescription
 * @property {string} pricingModel
 * @property {string[]} deliverables
 * @property {string} typicalDuration
 * @property {string[]} assetIds
 * @property {string[]} contentBlockIds
 * @property {string} templateId
 * @property {string} icon
 * @property {string} accent
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @param {Partial<Service>} [input]
 * @returns {Service}
 */
export function makeService(input = {}) {
  const timestamp = new Date().toISOString()

  return {
    id: input.id ?? createRecordId('svc'),
    name: input.name ?? '',
    description: input.description ?? '',
    defaultDescription: input.defaultDescription ?? '',
    pricingModel: input.pricingModel ?? PRICING_MODEL.FIXED,
    deliverables: [...(input.deliverables ?? [])],
    typicalDuration: input.typicalDuration ?? '',
    assetIds: [...(input.assetIds ?? [])],
    contentBlockIds: [...(input.contentBlockIds ?? [])],
    templateId: input.templateId ?? '',
    icon: input.icon ?? 'services',
    accent: input.accent ?? '',
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp,
  }
}

/**
 * @param {Partial<Service>} service
 * @returns {{ field: string, message: string }[]}
 */
export function validateService(service) {
  const errors = []

  if (!service.name || !service.name.trim()) {
    errors.push({ field: 'name', message: 'Name is required.' })
  }

  if (service.pricingModel && !PRICING_MODELS.includes(service.pricingModel)) {
    errors.push({
      field: 'pricingModel',
      message: `Pricing model must be one of: ${PRICING_MODELS.join(', ')}.`,
    })
  }

  return errors
}

/**
 * Resolve the template copied when a proposal is created from this service.
 *
 * @param {import('./template.js').ProposalTemplate[]} templates
 * @param {Service} service
 */
export function findTemplateForService(templates, service) {
  if (!service) return undefined

  if (service.templateId) {
    const named = templates.find((template) => template.id === service.templateId)
    if (named) return named
  }

  return templates.find((template) => template.proposalType === service.id)
}
