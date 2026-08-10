export const CONTENT_FOLDERS = ['monsters', 'items', 'floors', 'attributes', 'config'] as const
export type ContentFolder = (typeof CONTENT_FOLDERS)[number]

export interface MonsterLoot {
  itemId: string
  chance: number
  qty: [number, number]
}

export interface Monster {
  id: string
  name: string
  /** Flavor + aparência — usado no editor e na geração PixelLab. */
  description?: string
  /** Opcional: acrescenta ao complemento global de imagem. */
  generativeComplement?: string
  level: number
  hp: number
  baseStats?: Record<string, number>
  bonusDefense?: Record<string, number>
  /** @deprecated legado — preferir baseStats.dmgBase */
  attack?: number
  /** @deprecated legado — preferir baseStats.defBase */
  defense?: number
  resistances?: Record<string, number>
  weaknesses?: Record<string, number>
  skills: string[]
  behavior: string
  skyCoinDrop?: [number, number]
  rarityLuck?: number
  loot: MonsterLoot[]
  assets: {
    sprite?: string
    /** Presentation size in combat footer (px). */
    width?: number
    height?: number
    animations?: {
      idle?: {
        frames: string[]
        frameWidth?: number
        frameHeight?: number
        frameCount?: number
        fps?: number
        direction?: string
      }
    }
  }
}

export interface Item {
  id: string
  name: string
  description: string
  type: string
  grip?: 'oneHand' | 'twoHand' | string
  itemLevel: number
  stackable: boolean
  stats?: Record<string, number>
  assets: { icon?: string }
}

export interface FloorRoom {
  number: number
  type: string
  monsterIds: string[]
}

export interface FloorBoss {
  monsterId: string
  gateFee: number
  registryFee: number
  attrMult: number
}

export interface Floor {
  id: string
  number: number
  name: string
  description: string
  /** Optional append to global generative.floorImageComplement. */
  generativeComplement?: string
  theme: string
  difficulty: number
  itemLevel: number
  rooms: FloorRoom[]
  boss: FloorBoss
  ownerPlayerId: string | null
  ownerSnapshotPath: string | null
  assets: { background?: string }
}

export type ContentEntity = Monster | Item | Floor
