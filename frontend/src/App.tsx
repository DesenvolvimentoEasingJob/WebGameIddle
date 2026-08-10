import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { CreateFlowProvider } from './auth/CreateFlowContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { RaceSelectPage } from './pages/RaceSelectPage'
import { ClassSelectPage } from './pages/ClassSelectPage'
import { HubPage } from './pages/HubPage'
import { StatusPanel } from './pages/panels/StatusPanel'
import { InventoryPanel } from './pages/panels/InventoryPanel'
import { TowerPanel } from './pages/panels/TowerPanel'
import { MarketPanel } from './pages/panels/MarketPanel'
import { TrainingPanel } from './pages/panels/TrainingPanel'
import { RankingsPanel } from './pages/panels/RankingsPanel'

export default function App() {
  return (
    <AuthProvider>
      <CreateFlowProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/create/race"
            element={
              <ProtectedRoute>
                <RaceSelectPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/create/class"
            element={
              <ProtectedRoute>
                <ClassSelectPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hub"
            element={
              <ProtectedRoute>
                <HubPage />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="status" replace />} />
            <Route path="status" element={<StatusPanel />} />
            <Route path="inventory" element={<InventoryPanel />} />
            <Route path="tower" element={<TowerPanel />} />
            <Route path="market" element={<MarketPanel />} />
            <Route path="training" element={<TrainingPanel />} />
            <Route path="rankings" element={<RankingsPanel />} />
          </Route>
          <Route path="/tower" element={<Navigate to="/hub/tower" replace />} />
          <Route path="/inventory" element={<Navigate to="/hub/inventory" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </CreateFlowProvider>
    </AuthProvider>
  )
}
