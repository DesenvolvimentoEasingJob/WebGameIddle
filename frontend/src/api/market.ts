import { apiGet, apiPost } from './client'
import type { BagItem } from '../types/item'

export type MarketListingRow = {
  id: string
  itemId: string
  priceEach: number
  quantity: number
  sellerId: string
  createdAt: string
  item?: BagItem | null
}

export function fetchMarket() {
  return apiGet<MarketListingRow[]>('/api/market', true)
}

export function listOnMarket(bagIndex: number, quantity: number, priceEach: number) {
  return apiPost<{ id: string; itemId: string; quantity: number; priceEach: number }>(
    '/api/market/list',
    { bagIndex, quantity, priceEach },
    true,
  )
}

export function buyListing(listingId: string, quantity: number) {
  return apiPost<{ itemId: string; quantity: number; totalPaid: number; skyCoin: number }>(
    '/api/market/buy',
    { listingId, quantity },
    true,
  )
}

export function cancelListing(listingId: string) {
  return apiPost<{ ok: boolean }>('/api/market/cancel', { listingId }, true)
}
