import { apiGet, apiPost } from './client'
import type { CharacterStats, CharacterSummary, GameClass, ItemDef, Race } from '../types/api'

export function listRaces() {
  return apiGet<Race[]>('/api/content/races')
}

export function listClasses() {
  return apiGet<GameClass[]>('/api/content/classes')
}

export function listItems() {
  return apiGet<ItemDef[]>('/api/content/items')
}

export function createCharacter(name: string, raceId: string, classId: string) {
  return apiPost<CharacterSummary>(
    '/api/characters',
    { name, raceId, classId },
    true,
  )
}

export function fetchMyCharacter() {
  return apiGet<CharacterSummary>('/api/characters/me', true)
}

export function fetchMyStats() {
  return apiGet<CharacterStats>('/api/characters/me/stats', true)
}
