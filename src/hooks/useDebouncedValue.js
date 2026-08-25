import { useEffect, useState } from 'react'

/**
 * Return a copy of `value` that only updates once it has stopped changing.
 *
 * Used to keep a text input responsive while preventing a request per
 * keystroke: the input stays controlled by immediate state, and the debounced
 * copy is what gets passed to the data layer.
 *
 * @template T
 * @param {T} value
 * @param {number} [delay] Quiet period in milliseconds.
 * @returns {T}
 */
export function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debounced
}
