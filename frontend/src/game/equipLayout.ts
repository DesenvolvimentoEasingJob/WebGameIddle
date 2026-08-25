export type EquipSlotLayout = {
  name: string
  itemType: string[]
  boxSize: number
  row?: number
  order?: number
}

/** Escala de boxSize: 1 = maior, 10 = menor (mesmo visual do antigo boxSize 4). */
export const EQUIP_SLOT_MAX_BOX_SIZE = 10

/** Divisor legado do menor slot (antigo boxSize 4 → base / 4). */
const EQUIP_SLOT_MIN_VISUAL_DIVISOR = 4

export function clampEquipBoxSize(boxSize: number | undefined): number {
  const raw = Number.isFinite(boxSize) ? Math.round(boxSize as number) : 1
  return Math.min(EQUIP_SLOT_MAX_BOX_SIZE, Math.max(1, raw || 1))
}

/**
 * Tamanho visual em rem: interpola em passos iguais de `baseRem` (boxSize 1)
 * até `baseRem / 4` (boxSize 10 — equivalente ao antigo 4).
 */
export function equipSlotSizeRem(boxSize: number | undefined, baseRem: number): number {
  const size = clampEquipBoxSize(boxSize)
  const t = (size - 1) / (EQUIP_SLOT_MAX_BOX_SIZE - 1)
  const maxRem = baseRem
  const minRem = baseRem / EQUIP_SLOT_MIN_VISUAL_DIVISOR
  return maxRem - t * (maxRem - minRem)
}

export type EquipLayoutRow = {
  row: number
  slots: EquipSlotLayout[]
}

const FALLBACK_LAYOUT: Record<string, { row: number; order: number }> = {
  ring1: { row: 1, order: 1 },
  amulet: { row: 1, order: 3 },
  head: { row: 1, order: 2 },
  ring2: { row: 1, order: 3 },
  offHand: { row: 2, order: 1 },
  chest: { row: 2, order: 2 },
  mainHand: { row: 2, order: 3 },
  ring3: { row: 3, order: 1 },
  ring4: { row: 3, order: 2 },
  legs: { row: 3, order: 2 },
  feet: { row: 4, order: 2 },
  hands: { row: 2, order: 2 },
}

export const EQUIP_SLOT_LABELS: Record<string, string> = {
  head: 'Cabeça',
  chest: 'Peito',
  mainHand: 'Mão principal',
  offHand: 'Mão secundária',
  ring1: 'Anel',
  ring2: 'Anel 2',
  ring3: 'Anel 3',
  ring4: 'Anel 4',
  amulet: 'Amuleto',
  legs: 'Pernas',
  feet: 'Pés',
  hands: 'Mãos',
}

function resolveLayout(slot: EquipSlotLayout, index: number): { row: number; order: number } {
  if (Number.isFinite(slot.row) && Number.isFinite(slot.order)) {
    return { row: slot.row as number, order: slot.order as number }
  }
  const fb = FALLBACK_LAYOUT[slot.name]
  if (fb) return fb
  return { row: 99, order: index + 1 }
}

/** Agrupa slots por `row` e ordena por `order` (fallback por nome se faltar). */
export function groupEquipSlotsByRow(slots: EquipSlotLayout[]): EquipLayoutRow[] {
  const enriched = slots.map((slot, index) => {
    const layout = resolveLayout(slot, index)
    return { slot, ...layout }
  })

  const byRow = new Map<number, typeof enriched>()
  for (const entry of enriched) {
    const list = byRow.get(entry.row) ?? []
    list.push(entry)
    byRow.set(entry.row, list)
  }

  return [...byRow.entries()]
    .sort(([a], [b]) => a - b)
    .map(([row, entries]) => ({
      row,
      slots: entries
        .sort((a, b) => a.order - b.order || a.slot.name.localeCompare(b.slot.name))
        .map((e) => e.slot),
    }))
}

export function equipSlotLabel(name: string): string {
  return EQUIP_SLOT_LABELS[name] ?? name
}
