export const MONSTER_BEHAVIORS = ['aggressive', 'defensive', 'passive', 'skittish'] as const

export type MonsterBehavior = (typeof MONSTER_BEHAVIORS)[number]

export const BASE_STAT_SUGGESTIONS = [
  'dmgBase',
  'defBase',
  'critChance',
  'critDamage',
  'dodgeChance',
  'attackSpeed',
  'hpRegenPerSec',
] as const

export interface MonsterLootForm {
  itemId: string
  chance: number
  qtyMin: number
  qtyMax: number
}

export interface MonsterBonusDamageEntry {
  dmgBase: number
  counter: string
}

export interface MonsterIdleAnimation {
  frames: string[]
  frameWidth: number
  frameHeight: number
  frameCount: number
  fps: number
  direction: string
}

export interface MonsterFormData {
  id: string
  name: string
  /** Flavor + prompt enrichment for PixelLab / IA — persisted in content JSON. */
  description: string
  /** Optional per-monster append to global generative.monsterImageComplement. */
  generativeComplement: string
  level: number
  hp: number
  baseStats: Record<string, number>
  bonusDamage: Record<string, MonsterBonusDamageEntry>
  bonusDefense: Record<string, number>
  skills: string[]
  behavior: string
  skyCoinDropMin: number
  skyCoinDropMax: number
  rarityLuck: number
  loot: MonsterLootForm[]
  assets: {
    sprite: string
    /** Presentation size in combat footer (px). */
    width: number
    height: number
    idle: MonsterIdleAnimation | null
  }
}

export function emptyIdleAnimation(): MonsterIdleAnimation {
  return {
    frames: [],
    frameWidth: 64,
    frameHeight: 64,
    frameCount: 0,
    fps: 6,
    direction: 'east',
  }
}

export function emptyMonsterForm(): MonsterFormData {
  return {
    id: '',
    name: '',
    description: '',
    generativeComplement: '',
    level: 1,
    hp: 30,
    baseStats: { dmgBase: 5, defBase: 2 },
    bonusDamage: {},
    bonusDefense: {},
    skills: [],
    behavior: 'aggressive',
    skyCoinDropMin: 1,
    skyCoinDropMax: 2,
    rarityLuck: 0,
    loot: [],
    assets: { sprite: '/assets/monsters/novo.png', width: 56, height: 56, idle: null },
  }
}

function readNumberMap(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
  }
  return out
}

function readBonusDamageMap(raw: unknown): Record<string, MonsterBonusDamageEntry> {
  const out: Record<string, MonsterBonusDamageEntry> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue
    const entry = v as Record<string, unknown>
    const dmgBase =
      typeof entry.dmgBase === 'number' && Number.isFinite(entry.dmgBase) ? entry.dmgBase : 0
    const counter = typeof entry.counter === 'string' ? entry.counter : ''
    out[k] = { dmgBase, counter }
  }
  return out
}

