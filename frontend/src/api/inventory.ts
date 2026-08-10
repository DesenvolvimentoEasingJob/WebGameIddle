import { apiGet } from './client'
import type { BagItem } from '../types/item'

export type InventoryResponse = {
  slotCount: number
  items: BagItem[]
  equipment: Record<string, BagItem | null>
  equipmentSlots: { name: string; itemType: string[]; boxSize: number }[]
}

export function fetchInventory() {
  return apiGet<InventoryResponse>('/api/inventory', true)
}
