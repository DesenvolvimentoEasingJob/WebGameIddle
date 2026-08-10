export interface GlobalBalanceForm {
  xpBase: number
  xpScale: number
  xpScaleStepEvery: number
  xpScaleStep: number
  floorDifficultyMult: number
  floorRewardMult: number
  bossChallengeAttrMult: number
  bossChallengeFee: number
  floorOwnerFeeShare: number
  deathXpPenalty: number
  trainingCostBase: number
  trainingGoldScale: number
  battleCoinRewardBase: number
  hpRegenGlobalMult: number
  hpDefeatRevivePct: number
  combatTurnSeconds: number
  combatDamageNoise: number
}

export interface GlobalConfigForm {
  id: string
  monsterImageComplement: string
  floorImageComplement: string
  balance: GlobalBalanceForm
}

export function emptyGlobalConfig(): GlobalConfigForm {
  return {
    id: 'global',
    monsterImageComplement:
      'pixel art, transparent background, side view, monster facing left (west), clean silhouette, no text, no UI chrome',
    floorImageComplement:
      'pixel art, ultrawide 21:9 combat arena strip, side view, solid walkable ground along the bottom third edge-to-edge, depth behind the ground plane, no characters, no monsters, no UI, no text, no floating island, no letterboxing, fill the entire frame',
    balance: {
      xpBase: 100,
      xpScale: 1.2,
      xpScaleStepEvery: 10,
      xpScaleStep: 0.1,
      floorDifficultyMult: 2.0,
      floorRewardMult: 1.5,
      bossChallengeAttrMult: 10,
      bossChallengeFee: 50,
      floorOwnerFeeShare: 0.1,
      deathXpPenalty: 0.1,
      trainingCostBase: 10,
      trainingGoldScale: 1.3,
      battleCoinRewardBase: 2,
      hpRegenGlobalMult: 1.0,
      hpDefeatRevivePct: 0.5,
      combatTurnSeconds: 1.0,
      combatDamageNoise: 0,
    },
  }
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

export function parseGlobalConfig(raw: unknown): GlobalConfigForm {
  const base = emptyGlobalConfig()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>

  let complement = base.monsterImageComplement
  let floorComplement = base.floorImageComplement
  if (o.generative && typeof o.generative === 'object' && !Array.isArray(o.generative)) {
    const g = o.generative as Record<string, unknown>
    if (typeof g.monsterImageComplement === 'string') {
      complement = g.monsterImageComplement
    }
    if (typeof g.floorImageComplement === 'string') {
      floorComplement = g.floorImageComplement
    }
  }

  const bal = { ...base.balance }
  if (o.balance && typeof o.balance === 'object' && !Array.isArray(o.balance)) {
    const b = o.balance as Record<string, unknown>
    bal.xpBase = num(b.xpBase, bal.xpBase)
    bal.xpScale = num(b.xpScale, bal.xpScale)
    bal.xpScaleStepEvery = num(b.xpScaleStepEvery, bal.xpScaleStepEvery)
    bal.xpScaleStep = num(b.xpScaleStep, bal.xpScaleStep)
    bal.floorDifficultyMult = num(b.floorDifficultyMult, bal.floorDifficultyMult)
    bal.floorRewardMult = num(b.floorRewardMult, bal.floorRewardMult)
    bal.bossChallengeAttrMult = num(b.bossChallengeAttrMult, bal.bossChallengeAttrMult)
    bal.bossChallengeFee = num(b.bossChallengeFee, bal.bossChallengeFee)
    bal.floorOwnerFeeShare = num(b.floorOwnerFeeShare, bal.floorOwnerFeeShare)
    bal.deathXpPenalty = num(b.deathXpPenalty, bal.deathXpPenalty)
    bal.trainingCostBase = num(b.trainingCostBase, bal.trainingCostBase)
    bal.trainingGoldScale = num(b.trainingGoldScale, bal.trainingGoldScale)
    bal.battleCoinRewardBase = num(b.battleCoinRewardBase, bal.battleCoinRewardBase)
    bal.hpRegenGlobalMult = num(b.hpRegenGlobalMult, bal.hpRegenGlobalMult)
    bal.hpDefeatRevivePct = num(b.hpDefeatRevivePct, bal.hpDefeatRevivePct)
    bal.combatTurnSeconds = num(b.combatTurnSeconds, bal.combatTurnSeconds)
    bal.combatDamageNoise = num(b.combatDamageNoise, bal.combatDamageNoise)
  }

  return {
    id: typeof o.id === 'string' && o.id ? o.id : 'global',
    monsterImageComplement: complement,
    floorImageComplement: floorComplement,
    balance: bal,
  }
}

export function globalConfigToJson(form: GlobalConfigForm): Record<string, unknown> {
  return {
    id: 'global',
    generative: {
      monsterImageComplement: form.monsterImageComplement.trim(),
      floorImageComplement: form.floorImageComplement.trim(),
    },
    balance: { ...form.balance },
  }
}

export function validateGlobalConfig(form: GlobalConfigForm): string | null {
  if (!form.monsterImageComplement.trim()) {
    return 'Complemento generativo de monstro é obrigatório.'
  }
  if (!form.floorImageComplement.trim()) {
    return 'Complemento generativo de andar (floorImageComplement) é obrigatório.'
  }
  const b = form.balance
  if (b.xpBase < 1) return 'xpBase deve ser ≥ 1.'
  if (b.xpScale <= 0) return 'xpScale deve ser > 0.'
  if (b.xpScaleStepEvery < 1) return 'xpScaleStepEvery deve ser ≥ 1.'
  if (b.bossChallengeFee < 0) return 'bossChallengeFee deve ser ≥ 0.'
  if (b.trainingCostBase < 1) return 'trainingCostBase deve ser ≥ 1.'
  if (b.hpDefeatRevivePct < 0 || b.hpDefeatRevivePct > 1) {
    return 'hpDefeatRevivePct deve estar entre 0 e 1.'
  }
  if (b.floorOwnerFeeShare < 0 || b.floorOwnerFeeShare > 1) {
    return 'floorOwnerFeeShare deve estar entre 0 e 1.'
  }
  if (b.deathXpPenalty < 0 || b.deathXpPenalty > 1) {
    return 'deathXpPenalty deve estar entre 0 e 1.'
  }
  return null
}

export const BALANCE_FIELDS: Array<{
  key: keyof GlobalBalanceForm
  label: string
  step?: string
}> = [
  { key: 'xpBase', label: 'XP base (nv 1→2)' },
  { key: 'xpScale', label: 'XP scale', step: '0.01' },
  { key: 'xpScaleStepEvery', label: 'XP scale step every N levels' },
  { key: 'xpScaleStep', label: 'XP scale step', step: '0.01' },
  { key: 'floorDifficultyMult', label: 'Floor difficulty mult', step: '0.01' },
  { key: 'floorRewardMult', label: 'Floor reward mult', step: '0.01' },
  { key: 'bossChallengeAttrMult', label: 'Boss challenge attr mult (fallback)', step: '0.1' },
  { key: 'bossChallengeFee', label: 'Boss challenge fee (fallback)' },
  { key: 'floorOwnerFeeShare', label: 'Floor owner fee share', step: '0.01' },
  { key: 'deathXpPenalty', label: 'Death XP penalty', step: '0.01' },
  { key: 'trainingCostBase', label: 'Training cost base' },
  { key: 'trainingGoldScale', label: 'Training gold scale', step: '0.01' },
  { key: 'battleCoinRewardBase', label: 'Battle coin reward base' },
  { key: 'hpRegenGlobalMult', label: 'HP regen global mult', step: '0.01' },
  { key: 'hpDefeatRevivePct', label: 'HP defeat revive %', step: '0.01' },
  { key: 'combatTurnSeconds', label: 'Combat turn seconds', step: '0.1' },
  { key: 'combatDamageNoise', label: 'Combat damage noise', step: '0.01' },
]
