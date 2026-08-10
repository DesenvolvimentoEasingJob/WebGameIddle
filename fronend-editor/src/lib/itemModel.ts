export const ITEM_TYPES = [
  'weapon',
  'helmet',
  'armor',
  'ring',
  'amulet',
  'focus',
  'material',
  'shield',
] as const

export type ItemType = (typeof ITEM_TYPES)[number]

export const HAND_ITEM_TYPES = new Set<string>(['weapon', 'shield', 'focus'])

export const GRIP_OPTIONS = ['oneHand', 'twoHand'] as const

export type ItemGrip = (typeof GRIP_OPTIONS)[number]

export const STAT_SUGGESTIONS = [
  'dmgBase',
  'defBase',
  'hpBase',
  'mpBase',
  'capBase',
  'attackSpeed',
  'critChance',
  'critDamage',
  'dodgeChance',
  'hpRegenPerSec',
] as const

export interface ItemFormData {
  id: string
  name: string
  description: string
  type: string
  /** Só para weapon/shield/focus — quantos slots de mão ocupa. */
  grip?: ItemGrip
  itemLevel: number
  stackable: boolean
  stats: Record<string, number>
  assets: { icon: string }
}

export function emptyItemForm(): ItemFormData {
  return {
    id: '',
    name: '',
    description: '',
    type: 'material',
    itemLevel: 1,
    stackable: false,
    stats: {},
    assets: { icon: '/assets/items/novo.png' },
  }
}

export function parseItemForm(raw: unknown): ItemFormData {
  const base = emptyItemForm()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>

  const stats: Record<string, number> = {}
  if (o.stats && typeof o.stats === 'object' && !Array.isArray(o.stats)) {
    for (const [k, v] of Object.entries(o.stats as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) stats[k] = v
    }
  }

  let icon = base.assets.icon
  if (o.assets && typeof o.assets === 'object' && !Array.isArray(o.assets)) {
    const a = o.assets as Record<string, unknown>
    if (typeof a.icon === 'string') icon = a.icon
  }

  const type = typeof o.type === 'string' && o.type ? o.type : 'material'
  const gripRaw = typeof o.grip === 'string' ? o.grip : undefined
  const grip =
    HAND_ITEM_TYPES.has(type) && (gripRaw === 'oneHand' || gripRaw === 'twoHand')
      ? gripRaw
      : HAND_ITEM_TYPES.has(type)
        ? 'oneHand'
        : undefined

  return {
    id: typeof o.id === 'string' ? o.id : '',
    name: typeof o.name === 'string' ? o.name : '',
    description: typeof o.description === 'string' ? o.description : '',
    type,
    grip,
    itemLevel: typeof o.itemLevel === 'number' && Number.isFinite(o.itemLevel) ? o.itemLevel : 1,
    stackable: o.stackable === true,
    stats,
    assets: { icon },
  }
}

export function itemFormToJson(form: ItemFormData, id: string): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id,
    name: form.name.trim(),
    description: form.description.trim(),
    type: form.type,
    itemLevel: form.itemLevel,
    stackable: form.stackable,
    stats: { ...form.stats },
    assets: { icon: form.assets.icon.trim() || `/assets/items/${id}.png` },
  }

  if (!HAND_ITEM_TYPES.has(form.type)) {
    return base
  }

  return {
    id: base.id,
    name: base.name,
    description: base.description,
    type: base.type,
    grip: form.grip === 'twoHand' ? 'twoHand' : 'oneHand',
    itemLevel: base.itemLevel,
    stackable: base.stackable,
    stats: base.stats,
    assets: base.assets,
  }
}

export function validateItemForm(form: ItemFormData): string | null {
  if (!form.name.trim()) return 'Nome é obrigatório.'
  if (!form.type.trim()) return 'Tipo é obrigatório.'
  if (!Number.isFinite(form.itemLevel) || form.itemLevel < 1) {
    return 'itemLevel deve ser um número ≥ 1.'
  }
  if (
    HAND_ITEM_TYPES.has(form.type) &&
    form.grip &&
    form.grip !== 'oneHand' &&
    form.grip !== 'twoHand'
  ) {
    return 'grip deve ser oneHand ou twoHand.'
  }
  for (const [k, v] of Object.entries(form.stats)) {
    if (!k.trim()) return 'Stats: chave vazia não é permitida.'
    if (!Number.isFinite(v)) return `Stats: valor inválido em "${k}".`
  }
  return null
}

export function stackableStatsWarning(form: ItemFormData): string | null {
  if (form.stackable && Object.keys(form.stats).length > 0) {
    return 'Aviso: stackable com stats é combinação suspeita (materiais costumam não ter stats).'
  }
  return null
}
