import { describe, expect, it } from 'vitest'
import type { BattleEvent } from '../types/api'
import {
  COMBAT_TIMING,
  groupBattleEvents,
  planBeat,
  planPlayback,
} from './combatPlayback'

function ev(
  partial: Partial<BattleEvent> & Pick<BattleEvent, 'type' | 'actor'>,
): BattleEvent {
  return {
    target: null,
    amount: null,
    message: null,
    ...partial,
  }
}

describe('groupBattleEvents', () => {
  it('compresses opening meta (start + vitals) into one beat', () => {
    const events = [
      ev({ type: 'start', actor: 'system', message: 'Fight' }),
      ev({ type: 'vitals', actor: 'player', hpAfter: 100, maxHp: 100 }),
      ev({ type: 'vitals', actor: 'enemy', slot: 0, hpAfter: 40, maxHp: 40, message: 'Rat' }),
      ev({
        type: 'hit',
        actor: 'player',
        target: 'enemy',
        amount: 12,
        hpAfter: 28,
        slot: 0,
      }),
    ]

    const beats = groupBattleEvents(events)
    expect(beats).toHaveLength(2)
    expect(beats[0]).toMatchObject({ kind: 'meta' })
    if (beats[0]?.kind === 'meta') {
      expect(beats[0].events.map((e) => e.type)).toEqual(['start', 'vitals', 'vitals'])
    }
    expect(beats[1]?.kind).toBe('round')
  })

  it('keeps enemy death with the player kill beat and skips retaliation', () => {
    const events = [
      ev({
        type: 'hit',
        actor: 'player',
        target: 'enemy',
        amount: 40,
        hpAfter: 0,
        slot: 0,
      }),
      ev({ type: 'death', actor: 'enemy', slot: 0, message: 'Rat dies' }),
      ev({ type: 'victory', actor: 'player', message: 'Victory!' }),
      ev({ type: 'xp', actor: 'player', amount: 10, message: '+10 XP' }),
      ev({ type: 'loot', actor: 'player', message: 'Loot: scrap', slot: 0 }),
    ]

    const beats = groupBattleEvents(events)
    expect(beats[0]?.kind).toBe('round')
    if (beats[0]?.kind === 'round') {
      expect(beats[0].playerEvents.map((e) => e.type)).toEqual(['hit', 'death'])
      expect(beats[0].enemyEvents).toHaveLength(0)
    }
    expect(beats[1]?.kind).toBe('meta')
    if (beats[1]?.kind === 'meta') {
      expect(beats[1].events.map((e) => e.type)).toEqual(['victory', 'xp', 'loot'])
    }
  })

  it('groups multi-mob retaliation after a player swing', () => {
    const events = [
      ev({
        type: 'hit',
        actor: 'player',
        target: 'enemy',
        amount: 8,
        hpAfter: 20,
        slot: 0,
      }),
      ev({
        type: 'hit',
        actor: 'enemy',
        target: 'player',
        amount: 3,
        slot: 0,
      }),
      ev({
        type: 'crit',
        actor: 'enemy',
        target: 'player',
        amount: 7,
        slot: 1,
      }),
      ev({
        type: 'dodge',
        actor: 'enemy',
        target: 'player',
        slot: 2,
        message: 'Dodged',
      }),
      ev({ type: 'regen', actor: 'player', amount: 2, message: '+2 HP (regen)' }),
    ]

    const beats = groupBattleEvents(events)
    expect(beats).toHaveLength(2)
    expect(beats[0]?.kind).toBe('round')
    if (beats[0]?.kind === 'round') {
      expect(beats[0].playerEvents).toHaveLength(1)
      expect(beats[0].enemyEvents.map((e) => e.type)).toEqual(['hit', 'crit', 'dodge'])
      expect(beats[0].enemyEvents.map((e) => e.slot)).toEqual([0, 1, 2])
    }
    expect(beats[1]?.kind).toBe('meta')
    if (beats[1]?.kind === 'meta') {
      expect(beats[1].events[0]?.type).toBe('regen')
    }
  })

  it('stops enemy batch when player dies mid-retaliation', () => {
    const events = [
      ev({
        type: 'hit',
        actor: 'player',
        target: 'enemy',
        amount: 5,
        hpAfter: 10,
        slot: 0,
      }),
      ev({
        type: 'hit',
        actor: 'enemy',
        target: 'player',
        amount: 50,
        slot: 0,
      }),
      ev({ type: 'death', actor: 'player', message: 'You die' }),
      ev({ type: 'defeat', actor: 'player', message: 'Defeat' }),
      ev({ type: 'revive', actor: 'player', hpAfter: 20, maxHp: 100 }),
    ]

    const beats = groupBattleEvents(events)
    expect(beats[0]?.kind).toBe('round')
    if (beats[0]?.kind === 'round') {
      expect(beats[0].enemyEvents.map((e) => e.type)).toEqual(['hit', 'death'])
    }
    expect(beats[1]?.kind).toBe('meta')
  })
})

