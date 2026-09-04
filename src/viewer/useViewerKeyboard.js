import { useEffect } from 'react'

function typingTarget(target) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export function useViewerKeyboard({
  enabled = true,
  sectionIds = [],
  activeId,
  onJump,
  onFullscreen,
  lightboxOpen = false,
  onLightboxPrev,
  onLightboxNext,
  onLightboxClose,
  onLightboxZoomIn,
  onLightboxZoomOut,
}) {
  useEffect(() => {
    if (!enabled) return undefined

    function onKeyDown(event) {
      if (typingTarget(event.target)) return

      if (lightboxOpen) {
        if (event.key === 'Escape') {
          event.preventDefault()
          onLightboxClose?.()
        } else if (event.key === 'ArrowRight' || event.key === 'j') {
          event.preventDefault()
          onLightboxNext?.()
        } else if (event.key === 'ArrowLeft' || event.key === 'k') {
          event.preventDefault()
          onLightboxPrev?.()
        } else if (event.key === '+' || event.key === '=') {
          event.preventDefault()
          onLightboxZoomIn?.()
        } else if (event.key === '-' || event.key === '_') {
          event.preventDefault()
          onLightboxZoomOut?.()
        } else if (event.key.toLowerCase() === 'f') {
          event.preventDefault()
          onFullscreen?.()
        }
        return
      }

      if (event.key.toLowerCase() === 'f') {
        event.preventDefault()
        onFullscreen?.()
        return
      }

      const index = Math.max(0, sectionIds.indexOf(activeId))
      if (event.key === 'ArrowDown' || event.key === 'j') {
        event.preventDefault()
        const next = sectionIds[Math.min(index + 1, sectionIds.length - 1)]
        if (next) onJump?.(next)
      } else if (event.key === 'ArrowUp' || event.key === 'k') {
        event.preventDefault()
        const prev = sectionIds[Math.max(index - 1, 0)]
        if (prev) onJump?.(prev)
      } else if (event.key === 'Home') {
        event.preventDefault()
        if (sectionIds[0]) onJump?.(sectionIds[0])
      } else if (event.key === 'End') {
        event.preventDefault()
        const last = sectionIds[sectionIds.length - 1]
        if (last) onJump?.(last)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    enabled,
    sectionIds,
    activeId,
    onJump,
    onFullscreen,
    lightboxOpen,
    onLightboxPrev,
    onLightboxNext,
    onLightboxClose,
    onLightboxZoomIn,
    onLightboxZoomOut,
  ])
}
