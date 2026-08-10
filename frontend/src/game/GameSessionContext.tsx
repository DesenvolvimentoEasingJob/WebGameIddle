import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  enterTower,
  fetchFloors,
  fetchTowerState,
  moveRoom,
  setAutoClimb,
  startBattle,
  challengeBoss,
  challengeRegistry,
  fetchOwnership,
  type FloorSummary,
} from '../api/tower'
import { fetchBalance } from '../api/economy'
import { fetchMyCharacter, fetchMyStats } from '../api/content'
import { ApiError } from '../api/client'
import type {
  BattleEvent,
  BattleResult,
  CharacterStats,
  CharacterSummary,
  CombatEnemy,
  TowerState,
} from '../types/api'
import {
  COMBAT_TIMING,
  createPlaybackClock,
  peekNextEnemyTargetSlot,
  planPlayback,
  runBeatPlan,
  type MotionCue,
  type PlaybackAction,
} from './combatPlayback'

export type CombatFloater = {
  id: number
  text: string
  side: 'left' | 'right'
  slot: number | null
}

export type FighterMotion = MotionCue & { id: number }

type GameSessionValue = {
  state: TowerState | null
  skyCoin: number | null
  /** Resumo do personagem (nome, raça, classe, baseStats). Revalida só por evento. */
  character: CharacterSummary | null
  /** Atributos calculados. Revalida só por evento (level up, treino, equip). */
  stats: CharacterStats | null
  /** true quando GET /me devolve 404 (personagem ainda não criado) */
  characterMissing: boolean
  /** Revalida personagem + stats. Chamar em eventos que os alteram, não por tick. */
  refreshCharacter: () => Promise<void>
  error: string | null
  busy: boolean
  playing: boolean
  log: string[]
  floaters: CombatFloater[]
  motions: FighterMotion[]
  flash: 'player' | 'enemy' | null
  flashSlot: number | null
  /** Slot do inimigo sob foco (HP/status à direita). Persiste até outro ser atacado. */
  focusedEnemySlot: number | null
  enemies: CombatEnemy[]
  playerHp: number | null
  playerMaxHp: number | null
  /** HP bruto por segundo. Front anima localmente. */
  hpRegenPerSec: number
  floors: FloorSummary[]
  refresh: () => Promise<void>
  enter: (floor?: number) => Promise<void>
  toggleAuto: () => Promise<void>
  moveToRoom: (room: number) => Promise<void>
  battle: () => Promise<void>
  challenge: () => Promise<void>
  registerFloor: () => Promise<void>
  skipAnimation: () => void
  clearError: () => void
  ownership: { owned: boolean; ownerUsername: string | null } | null
}

const GameSessionContext = createContext<GameSessionValue | null>(null)

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function motionKey(m: MotionCue): string {
  return `${m.side}:${m.slot ?? 'x'}:${m.kind}`
}

