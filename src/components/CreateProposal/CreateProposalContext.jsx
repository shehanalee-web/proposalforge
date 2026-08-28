import { useCallback, useMemo, useState } from 'react'
import { CreateProposalContext } from './createProposalState.js'

/**
 * Duplicate-proposal dialog. New proposals use the Create Proposal journey
 * at `/new`; this stays in chrome for duplicating an existing document.
 */
export function CreateProposalProvider({ children }) {
  const [open, setOpen] = useState(false)
  const [seed, setSeed] = useState(null)

  const openCreate = useCallback((nextSeed = null) => {
    setSeed(nextSeed)
    setOpen(true)
  }, [])

  const closeCreate = useCallback(() => {
    setOpen(false)
    setSeed(null)
  }, [])

  const value = useMemo(
    () => ({ open, seed, openCreate, closeCreate }),
    [open, seed, openCreate, closeCreate],
  )

  return (
    <CreateProposalContext.Provider value={value}>
      {children}
    </CreateProposalContext.Provider>
  )
}
