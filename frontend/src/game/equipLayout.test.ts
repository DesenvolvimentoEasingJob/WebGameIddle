import { describe, expect, it } from 'vitest'
import {
  clampEquipBoxSize,
  equipSlotSizeRem,
  groupEquipSlotsByRow,
} from './equipLayout'

describe('groupEquipSlotsByRow', () => {
  it('groups by row and sorts by order', () => {
    const rows = groupEquipSlotsByRow([
      { name: 'mainHand', itemType: ['weapon'], boxSize: 1, row: 2, order: 3 },
      { name: 'head', itemType: ['helmet'], boxSize: 1, row: 1, order: 2 },
      { name: 'offHand', itemType: ['focus'], boxSize: 1, row: 2, order: 1 },
      { name: 'ring1', itemType: ['ring'], boxSize: 10, row: 1, order: 1 },
      { name: 'chest', itemType: ['armor'], boxSize: 1, row: 2, order: 2 },
      { name: 'amulet', itemType: ['amulet'], boxSize: 2, row: 1, order: 3 },
    ])

    expect(rows.map((r) => r.row)).toEqual([1, 2])
    expect(rows[0]!.slots.map((s) => s.name)).toEqual(['ring1', 'head', 'amulet'])
    expect(rows[1]!.slots.map((s) => s.name)).toEqual(['offHand', 'chest', 'mainHand'])
  })

  it('falls back by slot name when row/order missing', () => {
    const rows = groupEquipSlotsByRow([
      { name: 'chest', itemType: ['armor'], boxSize: 1 },
      { name: 'head', itemType: ['helmet'], boxSize: 1 },
      { name: 'mainHand', itemType: ['weapon'], boxSize: 1 },
    ])

    expect(rows[0]!.slots.map((s) => s.name)).toEqual(['head'])
    expect(rows[1]!.slots.map((s) => s.name)).toEqual(['chest', 'mainHand'])
  })
})

describe('equip boxSize scale', () => {
  it('clamps to 1…10', () => {
    expect(clampEquipBoxSize(undefined)).toBe(1)
    expect(clampEquipBoxSize(0)).toBe(1)
    expect(clampEquipBoxSize(4)).toBe(4)
    expect(clampEquipBoxSize(10)).toBe(10)
    expect(clampEquipBoxSize(99)).toBe(10)
  })

  it('maps 1…10 from full size down to legacy size-4 visual', () => {
    expect(equipSlotSizeRem(1, 10)).toBe(10)
    expect(equipSlotSizeRem(10, 10)).toBe(2.5) // legacy base/4
    // Midpoint of the 10-step scale (boxSize 5.5 → between 5 and 6)
    expect(equipSlotSizeRem(5, 10)).toBeCloseTo(10 - (4 / 9) * 7.5, 5)
    expect(equipSlotSizeRem(6, 10)).toBeCloseTo(10 - (5 / 9) * 7.5, 5)
  })
})
