import { useEffect, useState } from 'react'
import {
  FORGE_CAPABILITIES,
  resolveForgePresentation,
} from '../../forge/index.js'
import styles from './ForgeAssistantShell.module.css'

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return reduced
}

/**
 * Studio-only Forge assistant presentation shell.
 * Uses icon + text fallback. Optional Rive path is reserved when capability
 * and asset both exist — H14.8 does not require a .riv file.
 */
export function ForgeAssistantShell({
  busy = false,
  error = null,
  resultMessage = '',
  hasSummary = false,
  hasSuggestion = false,
}) {
  const reducedMotion = usePrefersReducedMotion()
  const presentation = resolveForgePresentation({
    busy,
    error,
    resultMessage,
    hasSummary,
    hasSuggestion,
    reducedMotion,
    assetExists: false,
    capabilities: FORGE_CAPABILITIES,
  })

  return (
    <div
      className={styles.shell}
      data-forge-assistant="true"
      data-forge-state={presentation.state}
      data-forge-mode={presentation.mode}
      data-reduced-motion={presentation.reducedMotion ? 'true' : 'false'}
      aria-live="polite"
    >
      <span
        className={styles.mark}
        data-animate={presentation.animate ? 'true' : 'false'}
        aria-hidden="true"
      />
      <div className={styles.copy}>
        <p className={styles.kicker}>Forge assistant</p>
        <p className={styles.label}>{presentation.label}</p>
        <p className={styles.hint}>
          {presentation.mode === 'rive'
            ? 'Rive presentation active.'
            : 'Icon + text fallback — Rive asset optional, not required.'}
        </p>
      </div>
    </div>
  )
}
