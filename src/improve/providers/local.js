import { IMPROVE_PROVIDER } from '../ids.js'
import { ImproveError, IMPROVE_ERROR_CODE } from '../errors.js'
import { aiRuntimeOptions } from '../settings.js'
import {
  mapProviderFailure,
  mapProviderHttpError,
  providerFetch,
  readSse,
  usageFrom,
} from './http.js'

function endpoint(base) {
  const url = String(base ?? '').replace(/\/$/, '')
  if (!url) return ''
  if (/\/chat\/completions\/?$/.test(url)) return url
  if (/\/v1$/.test(url)) return `${url}/chat/completions`
  return `${url}/v1/chat/completions`
}

export function createLocalProvider(env = {}) {
  const settings = aiRuntimeOptions(env, IMPROVE_PROVIDER.LOCAL)
  const apiKey = String(env.LOCAL_AI_API_KEY ?? '').trim()
  const url = endpoint(settings.localUrl)

  return {
    id: IMPROVE_PROVIDER.LOCAL,
    label: 'Local',
    model: settings.model,
    supportsStreaming: true,
    supportsJSON: true,
    supportsVision: false,
    supportsTools: false,
    maxTokens: settings.maxTokens,

    async complete({ prompts, options = {}, signal, onDelta } = {}) {
      if (!url) {
        throw new ImproveError('Generation failed.', {
          code: IMPROVE_ERROR_CODE.UNAVAILABLE,
          retryable: false,
        })
      }

      const stream = Boolean(options.stream && onDelta)
      const timeoutMs = options.timeoutMs ?? settings.timeoutMs
      const headers = { 'Content-Type': 'application/json' }
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`

      try {
        const response = await providerFetch(
          url,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model: settings.model,
              temperature: settings.temperature,
              max_tokens: settings.maxTokens,
              stream,
              messages: [
                { role: 'system', content: prompts.systemPrompt },
                { role: 'user', content: prompts.userPrompt },
              ],
            }),
            signal,
          },
          timeoutMs,
        )

        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw mapProviderHttpError(response.status, body, 'The local model rejected the request.')
        }

        if (!stream) {
          const body = await response.json()
          const text = body.choices?.[0]?.message?.content ?? body.message?.content ?? ''
          return { text, usage: usageFrom(body.usage, prompts.userPrompt, text) }
        }

        let text = ''
        let usage = {}
        await readSse(response, (event) => {
          if (event.done) return
          const delta =
            event.data?.choices?.[0]?.delta?.content ??
            event.data?.message?.content ??
            ''
          if (delta) {
            text += delta
            onDelta(text)
          }
          if (event.data?.usage) usage = event.data.usage
        })

        return { text, usage: usageFrom(usage, prompts.userPrompt, text) }
      } catch (error) {
        throw mapProviderFailure(error)
      }
    },
  }
}
