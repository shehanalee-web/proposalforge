import { useCallback, useMemo, useState } from 'react'
import { CreateProposalContext } from './createProposalState.js'

/**
 * Studio chrome dialogs: start a proposal (AI vs template) and duplicate.
 */
export function CreateProposalProvider({ children }) {
  const [open, setOpen] = useState(false)
  const [seed, setSeed] = useState(null)
  const [startOpen, setStartOpen] = useState(false)

  const openCreate = useCallback((nextSeed = null) => {
    setSeed(nextSeed)
    setOpen(true)
  }, [])

  const closeCreate = useCallback(() => {
    setOpen(false)
    setSeed(null)
  }, [])

  const openStart = useCallback(() => {
    setStartOpen(true)
  }, [])

  const closeStart = useCallback(() => {
    setStartOpen(false)
  }, [])

  const value = useMemo(
    () => ({
      open,
      seed,
      openCreate,
      closeCreate,
      startOpen,
      openStart,
      closeStart,
    }),
    [open, seed, openCreate, closeCreate, startOpen, openStart, closeStart],
  )

  return (
    <CreateProposalContext.Provider value={value}>
      {children}
    </CreateProposalContext.Provider>
  )
}
