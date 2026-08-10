import { apiGet } from './client'

export type RankingRow = {
  username: string
  characterName: string
  level: number
  lastFloor: number
  lastRoom: number
  kills: number
  floorsOwned: number
  skyCoin: number
}

export function fetchRankings(by: 'floor' | 'level' | 'wealth' = 'floor') {
  return apiGet<RankingRow[]>(`/api/rankings?by=${by}`, false)
}
