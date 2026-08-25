import type { BattleEvent } from '../types/api'

/** Timing tunables for combat choreography (ms) around server atMs. */
export const COMBAT_TIMING = {
  windupMs: 110,
  hitImpactHoldMs: 210,
  critImpactHoldMs: 280,
  deathHoldMs: 260,
  dodgeHoldMs: 180,
  floaterClearMs: 500,
  motionClearMs: 320,
  /** Scale server atMs → wall clock (1 = realtime vs simulated ms). */
  playbackScale: 1,
} as const

export type MotionKind = 'strike' | 'hurt' | 'die'

export type MotionCue = {
  kind: MotionKind
  side: 'player' | 'enemy'
  slot: number | null
}

export type FloaterCue = {
  text: string
  side: 'left' | 'right'
  slot: number | null
}

export type PlaybackAction =
  | { type: 'apply'; event: BattleEvent; eventIndex: number }
  | { type: 'motion'; motion: MotionCue }
  | { type: 'floater'; floater: FloaterCue }
  | { type: 'clearMotion'; motion: MotionCue }

export type TimedAction = {
  atMs: number
  action: PlaybackAction
}

export type BeatPlan = {
  durationMs: number
  actions: TimedAction[]
}

function isCombatSwing(ev: BattleEvent): boolean {
  return ev.type === 'hit' || ev.type === 'crit' || ev.type === 'dodge'
}

function swingHoldMs(ev: BattleEvent): number {
  if (ev.type === 'crit') return COMBAT_TIMING.critImpactHoldMs
  if (ev.type === 'dodge') return COMBAT_TIMING.dodgeHoldMs
  if (ev.type === 'death') return COMBAT_TIMING.deathHoldMs
  return COMBAT_TIMING.hitImpactHoldMs
}

function eventAtMs(ev: BattleEvent): number {
  return Math.max(0, ev.atMs ?? 0)
}

/** Próximo slot inimigo que o player ataca na timeline (após `fromIndex`). */
export function peekNextEnemyTargetSlot(
  events: BattleEvent[],
  fromIndex: number,
): number | null {
  for (let i = fromIndex + 1; i < events.length; i++) {
    const ev = events[i]!
    if (ev.type === 'victory' || ev.type === 'defeat') break
    if ((ev.type === 'hit' || ev.type === 'crit') && ev.target === 'enemy') {
      return ev.slot ?? 0
    }
  }
  return null
}

function pushApply(
  actions: TimedAction[],
  atMs: number,
  event: BattleEvent,
  eventIndex: number,
) {
  actions.push({ atMs, action: { type: 'apply', event, eventIndex } })
}

function pushMotion(actions: TimedAction[], atMs: number, motion: MotionCue) {
  actions.push({ atMs, action: { type: 'motion', motion } })
  actions.push({
    atMs: atMs + COMBAT_TIMING.motionClearMs,
    action: { type: 'clearMotion', motion },
  })
}

function pushFloater(actions: TimedAction[], atMs: number, floater: FloaterCue) {
  actions.push({ atMs, action: { type: 'floater', floater } })
}

function floaterFromSwing(ev: BattleEvent): FloaterCue | null {
  if (ev.amount == null || (ev.type !== 'hit' && ev.type !== 'crit')) return null
  const side = ev.target === 'player' ? 'left' : 'right'
  const text = `${ev.type === 'crit' ? 'CRIT ' : ''}-${ev.amount}`
  const slot = side === 'right' ? (ev.slot ?? 0) : null
  return { text, side, slot }
}

function wallMs(simMs: number): number {
  return Math.round(simMs * COMBAT_TIMING.playbackScale)
}

/**
 * Um núcleo: agenda apply + FX a partir do `atMs` autoritativo do server.
 * Windup cosmético pode começar antes do impacto, sem reordenar hits.
 */
