/**
 * H15.6 — Server-only CommercialClose provider configuration.
 *
 * Empty/disabled defaults. No real secrets. Never serialize to clients.
 */

import { NULL_PROVIDER_ID } from './providers/types.js'

/**
 * @param {object} [input]
 */
export function makeCommercialCloseProviderConfig(input = {}) {
  const providerId = String(input.providerId ?? '').trim() || null
  return Object.freeze({
    companyId: String(input.companyId ?? '').trim() || null,
    providerId,
    enabled: input.enabled === true && Boolean(providerId),
    accountId: String(input.accountId ?? '').trim() || null,
    apiKeyRef: String(input.apiKeyRef ?? '').trim() || null,
    webhookSecretRef: String(input.webhookSecretRef ?? '').trim() || null,
    metadata:
      input.metadata && typeof input.metadata === 'object'
        ? Object.freeze({ ...input.metadata })
        : Object.freeze({}),
  })
}

/**
 * Resolve server-side provider config for a company.
 * H15.6 always returns disabled empty defaults (no env vendor wiring).
 *
 * @param {string} companyId
 * @param {string} [providerId]
 */
export function getCommercialCloseProviderConfig(companyId, providerId) {
  const company = String(companyId ?? '').trim() || null
  const id = String(providerId ?? '').trim() || null
  // Null adapters stay disabled; unknown ids also resolve to disabled empties.
  if (
    id === NULL_PROVIDER_ID.SIGNATURE ||
    id === NULL_PROVIDER_ID.PAYMENT ||
    !id
  ) {
    return makeCommercialCloseProviderConfig({
      companyId: company,
      providerId: id,
      enabled: false,
    })
  }
  return makeCommercialCloseProviderConfig({
    companyId: company,
    providerId: id,
    enabled: false,
    accountId: null,
    apiKeyRef: null,
    webhookSecretRef: null,
    metadata: Object.freeze({}),
  })
}

/**
 * Client-safe projection — never includes secret refs or account material.
 *
 * @param {object | null | undefined} config
 */
export function presentClientProviderConfig(config) {
  if (!config) {
    return {
      enabled: false,
      providerId: null,
    }
  }
  return {
    enabled: false,
    providerId: null,
  }
}

/**
 * Studio-safe projection — architecture status only, no secrets.
 *
 * @param {object | null | undefined} config
 */
export function presentStudioProviderConfig(config) {
  const next = makeCommercialCloseProviderConfig(config ?? {})
  return {
    companyId: next.companyId,
    providerId: next.providerId,
    enabled: false,
    configured: false,
    architectureOnly: true,
  }
}
