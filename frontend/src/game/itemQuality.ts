import type { BagItem, RgbColor } from '../types/item'

/** Fallback alinhado a content/qualities/qualities.json (itens antigos sem bake). */
const FALLBACK_BY_STARS: Record<
  number,
  { name: string; colorStart: RgbColor; colorEnd: RgbColor }
> = {
  1: {
    name: 'Simples',
    colorStart: { r: 157, g: 157, b: 157 },
    colorEnd: { r: 220, g: 220, b: 220 },
  },
  2: {
    name: 'Refinado',
    colorStart: { r: 30, g: 178, b: 0 },
    colorEnd: { r: 120, g: 255, b: 90 },
  },
  3: {
    name: 'Raro',
    colorStart: { r: 0, g: 112, b: 221 },
    colorEnd: { r: 100, g: 180, b: 255 },
  },
  4: {
    name: 'Épico',
    colorStart: { r: 163, g: 53, b: 238 },
    colorEnd: { r: 210, g: 130, b: 255 },
  },
  5: {
    name: 'Lendário',
    colorStart: { r: 255, g: 128, b: 0 },
    colorEnd: { r: 255, g: 215, b: 60 },
  },
}

export function rgbCss(c: RgbColor): string {
  return `rgb(${c.r}, ${c.g}, ${c.b})`
}

export function resolveItemQuality(item: BagItem): {
  name?: string
  colorStart: RgbColor
  colorEnd: RgbColor
} | null {
  const stars = item.stars ? Math.min(5, Math.max(1, item.stars)) : 0
  if (!stars) return null

  const fallback = FALLBACK_BY_STARS[stars]
  if (!fallback) return null

  return {
    name: item.qualityName ?? fallback.name,
    colorStart: item.colorStart ?? fallback.colorStart,
    colorEnd: item.colorEnd ?? fallback.colorEnd,
  }
}

/** Variáveis CSS para borda/nome; gradiente animado só no tile selecionado. */
export function itemQualityStyle(item: BagItem): Record<string, string> | undefined {
  const q = resolveItemQuality(item)
  if (!q) return undefined
  return {
    '--item-color-start': rgbCss(q.colorStart),
    '--item-color-end': rgbCss(q.colorEnd),
  }
}
