export type HealthResponse = {
  status: string
  database?: string
  error?: string
}

export type MeResponse = {
  id: string
  username: string
  email: string
  hasCharacter: boolean
}

export type AuthResponse = {
  token: string
  user: MeResponse
}

export type Race = {
  id: string
  name: string
  description: string
}

export type GameClass = {
  id: string
  name: string
  description: string
  allowedRaces: string[]
}

/** Definição de item vinda de `content/items/*.json` */
export type ItemDef = {
  id: string
  name: string
  description?: string
  type: string
  rarity?: string
  itemLevel?: number
  stackable?: boolean
  stats?: Record<string, number>
  assets?: { icon?: string }
}

export type CharacterSummary = {
  id: string
  name: string
  raceId: string
  classId: string
  level: number
  xp: number
  /** XP necessária para sair do nível atual, calculada pelo backend */
  xpToNextLevel: number
  skyCoin: number
  /** HP corrente persistido no servidor (após regen) */
  currentHp: number
  maxHp: number
  /** HP bruto regenerado por segundo (semente + core + itens) */
  hpRegenPerSec: number
  baseStats?: Record<string, number>
  hasCharacter: boolean
}

/** Calculated attribute map from GET /api/characters/me/stats */
export type CharacterStats = Record<string, number>

/** Idle loop for combat footer (from content assets.animations.idle). */
export type MonsterIdleAnimation = {
  frames: string[]
  frameWidth: number
  frameHeight: number
  frameCount: number
  fps: number
  direction: string
}

/** Preview de um monstro do encontro da sala (vem no TowerState). */
export type EncounterMonster = {
  id: string
  name: string
  description?: string | null
  level: number
  hp: number
  dmgBase: number
  defBase: number
  sprite: string | null
  /** Presentation size in combat footer (`assets.width` / `assets.height`). */
  width?: number
  height?: number
  skyCoinDropMin?: number | null
  skyCoinDropMax?: number | null
  rarityLuck?: number
  idleAnimation?: MonsterIdleAnimation | null
}

/** Encontro da sala atual — mesmos IDs/contagens que o combate usa. */
export type RoomEncounter = {
  room: number
  type: string
  monsters: EncounterMonster[]
}

export type TowerState = {
  inTower: boolean
  floor: number
  room: number
  maxUnlockedRoom: number
  maxUnlockedFloor: number
  autoClimb: boolean
  floorName: string | null
  characterName: string
  level: number
  xp: number
  /** XP necessária para sair do nível atual, calculada pelo backend */
  xpToNextLevel: number
  /** Taxa do portão de progressão, vinda de `boss.gateFee` do andar atual */
  bossGateFee: number
  /** Taxa do desafio de registro de nome, vinda de `boss.registryFee` do andar atual */
  floorRegistryFee: number
  registryAttrMult: number
  currentHp: number
  maxHp: number
  hpRegenPerSec: number
  /** Preview dos monstros da sala atual; null fora da torre */
  roomEncounter?: RoomEncounter | null
  /** Path do background do andar (`assets.background` do JSON). */
  floorBackground?: string | null
}

export type BattleEvent = {
  type: string
  actor: string
  target: string | null
  amount: number | null
  message: string | null
  hpAfter?: number | null
  maxHp?: number | null
  /** Índice do inimigo no grupo (0–3); ausente em eventos só do player */
  slot?: number | null
}

export type CombatEnemy = {
  slot: number
  name: string
  hp: number
  maxHp: number
  alive: boolean
}

export type BattleResult = {
  victory: boolean
  events: BattleEvent[]
  xpGained: number
  newLevel: number | null
  leveledUp: boolean
  loot: string[]
  autoAdvanceRoom: boolean
  state: TowerState | null
  coinsGained: number
  skyCoin: number | null
}
