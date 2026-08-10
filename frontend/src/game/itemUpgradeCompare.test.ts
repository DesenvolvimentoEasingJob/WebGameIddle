import { describe, expect, it } from 'vitest'
import { bagItemShowsUpgradeArrow, hasHigherAttribute } from './itemUpgradeCompare'
import type { BagItem } from '../types/item'

const ringSlots = [
  { name: 'ring1', itemType: ['ring'] },
  { name: 'ring2', itemType: ['ring'] },
]

function item(partial: Partial<BagItem> & { type?: string }): BagItem {
  return { qty: 1, ...partial }
}

describe('hasHigherAttribute', () => {
  it('detects higher strength vs equipped ring', () => {
    const bag = item({ type: 'ring', stats: { strength: 5, intellect: 1 } })
    const equipped = item({ type: 'ring', stats: { strength: 2, agility: 3 } })
    expect(hasHigherAttribute(bag, equipped)).toBe(true)
  })

  it('returns false when no attribute is higher', () => {
    const bag = item({ type: 'ring', stats: { strength: 1 } })
    const equipped = item({ type: 'ring', stats: { strength: 4, agility: 2 } })
    expect(hasHigherAttribute(bag, equipped)).toBe(false)
  })

  it('treats empty slot as zeros', () => {
    const bag = item({ type: 'ring', stats: { strength: 1 } })
    expect(hasHigherAttribute(bag, null)).toBe(true)
  })
})

describe('bagItemShowsUpgradeArrow', () => {
  it('compares against the weaker ring among multiple slots', () => {
    const bag = item({ type: 'ring', stats: { strength: 3 } })
    const equipment = {
      ring1: item({ type: 'ring', stats: { strength: 5 } }),
      ring2: item({ type: 'ring', stats: { strength: 1 } }),
    }
    expect(bagItemShowsUpgradeArrow(bag, equipment, ringSlots)).toBe(true)
  })

  it('ignores materials with no compatible slot', () => {
    const bag = item({ type: 'material', stats: { strength: 99 } })
    expect(bagItemShowsUpgradeArrow(bag, {}, ringSlots)).toBe(false)
  })

  it('compares ghost slots against the real two-hand item', () => {
    const bag = item({ type: 'weapon', stats: { dmgBase: 10 } })
    const real = item({
      type: 'weapon',
      instanceId: 'spear-1',
      grip: 'twoHand',
      stats: { dmgBase: 6 },
    })
    const equipment = {
      mainHand: real,
      offHand: item({
        ghost: true,
        occupiedBy: 'spear-1',
        anchorSlot: 'mainHand',
        type: 'weapon',
      }),
    }
    const handSlots = [
      { name: 'mainHand', itemType: ['weapon'] },
      { name: 'offHand', itemType: ['weapon', 'shield'] },
    ]
    expect(bagItemShowsUpgradeArrow(bag, equipment, handSlots)).toBe(true)
  })
})