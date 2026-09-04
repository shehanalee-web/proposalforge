import { createContext, useContext, useMemo } from 'react'
import {
  enforceClientReadOnly,
  hasCapability,
  PORTAL_ACTOR,
  resolveClientCapabilities,
} from '../models/portalPermissions.js'
import { getPortalSession } from '../services/portalService.js'

const PortalContext = createContext(null)

export function PortalProvider({ proposal, token, children }) {
  const value = useMemo(() => {
    const session = getPortalSession(proposal, token)
    const capabilities = enforceClientReadOnly(
      session.capabilities ?? resolveClientCapabilities(proposal),
    )
    return {
      actor: PORTAL_ACTOR.CLIENT,
      proposal,
      token: session.token,
      session: { ...session, capabilities },
      capabilities,
      readOnly: true,
      can: (capability) => hasCapability(capabilities, capability),
    }
  }, [proposal, token])

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>
}

export function usePortal() {
  const ctx = useContext(PortalContext)
  if (!ctx) {
    throw new Error('usePortal must be used inside PortalProvider')
  }
  return ctx
}
