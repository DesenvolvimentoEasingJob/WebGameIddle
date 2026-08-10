import type { BattleEvent } from '../types/api'

/** Timing tunables for combat choreography (ms). */
export const COMBAT_TIMING = {
  windupMs: 110,
  hitImpactHoldMs: 210,
  critImpactHoldMs: 280,
  deathHoldMs: 260,
  dodgeHoldMs: 180,
  enemyStaggerMs: 95,
  /** Start enemy retaliation before player beat fully ends. */
  retaliationOverlapMs: 90,
  metaInstantMs: 0,
  metaShortMs: 55,
  metaBurstMs: 70,
  floaterClearMs: 500,
  motionClearMs: 320,
} as const

export type BeatKind = 'meta' | 'round'

export type CombatBeat =
  | { kind: 'meta'; events: BattleEvent[]; startIndex: number }
  | {
      kind: 'round'
      playerEvents: BattleEvent[]
      enemyEvents: BattleEvent[]
      startIndex: number
      /** Index of the first player combat event in the original timeline. */
      playerEventIndex: number
    }

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

const META_TYPES = new Set([
  'start',
  'vitals',
  'regen',
  'victory',
  'defeat',
  'xp',
  'level_up',
  'xp_penalty',
  'loot',
  'coins',
  'revive',
])

function isCombatSwing(ev: BattleEvent): boolean {
  return ev.type === 'hit' || ev.type === 'crit' || ev.type === 'dodge'
}

function isPlayerSwing(ev: BattleEvent): boolean {
  return isCombatSwing(ev) && ev.actor === 'player'
}

function isEnemySwing(ev: BattleEvent): boolean {
  return isCombatSwing(ev) && ev.actor === 'enemy'
}

function metaDelayMs(ev: BattleEvent): number {
  if (ev.type === 'start' || ev.type === 'vitals') return COMBAT_TIMING.metaInstantMs
  if (ev.type === 'regen') return COMBAT_TIMING.metaShortMs
  if (
    ev.type === 'loot' ||
    ev.type === 'xp' ||
    ev.type === 'coins' ||
    ev.type === 'level_up' ||
    ev.type === 'xp_penalty'
  ) {
    return COMBAT_TIMING.metaBurstMs
  }
  if (ev.type === 'victory' || ev.type === 'defeat' || ev.type === 'revive') {
    return COMBAT_TIMING.metaShortMs
  }
  return COMBAT_TIMING.metaShortMs
}

