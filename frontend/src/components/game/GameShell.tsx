import { Outlet } from 'react-router-dom'
import { CharacterSidebar } from './CharacterSidebar'
import { CombatDock } from './CombatDock'
import { useGameSession } from '../../game/GameSessionContext'

export function GameShell() {
  const { error } = useGameSession()

  return (
    <div className="game-shell">
      <CharacterSidebar />
      <div className="game-shell__main">
        {error ? <p className="form-error game-shell__error">{error}</p> : null}
        <Outlet />
      </div>
      <CombatDock />
    </div>
  )
}
