import { useEffect } from 'react'

function typingTarget(target) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  )
}

/**
 * Keyboard-first editor shortcuts. Skips when typing in fields,
 * except undo/redo which remain available.
 */
export function useEditorKeyboard({
  disabled = false,
  onUndo,
  onRedo,
  onDuplicate,
  onDelete,
  onMove,
  onToggleExpand,
  onTogglePreview,
  onFocusSearch,
  onNextBlock,
  onPrevBlock,
  onCopy,
  onPaste,
}) {
  useEffect(() => {
    if (disabled) return undefined

    function onKeyDown(event) {
      const meta = event.metaKey || event.ctrlKey
      const typing = typingTarget(event.target)

      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) onRedo?.()
        else onUndo?.()
        return
      }

      if (meta && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        onRedo?.()
        return
      }

      if (meta && event.key.toLowerCase() === 'p') {
        event.preventDefault()
        onTogglePreview?.()
        return
      }

      if (meta && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        onFocusSearch?.()
        return
      }

      if (typing) return

      const tag = event.target instanceof HTMLElement ? event.target.tagName : ''
      const interactive = tag === 'BUTTON' || tag === 'A'

      if (event.key === '/' && !meta) {
        event.preventDefault()
        onFocusSearch?.()
        return
      }

      if (event.altKey && event.key === 'ArrowUp') {
        event.preventDefault()
        onMove?.(-1)
        return
      }
      if (event.altKey && event.key === 'ArrowDown') {
        event.preventDefault()
        onMove?.(1)
        return
      }

      if (event.key === 'ArrowDown' || event.key === 'j') {
        event.preventDefault()
        onNextBlock?.()
      } else if (event.key === 'ArrowUp' || event.key === 'k') {
        event.preventDefault()
        onPrevBlock?.()
      } else if ((event.key === 'Enter' || event.key === ' ') && !interactive) {
        event.preventDefault()
        onToggleExpand?.()
      } else if (event.key.toLowerCase() === 'c' && meta && !event.shiftKey) {
        event.preventDefault()
        onCopy?.()
      } else if (event.key.toLowerCase() === 'v' && meta && !event.shiftKey) {
        event.preventDefault()
        onPaste?.()
      } else if (event.key.toLowerCase() === 'd' && meta) {
        event.preventDefault()
        onDuplicate?.()
      } else if ((event.key === 'Backspace' || event.key === 'Delete') && meta) {
        event.preventDefault()
        onDelete?.()
      } else if (event.key === '[') {
        event.preventDefault()
        onToggleExpand?.(false)
      } else if (event.key === ']') {
        event.preventDefault()
        onToggleExpand?.(true)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    disabled,
    onUndo,
    onRedo,
    onDuplicate,
    onDelete,
    onMove,
    onToggleExpand,
    onTogglePreview,
    onFocusSearch,
    onNextBlock,
    onPrevBlock,
    onCopy,
    onPaste,
  ])
}
