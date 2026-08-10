import { apiGet, apiPost } from './client'
import type { BattleResult, TowerState } from '../types/api'

export function fetchTowerState() {
  return apiGet<TowerState>('/api/tower/state', true)
}

export function enterTower(floor: number) {
  return apiPost<TowerState>('/api/tower/enter', { floor }, true)
}

export function setAutoClimb(enabled: boolean) {
  return apiPost<TowerState>('/api/tower/auto-climb', { enabled }, true)
}

export function moveRoom(room: number) {
  return apiPost<TowerState>('/api/tower/move', { room }, true)
}

export function startBattle() {
  return apiPost<BattleResult>('/api/tower/battle/start', {}, true)
}

/** Chefe com atributos normais: vitória libera o próximo andar. */
export function challengeBoss() {
  return apiPost<BattleResult>('/api/tower/challenge/boss', {}, true)
}

/** Chefe ×N (ou clone do dono): vitória registra o andar no seu nome. */
export function challengeRegistry() {
  return apiPost<BattleResult>('/api/tower/challenge/registry', {}, true)
}

export function fetchOwnership(floor: number) {
  return apiGet<{
    floor: number
    owned: boolean
    ownerUsername: string | null
    claimedAt: string | null
  }>(`/api/tower/ownership/${floor}`, true)
}

export function fetchFloor(n: number) {
  return apiGet<Record<string, unknown>>(`/api/tower/floors/${n}`, true)
}

export type FloorSummary = { number: number; name: string }

export async function fetchFloors(): Promise<FloorSummary[]> {
  const floors = await apiGet<Array<{ number?: number; name?: string }>>('/api/tower/floors', true)
  return floors
    .map((f, i) => ({ number: f.number ?? i + 1, name: f.name ?? `Andar ${f.number ?? i + 1}` }))
    .sort((a, b) => a.number - b.number)
}
