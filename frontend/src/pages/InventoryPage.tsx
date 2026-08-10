import { Navigate } from 'react-router-dom'

/** @deprecated Use /hub/inventory */
export function InventoryPage() {
  return <Navigate to="/hub/inventory" replace />
}
