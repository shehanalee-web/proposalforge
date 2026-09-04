import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Run an async task and track its loading and error state.
 *
 * Internal building block for the resource hooks. It exists so the awkward
 * parts — ignoring responses that arrive out of order, and not setting state
 * after unmount — are solved once rather than repeated in every hook.
 *
 * The `task` must be memoised by the caller (with `useCallback`), because it is
 * the dependency that decides when a refetch happens.
 *
 * @template T
 * @param {() => Promise<T>} task
 * @param {{ enabled?: boolean, initialData?: T }} [options]
 * @param {boolean} [options.enabled] Skip the request when false.
 * @param {T} [options.initialData] Value held before the first result arrives.
 * @returns {{ data: T, loading: boolean, error: Error | null, refetch: () => Promise<void>, setData: (value: T) => void }}
 */
export function useAsyncData(task, options = {}) {
  const { enabled = true, initialData = null } = options

  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(null)

  /**
   * Incremented for every request, and again on cleanup. A response is only
   * applied when its id is still current, which discards both out-of-order
   * responses and any request still in flight when the component unmounts.
   */
  const requestId = useRef(0)

  const run = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }

    const id = requestId.current + 1
    requestId.current = id

    setLoading(true)
    setError(null)

    try {
      const result = await task()

      if (id !== requestId.current) return

      setData(result)
    } catch (caught) {
      if (id !== requestId.current) return

      setError(caught)
    } finally {
      if (id === requestId.current) {
        setLoading(false)
      }
    }
  }, [task, enabled])

  useEffect(() => {
    // `run` flips loading on before its first await, which the rule flags as a
    // synchronous setState. That is unavoidable — and correct — when the effect
    // exists to synchronise with an external system, which is the case here.
    // oxlint-disable-next-line react/set-state-in-effect
    run()

    return () => {
      requestId.current += 1
    }
  }, [run])

  return { data, loading, error, refetch: run, setData }
}
