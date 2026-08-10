import { useEffect, useMemo, useRef } from 'react'
import { resolveFloorBackgroundUrl } from '../../game/floorAssets'
import { useGameSession } from '../../game/GameSessionContext'
import type { CombatEnemy, EncounterMonster } from '../../types/api'
import { MonsterCombatSprite } from './MonsterCombatSprite'

type ArenaEnemy = {
  slot: number
  name: string
  alive: boolean
  sprite: string | null
  idle: EncounterMonster['idleAnimation']
  width: number | null
  height: number | null
}

export function CombatDock() {
  const {
    state,
    playing,
    log,
    floaters,
    motions,
    flash,
    flashSlot,
    focusedEnemySlot,
    enemies,
    playerHp,
    playerMaxHp,
  } = useGameSession()
  const logRef = useRef<HTMLDivElement>(null)

  const playerMotion = useMemo(() => pickMotion(motions, 'player', null), [motions])
  const fallbackEnemyMotion = useMemo(() => pickMotion(motions, 'enemy', 0), [motions])

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [log])

  const playerName = state?.characterName ?? 'Herói'
  const inTower = Boolean(state?.inTower)
  const encounterMonsters = state?.roomEncounter?.monsters ?? []

  const arenaEnemies: ArenaEnemy[] = useMemo(() => {
    if (encounterMonsters.length > 0) {
      return encounterMonsters.map((m, slot) => {
        const live = enemies.find((e) => e.slot === slot)
        return {
          slot,
          name: live?.name ?? m.name,
          alive: live ? live.alive : true,
          sprite: m.sprite,
          idle: m.idleAnimation ?? null,
          width: readPresentationSize(m, 'width'),
          height: readPresentationSize(m, 'height'),
        }
      })
    }
    return enemies.map((e) => ({
      slot: e.slot,
      name: e.name,
      alive: e.alive,
      sprite: null,
      idle: null,
      width: null,
      height: null,
    }))
  }, [encounterMonsters, enemies])

  const enemyCount = arenaEnemies.length
  const anyAlive = arenaEnemies.some((e) => e.alive)
  const focusedEnemy = pickFocusedEnemy(enemies, focusedEnemySlot)
  const focusedArena =
    focusedEnemy != null
      ? arenaEnemies.find((e) => e.slot === focusedEnemy.slot) ?? null
      : arenaEnemies.find((e) => e.alive) ?? arenaEnemies[0] ?? null

  const status = !inTower
    ? 'Fora da torre'
    : playing
      ? 'Em combate'
      : state?.autoClimb
        ? 'Auto-subida ativa'
        : 'Aguardando ordem'

  const floorBgUrl = useMemo(() => {
    if (!inTower || !state) return null
    const fromState = resolveFloorBackgroundUrl(state.floorBackground)
    if (fromState) return fromState
    // Fallback se o state antigo não trouxer floorBackground.
    const nn = String(state.floor).padStart(2, '0')
    return resolveFloorBackgroundUrl(`/api/assets/floors/floor-${nn}.png`)
  }, [inTower, state])

  return (
    <section className="combat-dock" aria-label="Combate">
      <div
        className={`tower__stage combat-dock__stage${floorBgUrl ? ' combat-dock__stage--with-bg' : ''}`}
      >
        {floorBgUrl ? (
          <img
            className="combat-dock__stage-bg"
            src={floorBgUrl}
            alt=""
            aria-hidden
            decoding="async"
          />
        ) : null}
        <aside className="combat-dock__side combat-dock__side--player" aria-label="HP do herói">
          <CombatHpBar current={playerHp} max={playerMaxHp} align="left" />
          <div className="combat-dock__side-info">
            <strong className="combat-dock__side-name">{playerName}</strong>
            {state ? (
              <span className="combat-dock__side-meta">Nv. {state.level}</span>
            ) : null}
          </div>
        </aside>

        <div
          className={`combat-dock__arena combat-dock__arena--n${Math.min(4, Math.max(1, enemyCount || 1))}`}
          aria-hidden={!inTower}
        >
          <div
            className={[
              'tower__fighter',
              'tower__fighter--player',
              flash === 'player' ? 'tower__fighter--flash' : '',
              playerMotion ? `tower__fighter--${playerMotion.kind}` : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="tower__sprite" aria-hidden />
          </div>
          <div className="combat-dock__enemies" aria-hidden>
            {inTower && enemyCount > 0 ? (
              arenaEnemies.map((enemy, index) => {
                const isFocused = focusedArena?.slot === enemy.slot
                const isFlashing = flash === 'enemy' && flashSlot === enemy.slot
                const enemyMotion = pickMotion(motions, 'enemy', enemy.slot)
                return (
                  <div
                    key={enemy.slot}
                    className={[
                      'tower__fighter',
                      'tower__fighter--enemy',
                      isFlashing ? 'tower__fighter--flash' : '',
                      isFocused ? 'tower__fighter--focused' : '',
                      enemy.alive ? '' : 'tower__fighter--dead',
                      enemyMotion ? `tower__fighter--${enemyMotion.kind}` : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{ zIndex: isFocused ? 10 : index + 1 }}
                  >
                    <MonsterCombatSprite
                      sprite={enemy.sprite}
                      idle={enemy.idle}
                      width={enemy.width}
                      height={enemy.height}
                      dead={!enemy.alive}
                    />
                  </div>
                )
              })
            ) : (
              <div
                className={[
                  'tower__fighter',
                  'tower__fighter--enemy',
                  anyAlive ? '' : 'tower__fighter--dead',
                  fallbackEnemyMotion ? `tower__fighter--${fallbackEnemyMotion.kind}` : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="tower__sprite tower__sprite--enemy" aria-hidden />
              </div>
            )}
          </div>
          <div className="tower__floaters" aria-hidden>
            {floaters.map((f) => (
              <span
                key={f.id}
                className={[
                  'tower__floater',
                  `tower__floater--${f.side}`,
                  f.slot != null ? `tower__floater--slot-${f.slot}` : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {f.text}
              </span>
            ))}
          </div>
        </div>

        <aside className="combat-dock__side combat-dock__side--enemy" aria-label="HP do inimigo">
          {inTower && focusedEnemy ? (
            <>
              <CombatHpBar current={focusedEnemy.hp} max={focusedEnemy.maxHp} align="right" />
              <div className="combat-dock__side-info combat-dock__side-info--enemy">
                <strong className="combat-dock__side-name">{focusedEnemy.name}</strong>
                <span className="combat-dock__side-meta">
                  {focusedEnemy.alive ? 'Alvo' : 'Derrotado'}
                  {enemyCount > 1 ? ` · ${focusedEnemy.slot + 1}/${enemyCount}` : ''}
                </span>
              </div>
            </>
          ) : inTower && focusedArena ? (
            <>
              <CombatHpBar current={null} max={null} align="right" />
              <div className="combat-dock__side-info combat-dock__side-info--enemy">
                <strong className="combat-dock__side-name">{focusedArena.name}</strong>
                <span className="combat-dock__side-meta">Pronto</span>
              </div>
            </>
          ) : (
            <>
              <CombatHpBar current={null} max={null} align="right" />
              <div className="combat-dock__side-info combat-dock__side-info--enemy">
                <strong className="combat-dock__side-name">—</strong>
                <span className="combat-dock__side-meta">Sem inimigo</span>
              </div>
            </>
          )}
          {inTower && state?.floorName ? (
            <span className="combat-dock__side-meta combat-dock__side-meta--floor">
              {state.floorName}
              {state.room === 10 ? ' · Chefe' : ` · Sala ${state.room}`}
            </span>
          ) : null}
        </aside>
      </div>

      <div className="combat-dock__log-wrap">
        <div className="combat-dock__log tower__log" aria-live="polite" ref={logRef}>
          <div className="combat-dock__log-title">Eventos</div>
          {log.length === 0 ? (
            <div className="combat-dock__log-empty">Sem eventos ainda.</div>
          ) : (
            log.map((line, i) => <div key={`${i}-${line}`}>{line}</div>)
          )}
        </div>
      </div>

      <div className="combat-dock__status" aria-live="polite">
        <span className={`combat-dock__badge${playing ? ' combat-dock__badge--active' : ''}`}>
          {status}
        </span>
        {inTower && state ? (
          <span className="combat-dock__status-meta">
            Andar {state.floor} · Sala {state.room === 10 ? 'Chefe' : `${state.room}/9`} · Auto{' '}
            {state.autoClimb ? 'ON' : 'OFF'}
            {enemyCount > 1 ? ` · Grupo ×${enemyCount}` : ''}
          </span>
        ) : (
          <span className="combat-dock__status-meta">
            Abra o menu Torre para entrar e iniciar a subida.
          </span>
        )}
      </div>
    </section>
  )
}

function readPresentationSize(
  monster: EncounterMonster,
  key: 'width' | 'height',
): number | null {
  const raw = monster[key]
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.round(raw)
  return null
}

function pickFocusedEnemy(enemies: CombatEnemy[], focusedSlot: number | null): CombatEnemy | null {
  if (enemies.length === 0) return null
  if (focusedSlot != null) {
    const match = enemies.find((e) => e.slot === focusedSlot)
    if (match) return match
  }
  return enemies.find((e) => e.alive) ?? enemies[0] ?? null
}

function pickMotion(
  motions: { side: 'player' | 'enemy'; slot: number | null; kind: string }[],
  side: 'player' | 'enemy',
  slot: number | null,
) {
  // Prefer die > strike > hurt when several overlap on the same fighter.
  const rank = (kind: string) => (kind === 'die' ? 3 : kind === 'strike' ? 2 : 1)
  let best: (typeof motions)[number] | null = null
  for (const m of motions) {
    if (m.side !== side) continue
    if (side === 'enemy' && (m.slot ?? 0) !== (slot ?? 0)) continue
    if (!best || rank(m.kind) > rank(best.kind)) best = m
  }
  return best
}

function CombatHpBar({
  current,
  max,
  align,
}: {
  current: number | null
  max: number | null
  align: 'left' | 'right'
}) {
  const pct = max != null && max > 0 ? Math.min(100, Math.round(((current ?? 0) / max) * 100)) : 0
  const label =
    current == null || max == null ? '—' : `${Math.round(current)}/${Math.round(max)}`

  return (
    <div className={`combat-dock__hp combat-dock__hp--${align}`} title={label}>
      <span className="combat-dock__hp-label">{label}</span>
      <div className="combat-dock__hp-track">
        <div className="combat-dock__hp-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
