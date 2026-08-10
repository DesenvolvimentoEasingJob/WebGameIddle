import type { ContentFolder } from '../types/content'

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  let data: unknown
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    throw new Error(`Invalid JSON response (${res.status})`)
  }

  if (!res.ok) {
    const err = data as { error?: string } | null
    throw new Error(err?.error ?? `Request failed (${res.status})`)
  }

  return data as T
}

export async function listContent<T>(folder: ContentFolder): Promise<T[]> {
  const res = await fetch(`/api/content/${folder}`)
  return parseJson<T[]>(res)
}

export async function getContent<T>(folder: ContentFolder, id: string): Promise<T> {
  const res = await fetch(`/api/content/${folder}/${encodeURIComponent(id)}`)
  return parseJson<T>(res)
}

export async function putContent<T extends { id: string }>(
  folder: ContentFolder,
  id: string,
  body: T,
): Promise<T> {
  const res = await fetch(`/api/content/${folder}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return parseJson<T>(res)
}

export async function deleteContent(folder: ContentFolder, id: string): Promise<void> {
  const res = await fetch(`/api/content/${folder}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  await parseJson<{ ok: boolean }>(res)
}
