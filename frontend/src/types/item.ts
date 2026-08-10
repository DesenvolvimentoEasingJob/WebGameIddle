/** RGB 0–255 — qualidade (estrelas) usa par start/end para gradientes/efeitos. */
export type RgbColor = { r: number; g: number; b: number }

/** Snapshot de item na bag / equipamento (fonte da verdade do jogador). */
export type BagItem = {
  instanceId?: string
  templateId?: string
  /** Legado */
  itemId?: string
  name?: string
  description?: string
  type?: string
  /** oneHand = 1 slot de mão; twoHand = 2 slots (ghost transparente nos satélites). */
  grip?: 'oneHand' | 'twoHand' | string
  /** Override numérico opcional (ex.: raça com N braços / armas especiais). */
  handSlots?: number
  /** Slot satélite de grip multi-mão — só visual, sem stats. */
  ghost?: boolean
  occupiedBy?: string
  anchorSlot?: string
  itemLevel?: number
  stackable?: boolean
  qty: number
  rarityId?: number
  rarityName?: string
  /** Qualidade 1–5 (estrelas). */
  stars?: number
  qualityName?: string
  colorStart?: RgbColor
  colorEnd?: RgbColor
  stats?: Record<string, number>
  baseStats?: Record<string, number>
  assets?: { icon?: string }
}

export function bagItemTemplateId(item: BagItem): string {
  return item.templateId ?? item.itemId ?? item.name ?? 'item'
}

export function bagItemLabel(item: BagItem): string {
  const name = item.name ?? bagItemTemplateId(item)
  const parts: string[] = [name]
  if (item.itemLevel) parts.push(`Lv${item.itemLevel}`)
  if (item.rarityName && item.stars) {
    parts.push(`[${item.rarityName} ${item.stars}★]`)
  }
  return parts.join(' ')
}
