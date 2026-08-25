/** Atributos primários primeiro, depois derivados; chaves novas caem no fim. */
const STAT_LABELS: Record<string, string> = {
  strength: 'Força',
  intelligence: 'Inteligência',
  agility: 'Agilidade',
  hpBase: 'Vida (HP)',
  mpBase: 'Mana (MP)',
  dmgBase: 'Dano',
  capBase: 'Capacidade',
  hpRegenPerSec: 'Regen HP/s',
  attackSpeed: 'Vel. de ataque',
  magicianCastTime: 'Tempo de conjuração',
  defBase: 'Defesa',
}

const STAT_ORDER = Object.keys(STAT_LABELS)

export type StatGroupId = 'primary' | 'combat' | 'vitality' | 'other'

export type StatGroup = {
  id: StatGroupId
  title: string
  entries: [string, number][]
}

const STAT_GROUPS: { id: StatGroupId; title: string; keys: string[] }[] = [
  {
    id: 'primary',
    title: 'Primários',
    keys: ['strength', 'intelligence', 'agility'],
  },
  {
    id: 'combat',
    title: 'Combate',
    keys: ['dmgBase', 'defBase', 'attackSpeed', 'magicianCastTime'],
  },
  {
    id: 'vitality',
    title: 'Vitalidade',
    keys: ['hpBase', 'mpBase', 'hpRegenPerSec', 'capBase'],
  },
]

export function sortStats(stats: Record<string, number>) {
  return Object.entries(stats).sort(([a], [b]) => {
    const ia = STAT_ORDER.indexOf(a)
    const ib = STAT_ORDER.indexOf(b)
    if (ia !== -1 && ib !== -1) return ia - ib
    if (ia !== -1) return -1
    if (ib !== -1) return 1
    return a.localeCompare(b)
  })
}

/** Agrupa atributos para o painel Status (primários / combate / vitalidade / outros). */
export function groupStats(stats: Record<string, number>): StatGroup[] {
  const remaining = new Set(Object.keys(stats))
  const groups: StatGroup[] = []

  for (const def of STAT_GROUPS) {
    const entries: [string, number][] = []
    for (const key of def.keys) {
      if (!(key in stats)) continue
      entries.push([key, stats[key]!])
      remaining.delete(key)
    }
    if (entries.length > 0) {
      groups.push({ id: def.id, title: def.title, entries })
    }
  }

  if (remaining.size > 0) {
    const other: Record<string, number> = {}
    for (const key of remaining) other[key] = stats[key]!
    groups.push({
      id: 'other',
      title: 'Outros',
      entries: sortStats(other),
    })
  }

  return groups
}

export function statLabel(key: string) {
  return STAT_LABELS[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2')
}

export function formatStat(value: number) {
  if (Number.isInteger(value)) return value.toLocaleString('pt-BR')
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

/** Defaults alinhados a `content/config/global.json` → balance. */
export const DEFAULT_ARMOR_MID_DEF = 4800
export const DEFAULT_ARMOR_POWER = 0.31

/** Redução física 0..&lt;1: `def^p / (def^p + mid^p)` (mesma curva do backend). */
export function armorDamageReduction(
  def: number,
  midDef = DEFAULT_ARMOR_MID_DEF,
  power = DEFAULT_ARMOR_POWER,
): number {
  const d = Math.max(0, def)
  if (d <= 0) return 0
  const mid = Math.max(1e-9, midDef)
  const p = Math.max(1e-9, power)
  const dp = d ** p
  const mp = mid ** p
  return dp / (dp + mp)
}

/** Exibe defesa como % de redução (ex.: `19,2%`). */
export function formatArmorPercent(def: number): string {
  const pct = armorDamageReduction(def) * 100
  return `${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

/** Defesa no painel Status: `%` + pontos (ex.: `19,2% (42)`). */
export function formatArmorWithPoints(def: number): string {
  return `${formatArmorPercent(def)} (${formatStat(def)})`
}

/** Formata atributo para UI; `defBase` vira % + pontos. */
export function formatStatForKey(key: string, value: number) {
  if (key === 'defBase') return formatArmorWithPoints(value)
  return formatStat(value)
}

/** Valores positivos ganham `+` para deixar claro que somam ao personagem. */
export function formatStatDelta(value: number) {
  return value > 0 ? `+${formatStat(value)}` : formatStat(value)
}
