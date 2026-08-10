import { NavLink, Outlet } from 'react-router-dom'

const nav = [
  { to: '/', label: 'Home' },
  { to: '/monsters', label: 'Monstros' },
  { to: '/items', label: 'Itens' },
  { to: '/attributes', label: 'Atributos' },
  { to: '/floors', label: 'Andares' },
  { to: '/config', label: 'Config' },
] as const

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand">
          <span className="app-brand__mark">SkySpire</span>
          <span className="app-brand__sub">Content Editor · dev only</span>
        </div>
        <nav className="app-nav" aria-label="Editores">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => (isActive ? 'app-nav__link is-active' : 'app-nav__link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
