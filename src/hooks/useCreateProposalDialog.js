import { useContext } from 'react'
import { CreateProposalContext } from '../components/CreateProposal/createProposalState.js'

export function useCreateProposalDialog() {
  const value = useContext(CreateProposalContext)

  if (!value) {
    throw new Error('useCreateProposalDialog must be used within CreateProposalProvider.')
  }

  return value
}
