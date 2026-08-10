import { Navigate } from 'react-router-dom'

/** @deprecated Use /hub/tower — kept so old imports do not break builds. */
export function TowerPage() {
  return <Navigate to="/hub/tower" replace />
}
