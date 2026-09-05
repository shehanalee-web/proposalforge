import { useCallback, useRef, useState } from 'react'
import { generateProposalDraft } from '../generate/client.js'
import { GENERATION_STATUS } from '../generate/types.js'
import { ImproveError, IMPROVE_ERROR_CODE } from '../improve/errors.js'

/**
 * Client-side generator session. Never creates a proposal until the caller
 * explicitly calls create with the preview payload.
 */
export function useGenerateProposal() {
  const [status, setStatus] = useState(GENERATION_STATUS.IDLE)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const lastRequest = useRef(null)
  const controller = useRef(null)

  const reset = useCallback(() => {
    controller.current?.abort()
    controller.current = null
    setStatus(GENERATION_STATUS.IDLE)
    setResult(null)
    setError(null)
  }, [])

  const cancel = useCallback(() => {
    controller.current?.abort()
    controller.current = null
    setStatus(GENERATION_STATUS.CANCELLED)
    setResult(null)
    setError(new ImproveError('Generation failed.', { code: IMPROVE_ERROR_CODE.CANCELLED }))
  }, [])

  const run = useCallback(async (request, { retry = false } = {}) => {
    const payload = retry ? lastRequest.current : request
    if (!payload) return null
    lastRequest.current = payload
    controller.current?.abort()
    const abort = new AbortController()
    controller.current = abort
    setError(null)
    setResult(null)
    setStatus(GENERATION_STATUS.PREPARING)

    try {
      const next = await generateProposalDraft(payload, {
        signal: abort.signal,
        onStatus(value) {
          if (value === 'retrieving_knowledge') setStatus(GENERATION_STATUS.RETRIEVING_KNOWLEDGE)
          else if (value === 'generating') setStatus(GENERATION_STATUS.GENERATING)
          else if (value === 'validating') setStatus(GENERATION_STATUS.VALIDATING)
          else if (value === 'preparing') setStatus(GENERATION_STATUS.PREPARING)
        },
      })
      if (abort.signal.aborted) return null
      setResult(next)
      setStatus(GENERATION_STATUS.COMPLETE)
      return next
    } catch (caught) {
      if (abort.signal.aborted || caught?.code === IMPROVE_ERROR_CODE.CANCELLED) {
        setStatus(GENERATION_STATUS.CANCELLED)
        setResult(null)
        setError(caught)
        return null
      }
      setStatus(GENERATION_STATUS.FAILED)
      setResult(null)
      setError(caught)
      return null
    }
  }, [])

  return {
    status,
    result,
    error,
    run,
    retry: () => run(lastRequest.current, { retry: true }),
    cancel,
    reset,
    busy:
      status === GENERATION_STATUS.PREPARING ||
      status === GENERATION_STATUS.RETRIEVING_KNOWLEDGE ||
      status === GENERATION_STATUS.GENERATING ||
      status === GENERATION_STATUS.VALIDATING ||
      status === GENERATION_STATUS.CREATING_PROPOSAL,
  }
}
