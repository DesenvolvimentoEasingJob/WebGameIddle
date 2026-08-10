import { getApiBaseUrl } from '../api/client'

/**
 * Resolve `assets.icon` from content/bag JSON to a fetchable URL.
 * Content often stores `/assets/items/{id}.png`; files are served at
 * `GET /api/assets/items/{fileName}`.
 */
export function resolveItemIconUrl(icon: string | undefined | null): string | null {
  const path = icon?.trim()
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
  if (path.startsWith('/assets/items/')) {
    const fileName = path.slice('/assets/items/'.length)
    if (!fileName || fileName.includes('..')) return null
    apiPath = `/api/assets/items/${fileName}`
  } else if (!path.startsWith('/api/')) {
    const fileName = path.split('/').pop()
    if (!fileName || fileName.includes('..')) return null
    apiPath = `/api/assets/items/${fileName}`
  }

  const base = getApiBaseUrl().replace(/\/$/, '')
  return `${base}${apiPath.startsWith('/') ? apiPath : `/${apiPath}`}`
}
