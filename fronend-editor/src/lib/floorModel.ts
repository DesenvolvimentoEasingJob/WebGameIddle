export const FLOOR_ID_PATTERN = /^floor-(\d{2})$/

/** Max enemies the combat runtime accepts per room. */
export const MAX_ENEMIES_PER_ROOM = 4

export interface FloorRoomForm {
  number: number
  type: string
  monsterIds: string[]
}

export interface FloorBossForm {
  monsterId: string
  gateFee: number
  registryFee: number
  attrMult: number
}

export interface FloorFormData {
  id: string
  number: number
  name: string
  description: string
  /** Optional per-floor append to global generative.floorImageComplement. */
  generativeComplement: string
  theme: string
  difficulty: number
  itemLevel: number
  rooms: FloorRoomForm[]
  boss: FloorBossForm
  ownerPlayerId: string | null
  ownerSnapshotPath: string | null
  assets: { background: string }
}

export function emptyRooms(): FloorRoomForm[] {
  return Array.from({ length: 9 }, (_, i) => ({
    number: i + 1,
    type: 'wave',
    monsterIds: [],
  }))
}

export function emptyFloorForm(floorNumber = 1): FloorFormData {
  const nn = Math.max(1, Math.min(99, Math.floor(floorNumber)))
  const id = `floor-${String(nn).padStart(2, '0')}`
  return {
    id,
    number: nn,
    name: '',
    description: '',
    generativeComplement: '',
    theme: '',
    difficulty: nn,
    itemLevel: nn,
    rooms: emptyRooms(),
    boss: { monsterId: '', gateFee: 50, registryFee: 50, attrMult: 10 },
    ownerPlayerId: null,
    ownerSnapshotPath: null,
    assets: { background: `/api/assets/floors/${id}.png` },
  }
}

function asNumber(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function parseRooms(raw: unknown): FloorRoomForm[] {
  const rooms = emptyRooms()
  if (!Array.isArray(raw)) return rooms

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const o = entry as Record<string, unknown>
    const num = asNumber(o.number, 0)
    if (num < 1 || num > 9) continue
    const idx = num - 1
    const monsterIds: string[] = []
    if (Array.isArray(o.monsterIds)) {
      for (const id of o.monsterIds) {
        if (typeof id === 'string' && id.trim()) monsterIds.push(id.trim())
      }
    }
    rooms[idx] = {
      number: num,
      type: asString(o.type, 'wave') || 'wave',
      monsterIds,
    }
  }
  return rooms
}

export function parseFloorForm(raw: unknown): FloorFormData {
  const base = emptyFloorForm()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>

  let background = base.assets.background
  if (o.assets && typeof o.assets === 'object' && !Array.isArray(o.assets)) {
    const a = o.assets as Record<string, unknown>
    if (typeof a.background === 'string') background = a.background
  }

  const bossRaw =
    o.boss && typeof o.boss === 'object' && !Array.isArray(o.boss)
      ? (o.boss as Record<string, unknown>)
      : {}

  return {
    id: asString(o.id),
    number: asNumber(o.number, 1),
    name: asString(o.name),
    description: asString(o.description),
    generativeComplement: asString(o.generativeComplement),
    theme: asString(o.theme),
    difficulty: asNumber(o.difficulty, 1),
    itemLevel: asNumber(o.itemLevel, 1),
    rooms: parseRooms(o.rooms),
    boss: {
      monsterId: asString(bossRaw.monsterId),
      gateFee: asNumber(bossRaw.gateFee, 50),
      registryFee: asNumber(bossRaw.registryFee, 50),
      attrMult: asNumber(bossRaw.attrMult, 10),
    },
    ownerPlayerId: typeof o.ownerPlayerId === 'string' ? o.ownerPlayerId : null,
    ownerSnapshotPath: typeof o.ownerSnapshotPath === 'string' ? o.ownerSnapshotPath : null,
    assets: { background },
  }
}

export function floorNumberFromId(id: string): number | null {
  const m = FLOOR_ID_PATTERN.exec(id.trim())
  if (!m) return null
  return Number(m[1])
}

