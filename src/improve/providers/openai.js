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

function headers(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
}

function payload(prompts, settings, stream) {
  return {
    model: settings.model,
    temperature: settings.temperature,
    max_tokens: settings.maxTokens,
    stream: Boolean(stream),
    messages: [
      { role: 'system', content: prompts.systemPrompt },
      { role: 'user', content: prompts.userPrompt },
    ],
  }
}

export function createOpenAIProvider(env = {}) {
  const settings = aiRuntimeOptions(env, IMPROVE_PROVIDER.OPENAI)
  const apiKey = String(env.OPENAI_API_KEY ?? '').trim()

  return {
    id: IMPROVE_PROVIDER.OPENAI,
    label: 'OpenAI',
    model: settings.model,
    supportsStreaming: true,
    supportsJSON: true,
    supportsVision: true,
    supportsTools: true,
    maxTokens: settings.maxTokens,

    async complete({ prompts, options = {}, signal, onDelta } = {}) {
      if (!apiKey) {
        throw new ImproveError('Generation failed.', {
          code: IMPROVE_ERROR_CODE.INVALID_KEY,
          retryable: false,
        })
      }

      const stream = Boolean(options.stream && onDelta)
      const timeoutMs = options.timeoutMs ?? settings.timeoutMs

      try {
        const response = await providerFetch(
          'https://api.openai.com/v1/chat/completions',
          {
            method: 'POST',
            headers: headers(apiKey),
            body: JSON.stringify(payload(prompts, settings, stream)),
            signal,
          },
          timeoutMs,
        )

        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw mapProviderHttpError(response.status, body, 'OpenAI rejected the request.')
        }

        if (!stream) {
          const body = await response.json()
          const text = body.choices?.[0]?.message?.content ?? ''
          return {
            text,
            usage: usageFrom(body.usage, prompts.userPrompt, text),
          }
        }

        let text = ''
        let usage = {}
        await readSse(response, (event) => {
          if (event.done) return
          const delta = event.data?.choices?.[0]?.delta?.content ?? ''
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
