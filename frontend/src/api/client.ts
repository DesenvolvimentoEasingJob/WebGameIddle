import { getToken } from './token'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function parseError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string }
    if (data.error) return data.error
  } catch {
    /* ignore */
  }
  return response.statusText || `HTTP ${response.status}`
}

function headers(json = false): HeadersInit {
  const h: Record<string, string> = {}
  if (json) h['Content-Type'] = 'application/json'
  const token = getToken()
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

export async function apiGet<T>(path: string, _authenticated = false): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { headers: headers() })
  if (!response.ok) throw new ApiError(response.status, await parseError(response))
  return (await response.json()) as T
}

export async function apiPost<T>(path: string, body: unknown, _authenticated = false): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new ApiError(response.status, await parseError(response))
  return (await response.json()) as T
}

export function getApiBaseUrl(): string {
  return API_URL
}
