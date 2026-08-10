import { getApiBaseUrl } from '../api/client'

/**
 * Resolve `assets.sprite` (or an idle frame path) from monster JSON / encounter DTO
 * to a fetchable URL. Content stores `/assets/monsters/{file}.png`; files are served at
 * `GET /api/assets/monsters/{fileName}`.
 */
export function resolveMonsterSpriteUrl(sprite: string | undefined | null): string | null {
  const path = sprite?.trim()
  if (!path) return null

  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('data:') ||
    path.startsWith('blob:')
  ) {
    return path
  }

  let apiPath = path
  if (path.startsWith('/assets/monsters/')) {
    const fileName = path.slice('/assets/monsters/'.length)
    if (!fileName || fileName.includes('..')) return null
    apiPath = `/api/assets/monsters/${fileName}`
  } else if (!path.startsWith('/api/')) {
    const fileName = path.split('/').pop()
    if (!fileName || fileName.includes('..')) return null
    apiPath = `/api/assets/monsters/${fileName}`
  }

  const base = getApiBaseUrl().replace(/\/$/, '')
  return `${base}${apiPath.startsWith('/') ? apiPath : `/${apiPath}`}`
}

/** Resolve all idle frame URLs; drops invalid entries. */
export function resolveMonsterIdleFrameUrls(frames: string[] | undefined | null): string[] {
  if (!frames?.length) return []
  return frames
    .map((f) => resolveMonsterSpriteUrl(f))
    .filter((u): u is string => Boolean(u))
}
