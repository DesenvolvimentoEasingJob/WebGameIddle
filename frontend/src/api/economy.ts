import { apiGet } from './client'

export type EconomyBalance = { skyCoin: number }

export type LedgerEntry = {
  id: string
  amount: number
  balanceAfter: number
  reason: string
  reference: string | null
  createdAt: string
}

export function fetchBalance() {
  return apiGet<EconomyBalance>('/api/economy/balance', true)
}

export function fetchLedger(take = 50) {
  return apiGet<LedgerEntry[]>(`/api/economy/ledger?take=${take}`, true)
}
