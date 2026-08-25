import { describe, expect, it } from 'vitest'
import {
  armorDamageReduction,
  DEFAULT_ARMOR_MID_DEF,
  formatArmorPercent,
  formatStatForKey,
} from './stats'

describe('armorDamageReduction', () => {
  it('returns 0 for zero def', () => {
    expect(armorDamageReduction(0)).toBe(0)
  })

  it('hits ~50% at mid def', () => {
    expect(armorDamageReduction(DEFAULT_ARMOR_MID_DEF)).toBeCloseTo(0.5, 5)
  })

  it('hits ~30% around 300 def', () => {
    expect(armorDamageReduction(300)).toBeGreaterThan(0.28)
    expect(armorDamageReduction(300)).toBeLessThan(0.32)
  })

  it('never reaches 100%', () => {
    expect(armorDamageReduction(1_000_000_000)).toBeLessThan(1)
  })
})

describe('formatArmorPercent', () => {
  it('formats as percent string', () => {
    expect(formatArmorPercent(DEFAULT_ARMOR_MID_DEF)).toMatch(/50/)
    expect(formatArmorPercent(DEFAULT_ARMOR_MID_DEF)).toContain('%')
  })
})

describe('formatStatForKey', () => {
  it('formats defBase as percent and points', () => {
    const text = formatStatForKey('defBase', DEFAULT_ARMOR_MID_DEF)
    expect(text).toContain('%')
    expect(text).toContain('4.800')
  })

  it('formats other stats as numbers', () => {
    expect(formatStatForKey('dmgBase', 42)).toBe('42')
  })
})
