import type { BagItem } from '../types/item'

export type EquipSlotDef = {
  name: string
  itemType: string[]
  boxSize?: number
  row?: number
  order?: number
}

function slotAcceptsType(slot: EquipSlotDef, type: string): boolean {
  return slot.itemType.some(
    (allowed) => allowed === '*' || allowed.toLowerCase() === type.toLowerCase(),
  )
}

function statValue(stats: Record<string, number> | undefined, key: string): number {
  if (!stats) return 0
  if (stats[key] != null) return stats[key]
  const lower = key.toLowerCase()
  for (const [k, v] of Object.entries(stats)) {
    if (k.toLowerCase() === lower) return v
  }
  return 0
}

/** Resolve ghost → item real no slot âncora (para comparar stats). */
export function resolveEquippedItem(
  equipment: Record<string, BagItem | null> | undefined,
  slotName: string,
): BagItem | null {
  const raw = equipment?.[slotName] ?? null
  if (!raw) return null
  if (!raw.ghost) return raw
  const anchor = raw.anchorSlot
  if (anchor && equipment?.[anchor] && !equipment[anchor]?.ghost) {
    return equipment[anchor] ?? null
  }
  if (raw.occupiedBy) {
    for (const item of Object.values(equipment ?? {})) {
      if (item && !item.ghost && item.instanceId === raw.occupiedBy) return item
    }
  }
  return raw
}

/** True se o item da bag supera o equipado em ao menos um atributo (ausente = 0). */
export function hasHigherAttribute(bagItem: BagItem, equipped: BagItem | null): boolean {
  const bagStats = bagItem.stats
  if (!bagStats) return false

  for (const [key, value] of Object.entries(bagStats)) {
    if (!Number.isFinite(value)) continue
    if (value > statValue(equipped?.stats, key)) return true
  }
  return false
}

/**
 * Item da bag marca upgrade se encaixa em algum slot e, nesse slot, tem
 * ao menos um atributo maior que o item equipado (slot vazio = 0 em tudo).
 */
export function bagItemShowsUpgradeArrow(
  bagItem: BagItem,
  equipment: Record<string, BagItem | null> | undefined,
  slots: EquipSlotDef[],
): boolean {
  const type = bagItem.type ?? 'material'
  const compatible = slots.filter((slot) => slotAcceptsType(slot, type))
  if (compatible.length === 0) return false

  return compatible.some((slot) =>
    hasHigherAttribute(bagItem, resolveEquippedItem(equipment, slot.name)),
  )
}
