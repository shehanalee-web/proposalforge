import { useCallback, useEffect, useMemo, useState } from 'react'
import { LivingSessionContext } from './LivingSessionContext.js'
import { postLivingEngagementEvent } from './clientEvents.js'
import { LIVING_CAPABILITIES, LIVING_EVENT } from './types.js'

async function readJson(response) {
  return response.json().catch(() => ({}))
}

/**
 * Living session client surface.
 *
 * Session identity follows the share token already in `/p/:token`.
 * Internal session ids are never placed in the URL.
 * Selection events persist after a successful decision update.
 *
 * @param {{
 *   shareToken?: string | null,
 *   children: import('react').ReactNode,
 * }} props
 */
export function LivingSessionProvider({ shareToken, children }) {
  const token = String(shareToken ?? '').trim()
  const enabled = Boolean(token && LIVING_CAPABILITIES.livingSession)
  const [session, setSession] = useState(null)
  const [commercialState, setCommercialState] = useState(null)
  const [authoredOffers, setAuthoredOffers] = useState(null)
  const [livingProposal, setLivingProposal] = useState(null)
  const [publication, setPublication] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [ready, setReady] = useState(!enabled)

  useEffect(() => {
    if (!enabled) return undefined

    let cancelled = false

    ;(async () => {
      try {
        const response = await fetch(`/api/living/${encodeURIComponent(token)}`)
        const payload = await readJson(response)
        if (cancelled) return
        if (!response.ok) {
          setError(payload.message || 'Could not load living session.')
          setReady(true)
          return
        }
        setError(null)
        setSession(payload.session ?? null)
        setCommercialState(payload.commercialState ?? null)
        setAuthoredOffers(payload.authoredOffers ?? null)
        setLivingProposal(payload.proposal ?? null)
        setPublication(payload.publication ?? null)
        setReady(true)
      } catch {
        if (cancelled) return
        setError('Could not load living session.')
        setReady(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, token])

  const postDecision = useCallback(
    async (body) => {
      if (!token || !LIVING_CAPABILITIES.selections) return null
      setBusy(true)
      setError(null)
      try {
        const response = await fetch(
          `/api/living/${encodeURIComponent(token)}/decisions`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          },
        )
        const payload = await readJson(response)
        if (!response.ok) {
          setError(payload.message || 'Could not update selection.')
          return null
        }
        setSession(payload.session ?? null)
        setCommercialState(payload.commercialState ?? null)
        return payload
      } catch {
        setError('Could not update selection.')
        return null
      } finally {
        setBusy(false)
      }
    },
    [token],
  )

  const selectPackage = useCallback(
    async (packageId) => {
      const payload = await postDecision({ selectedPackageId: packageId })
      if (payload?.session?.selectedPackageId) {
        void postLivingEngagementEvent(token, {
          type: LIVING_EVENT.PACKAGE_SELECTED,
          offerId: payload.session.selectedPackageId,
          sessionId: payload.session.id,
          dedupe: false,
        })
      }
      return payload
    },
    [postDecision, token],
  )

  const selectAlternative = useCallback(
    (alternativeId) => postDecision({ selectedAlternativeId: alternativeId }),
    [postDecision],
  )

  const toggleAddon = useCallback(
    async (addonId) => {
      const payload = await postDecision({ toggleAddonId: addonId })
      if (payload?.session) {
        void postLivingEngagementEvent(token, {
          type: LIVING_EVENT.ADDON_SELECTED,
          offerId: addonId,
          sessionId: payload.session.id,
          metadata: {
            selected: payload.session.selectedAddonIds?.includes(addonId) ? 1 : 0,
          },
          dedupe: false,
        })
      }
      return payload
    },
    [postDecision, token],
  )

  const value = useMemo(
    () => ({
      ready,
      busy,
      error,
      session,
      commercialState,
      authoredOffers,
      livingProposal,
      publication,
      capabilities: LIVING_CAPABILITIES,
      interactive: Boolean(
        token && LIVING_CAPABILITIES.selections && LIVING_CAPABILITIES.livingSession,
      ),
      selectPackage,
      selectAlternative,
      toggleAddon,
    }),
    [
      ready,
      busy,
      error,
      session,
      commercialState,
      authoredOffers,
      livingProposal,
      publication,
      token,
      selectPackage,
      selectAlternative,
      toggleAddon,
    ],
  )

  return (
    <LivingSessionContext.Provider value={value}>
      {children}
    </LivingSessionContext.Provider>
  )
}
