import type { PixelLabQuality } from '../components/PixelLabQualityModal'

export type { PixelLabQuality }
export type { PixelLabGenerateOptions } from '../components/PixelLabQualityModal'

const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:8080'

export function getApiBase(): string {
  return API_BASE
}

export interface ItemDraftResponse {
  id: string
  name: string
  description: string
  type: string
  itemLevel: number
  stackable: boolean
  stats: Record<string, number>
  assets: { icon: string }
}

export async function draftItem(description: string): Promise<ItemDraftResponse> {
  const res = await fetch(`${API_BASE}/api/editor/items/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(parseError(text, res.status))
  }
  return (await res.json()) as ItemDraftResponse
}

export interface PixelLabCandidateDto {
  index: number
  previewPath: string
}

export interface PixelLabCandidatesResponse {
  draftId: string
  candidates: PixelLabCandidateDto[]
  source: string
  reason?: string
  quality?: string
  model?: string
  size?: number
  /** True when API already wrote the final asset (legacy / single-shot response). */
  alreadyCommitted?: boolean
  committedPath?: string
}

export interface GenerateIconCommitResponse {
  iconPath: string
  source: string
  reason?: string
  quality?: string
  model?: string
}

/** Normalize generate responses: candidates[], single candidate object, or legacy iconPath/spritePath. */
function normalizeCandidatesPayload(
  raw: Record<string, unknown>,
  legacyPathKey: 'iconPath' | 'spritePath',
): PixelLabCandidatesResponse {
  const source = typeof raw.source === 'string' ? raw.source : 'pixellab'
  const reason = typeof raw.reason === 'string' ? raw.reason : undefined
  const quality = typeof raw.quality === 'string' ? raw.quality : undefined
  const model = typeof raw.model === 'string' ? raw.model : undefined
  const size = typeof raw.size === 'number' ? raw.size : undefined
  const draftId = typeof raw.draftId === 'string' ? raw.draftId : ''

  const fromList: PixelLabCandidateDto[] = []
  if (Array.isArray(raw.candidates)) {
    for (const item of raw.candidates) {
      if (!item || typeof item !== 'object') continue
      const c = item as Record<string, unknown>
      const index = typeof c.index === 'number' ? c.index : fromList.length
      const previewPath =
        typeof c.previewPath === 'string'
          ? c.previewPath
          : typeof c.iconPath === 'string'
            ? c.iconPath
            : typeof c.spritePath === 'string'
              ? c.spritePath
              : typeof c.url === 'string'
                ? c.url
                : ''
      if (previewPath) fromList.push({ index, previewPath })
    }
  } else if (raw.candidates && typeof raw.candidates === 'object') {
    // Single candidate object instead of array
    const c = raw.candidates as Record<string, unknown>
    const previewPath =
      typeof c.previewPath === 'string'
        ? c.previewPath
        : typeof c.url === 'string'
          ? c.url
          : ''
    if (previewPath) {
      fromList.push({
        index: typeof c.index === 'number' ? c.index : 0,
        previewPath,
      })
    }
  }

  if (fromList.length > 0) {
    return {
      draftId,
      candidates: fromList,
      source,
      reason,
      quality,
      model,
      size,
      alreadyCommitted: !draftId,
      committedPath: !draftId ? fromList[0]?.previewPath : undefined,
    }
  }

  const legacyPath = raw[legacyPathKey]
  if (typeof legacyPath === 'string' && legacyPath.trim()) {
    return {
      draftId: '',
      candidates: [{ index: 0, previewPath: legacyPath.trim() }],
      source,
      reason,
      quality,
      model,
      size,
      alreadyCommitted: true,
      committedPath: legacyPath.trim(),
    }
  }

  return {
    draftId,
    candidates: [],
    source,
    reason,
    quality,
    model,
    size,
  }
}

export async function generateItemIcon(input: {
  id: string
  name: string
  description: string
  type: string
  quality?: PixelLabQuality
  size?: number
}): Promise<PixelLabCandidatesResponse> {
  const res = await fetch(`${API_BASE}/api/editor/items/${encodeURIComponent(input.id)}/icon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: input.name,
      description: input.description,
      type: input.type,
      quality: input.quality ?? 'standard',
      size: input.size,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(parseError(text, res.status))
  }
  const raw = (await res.json()) as Record<string, unknown>
  return normalizeCandidatesPayload(raw, 'iconPath')
}

export async function commitItemIcon(input: {
  id: string
  draftId: string
  index: number
}): Promise<GenerateIconCommitResponse> {
  const res = await fetch(
    `${API_BASE}/api/editor/items/${encodeURIComponent(input.id)}/icon/commit`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftId: input.draftId, index: input.index }),
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(parseError(text, res.status))
  }
  return (await res.json()) as GenerateIconCommitResponse
}

export interface MonsterDraftResponse {
  id: string
  name: string
  description: string
  level: number
  hp: number
  baseStats: Record<string, number>
  bonusDefense: Record<string, number>
  skills: string[]
  behavior: string
  skyCoinDrop: [number, number]
  rarityLuck: number
  loot: Array<{ itemId: string; chance: number; qty: [number, number] }>
  assets: { sprite: string }
}

