import { IMPROVE_PROVIDER, IMPROVE_PROVIDERS } from './ids.js'

export const AI_DEFAULTS = Object.freeze({
  temperature: 0.4,
  maxTokens: 1200,
  timeoutMs: 60_000,
  streaming: true,
})

const DEFAULT_MODELS = Object.freeze({
  [IMPROVE_PROVIDER.OPENAI]: 'gpt-4o-mini',
  [IMPROVE_PROVIDER.ANTHROPIC]: 'claude-3-5-haiku-latest',
  [IMPROVE_PROVIDER.GEMINI]: 'gemini-2.0-flash',
  [IMPROVE_PROVIDER.LOCAL]: 'llama3.1',
  [IMPROVE_PROVIDER.MOCK]: 'mock',
  [IMPROVE_PROVIDER.DETERMINISTIC]: 'mock',
})

function flag(value, fallback) {
  if (value == null || value === '') return fallback
  return /^(1|true|yes|on)$/i.test(String(value))
}

function number(value, fallback) {
  const next = Number(value)
  return Number.isFinite(next) && next > 0 ? next : fallback
}

function requestedProvider(env = {}) {
  const raw = String(env.AI_PROVIDER || IMPROVE_PROVIDER.MOCK)
    .trim()
    .toLowerCase()
  if (raw === 'deterministic') return IMPROVE_PROVIDER.MOCK
  return IMPROVE_PROVIDERS.includes(raw) ? raw : IMPROVE_PROVIDER.MOCK
}

export function providerApiKey(id, env = {}) {
  switch (id) {
    case IMPROVE_PROVIDER.OPENAI:
      return String(env.OPENAI_API_KEY ?? '').trim()
    case IMPROVE_PROVIDER.ANTHROPIC:
      return String(env.ANTHROPIC_API_KEY ?? '').trim()
    case IMPROVE_PROVIDER.GEMINI:
      return String(env.GEMINI_API_KEY ?? '').trim()
    case IMPROVE_PROVIDER.LOCAL:
      return String(env.LOCAL_AI_API_KEY ?? '').trim()
    default:
      return ''
  }
}

export function providerModel(id, env = {}) {
  if (env.AI_MODEL) return String(env.AI_MODEL).trim()
  switch (id) {
    case IMPROVE_PROVIDER.OPENAI:
      return String(env.OPENAI_MODEL || DEFAULT_MODELS[IMPROVE_PROVIDER.OPENAI]).trim()
    case IMPROVE_PROVIDER.ANTHROPIC:
      return String(env.ANTHROPIC_MODEL || DEFAULT_MODELS[IMPROVE_PROVIDER.ANTHROPIC]).trim()
    case IMPROVE_PROVIDER.GEMINI:
      return String(env.GEMINI_MODEL || DEFAULT_MODELS[IMPROVE_PROVIDER.GEMINI]).trim()
    case IMPROVE_PROVIDER.LOCAL:
      return String(env.LOCAL_AI_MODEL || DEFAULT_MODELS[IMPROVE_PROVIDER.LOCAL]).trim()
    default:
      return DEFAULT_MODELS[IMPROVE_PROVIDER.MOCK]
  }
}

export function providerReady(id, env = {}) {
  if (id === IMPROVE_PROVIDER.MOCK || id === IMPROVE_PROVIDER.DETERMINISTIC) {
    return true
  }
  if (id === IMPROVE_PROVIDER.LOCAL) {
    return Boolean(String(env.LOCAL_AI_URL ?? '').trim())
  }
  return Boolean(providerApiKey(id, env))
}

/**
 * Resolve the active provider from env. Incomplete networked config falls
 * back to mock without throwing.
 *
 * @param {Record<string, string | undefined>} [env]
 */
export function resolveAiSettings(env = {}) {
  const requested = requestedProvider(env)
  const ready = providerReady(requested, env)
  const provider = ready ? requested : IMPROVE_PROVIDER.MOCK
  const temperature = number(env.AI_TEMPERATURE, AI_DEFAULTS.temperature)
  const maxTokens = Math.min(8192, number(env.AI_MAX_TOKENS, AI_DEFAULTS.maxTokens))
  const timeoutMs = number(env.AI_TIMEOUT_MS, AI_DEFAULTS.timeoutMs)
  const streaming = flag(env.AI_STREAMING, AI_DEFAULTS.streaming)

  return {
    requestedProvider: requested,
    provider,
    fallback: provider !== requested,
    model: providerModel(provider, env),
    temperature,
    maxTokens,
    timeoutMs,
    streaming,
    localUrl: String(env.LOCAL_AI_URL ?? '').trim(),
    hasApiKey: Boolean(providerApiKey(requested, env)) || requested === IMPROVE_PROVIDER.LOCAL,
  }
}

/** Runtime knobs for a specific adapter. Does not change which adapter is active. */
export function aiRuntimeOptions(env = {}, providerId) {
  const settings = resolveAiSettings(env)
  const id = providerId ?? settings.provider
  return {
    model: providerModel(id, env),
    temperature: settings.temperature,
    maxTokens: settings.maxTokens,
    timeoutMs: settings.timeoutMs,
    streaming: settings.streaming,
    localUrl: settings.localUrl,
  }
}

/**
 * Public status for the Settings module. Never includes secrets.
 */
export function publicAiSettings(env = {}, metadata = {}) {
  const settings = resolveAiSettings(env)
  return {
    provider: settings.provider,
    requestedProvider: settings.requestedProvider,
    fallback: settings.fallback,
    model: settings.model,
    temperature: settings.temperature,
    maxTokens: settings.maxTokens,
    streaming: settings.streaming,
    timeoutMs: settings.timeoutMs,
    hasApiKey: settings.provider === IMPROVE_PROVIDER.MOCK ? true : settings.hasApiKey,
    supportsStreaming: Boolean(metadata.supportsStreaming),
    supportsJSON: metadata.supportsJSON !== false,
    supportsVision: Boolean(metadata.supportsVision),
    supportsTools: Boolean(metadata.supportsTools),
    configuredVia: 'environment',
  }
}
