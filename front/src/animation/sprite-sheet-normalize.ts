import {
  RAW_SHEET_HEIGHT,
  RAW_SHEET_WIDTH,
  SHEET_HEIGHT,
  SHEET_WIDTH,
} from "./sprite-config";

const normalizedUrlCache = new Map<string, string>();

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Falha ao carregar sprite sheet: ${url}`));
    img.src = url;
  });
}

/**
 * Adiciona padding transparente (2px direita, 1px baixo) quando a sheet está em 1774×887.
 * Não escala — apenas encaixa a imagem no canto superior esquerdo de 1776×888.
 */
export async function normalizeSpriteSheetUrl(imageUrl: string): Promise<string> {
  const cached = normalizedUrlCache.get(imageUrl);
  if (cached) return cached;

  const img = await loadImage(imageUrl);

  if (img.width === SHEET_WIDTH && img.height === SHEET_HEIGHT) {
    normalizedUrlCache.set(imageUrl, imageUrl);
    return imageUrl;
  }

  const needsPadding =
    img.width === RAW_SHEET_WIDTH &&
    img.height === RAW_SHEET_HEIGHT;

  if (!needsPadding) {
    normalizedUrlCache.set(imageUrl, imageUrl);
    return imageUrl;
  }

  const canvas = document.createElement("canvas");
  canvas.width = SHEET_WIDTH;
  canvas.height = SHEET_HEIGHT;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    normalizedUrlCache.set(imageUrl, imageUrl);
    return imageUrl;
  }

  ctx.clearRect(0, 0, SHEET_WIDTH, SHEET_HEIGHT);
  ctx.drawImage(img, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });

  if (!blob) {
    normalizedUrlCache.set(imageUrl, imageUrl);
    return imageUrl;
  }

  const objectUrl = URL.createObjectURL(blob);
  normalizedUrlCache.set(imageUrl, objectUrl);
  return objectUrl;
}

export function revokeNormalizedSpriteUrls(): void {
  for (const [source, normalized] of normalizedUrlCache) {
    if (normalized !== source) {
      URL.revokeObjectURL(normalized);
    }
  }
  normalizedUrlCache.clear();
}