export function floorFormToJson(
  form: FloorFormData,
  id: string,
): Record<string, unknown> & { id: string } {
  const nn = floorNumberFromId(id) ?? form.number
  const json: Record<string, unknown> & { id: string } = {
    id,
    number: nn,
    name: form.name.trim(),
    description: form.description.trim(),
    theme: form.theme.trim(),
    difficulty: form.difficulty,
    itemLevel: form.itemLevel,
    rooms: form.rooms.map((r) => ({
      number: r.number,
      type: 'wave',
      monsterIds: [...r.monsterIds],
    })),
    boss: {
      monsterId: form.boss.monsterId.trim(),
      gateFee: form.boss.gateFee,
      registryFee: form.boss.registryFee,
      attrMult: form.boss.attrMult,
    },
    ownerPlayerId: form.ownerPlayerId,
    ownerSnapshotPath: form.ownerSnapshotPath,
    assets: {
      background:
        form.assets.background.trim() || `/api/assets/floors/${id}.png`,
    },
  }
  const complement = form.generativeComplement.trim()
  if (complement) {
    json.generativeComplement = complement
  }
  return json
}

export interface FloorValidateContext {
  /** Existing floor numbers keyed by id (other files). */
  otherFloorNumbers: Map<string, number>
  /** Known monster ids from content/monsters. */
  monsterIds: Set<string>
  /** When true, missing monster refs are warnings only (used before AI apply creates them). */
  allowMissingMonsters?: boolean
}

export function validateFloorForm(
  form: FloorFormData,
  ctx: FloorValidateContext,
): string | null {
  const id = form.id.trim()
  if (!FLOOR_ID_PATTERN.test(id)) {
    return 'Id inválido. Use floor-01 … floor-99.'
  }
  if (!form.name.trim()) return 'Nome é obrigatório.'
  if (!Number.isFinite(form.difficulty) || form.difficulty < 1) {
    return 'difficulty deve ser um número ≥ 1.'
  }
  if (!Number.isFinite(form.itemLevel) || form.itemLevel < 1) {
    return 'itemLevel deve ser um número ≥ 1.'
  }

  const fromId = floorNumberFromId(id)!
  if (form.number !== fromId) {
    return `number (${form.number}) diverge do id (${fromId}). Ajuste ou deixe o id derivar o número.`
  }

  for (const [otherId, otherNum] of ctx.otherFloorNumbers) {
    if (otherId !== id && otherNum === fromId) {
      return `Já existe outro andar com number ${fromId} (${otherId}).`
    }
  }

  if (form.rooms.length !== 9) return 'O andar deve ter exatamente 9 salas.'
  const seen = new Set<number>()
  for (const room of form.rooms) {
    if (room.number < 1 || room.number > 9) {
      return `Sala inválida: number ${room.number}.`
    }
    if (seen.has(room.number)) return `Sala ${room.number} duplicada.`
    seen.add(room.number)
    if (room.type !== 'wave') {
      return `Sala ${room.number}: type deve ser "wave" no MVP.`
    }
    if (room.monsterIds.length === 0) {
      return `Sala ${room.number}: adicione ao menos 1 monstro em monsterIds.`
    }
    if (room.monsterIds.length > MAX_ENEMIES_PER_ROOM) {
      return `Sala ${room.number}: no máximo ${MAX_ENEMIES_PER_ROOM} inimigos (slots em monsterIds).`
    }
    if (!ctx.allowMissingMonsters) {
      for (const mid of room.monsterIds) {
        if (!ctx.monsterIds.has(mid)) {
          return `Sala ${room.number}: monstro "${mid}" não existe em content/monsters.`
        }
      }
    }
  }
  for (let n = 1; n <= 9; n++) {
    if (!seen.has(n)) return `Falta a sala ${n}.`
  }

  const bossId = form.boss.monsterId.trim()
  if (!bossId) return 'boss.monsterId é obrigatório.'
  if (!ctx.allowMissingMonsters && !ctx.monsterIds.has(bossId)) {
    return `Boss: monstro "${bossId}" não existe em content/monsters.`
  }
  if (!Number.isFinite(form.boss.gateFee) || form.boss.gateFee < 0) {
    return 'boss.gateFee deve ser ≥ 0.'
  }
  if (!Number.isFinite(form.boss.registryFee) || form.boss.registryFee < 0) {
    return 'boss.registryFee deve ser ≥ 0.'
  }
  if (!Number.isFinite(form.boss.attrMult) || form.boss.attrMult < 1) {
    return 'boss.attrMult deve ser ≥ 1.'
  }

  return null
}

export function syncNumberFromId(form: FloorFormData): FloorFormData {
  const n = floorNumberFromId(form.id)
  if (n == null) return form
  return { ...form, number: n }
}
