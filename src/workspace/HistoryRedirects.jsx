import { Navigate, useParams } from 'react-router'
import { PATH, proposalEditPath, proposalPath } from './paths.js'

/**
 * Compatibility redirects from the former `/history` routes.
 *
 * The Proposal Engine is unchanged; only the studio path is now `/proposals`.
 */

export function HistoryIndexRedirect() {
  return <Navigate to={PATH.PROPOSALS} replace />
}

export function HistoryDetailRedirect() {
  const { id } = useParams()
  return <Navigate to={proposalPath(id)} replace />
}

export function HistoryEditRedirect() {
  const { id } = useParams()
  return <Navigate to={proposalEditPath(id)} replace />
}
