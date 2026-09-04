import { IMPROVE_PROVIDER } from './ids.js'
import { makeImprovementDraft } from './draft.js'

const providers = new Map()

function withMetadata(spec) {
  return {
    id: spec.id,
    label: String(spec.label ?? spec.id),
    model: String(spec.model ?? ''),
    supportsStreaming: Boolean(spec.supportsStreaming),
    supportsJSON: spec.supportsJSON !== false,
    supportsVision: Boolean(spec.supportsVision),
    supportsTools: Boolean(spec.supportsTools),
    maxTokens: Number(spec.maxTokens) > 0 ? Number(spec.maxTokens) : 4096,
  }
}

/**
 * Register a generator. The UI never imports a provider id — `getImproveProvider()`
 * and the server engine resolve the active adapter from configuration.
 *
 * @param {{
 *   id: string,
 *   label?: string,
 *   model?: string,
 *   supportsStreaming?: boolean,
 *   supportsJSON?: boolean,
 *   supportsVision?: boolean,
 *   supportsTools?: boolean,
 *   maxTokens?: number,
 *   generate?: (request: object) => object | Promise<object>,
 *   generateImprovement?: (request: object) => object | Promise<object>,
 *   complete?: (request: object) => object | Promise<object>,
 * }} spec
 */
export function registerImproveProvider(spec) {
  const generate = spec?.generateImprovement || spec?.generate
  if (!spec?.id || (typeof generate !== 'function' && typeof spec.complete !== 'function')) {
    throw new Error('Improve provider requires id and generateImprovement()')
  }

  const meta = withMetadata(spec)

  const provider = {
    ...meta,
    async generate(request) {
      if (typeof generate !== 'function') {
        throw new Error(`${spec.id} does not implement generateImprovement()`)
      }
      const result = await generate(request)
      return makeImprovementDraft({
        ...result,
        provider: spec.id,
      })
    },
    async generateImprovement(request) {
      return provider.generate(request)
    },
    complete: spec.complete
      ? (args) => spec.complete(args)
      : async (args) => {
          const draft = await provider.generate(args.request ?? args)
          return {
            text: draft.previewBody,
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            draft,
          }
        },
  }

  providers.set(provider.id, provider)
  return provider
}

/**
 * @param {string} [id]
 */
export function getImproveProvider(id = IMPROVE_PROVIDER.MOCK) {
  const requested = id === IMPROVE_PROVIDER.DETERMINISTIC ? IMPROVE_PROVIDER.MOCK : id
  return (
    providers.get(requested) ??
    providers.get(IMPROVE_PROVIDER.MOCK) ??
    providers.get(IMPROVE_PROVIDER.DETERMINISTIC)
  )
}

export function listImproveProviders() {
  return [...providers.values()]
}

export function providerMetadata(id) {
  const provider = getImproveProvider(id)
  if (!provider) return withMetadata({ id: IMPROVE_PROVIDER.MOCK, label: 'Mock' })
  return withMetadata(provider)
}
