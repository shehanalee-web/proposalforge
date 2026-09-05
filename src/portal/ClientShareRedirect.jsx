import { Navigate, useParams } from 'react-router'
import { clientProposalPath } from '../workspace/paths.js'

/**
 * Legacy `/p/share/:token` alias → canonical Living Proposal URL `/p/:token`.
 */
function ClientShareRedirect() {
  const { token } = useParams()
  if (!token) return <Navigate to="/" replace />
  return <Navigate to={clientProposalPath(token)} replace />
}

export default ClientShareRedirect