export function parseMonsterForm(raw: unknown): MonsterFormData {
  const base = emptyMonsterForm()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>

  let baseStats = readNumberMap(o.baseStats)
  if (Object.keys(baseStats).length === 0) {
    // Legacy flat attack/defense
    if (typeof o.attack === 'number' && Number.isFinite(o.attack)) baseStats.dmgBase = o.attack
    if (typeof o.defense === 'number' && Number.isFinite(o.defense)) baseStats.defBase = o.defense
  }
  if (Object.keys(baseStats).length === 0) {
    baseStats = { ...base.baseStats }
  }

  const bonusDefense = readNumberMap(o.bonusDefense)
  const bonusDamage = readBonusDamageMap(o.bonusDamage)

  const skills: string[] = []
  if (Array.isArray(o.skills)) {
    for (const s of o.skills) {
      if (typeof s === 'string' && s.trim()) skills.push(s)
    }
  }

  let skyMin = base.skyCoinDropMin
  let skyMax = base.skyCoinDropMax
  if (Array.isArray(o.skyCoinDrop) && o.skyCoinDrop.length >= 2) {
    const a = o.skyCoinDrop[0]
    const b = o.skyCoinDrop[1]
    if (typeof a === 'number' && Number.isFinite(a)) skyMin = a
    if (typeof b === 'number' && Number.isFinite(b)) skyMax = b
  }

  const loot: MonsterLootForm[] = []
  if (Array.isArray(o.loot)) {
    for (const entry of o.loot) {
      if (!entry || typeof entry !== 'object') continue
      const e = entry as Record<string, unknown>
      const itemId = typeof e.itemId === 'string' ? e.itemId : ''
      if (!itemId) continue
      let qtyMin = 1
      let qtyMax = 1
      if (Array.isArray(e.qty) && e.qty.length >= 2) {
        if (typeof e.qty[0] === 'number') qtyMin = e.qty[0]
        if (typeof e.qty[1] === 'number') qtyMax = e.qty[1]
      }
      loot.push({
        itemId,
        chance: typeof e.chance === 'number' && Number.isFinite(e.chance) ? e.chance : 0.1,
        qtyMin,
        qtyMax,
      })
    }
  }

  let sprite = base.assets.sprite
  let width = base.assets.width
  let height = base.assets.height
  let idle: MonsterIdleAnimation | null = null
  if (o.assets && typeof o.assets === 'object' && !Array.isArray(o.assets)) {
    const a = o.assets as Record<string, unknown>
    if (typeof a.sprite === 'string') sprite = a.sprite
    if (typeof a.width === 'number' && Number.isFinite(a.width) && a.width > 0) width = a.width
    if (typeof a.height === 'number' && Number.isFinite(a.height) && a.height > 0) height = a.height
    idle = parseIdleAnimation(a)
  }

  return {
    id: typeof o.id === 'string' ? o.id : '',
    name: typeof o.name === 'string' ? o.name : '',
    description: typeof o.description === 'string' ? o.description : '',
    generativeComplement:
      typeof o.generativeComplement === 'string' ? o.generativeComplement : '',
    level: typeof o.level === 'number' && Number.isFinite(o.level) ? o.level : 1,
    hp: typeof o.hp === 'number' && Number.isFinite(o.hp) ? o.hp : 30,
    baseStats,
    bonusDamage,
    bonusDefense,
    skills,
    behavior: typeof o.behavior === 'string' && o.behavior ? o.behavior : 'aggressive',
    skyCoinDropMin: skyMin,
    skyCoinDropMax: skyMax,
    rarityLuck: typeof o.rarityLuck === 'number' && Number.isFinite(o.rarityLuck) ? o.rarityLuck : 0,
    loot,
    assets: { sprite, width, height, idle },
  }
}

function parseIdleAnimation(assets: Record<string, unknown>): MonsterIdleAnimation | null {
  if (!assets.animations || typeof assets.animations !== 'object' || Array.isArray(assets.animations)) {
    return null
  }
  const anims = assets.animations as Record<string, unknown>
  if (!anims.idle || typeof anims.idle !== 'object' || Array.isArray(anims.idle)) {
    return null
  }
  const idle = anims.idle as Record<string, unknown>
  const frames: string[] = []
  if (Array.isArray(idle.frames)) {
    for (const f of idle.frames) {
      if (typeof f === 'string' && f.trim()) frames.push(f)
    }
  }
  if (frames.length === 0 && typeof idle.sheet === 'string' && idle.sheet.trim()) {
    frames.push(idle.sheet)
  }
  if (frames.length === 0) return null

  return {
    frames,
    frameWidth:
      typeof idle.frameWidth === 'number' && Number.isFinite(idle.frameWidth) ? idle.frameWidth : 64,
    frameHeight:
      typeof idle.frameHeight === 'number' && Number.isFinite(idle.frameHeight)
        ? idle.frameHeight
        : 64,
    frameCount:
      typeof idle.frameCount === 'number' && Number.isFinite(idle.frameCount)
        ? idle.frameCount
        : frames.length,
    fps: typeof idle.fps === 'number' && Number.isFinite(idle.fps) ? idle.fps : 6,
    direction: typeof idle.direction === 'string' && idle.direction ? idle.direction : 'east',
  }
}

