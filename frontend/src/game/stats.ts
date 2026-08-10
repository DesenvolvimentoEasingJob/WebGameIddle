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
}

const STAT_ORDER = Object.keys(STAT_LABELS)

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

export function statLabel(key: string) {
  return STAT_LABELS[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2')
}

export function formatStat(value: number) {
  if (Number.isInteger(value)) return value.toLocaleString('pt-BR')
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

/** Valores positivos ganham `+` para deixar claro que somam ao personagem. */
export function formatStatDelta(value: number) {
  return value > 0 ? `+${formatStat(value)}` : formatStat(value)
}
