import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const ViewerContext = createContext(null)

export function ViewerProvider({ children }) {
  const [lightbox, setLightbox] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [notice, setNotice] = useState(null)

  const openGallery = useCallback((items, index = 0) => {
    setLightbox({ items, index, zoom: 1 })
  }, [])

  const closeGallery = useCallback(() => setLightbox(null), [])

  const flash = useCallback((message) => {
    setNotice(message)
    window.setTimeout(() => setNotice(null), 2400)
  }, [])

  const value = useMemo(
    () => ({
      lightbox,
      setLightbox,
      openGallery,
      closeGallery,
      drawerOpen,
      setDrawerOpen,
      saved,
      setSaved,
      notice,
      flash,
    }),
    [lightbox, openGallery, closeGallery, drawerOpen, saved, notice, flash],
  )

  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>
}

export function useViewer() {
  const ctx = useContext(ViewerContext)
  if (!ctx) {
    throw new Error('useViewer must be used inside ViewerProvider')
  }
  return ctx
}