function swingHoldMs(ev: BattleEvent): number {
  if (ev.type === 'crit') return COMBAT_TIMING.critImpactHoldMs
  if (ev.type === 'dodge') return COMBAT_TIMING.dodgeHoldMs
  if (ev.type === 'death') return COMBAT_TIMING.deathHoldMs
  return COMBAT_TIMING.hitImpactHoldMs
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

/**
 * Agrupa a timeline turn-based do server em beats de apresentação:
 * meta comprimido + rounds (player → retaliações inimigas).
 */
export function groupBattleEvents(events: BattleEvent[]): CombatBeat[] {
  const beats: CombatBeat[] = []
  let i = 0

  while (i < events.length) {
    const ev = events[i]!

    if (META_TYPES.has(ev.type)) {
      const startIndex = i
      const batch: BattleEvent[] = []
      while (i < events.length && META_TYPES.has(events[i]!.type)) {
        // Regen between rounds stays with the preceding round's trailing meta —
        // but if we are already in a meta batch, keep collecting.
        batch.push(events[i]!)
        i++
        // Split long meta tails: after opening vitals, stop so rounds can start.
        // Keep consecutive meta together except we never pull combat swings into meta.
      }
      beats.push({ kind: 'meta', events: batch, startIndex })
      continue
    }

    if (isPlayerSwing(ev)) {
      const startIndex = i
      const playerEventIndex = i
      const playerEvents: BattleEvent[] = [ev]
      i++
      // Death of the struck enemy belongs to the player beat.
      if (i < events.length && events[i]!.type === 'death' && events[i]!.actor === 'enemy') {
        playerEvents.push(events[i]!)
        i++
      }

      const enemyEvents: BattleEvent[] = []
      while (i < events.length && isEnemySwing(events[i]!)) {
        enemyEvents.push(events[i]!)
        i++
        if (i < events.length && events[i]!.type === 'death' && events[i]!.actor === 'player') {
          enemyEvents.push(events[i]!)
          i++
          break
        }
      }

      beats.push({
        kind: 'round',
        playerEvents,
        enemyEvents,
        startIndex,
        playerEventIndex,
      })
      continue
    }

    // Orphan enemy swing / death (should be rare) — treat as one-sided round.
    if (isEnemySwing(ev) || (ev.type === 'death' && ev.actor === 'player')) {
      const startIndex = i
      const enemyEvents: BattleEvent[] = []
      while (i < events.length && (isEnemySwing(events[i]!) || events[i]!.type === 'death')) {
        enemyEvents.push(events[i]!)
        i++
        if (enemyEvents[enemyEvents.length - 1]?.type === 'death') break
      }
      beats.push({
        kind: 'round',
        playerEvents: [],
        enemyEvents,
        startIndex,
        playerEventIndex: startIndex,
      })
      continue
    }

    // Unknown event: compress as meta of one.
    beats.push({ kind: 'meta', events: [ev], startIndex: i })
    i++
  }

  return beats
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

/**
 * Converte um beat em ações temporizadas (offsets relativos ao início do beat).
 */
export function planBeat(beat: CombatBeat): BeatPlan {
  if (beat.kind === 'meta') {
    const actions: TimedAction[] = []
    let t = 0
    for (let j = 0; j < beat.events.length; j++) {
      const event = beat.events[j]!
      const eventIndex = beat.startIndex + j
      pushApply(actions, t, event, eventIndex)
      t += metaDelayMs(event)
    }
    return { durationMs: t, actions }
  }

  const actions: TimedAction[] = []
  const windup = COMBAT_TIMING.windupMs
  let cursor = 0

  // Player swing(s): usually one hit/crit/dodge + optional death.
  if (beat.playerEvents.length > 0) {
    const swing = beat.playerEvents[0]!
    const targetSlot = swing.slot ?? 0
    pushMotion(actions, 0, { kind: 'strike', side: 'player', slot: null })
    cursor = windup

    let eventIndex = beat.playerEventIndex
    for (const event of beat.playerEvents) {
      pushApply(actions, cursor, event, eventIndex)
      if (event.type === 'hit' || event.type === 'crit' || event.type === 'dodge') {
        const floater = floaterFromSwing(event)
        if (floater) pushFloater(actions, cursor, floater)
        if (event.type !== 'dodge') {
          pushMotion(actions, cursor, {
            kind: 'hurt',
            side: 'enemy',
            slot: event.slot ?? targetSlot,
          })
        }
      }
      if (event.type === 'death' && event.actor === 'enemy') {
        pushMotion(actions, cursor, {
          kind: 'die',
          side: 'enemy',
          slot: event.slot ?? targetSlot,
        })
      }
      eventIndex++
    }

    const lastPlayer = beat.playerEvents[beat.playerEvents.length - 1]!
    cursor += swingHoldMs(lastPlayer)
  }

  // Enemy retaliations: staggered, overlapping the tail of the player beat.
  if (beat.enemyEvents.length > 0) {
    const retaliationStart = beat.playerEvents.length > 0
      ? Math.max(0, cursor - COMBAT_TIMING.retaliationOverlapMs)
      : 0
    let swingOrdinal = 0
    let eventIndex = beat.playerEventIndex + beat.playerEvents.length
    let lastImpactEnd = retaliationStart

    for (const event of beat.enemyEvents) {
      if (isEnemySwing(event)) {
        const strikeAt = retaliationStart + swingOrdinal * COMBAT_TIMING.enemyStaggerMs
        const impactAt = strikeAt + windup
        const slot = event.slot ?? 0
        pushMotion(actions, strikeAt, { kind: 'strike', side: 'enemy', slot })
        pushApply(actions, impactAt, event, eventIndex)
        const floater = floaterFromSwing(event)
        if (floater) pushFloater(actions, impactAt, floater)
        if (event.type !== 'dodge') {
          pushMotion(actions, impactAt, { kind: 'hurt', side: 'player', slot: null })
        }
        lastImpactEnd = Math.max(lastImpactEnd, impactAt + swingHoldMs(event))
        swingOrdinal++
      } else if (event.type === 'death' && event.actor === 'player') {
        const dieAt = lastImpactEnd
        pushApply(actions, dieAt, event, eventIndex)
        pushMotion(actions, dieAt, { kind: 'die', side: 'player', slot: null })
        lastImpactEnd = dieAt + COMBAT_TIMING.deathHoldMs
      } else {
        pushApply(actions, lastImpactEnd, event, eventIndex)
      }
      eventIndex++
    }

    cursor = Math.max(cursor, lastImpactEnd)
  }

  return { durationMs: cursor, actions }
}

export function planPlayback(events: BattleEvent[]): { beats: CombatBeat[]; plans: BeatPlan[] } {
  const beats = groupBattleEvents(events)
  const plans = beats.map((b) => planBeat(b))
  return { beats, plans }
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
