import { createContext, useContext } from 'react'

export const LivingSessionContext = createContext(null)

export function useLivingSession() {
  return useContext(LivingSessionContext)
}

export function useLivingSessionOptional() {
  return useContext(LivingSessionContext)
}