export function GameSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TowerState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [floaters, setFloaters] = useState<CombatFloater[]>([])
  const [motions, setMotions] = useState<FighterMotion[]>([])
  const [flash, setFlash] = useState<'player' | 'enemy' | null>(null)
  const [flashSlot, setFlashSlot] = useState<number | null>(null)
  const [focusedEnemySlot, setFocusedEnemySlot] = useState<number | null>(null)
  const [skyCoin, setSkyCoin] = useState<number | null>(null)
  const [character, setCharacter] = useState<CharacterSummary | null>(null)
  const [stats, setStats] = useState<CharacterStats | null>(null)
  const [characterMissing, setCharacterMissing] = useState(false)
  const [enemies, setEnemies] = useState<CombatEnemy[]>([])
  const [playerHp, setPlayerHp] = useState<number | null>(null)
  const [playerMaxHp, setPlayerMaxHp] = useState<number | null>(null)
  const [hpRegenPerSec, setHpRegenPerSec] = useState(0)
  const [ownership, setOwnership] = useState<{ owned: boolean; ownerUsername: string | null } | null>(
    null,
  )
  const [floors, setFloors] = useState<FloorSummary[]>([])
  const skipRef = useRef(false)
  const stopAutoRef = useRef(false)
  const floaterId = useRef(0)
  const motionId = useRef(0)
  const playbackClockRef = useRef<ReturnType<typeof createPlaybackClock> | null>(null)
  const prevLevelRef = useRef<number | null>(null)
  const playingRef = useRef(false)
  const playerHpRef = useRef<number | null>(null)
  const playerMaxHpRef = useRef<number | null>(null)
  const hpRegenPerSecRef = useRef(0)

  useEffect(() => {
    playingRef.current = playing
  }, [playing])

  useEffect(() => {
    playerHpRef.current = playerHp
  }, [playerHp])

  useEffect(() => {
    playerMaxHpRef.current = playerMaxHp
  }, [playerMaxHp])

  useEffect(() => {
    hpRegenPerSecRef.current = hpRegenPerSec
  }, [hpRegenPerSec])

  /** Snap HP/máximo/taxa ao valor do server — única fonte de verdade em sync. */
  const syncPlayerVitals = useCallback(
    (patch: { hp?: number | null; maxHp?: number | null; regenPerSec?: number | null }) => {
      if (patch.maxHp != null) {
        setPlayerMaxHp(patch.maxHp)
        playerMaxHpRef.current = patch.maxHp
      }
      if (patch.hp != null) {
        setPlayerHp(patch.hp)
        playerHpRef.current = patch.hp
      }
      if (patch.regenPerSec != null) {
        setHpRegenPerSec(patch.regenPerSec)
        hpRegenPerSecRef.current = patch.regenPerSec
      }
    },
    [],
  )

  // Regen fluido sempre (em e fora de combate). Dano aplica por outro caminho
  // (hits); HP é um valor compartilhado — os dois sistemas não se bloqueiam.
  useEffect(() => {
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000)
      last = now
      const cur = playerHpRef.current
      const max = playerMaxHpRef.current
      const rate = hpRegenPerSecRef.current
      if (cur != null && max != null && max > 0 && rate > 0 && cur > 0 && cur < max) {
        const next = Math.min(max, cur + rate * dt)
        if (next - cur > 0.01) {
          playerHpRef.current = next
          setPlayerHp(next)
        } else if (next >= max && cur < max) {
          playerHpRef.current = max
          setPlayerHp(max)
        }
      }
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const [s, bal] = await Promise.all([fetchTowerState(), fetchBalance()])
      setState(s)
      setSkyCoin(bal.skyCoin)
      syncPlayerVitals({
        hp: s.currentHp,
        maxHp: s.maxHp,
        regenPerSec: s.hpRegenPerSec,
      })
      if (s.inTower) {
        const o = await fetchOwnership(s.floor)
        setOwnership({ owned: o.owned, ownerUsername: o.ownerUsername })
      } else {
        setOwnership(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro')
    }
  }, [syncPlayerVitals])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Personagem e stats calculados mudam só em eventos (level up, treino, equip),
  // não a cada tick de combate. Buscamos uma vez e revalidamos sob demanda.
  const refreshCharacter = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([fetchMyCharacter(), fetchMyStats()])
      setCharacter(c)
      setStats(s)
      setCharacterMissing(false)
      syncPlayerVitals({
        hp: c.currentHp,
        maxHp: c.maxHp,
        regenPerSec: c.hpRegenPerSec,
      })
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setCharacterMissing(true)
        return
      }
      setError(err instanceof Error ? err.message : 'Erro ao carregar personagem')
    }
  }, [syncPlayerVitals])

  useEffect(() => {
    void refreshCharacter()
  }, [refreshCharacter])

  // Level só muda no server ao subir de nível → gatilho certo para revalidar stats.
  const level = state?.level ?? null
  useEffect(() => {
    if (level == null) return
    if (prevLevelRef.current != null && level !== prevLevelRef.current) {
      void refreshCharacter()
    }
    prevLevelRef.current = level
  }, [level, refreshCharacter])

  useEffect(() => {
    fetchFloors()
      .then(setFloors)
      .catch(() => setFloors([]))
  }, [])

  const clearEnemies = useCallback(() => {
    setEnemies([])
    setFlashSlot(null)
    setFocusedEnemySlot(null)
  }, [])

  const upsertEnemy = useCallback((slot: number, patch: Partial<CombatEnemy> & Pick<CombatEnemy, 'slot'>) => {
    setEnemies((prev) => {
      const idx = prev.findIndex((e) => e.slot === slot)
      if (idx < 0) {
        const next: CombatEnemy = {
          slot,
          name: patch.name ?? `Inimigo ${slot + 1}`,
          hp: patch.hp ?? 0,
          maxHp: patch.maxHp ?? patch.hp ?? 0,
          alive: patch.alive ?? true,
        }
        return [...prev, next].sort((a, b) => a.slot - b.slot)
      }
      const copy = [...prev]
      copy[idx] = { ...copy[idx], ...patch }
      return copy
    })
  }, [])

  const applyBattleEvent = useCallback(
    (ev: BattleEvent, eventIndex: number, events: BattleEvent[]) => {
      if (ev.message) {
        setLog((prev) => [...prev.slice(-40), ev.message!])
      }

      if (ev.type === 'vitals') {
        if (ev.actor === 'player') {
          syncPlayerVitals({
            hp: ev.hpAfter ?? undefined,
            maxHp: ev.maxHp ?? undefined,
          })
        } else if (ev.actor === 'enemy') {
          const slot = ev.slot ?? 0
          upsertEnemy(slot, {
            slot,
            name: ev.message ?? undefined,
            hp: ev.hpAfter ?? 0,
            maxHp: ev.maxHp ?? ev.hpAfter ?? 0,
            alive: (ev.hpAfter ?? 0) > 0,
          })
        }
      }

      // Player: dano só subtrai da HP local (regen continua no rAF).
      // Inimigo: ainda usa hpAfter do server.
      // regen do server: só log — a barra já sobe pelo tick local.
      if (ev.type === 'revive' && ev.hpAfter != null) {
        syncPlayerVitals({
          hp: ev.hpAfter,
          maxHp: ev.maxHp ?? undefined,
        })
      }

      if ((ev.type === 'hit' || ev.type === 'crit') && ev.target === 'player' && ev.amount != null) {
        if (ev.maxHp != null) {
          setPlayerMaxHp(ev.maxHp)
          playerMaxHpRef.current = ev.maxHp
        }
        const cur = playerHpRef.current ?? ev.hpAfter ?? 0
        const next = Math.max(0, cur - ev.amount)
        playerHpRef.current = next
        setPlayerHp(next)
      }

      if ((ev.type === 'hit' || ev.type === 'crit') && ev.target === 'enemy' && ev.hpAfter != null) {
        const slot = ev.slot ?? 0
        upsertEnemy(slot, {
          slot,
          hp: ev.hpAfter,
          maxHp: ev.maxHp ?? undefined,
          alive: ev.hpAfter > 0,
        })
        if (ev.hpAfter <= 0) {
          const next = peekNextEnemyTargetSlot(events, eventIndex)
          setFocusedEnemySlot(next ?? slot)
        } else {
          setFocusedEnemySlot(slot)
        }
      }

      if (ev.type === 'death' && ev.actor === 'enemy') {
        const slot = ev.slot ?? 0
        upsertEnemy(slot, { slot, hp: 0, alive: false })
        const next = peekNextEnemyTargetSlot(events, eventIndex)
        if (next != null) setFocusedEnemySlot(next)
      }
      if (ev.type === 'death' && ev.actor === 'player') {
        syncPlayerVitals({ hp: 0 })
      }
    },
    [upsertEnemy, syncPlayerVitals],
  )

  const playEvents = useCallback(
    async (events: BattleEvent[]) => {
      setPlaying(true)
      skipRef.current = false
      setMotions([])
      setFloaters([])
      setFlash(null)
      setFlashSlot(null)

      const openingTarget = peekNextEnemyTargetSlot(events, -1)
      if (openingTarget != null) setFocusedEnemySlot(openingTarget)

      const clock = createPlaybackClock(() => skipRef.current)
      playbackClockRef.current = clock
      const { plans } = planPlayback(events)

      const handleAction = (action: PlaybackAction) => {
        if (skipRef.current) return

        if (action.type === 'apply') {
          applyBattleEvent(action.event, action.eventIndex, events)
          return
        }

        if (action.type === 'motion') {
          const id = ++motionId.current
          const entry: FighterMotion = { id, ...action.motion }
          setMotions((prev) => [...prev, entry])
          if (action.motion.kind === 'hurt' || action.motion.kind === 'die') {
            setFlash(action.motion.side)
            setFlashSlot(action.motion.side === 'enemy' ? (action.motion.slot ?? 0) : null)
            if (action.motion.side === 'enemy' && action.motion.slot != null) {
              setFocusedEnemySlot(action.motion.slot)
            }
          }
          return
        }

        if (action.type === 'clearMotion') {
          const key = motionKey(action.motion)
          setMotions((prev) => {
            const idx = prev.findIndex((m) => motionKey(m) === key)
            if (idx < 0) return prev
            return prev.filter((_, i) => i !== idx)
          })
          if (action.motion.kind === 'hurt' || action.motion.kind === 'die') {
            setFlash(null)
            setFlashSlot(null)
          }
          return
        }

        if (action.type === 'floater') {
          const id = ++floaterId.current
          setFloaters((f) => [
            ...f,
            {
              id,
              text: action.floater.text,
              side: action.floater.side,
              slot: action.floater.slot,
            },
          ])
          if (action.floater.side === 'right' && action.floater.slot != null) {
            setFocusedEnemySlot(action.floater.slot)
          }
          clock.schedule(COMBAT_TIMING.floaterClearMs, () => {
            setFloaters((f) => f.filter((x) => x.id !== id))
          })
        }
      }

      try {
        for (const plan of plans) {
          if (skipRef.current) break
          await runBeatPlan(plan, clock, () => skipRef.current, handleAction)
        }
      } finally {
        clock.cancel()
        playbackClockRef.current = null
        setMotions([])
        setFlash(null)
        setFlashSlot(null)
        setPlaying(false)
      }
    },
    [applyBattleEvent],
  )

  const enter = useCallback(
    async (floor = 1) => {
      setBusy(true)
      setError(null)
      stopAutoRef.current = true
      try {
        const next = await enterTower(floor)
        setState(next)
        syncPlayerVitals({
          hp: next.currentHp,
          maxHp: next.maxHp,
          regenPerSec: next.hpRegenPerSec,
        })
        clearEnemies()
        setLog([])
        const o = await fetchOwnership(next.floor)
        setOwnership({ owned: o.owned, ownerUsername: o.ownerUsername })
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Falha ao entrar')
      } finally {
        setBusy(false)
      }
    },
    [clearEnemies, syncPlayerVitals],
  )

  const toggleAuto = useCallback(async () => {
    if (!state) return
    const next = !state.autoClimb
    if (!next) stopAutoRef.current = true
    try {
      setState(await setAutoClimb(next))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao alterar auto-subida')
    }
  }, [state])

  const moveToRoom = useCallback(async (room: number) => {
    setBusy(true)
    try {
      setState(await moveRoom(room))
      clearEnemies()
      setLog([])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sala bloqueada')
    } finally {
      setBusy(false)
    }
  }, [clearEnemies])

  const battle = useCallback(async () => {
    setBusy(true)
    setError(null)
    stopAutoRef.current = false
    try {
      let keepGoing = true
      while (keepGoing) {
        clearEnemies()
        const result: BattleResult = await startBattle()
        await playEvents(result.events)
        if (result.state) {
          setState(result.state)
          syncPlayerVitals({
            hp: result.state.currentHp,
            maxHp: result.state.maxHp,
            regenPerSec: result.state.hpRegenPerSec,
          })
        }
        else await refresh()
        if (result.skyCoin != null) setSkyCoin(result.skyCoin)

        keepGoing =
          !stopAutoRef.current &&
          Boolean(result.victory && result.autoAdvanceRoom && result.state?.autoClimb)
        if (keepGoing) {
          clearEnemies()
          await wait(350)
        }
      }
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha na batalha')
      setPlaying(false)
    } finally {
      setBusy(false)
    }
  }, [playEvents, refresh, clearEnemies, syncPlayerVitals])

  const runChallenge = useCallback(
    async (request: () => Promise<BattleResult>) => {
      setBusy(true)
      setError(null)
      stopAutoRef.current = true
      try {
        clearEnemies()
        const result = await request()
        await playEvents(result.events)
        if (result.state) {
          setState(result.state)
          syncPlayerVitals({
            hp: result.state.currentHp,
            maxHp: result.state.maxHp,
            regenPerSec: result.state.hpRegenPerSec,
          })
        }
        if (result.skyCoin != null) setSkyCoin(result.skyCoin)
        await refresh()
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Falha no desafio')
        setPlaying(false)
      } finally {
        setBusy(false)
      }
    },
    [playEvents, refresh, clearEnemies, syncPlayerVitals],
  )

  const challenge = useCallback(() => runChallenge(challengeBoss), [runChallenge])

  const registerFloor = useCallback(() => runChallenge(challengeRegistry), [runChallenge])

  const skipAnimation = useCallback(() => {
    skipRef.current = true
    playbackClockRef.current?.cancel()
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const value = useMemo<GameSessionValue>(
    () => ({
      state,
      skyCoin,
      character,
      stats,
      characterMissing,
      refreshCharacter,
      error,
      busy,
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
      hpRegenPerSec,
      ownership,
      floors,
      refresh,
      enter,
      toggleAuto,
      moveToRoom,
      battle,
      challenge,
      registerFloor,
      skipAnimation,
      clearError,
    }),
    [
      state,
      skyCoin,
      character,
      stats,
      characterMissing,
      refreshCharacter,
      error,
      busy,
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
      hpRegenPerSec,
      ownership,
      floors,
      refresh,
      enter,
      toggleAuto,
      moveToRoom,
      battle,
      challenge,
      registerFloor,
      skipAnimation,
      clearError,
    ],
  )

  return <GameSessionContext.Provider value={value}>{children}</GameSessionContext.Provider>
}

export function useGameSession() {
  const ctx = useContext(GameSessionContext)
  if (!ctx) throw new Error('useGameSession must be used within GameSessionProvider')
  return ctx
}
