import { PROPOSAL_TYPES } from '../models/proposalType.js'
import { PRICING_MODEL } from '../models/service.js'

/**
 * Seed Service Library from the current Create Proposal types.
 *
 * These are company offerings, not a hardcoded proposal schema. New industries
 * are added here (or in the Services UI), not as new proposal engines.
 *
 * @type {Partial<import('../models/service.js').Service>[]}
 */
export const MOCK_SERVICES = PROPOSAL_TYPES.map((type, index) => ({
  id: type.id,
  name: type.label,
  description: type.description,
  defaultDescription: type.description,
  pricingModel: PRICING_MODEL.FIXED,
  deliverables: [],
  typicalDuration: '',
  assetIds: [],
  contentBlockIds: [],
  templateId: type.templateId,
  icon: type.icon,
  accent: type.accent,
  createdAt: `2026-06-${String(10 + index).padStart(2, '0')}T09:00:00.000Z`,
  updatedAt: `2026-08-${String(10 + index).padStart(2, '0')}T09:00:00.000Z`,
}))
