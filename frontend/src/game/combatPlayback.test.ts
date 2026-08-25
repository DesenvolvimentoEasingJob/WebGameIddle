import { describe, expect, it } from 'vitest'
import type { BattleEvent } from '../types/api'
import { COMBAT_TIMING, planPlayback } from './combatPlayback'

function ev(
  partial: Partial<BattleEvent> & Pick<BattleEvent, 'type' | 'actor'>,
): BattleEvent {
  return {
    target: null,
    amount: null,
    message: null,
    atMs: 0,
    ...partial,
  }
}

describe('planPlayback (timeline atMs)', () => {
  it('schedules applies at server atMs (scaled)', () => {
    const events = [
      ev({ type: 'start', actor: 'system', message: 'Fight', atMs: 0 }),
      ev({ type: 'vitals', actor: 'player', hpAfter: 100, maxHp: 100, atMs: 0 }),
      ev({
        type: 'hit',
        actor: 'player',
        target: 'enemy',
        amount: 12,
        hpAfter: 28,
        slot: 0,
        atMs: 1000,
      }),
      ev({
        type: 'hit',
        actor: 'enemy',
        target: 'player',
        amount: 5,
        hpAfter: 95,
        slot: 0,
        atMs: 1000,
      }),
      ev({ type: 'regen', actor: 'player', amount: 2, hpAfter: 97, atMs: 2000 }),
    ]

    const plan = planPlayback(events).plans[0]!
    const applies = plan.actions.filter((a) => a.action.type === 'apply')
    expect(applies.map((a) => a.atMs)).toEqual([0, 0, 1000, 1000, 2000])
  })

  it('keeps same-ms order from the array (player then enemy)', () => {
    const events = [
      ev({
        type: 'hit',
        actor: 'player',
        target: 'enemy',
        amount: 8,
        hpAfter: 20,
        slot: 0,
        atMs: 1000,
      }),
      ev({
        type: 'hit',
        actor: 'enemy',
        target: 'player',
        amount: 3,
        slot: 0,
        atMs: 1000,
      }),
    ]
    const plan = planPlayback(events).plans[0]!
    const applies = plan.actions.filter((a) => a.action.type === 'apply')
    expect(applies).toHaveLength(2)
    expect(applies[0]!.action).toMatchObject({
      type: 'apply',
      event: { actor: 'player' },
    })
    expect(applies[1]!.action).toMatchObject({
      type: 'apply',
      event: { actor: 'enemy' },
    })
    expect(applies[0]!.atMs).toBe(applies[1]!.atMs)
  })

  it('winds up strike before impact without moving apply earlier', () => {
    const events = [
      ev({
        type: 'hit',
        actor: 'player',
        target: 'enemy',
        amount: 8,
        hpAfter: 20,
        slot: 0,
        atMs: 1000,
      }),
    ]
    const plan = planPlayback(events).plans[0]!
    const strike = plan.actions.find(
      (a) => a.action.type === 'motion' && a.action.motion.kind === 'strike',
    )
    const apply = plan.actions.find((a) => a.action.type === 'apply')
    expect(strike?.atMs).toBe(1000 - COMBAT_TIMING.windupMs)
    expect(apply?.atMs).toBe(1000)
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
        atMs: 500,
      }),
    ]
    const plan = planPlayback(events).plans[0]!
    const floater = plan.actions.find((a) => a.action.type === 'floater')
    expect(floater?.action).toMatchObject({
      type: 'floater',
      floater: { side: 'right', slot: 2, text: 'CRIT -22' },
    })
    expect(floater?.atMs).toBe(500)
  })

  it('defaults missing atMs to 0', () => {
    const events = [ev({ type: 'start', actor: 'system', message: 'Fight' })]
    delete (events[0] as { atMs?: number }).atMs
    const plan = planPlayback(events).plans[0]!
    expect(plan.actions[0]?.atMs).toBe(0)
  })
})
