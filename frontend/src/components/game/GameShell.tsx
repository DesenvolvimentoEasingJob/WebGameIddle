import { useMemo } from 'react'
import { Outlet } from 'react-router-dom'
import { CharacterSidebar } from './CharacterSidebar'
import { CombatDock } from './CombatDock'
import { UniqueDropModal } from './UniqueDropModal'
import { SupernaturalEventOverlay } from './SupernaturalEventOverlay'
import { resolveFloorBackgroundUrl } from '../../game/floorAssets'
import { useGameSession } from '../../game/GameSessionContext'

export function GameShell() {
  const {
    error,
    state,
    uniqueAnnounce,
    uniqueAnnounceRemaining,
    dismissUniqueAnnounce,
    supernaturalEvent,
  } = useGameSession()

  const floorBgUrl = useMemo(() => {
    if (!state?.inTower) return null
    const fromState = resolveFloorBackgroundUrl(state.floorBackground)
    if (fromState) return fromState
    const nn = String(state.floor).padStart(2, '0')
    return resolveFloorBackgroundUrl(`/api/assets/floors/floor-${nn}.png`)
  }, [state])

  return (
    <div className="game-shell">
      <CharacterSidebar />
      <div className={`game-shell__main${floorBgUrl ? ' game-shell__main--with-bg' : ''}`}>
        {floorBgUrl ? (
          <img
            className="game-shell__main-bg"
            src={floorBgUrl}
            alt=""
            aria-hidden
            decoding="async"
          />
        ) : null}
        <div className="game-shell__main-inner">
          {error ? <p className="form-error game-shell__error">{error}</p> : null}
          <Outlet />
        </div>
      </div>
      <CombatDock />
      {supernaturalEvent ? <SupernaturalEventOverlay /> : null}
      {uniqueAnnounce ? (
        <UniqueDropModal
          item={uniqueAnnounce}
          remaining={uniqueAnnounceRemaining}
          onClose={dismissUniqueAnnounce}
        />
      ) : null}
    </div>
  )
}
