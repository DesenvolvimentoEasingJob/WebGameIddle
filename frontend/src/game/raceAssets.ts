import { getApiBaseUrl } from '../api/client'

/**
 * Resolve race `assets.portrait` from content JSON to a fetchable URL.
 * Content stores `/assets/races/{id}.png`; files are served at
 * `GET /api/assets/races/{fileName}`.
 */
export function resolveRacePortraitUrl(portrait: string | undefined | null): string | null {
  const path = portrait?.trim()
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
  if (path.startsWith('/assets/races/')) {
    const fileName = path.slice('/assets/races/'.length)
    if (!fileName || fileName.includes('..')) return null
    apiPath = `/api/assets/races/${fileName}`
  } else if (!path.startsWith('/api/')) {
    const fileName = path.split('/').pop()
    if (!fileName || fileName.includes('..')) return null
    apiPath = `/api/assets/races/${fileName}`
  }

  const base = getApiBaseUrl().replace(/\/$/, '')
  return `${base}${apiPath.startsWith('/') ? apiPath : `/${apiPath}`}`
}
