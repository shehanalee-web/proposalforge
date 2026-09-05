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
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [responsesOpen, setResponsesOpen] = useState(false)
  const [collaborationOpen, setCollaborationOpen] = useState(false)
  const [clientOpen, setClientOpen] = useState(false)
  const [workflowOpen, setWorkflowOpen] = useState(false)
  const [portalOpen, setPortalOpen] = useState(false)
  const [interactionsOpen, setInteractionsOpen] = useState(false)
  const [followupOpen, setFollowupOpen] = useState(false)
  const clipboardRef = useRef(null)
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

  const copyBlock = useCallback((block) => {
    clipboardRef.current = block
      ? JSON.parse(JSON.stringify(block))
      : null
  }, [])

  const takeClipboard = useCallback(() => clipboardRef.current, [])

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
      inspectorOpen,
      setInspectorOpen,
      responsesOpen,
      setResponsesOpen,
      collaborationOpen,
      setCollaborationOpen,
      clientOpen,
      setClientOpen,
      workflowOpen,
      setWorkflowOpen,
      portalOpen,
      setPortalOpen,
      interactionsOpen,
      setInteractionsOpen,
      followupOpen,
      setFollowupOpen,
      copyBlock,
      takeClipboard,
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
      inspectorOpen,
      responsesOpen,
      collaborationOpen,
      clientOpen,
      workflowOpen,
      portalOpen,
      interactionsOpen,
      followupOpen,
      copyBlock,
      takeClipboard,
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
