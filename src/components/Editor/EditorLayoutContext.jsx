import { createContext, useContext, useMemo, useState } from 'react'

const EditorLayoutContext = createContext(null)

export function EditorLayoutProvider({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const value = useMemo(
    () => ({ sidebarOpen, setSidebarOpen }),
    [sidebarOpen],
  )

  return (
    <EditorLayoutContext.Provider value={value}>
      {children}
    </EditorLayoutContext.Provider>
  )
}

export function useEditorLayout() {
  const ctx = useContext(EditorLayoutContext)
  if (!ctx) {
    return { sidebarOpen: false, setSidebarOpen: () => {} }
  }
  return ctx
}
