import { apiGet, apiPost } from './client'

export type TrainingCost = {
  attribute: string
  name?: string | null
  description?: string | null
  cardPath?: string | null
  formulas?: string[]
  currentValue: number
  amount: number
  lastCost: number | null
  cost: number
}

export function trainAttribute(attribute: string) {
  return apiPost<{
    attribute: string
    value: number
    amount: number
    cost: number
    skyCoin: number
    calculated?: Record<string, number>
  }>('/api/training/train', { attribute }, true)
}

export function fetchTrainingCosts() {
  return apiGet<{ attributes: TrainingCost[] }>('/api/training/costs', true)
}

export function previewTraining(attribute: string, lastCost?: number | null) {
  const qs = new URLSearchParams({ attribute })
  if (lastCost != null) qs.set('lastCost', String(lastCost))
  return apiGet<{ attribute: string; lastCost: number | null; cost: number }>(
    `/api/training/preview?${qs}`,
    true,
  )
}
