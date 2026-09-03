import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useBrandKit } from '../hooks/useBrandKit.js'
import { useSettings } from '../hooks/useSettings.js'
import { resolveBrand } from '../blocks/brand.js'
import { applyThemeId, patchDesign, resolveDesign, tokensToCssVars } from './resolve.js'
import { readDesign, subscribeDesign, writeDesign } from './store.js'
import { makeTokens } from './tokens.js'

const ProposalThemeContext = createContext(null)

export function ProposalThemeProvider({
  proposalId,
  proposal = null,
  brand = null,
  children,
}) {
  const { settings } = useSettings()
  const { kit } = useBrandKit()
  const resolvedBrand = useMemo(
    () => brand ?? resolveBrand(settings, kit),
    [brand, settings, kit],
  )

  const [design, setDesign] = useState(() =>
    resolveDesign(readDesign(proposalId), proposal, resolvedBrand),
  )

  useEffect(() => {
    setDesign(resolveDesign(readDesign(proposalId), proposal, resolvedBrand))
    // Re-seed when the document or Brand Kit identity changes — not on every field edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalId, proposal?.id, kit])

  useEffect(
    () =>
      subscribeDesign(proposalId, (incoming) => {
        setDesign(resolveDesign(incoming, proposal, resolvedBrand))
      }),
    [proposalId, proposal, resolvedBrand],
  )

  const update = useCallback(
    (next) => {
      const resolved = resolveDesign(next, proposal, resolvedBrand)
      setDesign(resolved)
      writeDesign(proposalId, resolved)
    },
    [proposalId, proposal, resolvedBrand],
  )

  const patch = useCallback(
    (path, value) => {
      update(patchDesign(design, path, value))
    },
    [design, update],
  )

  const applyTheme = useCallback(
    (themeId) => {
      update(applyThemeId(design, themeId))
    },
    [design, update],
  )

  const cssVars = useMemo(() => tokensToCssVars(design), [design])

  const value = useMemo(
    () => ({
      design,
      tokens: design,
      cssVars,
      patch,
      update,
      applyTheme,
    }),
    [design, cssVars, patch, update, applyTheme],
  )

  return (
    <ProposalThemeContext.Provider value={value}>
      {children}
    </ProposalThemeContext.Provider>
  )
}

const FALLBACK = {
  design: makeTokens(),
  tokens: makeTokens(),
  cssVars: tokensToCssVars(makeTokens()),
  patch: () => {},
  update: () => {},
  applyTheme: () => {},
}

export function useProposalTheme() {
  return useContext(ProposalThemeContext) ?? FALLBACK
}
