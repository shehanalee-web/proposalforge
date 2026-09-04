import { BLOCK_VARIABLES } from '../models/contentBlock.js'

const TOKEN = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi

function formatMoney(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount === 0) return ''
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Resolve {{tokens}} from the live proposal, brand kit and theme.
 * Stored block copy keeps the token; renderers interpolate.
 */
export function buildVariableContext({
  proposal = {},
  brand = {},
  tokens = {},
  settings = {},
} = {}) {
  const metadata = tokens.metadata ?? {}
  return {
    client_name: proposal.clientName || '',
    company: proposal.company || brand.companyName || '',
    date: formatDate(metadata.issueDate || proposal.createdAt),
    proposal_number:
      metadata.number || (proposal.id ? `PF-${String(proposal.id).replace(/\D/g, '')}` : ''),
    project_value: formatMoney(proposal.amount),
    prepared_by: metadata.preparedBy || brand.companyName || settings.studioName || '',
    prepared_for: metadata.preparedFor || proposal.clientName || proposal.company || '',
    website: brand.contact?.website || '',
    email: brand.contact?.email || proposal.clientEmail || '',
    phone: brand.contact?.phone || '',
    brand_primary: tokens.colors?.accent || brand.colors?.accent || '',
    brand_secondary: tokens.colors?.border || brand.colors?.secondary || '',
    brand_logo: tokens.branding?.logo || brand.logos?.primary || '',
    valid_until: formatDate(metadata.expiryDate || proposal.validUntil),
    project_type: proposal.projectType || '',
    title: proposal.title || '',
  }
}

export function interpolate(text, context = {}) {
  if (typeof text !== 'string' || !text.includes('{{')) return text
  return text.replace(TOKEN, (match, key) => {
    const value = context[key]
    return value == null || value === '' ? match : String(value)
  })
}

export function interpolateDeep(value, context) {
  if (typeof value === 'string') return interpolate(value, context)
  if (Array.isArray(value)) return value.map((item) => interpolateDeep(item, context))
  if (value && typeof value === 'object') {
    const next = {}
    Object.keys(value).forEach((key) => {
      next[key] = interpolateDeep(value[key], context)
    })
    return next
  }
  return value
}

export function interpolateInstance(instance, context) {
  if (!instance) return instance
  return {
    ...instance,
    data: interpolateDeep(instance.data, context),
  }
}

export function listBlockVariables() {
  return BLOCK_VARIABLES
}
