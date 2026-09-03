import { MOCK_SETTINGS } from './mockSettings.js'
import { TAX_MODE } from '../models/brandKit.js'

/**
 * Seed Company Identity for development.
 *
 * Hard-coded so Brand Kit is populated on every reload. Replaced when a real
 * account API exists. Not persisted — reload restores this seed.
 *
 * @type {Partial<import('../models/brandKit.js').BrandKit>}
 */
export const MOCK_BRAND_KIT = {
  id: 'brand-workspace',
  companyName: MOCK_SETTINGS.studioName,
  description: MOCK_SETTINGS.about,
  colors: {
    primary: '#14b8a6',
    secondary: '#0f766e',
    accent: '#14b8a6',
  },
  typography: {
    fontFamily: 'inter',
  },
  contact: {
    legalName: MOCK_SETTINGS.studioName,
    email: MOCK_SETTINGS.contactEmail,
    phone: '',
    website: 'proposalforge.studio',
    address: '',
  },
  terms:
    'Work begins on receipt of a deposit. Remaining balance is due on delivery of final files. This proposal remains valid until the date shown unless a different period is agreed in writing.',
  paymentTerms:
    'A 40% deposit is due on acceptance, with the balance invoiced on delivery. Invoices are payable within 14 days. Late amounts may pause remaining work.',
  tax: {
    registered: false,
    taxId: '',
    rate: '',
    mode: TAX_MODE.EXCLUSIVE,
  },
  updatedAt: MOCK_SETTINGS.updatedAt,
}
