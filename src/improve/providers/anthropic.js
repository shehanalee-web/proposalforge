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

export function createAnthropicProvider(env = {}) {
  const settings = aiRuntimeOptions(env, IMPROVE_PROVIDER.ANTHROPIC)
  const apiKey = String(env.ANTHROPIC_API_KEY ?? '').trim()

  return {
    id: IMPROVE_PROVIDER.ANTHROPIC,
    label: 'Anthropic',
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
      const body = {
        model: settings.model,
        max_tokens: settings.maxTokens,
        temperature: settings.temperature,
        system: prompts.systemPrompt,
        messages: [{ role: 'user', content: prompts.userPrompt }],
        stream,
      }

      try {
        const response = await providerFetch(
          'https://api.anthropic.com/v1/messages',
          {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal,
          },
          timeoutMs,
        )

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw mapProviderHttpError(response.status, payload, 'Anthropic rejected the request.')
        }

        if (!stream) {
          const payload = await response.json()
          const text = (payload.content ?? [])
            .map((part) => part.text)
            .filter(Boolean)
            .join('')
          return {
            text,
            usage: usageFrom(
              {
                prompt_tokens: payload.usage?.input_tokens,
                completion_tokens: payload.usage?.output_tokens,
              },
              prompts.userPrompt,
              text,
            ),
          }
        }

        let text = ''
        let usage = {}
        await readSse(response, (event) => {
          if (event.done || !event.data) return
          if (event.data.type === 'content_block_delta' && event.data.delta?.text) {
            text += event.data.delta.text
            onDelta(text)
          }
          if (event.data.type === 'message_delta' && event.data.usage) {
            usage = event.data.usage
          }
        })

        return {
          text,
          usage: usageFrom(
            {
              prompt_tokens: usage.input_tokens,
              completion_tokens: usage.output_tokens,
            },
            prompts.userPrompt,
            text,
          ),
        }
      } catch (error) {
        throw mapProviderFailure(error)
      }
    },
  }
}
