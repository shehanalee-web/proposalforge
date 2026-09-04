import { IMPROVE_PROVIDER } from './ids.js'
import { makeImprovementDraft } from './draft.js'

const providers = new Map()

/**
 * @typedef {object} ImproveProvider
 * @property {string} id
 * @property {string} label
 * @property {(request: object) => import('./draft.js').ImprovementDraft} generate
 */

/**
 * Register a generator. The UI always calls `getImproveProvider()` so a later
 * OpenAI / Anthropic / Gemini / local adapter is a registration, not a
 * layout change.
 *
 * @param {{ id: string, label: string, generate: (request: object) => object }} spec
 */
export function registerImproveProvider(spec) {
  if (!spec?.id || typeof spec.generate !== 'function') {
    throw new Error('Improve provider requires id and generate()')
  }

  const provider = {
    id: spec.id,
    label: String(spec.label ?? spec.id),
    generate(request) {
      return makeImprovementDraft({
        ...spec.generate(request),
        provider: spec.id,
      })
    },
  }

  providers.set(provider.id, provider)
  return provider
}

/**
 * @param {string} [id]
 */
export function getImproveProvider(id = IMPROVE_PROVIDER.DETERMINISTIC) {
  return providers.get(id) ?? providers.get(IMPROVE_PROVIDER.DETERMINISTIC)
}

export function listImproveProviders() {
  return [...providers.values()]
}
