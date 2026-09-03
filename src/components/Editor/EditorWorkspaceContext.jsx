import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const EditorWorkspaceContext = createContext(null)

export function EditorWorkspaceProvider({ children }) {
  const [previewMode, setPreviewMode] = useState(false)
  const [outlineOpen, setOutlineOpen] = useState(true)
  const [activeBlockId, setActiveBlockId] = useState(null)
  const [expandedIds, setExpandedIds] = useState(() => new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const searchRef = useRef(null)

  const focusSearch = useCallback(() => {
    setOutlineOpen(true)
    setCommandPaletteOpen(true)
    requestAnimationFrame(() => searchRef.current?.focus())
  }, [])

  const toggleExpanded = useCallback((id, nextValue) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      const open = nextValue ?? !next.has(id)
      if (open) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const collapseAll = useCallback(() => setExpandedIds(new Set()), [])

  const scrollToBlock = useCallback((id) => {
    const node = document.querySelector(`[data-block-id="${id}"]`)
    if (!node) return
    node.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setActiveBlockId(id)
  }, [])

  const value = useMemo(
    () => ({
      previewMode,
      setPreviewMode,
      outlineOpen,
      setOutlineOpen,
      activeBlockId,
      setActiveBlockId,
      expandedIds,
      setExpandedIds,
      toggleExpanded,
      collapseAll,
      searchQuery,
      setSearchQuery,
      commandPaletteOpen,
      setCommandPaletteOpen,
      settingsOpen,
      setSettingsOpen,
      searchRef,
      focusSearch,
      scrollToBlock,
    }),
    [
      previewMode,
      outlineOpen,
      activeBlockId,
      expandedIds,
      searchQuery,
      commandPaletteOpen,
      settingsOpen,
      focusSearch,
      scrollToBlock,
      toggleExpanded,
      collapseAll,
    ],
  )

  return (
    <EditorWorkspaceContext.Provider value={value}>
      {children}
    </EditorWorkspaceContext.Provider>
  )
}

export function useEditorWorkspace() {
  const ctx = useContext(EditorWorkspaceContext)
  if (!ctx) {
    throw new Error('useEditorWorkspace must be used inside EditorWorkspaceProvider')
  }
  return ctx
}
