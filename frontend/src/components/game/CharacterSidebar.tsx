import { NavLink } from 'react-router-dom'
import type { CharacterStats } from '../../types/api'
import { useAuth } from '../../auth/AuthContext'
import { useGameSession } from '../../game/GameSessionContext'

function pickStat(stats: CharacterStats | null, keys: string[]) {
  if (!stats) return null
  for (const key of keys) {
    const found = Object.entries(stats).find(([k]) => k.toLowerCase() === key.toLowerCase())
    if (found) return found[1]
  }
  return null
}

function formatNum(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—'
  return Math.round(n).toLocaleString('pt-BR')
}

export function CharacterSidebar() {
  const { user, logout } = useAuth()
  const { state, skyCoin, character, stats, playerHp, playerMaxHp, hpRegenPerSec } = useGameSession()

  const level = state?.level ?? character?.level ?? 0
  const xp = state?.xp ?? character?.xp ?? 0
  const xpToNext = state?.xpToNextLevel ?? character?.xpToNextLevel ?? null
  const coins = skyCoin ?? character?.skyCoin ?? 0
  const name = state?.characterName ?? character?.name ?? '…'
  const hp = playerHp ?? character?.currentHp ?? null
  const hpMax = playerMaxHp ?? character?.maxHp ?? pickStat(stats, ['hpBase', 'maxHp', 'hp'])
  const regenRate = hpRegenPerSec || character?.hpRegenPerSec || 0
  const regenPerSecHp = regenRate > 0 ? regenRate : null
  const mana = pickStat(stats, ['mpBase', 'maxMana', 'mp', 'mana'])
  const atk = pickStat(stats, ['dmgBase', 'atk', 'attack'])
  const def = pickStat(stats, ['defBase', 'def', 'defense', 'armor'])

  return (
    <aside className="game-sidebar">
      <div className="game-sidebar__profile">
        <div className="game-sidebar__avatar" aria-hidden />
        <div className="game-sidebar__identity">
          <strong>{name}</strong>
          <span>
            {character ? `${character.raceId} · ${character.classId}` : 'Carregando…'}
          </span>
          <span className="game-sidebar__level">Nv. {level}</span>
        </div>
      </div>

      <nav className="game-sidebar__nav" aria-label="Menu do jogo">
        <NavLink to="/hub/status" className={({ isActive }) => navClass(isActive)}>
          Status
        </NavLink>
        <NavLink to="/hub/inventory" className={({ isActive }) => navClass(isActive)}>
          Inventário
        </NavLink>
        <NavLink to="/hub/tower" className={({ isActive }) => navClass(isActive)}>
          Torre
        </NavLink>
        <NavLink to="/hub/market" className={({ isActive }) => navClass(isActive)}>
          Mercado
        </NavLink>
        <NavLink to="/hub/training" className={({ isActive }) => navClass(isActive)}>
          Treino
        </NavLink>
        <NavLink to="/hub/rankings" className={({ isActive }) => navClass(isActive)}>
          Rankings
        </NavLink>
      </nav>

      {state?.inTower ? (
        <div className="game-sidebar__tower-info">
          <div className="game-sidebar__section-label">Torre infinita</div>
          <div>
            Andar: {state.floor}
            {state.floorName ? ` — ${state.floorName}` : ''}
          </div>
          <div>Sala: {state.room === 10 ? 'Chefe' : `${state.room}/9`}</div>
          <FloorPicker />
        </div>
      ) : null}

      <div className="game-sidebar__bars">
        <StatBar label="HP" value={hp} max={hpMax} tone="hp" />
        {regenPerSecHp != null && regenPerSecHp > 0 ? (
          <div className="game-sidebar__regen">
            +{regenPerSecHp.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} HP/s
          </div>
        ) : null}
        <StatBar label="Mana" value={mana} max={mana} tone="mana" />
        <StatBar label="XP" value={xp} max={xpToNext} tone="xp" />
      </div>

      <div className="game-sidebar__stats">
        <div>
          Ataque <strong>{formatNum(atk)}</strong>
        </div>
        <div>
          Defesa <strong>{formatNum(def)}</strong>
        </div>
        <div>
          SkyCoin <strong>{formatNum(coins)}</strong>
        </div>
      </div>

      <button type="button" className="btn btn--ghost game-sidebar__logout" onClick={logout}>
        Sair ({user?.username})
      </button>
    </aside>
  )
}

function navClass(isActive: boolean) {
  return `game-sidebar__link${isActive ? ' game-sidebar__link--active' : ''}`
}

/** Andares já superados (via desafio pago do chefe) podem ser revisitados. */
function FloorPicker() {
  const { state, floors, busy, playing, enter } = useGameSession()
  if (!state) return null

  const maxFloor = state.maxUnlockedFloor
  const unlocked = floors.length
    ? floors.filter((f) => f.number <= maxFloor)
    : Array.from({ length: maxFloor }, (_, i) => ({ number: i + 1, name: `Andar ${i + 1}` }))

  return (
    <div className="game-sidebar__floors">
      <div className="game-sidebar__section-label">Andares liberados</div>
      <div className="game-sidebar__floor-list" role="list">
        {unlocked.map((floor) => {
          const current = floor.number === state.floor
          return (
            <button
              key={floor.number}
              type="button"
              role="listitem"
              className={`game-sidebar__floor${current ? ' game-sidebar__floor--current' : ''}`}
              disabled={current || busy || playing}
              title={floor.name}
              onClick={() => void enter(floor.number)}
            >
              {floor.number}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StatBar({
  label,
  value,
  max,
  tone,
}: {
  label: string
  value: number | null
  max: number | null
  tone: 'hp' | 'mana' | 'xp'
}) {
  // Máximo desconhecido (ainda carregando) mostra barra vazia, não cheia.
  const pct = max != null && max > 0 ? Math.min(100, Math.round(((value ?? 0) / max) * 100)) : 0
  return (
    <div className="stat-bar">
      <div className="stat-bar__label">
        <span>{label}</span>
        <span>
          {value == null ? '—' : `${formatNum(value)}${max != null ? `/${formatNum(max)}` : ''}`}
        </span>
      </div>
      <div className="stat-bar__track">
        <div className={`stat-bar__fill stat-bar__fill--${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