export async function draftMonster(description: string): Promise<MonsterDraftResponse> {
  const res = await fetch(`${API_BASE}/api/editor/monsters/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(parseError(text, res.status))
  }
  return (await res.json()) as MonsterDraftResponse
}

export interface FloorDraftPackage {
  floor: Record<string, unknown>
  monsters: Array<Record<string, unknown>>
  items: Array<Record<string, unknown>>
}

export async function draftFloor(input: {
  description: string
  floorNumber?: number
  itemLevel?: number
}): Promise<FloorDraftPackage> {
  const res = await fetch(`${API_BASE}/api/editor/floors/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: input.description,
      floorNumber: input.floorNumber,
      itemLevel: input.itemLevel,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(parseError(text, res.status))
  }
  return (await res.json()) as FloorDraftPackage
}

export interface GenerateSpriteCommitResponse {
  spritePath: string
  source: string
  reason?: string
  quality?: string
  model?: string
}

export async function generateMonsterSprite(input: {
  id: string
  name: string
  description: string
  behavior: string
  generativeComplement?: string
  quality?: PixelLabQuality
  size?: number
}): Promise<PixelLabCandidatesResponse> {
  const res = await fetch(
    `${API_BASE}/api/editor/monsters/${encodeURIComponent(input.id)}/sprite`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: input.name,
        description: input.description,
        behavior: input.behavior,
        generativeComplement: input.generativeComplement || undefined,
        quality: input.quality ?? 'standard',
        size: input.size,
      }),
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(parseError(text, res.status))
  }
  const raw = (await res.json()) as Record<string, unknown>
  return normalizeCandidatesPayload(raw, 'spritePath')
}

export async function commitMonsterSprite(input: {
  id: string
  draftId: string
  index: number
}): Promise<GenerateSpriteCommitResponse> {
  const res = await fetch(
    `${API_BASE}/api/editor/monsters/${encodeURIComponent(input.id)}/sprite/commit`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftId: input.draftId, index: input.index }),
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(parseError(text, res.status))
  }
  return (await res.json()) as GenerateSpriteCommitResponse
}

export interface MonsterIdleAnimationDto {
  frames: string[]
  frameWidth: number
  frameHeight: number
  frameCount: number
  fps: number
  direction: string
}

export interface GenerateMonsterIdleDraftResponse {
  draftId: string
  frames: string[]
  frameWidth: number
  frameHeight: number
  frameCount: number
  fps: number
  direction: string
  source: string
  reason?: string
  quality?: string
  model?: string
  size?: number
}

export interface GenerateMonsterIdleCommitResponse {
  idle: MonsterIdleAnimationDto
  source: string
  reason?: string
  quality?: string
  model?: string
}

/** Animate static sprite → idle draft (PixelLab standard or Pro). */
export async function generateMonsterIdle(input: {
  id: string
  name?: string
  description?: string
  quality?: PixelLabQuality
  size?: number
}): Promise<GenerateMonsterIdleDraftResponse> {
  const res = await fetch(
    `${API_BASE}/api/editor/monsters/${encodeURIComponent(input.id)}/animate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: input.name,
        description: input.description,
        quality: input.quality ?? 'standard',
        size: input.size,
      }),
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(parseError(text, res.status))
  }
  return (await res.json()) as GenerateMonsterIdleDraftResponse
}

export async function commitMonsterIdle(input: {
  id: string
  draftId: string
}): Promise<GenerateMonsterIdleCommitResponse> {
  const res = await fetch(
    `${API_BASE}/api/editor/monsters/${encodeURIComponent(input.id)}/animate/commit`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftId: input.draftId }),
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(parseError(text, res.status))
  }
  return (await res.json()) as GenerateMonsterIdleCommitResponse
}

export async function discardPixelLabDraft(draftId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/editor/pixellab/discard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draftId }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(parseError(text, res.status))
  }
}

export interface GenerateAttributeCardResponse {
  cardPath: string
  source: string
  reason?: string
  /** Mensagem legível da API Gemini / exception (quando source=fallback). */
  detail?: string
}

export interface GenerateFloorBackgroundResponse {
  backgroundPath: string
  source: string
  reason?: string
  detail?: string
}

/** Floor background art via Google Gemini (16:9). */
export async function generateFloorBackground(input: {
  id: string
  name: string
  description: string
  theme: string
  generativeComplement?: string
}): Promise<GenerateFloorBackgroundResponse> {
  const res = await fetch(
    `${API_BASE}/api/editor/floors/${encodeURIComponent(input.id)}/background`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: input.name,
        description: input.description,
        theme: input.theme,
        generativeComplement: input.generativeComplement || undefined,
      }),
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(parseError(text, res.status))
  }
  return (await res.json()) as GenerateFloorBackgroundResponse
}

/** Attribute Magic card art via Google Gemini (not PixelLab). */
export async function generateAttributeCard(input: {
  id: string
  name: string
  description: string
  prompt?: string
}): Promise<GenerateAttributeCardResponse> {
  const res = await fetch(
    `${API_BASE}/api/editor/attributes/${encodeURIComponent(input.id)}/card`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: input.name,
        description: input.description,
        prompt: input.prompt || undefined,
      }),
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(parseError(text, res.status))
  }
  return (await res.json()) as GenerateAttributeCardResponse
}

function parseError(text: string, status: number): string {
  try {
    const j = JSON.parse(text) as { error?: string; title?: string; detail?: string }
    return j.error || j.detail || j.title || `HTTP ${status}`
  } catch {
    return text.trim() || `HTTP ${status}`
  }
}