export function planPlayback(events: BattleEvent[]): { plans: BeatPlan[] } {
  const actions: TimedAction[] = []
  const windup = COMBAT_TIMING.windupMs
  let lastImpactEnd = 0

  for (let i = 0; i < events.length; i++) {
    const ev = events[i]!
    const impactAt = wallMs(eventAtMs(ev))

    if (isCombatSwing(ev)) {
      const strikeAt = Math.max(0, impactAt - windup)
      const striker =
        ev.type === 'dodge'
          ? ev.target === 'player'
            ? 'player'
            : ev.target === 'enemy'
              ? 'enemy'
              : null
          : ev.actor === 'player' || ev.actor === 'enemy'
            ? ev.actor
            : null

      if (striker === 'player') {
        pushMotion(actions, strikeAt, { kind: 'strike', side: 'player', slot: null })
      } else if (striker === 'enemy') {
        pushMotion(actions, strikeAt, {
          kind: 'strike',
          side: 'enemy',
          slot: ev.slot ?? 0,
        })
      }

      pushApply(actions, impactAt, ev, i)
      const floater = floaterFromSwing(ev)
      if (floater) pushFloater(actions, impactAt, floater)

      if (ev.type !== 'dodge') {
        if (ev.target === 'enemy') {
          pushMotion(actions, impactAt, {
            kind: 'hurt',
            side: 'enemy',
            slot: ev.slot ?? 0,
          })
        } else if (ev.target === 'player') {
          pushMotion(actions, impactAt, { kind: 'hurt', side: 'player', slot: null })
        }
      }

      lastImpactEnd = Math.max(lastImpactEnd, impactAt + swingHoldMs(ev))
      continue
    }

    if (ev.type === 'death') {
      pushApply(actions, impactAt, ev, i)
      if (ev.actor === 'enemy') {
        pushMotion(actions, impactAt, {
          kind: 'die',
          side: 'enemy',
          slot: ev.slot ?? 0,
        })
      } else if (ev.actor === 'player') {
        pushMotion(actions, impactAt, { kind: 'die', side: 'player', slot: null })
      }
      lastImpactEnd = Math.max(lastImpactEnd, impactAt + COMBAT_TIMING.deathHoldMs)
      continue
    }

    pushApply(actions, impactAt, ev, i)
    lastImpactEnd = Math.max(lastImpactEnd, impactAt)
  }

  const maxAction = actions.reduce((m, a) => Math.max(m, a.atMs), 0)
  const durationMs = Math.max(lastImpactEnd, maxAction)

  return { plans: [{ durationMs, actions }] }
}

export type PlaybackClock = {
  wait: (ms: number) => Promise<void>
  schedule: (ms: number, fn: () => void) => void
  cancel: () => void
}

/** Timers canceláveis para skip mid-playback. */
export function createPlaybackClock(shouldSkip: () => boolean): PlaybackClock {
  const timers = new Set<number>()
  const waitResolvers = new Set<() => void>()

  return {
    wait(ms: number) {
      if (shouldSkip() || ms <= 0) return Promise.resolve()
      return new Promise((resolve) => {
        const finish = () => {
          waitResolvers.delete(finish)
          resolve()
        }
        waitResolvers.add(finish)
        const id = window.setTimeout(() => {
          timers.delete(id)
          finish()
        }, ms)
        timers.add(id)
      })
    },
    schedule(ms: number, fn: () => void) {
      if (shouldSkip()) return
      if (ms <= 0) {
        fn()
        return
      }
      const id = window.setTimeout(() => {
        timers.delete(id)
        if (!shouldSkip()) fn()
      }, ms)
      timers.add(id)
    },
    cancel() {
      for (const id of timers) window.clearTimeout(id)
      timers.clear()
      for (const resolve of waitResolvers) resolve()
      waitResolvers.clear()
    },
  }
}

/**
 * Executa um BeatPlan: agenda ações e espera a duração (ou skip).
 */
export async function runBeatPlan(
  plan: BeatPlan,
  clock: PlaybackClock,
  shouldSkip: () => boolean,
  onAction: (action: PlaybackAction) => void,
): Promise<void> {
  if (shouldSkip()) return
  for (const timed of plan.actions) {
    clock.schedule(timed.atMs, () => onAction(timed.action))
  }
  await clock.wait(plan.durationMs)
}
