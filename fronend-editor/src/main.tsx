import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import App from './App'
import {
  AttributesPage,
  ConfigPage,
  FloorsPage,
  HomePage,
  ItemsPage,
  MonstersPage,
} from './pages/EditorPages'
import './styles/global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<HomePage />} />
          <Route path="monsters" element={<MonstersPage />} />
          <Route path="items" element={<ItemsPage />} />
          <Route path="attributes" element={<AttributesPage />} />
          <Route path="floors" element={<FloorsPage />} />
          <Route path="config" element={<ConfigPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
