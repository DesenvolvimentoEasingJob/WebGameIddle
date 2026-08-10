import { getApiBaseUrl } from '../api/client'

/**
 * Resolve `assets.background` from floor JSON to a fetchable URL.
 * Content may store `/assets/floors/{file}.png` or `/api/assets/floors/{file}.png`.
 */
export function resolveFloorBackgroundUrl(
  background: string | undefined | null,
): string | null {
  const path = background?.trim()
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
  if (path.startsWith('/assets/floors/')) {
    const fileName = path.slice('/assets/floors/'.length)
    if (!fileName || fileName.includes('..')) return null
    apiPath = `/api/assets/floors/${fileName}`
  } else if (!path.startsWith('/api/')) {
    const fileName = path.split('/').pop()
    if (!fileName || fileName.includes('..')) return null
    apiPath = `/api/assets/floors/${fileName}`
  }

  const base = getApiBaseUrl().replace(/\/$/, '')
  return `${base}${apiPath.startsWith('/') ? apiPath : `/${apiPath}`}`
}