describe('planBeat / planPlayback', () => {
  it('staggers multi-mob retaliation and overlaps with player beat', () => {
    const events = [
      ev({
        type: 'hit',
        actor: 'player',
        target: 'enemy',
        amount: 8,
        hpAfter: 20,
        slot: 0,
      }),
      ev({ type: 'hit', actor: 'enemy', target: 'player', amount: 3, slot: 0 }),
      ev({ type: 'hit', actor: 'enemy', target: 'player', amount: 4, slot: 1 }),
    ]
    const { plans } = planPlayback(events)
    expect(plans).toHaveLength(1)
    const plan = plans[0]!
    const enemyApplies = plan.actions.filter(
      (a) =>
        a.action.type === 'apply' &&
        a.action.event.actor === 'enemy' &&
        a.action.event.type === 'hit',
    )
    expect(enemyApplies).toHaveLength(2)
    const gap = enemyApplies[1]!.atMs - enemyApplies[0]!.atMs
    expect(gap).toBe(COMBAT_TIMING.enemyStaggerMs)

    const playerImpact = plan.actions.find(
      (a) =>
        a.action.type === 'apply' &&
        a.action.event.actor === 'player' &&
        a.action.event.type === 'hit',
    )
    expect(playerImpact?.atMs).toBe(COMBAT_TIMING.windupMs)
    // First enemy strike begins before the player beat would fully end.
    const firstEnemyStrike = plan.actions.find(
      (a) =>
        a.action.type === 'motion' &&
        a.action.motion.side === 'enemy' &&
        a.action.motion.kind === 'strike',
    )
    expect(firstEnemyStrike).toBeTruthy()
    expect(firstEnemyStrike!.atMs).toBeLessThan(plan.durationMs)
    expect(firstEnemyStrike!.atMs).toBeLessThan(
      COMBAT_TIMING.windupMs + COMBAT_TIMING.hitImpactHoldMs,
    )
  })

  it('meta beat duration is far shorter than legacy 450ms-per-event', () => {
    const beat = groupBattleEvents([
      ev({ type: 'start', actor: 'system', message: 'Fight' }),
      ev({ type: 'vitals', actor: 'player', hpAfter: 100, maxHp: 100 }),
      ev({ type: 'vitals', actor: 'enemy', slot: 0, hpAfter: 40, maxHp: 40 }),
    ])[0]!
    expect(beat.kind).toBe('meta')
    const plan = planBeat(beat)
    expect(plan.durationMs).toBeLessThan(450)
    expect(plan.durationMs).toBe(0)
  })

  it('attaches floaters to enemy slots on player hits', () => {
    const events = [
      ev({
        type: 'crit',
        actor: 'player',
        target: 'enemy',
        amount: 22,
        hpAfter: 5,
        slot: 2,
      }),
    ]
    const plan = planPlayback(events).plans[0]!
    const floater = plan.actions.find((a) => a.action.type === 'floater')
    expect(floater?.action).toMatchObject({
      type: 'floater',
      floater: { side: 'right', slot: 2, text: 'CRIT -22' },
    })
  })
})
