import { getApiBaseUrl } from '../api/client'

/**
 * Resolve `assets.card` / training `cardPath` to a fetchable URL.
 * Content stores `/api/assets/attributes/{id}.png`.
 */
export function resolveAttributeCardUrl(card: string | undefined | null): string | null {
  const path = card?.trim()
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
  if (path.startsWith('/assets/attributes/')) {
    const fileName = path.slice('/assets/attributes/'.length)
    if (!fileName || fileName.includes('..')) return null
    apiPath = `/api/assets/attributes/${fileName}`
  } else if (!path.startsWith('/api/')) {
    const fileName = path.split('/').pop()
    if (!fileName || fileName.includes('..')) return null
    apiPath = `/api/assets/attributes/${fileName}`
  }

  const base = getApiBaseUrl().replace(/\/$/, '')
  return `${base}${apiPath.startsWith('/') ? apiPath : `/${apiPath}`}`
}
