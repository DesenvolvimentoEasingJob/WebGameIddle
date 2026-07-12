import atlasData from "./atlas.json";

export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type FrameName = keyof typeof atlasData.frames;

export const ITEM_SLOT_FRAMES: Record<string, FrameName> = {
  common: "slot-common",
  uncommon: "slot-uncommon",
  rare: "slot-rare",
  epic: "slot-epic",
  legendary: "slot-legendary",
  empty: "slot-common",
};

export function slotFrameForRarity(rarity: string): FrameName {
  if (rarity in ITEM_SLOT_FRAMES) {
    return ITEM_SLOT_FRAMES[rarity];
  }

  const dynamicFrame = `slot-${rarity}` as FrameName;
  if (dynamicFrame in atlasData.frames) {
    return dynamicFrame;
  }

  return "slot-common";
}

const frames = atlasData.frames as Record<FrameName, Frame>;
const dataUrlCache = new Map<FrameName, string>();

let sheetPromise: Promise<HTMLImageElement> | null = null;

function loadSheet(): Promise<HTMLImageElement> {
  if (!sheetPromise) {
    sheetPromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = atlasData.sheet;
    });
  }
  return sheetPromise;
}

/** Extrai um frame do sprite sheet como data URL (PNG com alpha). */
export async function frameDataURL(name: FrameName): Promise<string> {
  const cached = dataUrlCache.get(name);
  if (cached) return cached;

  const sheet = await loadSheet();
  const f = frames[name];
  const canvas = document.createElement("canvas");
  canvas.width = f.w;
  canvas.height = f.h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
  const url = canvas.toDataURL("image/png");
  dataUrlCache.set(name, url);
  return url;
}

export function getFrame(name: FrameName): Frame {
  return frames[name];
}

/** Frames usados nos controles da torre (andar + combate). */
export const TOWER_CONTROL_FRAMES = {
  floorDown: "btn-back",
  floorUp: "btn-next",
  combat: "btn-play",
  repeat: "btn-hounting",
} as const satisfies Record<string, FrameName>;

/**
 * Registra cada frame do atlas como CSS custom property no :root
 * (--ui-<nome>: url(data:...)), permitindo usar os sprites direto no CSS
 * com border-image / background-image.
 */
export async function installAtlasCSSVars(): Promise<void> {
  const root = document.documentElement;
  const names = Object.keys(frames) as FrameName[];
  await Promise.all(
    names.map(async (name) => {
      const url = await frameDataURL(name);
      root.style.setProperty(`--ui-${name}`, `url("${url}")`);
    }),
  );
  root.classList.add("atlas-ready");
}
