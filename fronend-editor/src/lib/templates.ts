import type { ContentFolder } from '../types/content'
import type { JsonValue } from './jsonModel'

function monsterTemplate(): JsonValue {
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
    skyCoinDrop: [1, 2],
    rarityLuck: 0,
    loot: [],
    assets: { sprite: '/assets/monsters/novo.png', width: 56, height: 56 },
  }
}

function itemTemplate(): JsonValue {
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

function floorTemplate(): JsonValue {
  return {
    id: '',
    number: 1,
    name: '',
    description: '',
    theme: '',
    difficulty: 1,
    itemLevel: 1,
    rooms: Array.from({ length: 9 }, (_, i) => ({
      number: i + 1,
      type: 'wave',
      monsterIds: [],
    })),
    boss: { monsterId: '', gateFee: 50, registryFee: 50, attrMult: 10 },
    ownerPlayerId: null,
    ownerSnapshotPath: null,
    assets: { background: '/api/assets/floors/novo.png' },
  }
}

function attributesTemplate(): JsonValue {
  return {
    id: 'core',
    strength: {
      name: 'Força',
      description: '',
      formulas: ['hpBase * 0.2'],
      assets: { card: '/api/assets/attributes/strength.png' },
    },
  }
}

function configTemplate(): JsonValue {
  return {
    id: 'global',
    generative: {
      monsterImageComplement:
        'pixel art, transparent background, side view, monster facing left (west), clean silhouette, no text, no UI chrome',
      floorImageComplement:
        'pixel art, ultrawide 21:9 combat arena strip, side view, solid walkable ground along the bottom third edge-to-edge, depth behind the ground plane, no characters, no monsters, no UI, no text, no floating island, no letterboxing, fill the entire frame',
    },
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
      combatBaseActionMs: 1000,
      combatMaxDurationMs: 60000,
      combatRegenTickMs: 1000,
      combatDamageNoise: 0,
      combatArmorMidDef: 4800,
      combatArmorPower: 0.31,
    },
  }
}

export function templateFor(folder: ContentFolder): JsonValue {
  if (folder === 'monsters') return monsterTemplate()
  if (folder === 'items') return itemTemplate()
  if (folder === 'attributes') return attributesTemplate()
  if (folder === 'config') return configTemplate()
  return floorTemplate()
}

/** Propriedades cujo valor é um id de outra pasta — alimenta o autocomplete. */
export const REFERENCE_FIELDS: Record<ContentFolder, Partial<Record<ContentFolder, string[]>>> = {
  monsters: { items: ['itemId'] },
  items: {},
  floors: { monsters: ['monsterId', 'monsterIds'] },
  attributes: {},
  config: {},
}