/** JSON shape written to content/monsters/{id}.json. */
export function monsterFormToJson(
  form: MonsterFormData,
  id: string,
): Record<string, unknown> & { id: string } {
  const assets: Record<string, unknown> = {
    sprite: form.assets.sprite.trim() || `/assets/monsters/${id}.png`,
    width: form.assets.width > 0 ? Math.round(form.assets.width) : 56,
    height: form.assets.height > 0 ? Math.round(form.assets.height) : 56,
  }
  if (form.assets.idle && form.assets.idle.frames.length > 0) {
    const idle = form.assets.idle
    assets.animations = {
      idle: {
        frames: [...idle.frames],
        frameWidth: idle.frameWidth,
        frameHeight: idle.frameHeight,
        frameCount: idle.frameCount || idle.frames.length,
        fps: idle.fps,
        direction: idle.direction || 'east',
      },
    }
  }

  const json: Record<string, unknown> = {
    id,
    name: form.name.trim(),
    description: form.description.trim(),
    level: form.level,
    hp: form.hp,
    baseStats: { ...form.baseStats },
    bonusDamage: Object.fromEntries(
      Object.entries(form.bonusDamage).map(([k, v]) => [
        k,
        { dmgBase: v.dmgBase, counter: v.counter.trim() },
      ]),
    ),
    bonusDefense: { ...form.bonusDefense },
    skills: [...form.skills],
    behavior: form.behavior,
    skyCoinDrop: [form.skyCoinDropMin, form.skyCoinDropMax],
    rarityLuck: form.rarityLuck,
    loot: form.loot.map((l) => ({
      itemId: l.itemId.trim(),
      chance: l.chance,
      qty: [l.qtyMin, l.qtyMax] as [number, number],
    })),
    assets,
  }
  const complement = form.generativeComplement.trim()
  if (complement) {
    json.generativeComplement = complement
  }
  return json as Record<string, unknown> & { id: string }
}

export function validateMonsterForm(form: MonsterFormData): string | null {
  if (!form.name.trim()) return 'Nome é obrigatório.'
  if (!form.description.trim()) {
    return 'Descrição é obrigatória (aparência/flavor — enriquece a geração de arte).'
  }
  if (!Number.isFinite(form.level) || form.level < 1) return 'level deve ser ≥ 1.'
  if (!Number.isFinite(form.hp) || form.hp <= 0) return 'hp deve ser > 0.'
  if (!form.behavior.trim()) return 'behavior é obrigatório.'
  if (!Number.isFinite(form.skyCoinDropMin) || form.skyCoinDropMin < 0) {
    return 'skyCoinDrop min deve ser ≥ 0.'
  }
  if (!Number.isFinite(form.skyCoinDropMax) || form.skyCoinDropMax < form.skyCoinDropMin) {
    return 'skyCoinDrop max deve ser ≥ min.'
  }
  if (!Number.isFinite(form.rarityLuck) || form.rarityLuck < 0) {
    return 'rarityLuck deve ser ≥ 0.'
  }
  if (!Number.isFinite(form.assets.width) || form.assets.width < 1) {
    return 'assets.width deve ser ≥ 1.'
  }
  if (!Number.isFinite(form.assets.height) || form.assets.height < 1) {
    return 'assets.height deve ser ≥ 1.'
  }
  for (const [k, v] of Object.entries(form.baseStats)) {
    if (!k.trim()) return 'baseStats: chave vazia não é permitida.'
    if (!Number.isFinite(v)) return `baseStats: valor inválido em "${k}".`
  }
  for (const [k, v] of Object.entries(form.bonusDefense)) {
    if (!k.trim()) return 'bonusDefense: chave vazia não é permitida.'
    if (!Number.isFinite(v)) return `bonusDefense: valor inválido em "${k}".`
  }
  for (const [k, v] of Object.entries(form.bonusDamage)) {
    if (!k.trim()) return 'bonusDamage: chave vazia não é permitida.'
    if (!Number.isFinite(v.dmgBase) || v.dmgBase <= 0) {
      return `bonusDamage.${k}: dmgBase deve ser > 0.`
    }
    if (!v.counter.trim()) {
      return `bonusDamage.${k}: counter é obrigatório (ex.: fireResistance).`
    }
  }
  for (let i = 0; i < form.loot.length; i++) {
    const l = form.loot[i]
    if (!l.itemId.trim()) return `loot[${i}]: itemId é obrigatório.`
    if (!Number.isFinite(l.chance) || l.chance < 0 || l.chance > 1) {
      return `loot[${i}]: chance deve estar entre 0 e 1.`
    }
    if (!Number.isFinite(l.qtyMin) || l.qtyMin < 1) return `loot[${i}]: qty min ≥ 1.`
    if (!Number.isFinite(l.qtyMax) || l.qtyMax < l.qtyMin) {
      return `loot[${i}]: qty max deve ser ≥ min.`
    }
  }
  return null
}
