import { Navigate, useParams } from 'react-router'

function ClientShareRedirect() {
  const { token } = useParams()
  if (!token) return <Navigate to="/" replace />
  return <Navigate to={`/p/share/${token}`} replace />
}

export default ClientShareRedirect
