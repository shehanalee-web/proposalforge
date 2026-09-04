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

export function createGeminiProvider(env = {}) {
  const settings = aiRuntimeOptions(env, IMPROVE_PROVIDER.GEMINI)
  const apiKey = String(env.GEMINI_API_KEY ?? '').trim()

  return {
    id: IMPROVE_PROVIDER.GEMINI,
    label: 'Gemini',
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
      const method = stream ? 'streamGenerateContent' : 'generateContent'
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.model)}:${method}?key=${encodeURIComponent(apiKey)}${stream ? '&alt=sse' : ''}`
      const body = {
        systemInstruction: { parts: [{ text: prompts.systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: prompts.userPrompt }] }],
        generationConfig: {
          temperature: settings.temperature,
          maxOutputTokens: settings.maxTokens,
        },
      }

      try {
        const response = await providerFetch(
          url,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal,
          },
          timeoutMs,
        )

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw mapProviderHttpError(response.status, payload, 'Gemini rejected the request.')
        }

        function textFrom(payload) {
          return (payload.candidates ?? [])
            .flatMap((candidate) => candidate.content?.parts ?? [])
            .map((part) => part.text)
            .filter(Boolean)
            .join('')
        }

        if (!stream) {
          const payload = await response.json()
          const text = textFrom(payload)
          const usage = payload.usageMetadata ?? {}
          return {
            text,
            usage: usageFrom(
              {
                prompt_tokens: usage.promptTokenCount,
                completion_tokens: usage.candidatesTokenCount,
                total_tokens: usage.totalTokenCount,
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
          const chunk = textFrom(event.data)
          if (chunk) {
            text += chunk
            onDelta(text)
          }
          if (event.data.usageMetadata) usage = event.data.usageMetadata
        })

        return {
          text,
          usage: usageFrom(
            {
              prompt_tokens: usage.promptTokenCount,
              completion_tokens: usage.candidatesTokenCount,
              total_tokens: usage.totalTokenCount,
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
