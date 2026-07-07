import type { AnimMapSource } from "@front/animation/anim-map-types";

export const SHEET_WIDTH = 1776;
export const SHEET_HEIGHT = 888;
export const VIEWPORT_WIDTH = 296;
export const VIEWPORT_HEIGHT = 296;
export const GRID_COLUMNS = 6;
export const GRID_ROWS = 3;

const LEGACY_WIDTH = 1774;
const LEGACY_HEIGHT = 887;

export const ANIM_ROW_NAMES = ["idle", "attack", "critical"] as const;

export interface GridLayout {
  offsetX: number;
  offsetY: number;
  cellWidth: number;
  cellHeight: number;
  columns: number;
  rows: number;
}

export interface BuildAnimMapOptions {
  id: string;
  sheet: string;
  grid?: GridLayout;
  fpsIdle?: number;
  fpsAttack?: number;
  fpsCritical?: number;
}

export interface NormalizeSheetResult {
  base64: string;
  width: number;
  height: number;
  grid: GridLayout;
}

export interface EditPromptOptions {
  kind: "mob" | "player";
  description: string;
  style?: string;
  referenceId?: string;
}

export const DEFAULT_MOB_REFERENCE = "f1-bat";
export const DEFAULT_STYLE =
  "pixel art 16-bit retro RPG, crisp pixels, limited color palette, chibi proportions, same visual style as classic 2D tower RPG enemy sprites";

export function buildFramesFromGrid(
  grid: GridLayout,
  rowNames: readonly string[],
): AnimMapSource["frames"] {
  const frames: AnimMapSource["frames"] = {};
  for (let row = 0; row < grid.rows; row++) {
    const rowName = rowNames[row] ?? `row${row}`;
    for (let col = 0; col < grid.columns; col++) {
      frames[`${rowName}-${col}`] = {
        x: Math.round(grid.offsetX + col * grid.cellWidth),
        y: Math.round(grid.offsetY + row * grid.cellHeight),
        w: Math.round(grid.cellWidth),
        h: Math.round(grid.cellHeight),
      };
    }
  }
  return frames;
}

export function buildAnimationsFromGrid(
  columns: number,
  rowNames: readonly string[],
  fpsByRow: Record<string, number>,
): AnimMapSource["animations"] {
  const animations: AnimMapSource["animations"] = {};
  for (const name of rowNames) {
    const frames = Array.from({ length: columns }, (_, i) => `${name}-${i}`);
    animations[name] = {
      frames,
      fps: fpsByRow[name] ?? 10,
      loop: name === "idle",
      ...(name !== "idle" ? { next: "idle" } : {}),
    };
  }
  return animations;
}

export function buildDefaultAnimMap(options: BuildAnimMapOptions): AnimMapSource {
  const rowNames = ANIM_ROW_NAMES.slice(0, GRID_ROWS);
  const fpsByRow = {
    idle: options.fpsIdle ?? 7,
    attack: options.fpsAttack ?? 12,
    critical: options.fpsCritical ?? 12,
  };
  const grid = options.grid ?? defaultGridLayout();

  return {
    id: options.id,
    sheet: options.sheet,
    viewportWidth: VIEWPORT_WIDTH,
    viewportHeight: VIEWPORT_HEIGHT,
    frames: buildFramesFromGrid(grid, rowNames),
    animations: buildAnimationsFromGrid(grid.columns, rowNames, fpsByRow),
  };
}

export function loadImageFromDataUrl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar imagem"));
    img.src = src;
  });
}

export function canvasToBase64Png(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/png").split(",")[1] ?? "";
}

export function defaultGridLayout(): GridLayout {
  return {
    offsetX: 0,
    offsetY: 0,
    cellWidth: SHEET_WIDTH / GRID_COLUMNS,
    cellHeight: SHEET_HEIGHT / GRID_ROWS,
    columns: GRID_COLUMNS,
    rows: GRID_ROWS,
  };
}

export async function normalizeSheetToTargetSize(
  base64: string,
  columns = GRID_COLUMNS,
  rows = GRID_ROWS,
): Promise<NormalizeSheetResult> {
  const dataUrl = `data:image/png;base64,${base64}`;
  const img = await loadImageFromDataUrl(dataUrl);

  if (img.width === SHEET_WIDTH && img.height === SHEET_HEIGHT) {
    return { base64, width: SHEET_WIDTH, height: SHEET_HEIGHT, grid: defaultGridLayout() };
  }

  if (img.width === LEGACY_WIDTH && img.height === LEGACY_HEIGHT) {
    const canvas = document.createElement("canvas");
    canvas.width = SHEET_WIDTH;
    canvas.height = SHEET_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, SHEET_WIDTH, SHEET_HEIGHT);
      ctx.drawImage(img, 0, 0);
      return {
        base64: canvasToBase64Png(canvas),
        width: SHEET_WIDTH,
        height: SHEET_HEIGHT,
        grid: defaultGridLayout(),
      };
    }
    return {
      base64,
      width: img.width,
      height: img.height,
      grid: gridFromDimensions(img.width, img.height, columns, rows),
    };
  }

  const canvas = document.createElement("canvas");
  canvas.width = SHEET_WIDTH;
  canvas.height = SHEET_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      base64,
      width: img.width,
      height: img.height,
      grid: gridFromDimensions(img.width, img.height, columns, rows),
    };
  }

  ctx.clearRect(0, 0, SHEET_WIDTH, SHEET_HEIGHT);
  const scale = Math.min(SHEET_WIDTH / img.width, SHEET_HEIGHT / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const offsetX = (SHEET_WIDTH - drawW) / 2;
  const offsetY = (SHEET_HEIGHT - drawH) / 2;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

  return {
    base64: canvasToBase64Png(canvas),
    width: SHEET_WIDTH,
    height: SHEET_HEIGHT,
    grid: {
      offsetX,
      offsetY,
      cellWidth: drawW / columns,
      cellHeight: drawH / rows,
      columns,
      rows,
    },
  };
}

export function gridFromDimensions(
  width: number,
  height: number,
  columns: number,
  rows: number,
): GridLayout {
  return {
    offsetX: 0,
    offsetY: 0,
    cellWidth: width / columns,
    cellHeight: height / rows,
    columns,
    rows,
  };
}

export function buildEditPrompt(options: EditPromptOptions): string {
  const style = options.style?.trim() || DEFAULT_STYLE;
  const description = options.description.trim();
  const referenceId = options.referenceId ?? DEFAULT_MOB_REFERENCE;
  const facing =
    options.kind === "mob"
      ? "The new monster MUST face LEFT (profile view, snout toward the left edge) in every frame."
      : "The new hero MUST face RIGHT in every frame.";

  return [
    `Edit the attached SkySpire sprite sheet (${referenceId} layout).`,
    `Replace ONLY the character artwork with: ${description}.`,
    "",
    "PRESERVE EXACTLY from the reference image:",
    `- Canvas size and ${GRID_COLUMNS}×${GRID_ROWS} grid (do not resize or restructure)`,
    "- Same cell positions, spacing, and proportions as the template",
    "- Pixel art density, color palette feel, and chibi scale of the template",
    "- Transparent background — remove any boxes, borders, grey/white cell backgrounds",
    "- Row 1 = idle (6 distinct subtle poses), row 2 = attack (6 wind-up→strike frames), row 3 = critical (6 dramatic poses)",
    "",
    facing,
    "- No text, watermarks, or grid lines",
    `ART STYLE: ${style}`,
    "Result: same sheet dimensions as input, new character, game-ready for SkySpire.",
  ].join("\n");
}

export function defaultReferenceId(kind: "mob" | "player"): string {
  return kind === "mob" ? DEFAULT_MOB_REFERENCE : "elf-mage";
}

export function inferGridFromAnimMap(map: AnimMapSource): GridLayout | null {
  const idle0 = map.frames["idle-0"];
  const idle1 = map.frames["idle-1"];
  const attack0 = map.frames["attack-0"];
  if (!idle0 || !idle1 || !attack0) return null;

  const cellWidth = idle1.x - idle0.x;
  const cellHeight = attack0.y - idle0.y;
  if (cellWidth <= 0 || cellHeight <= 0) return null;

  const columns = Object.keys(map.frames).filter((id) => id.startsWith("idle-")).length || 6;
  const maxY = Math.max(...Object.values(map.frames).map((f) => f.y + f.h));
  const rows = Math.round((maxY - idle0.y) / cellHeight);

  return {
    offsetX: idle0.x,
    offsetY: idle0.y,
    cellWidth,
    cellHeight,
    columns,
    rows: rows || 3,
  };
}

export function cloneAnimMapWithNewId(
  source: AnimMapSource,
  id: string,
  sheet: string,
): AnimMapSource {
  return {
    id,
    sheet,
    viewportWidth: source.viewportWidth,
    viewportHeight: source.viewportHeight,
    frames: structuredClone(source.frames),
    animations: structuredClone(source.animations),
  };
}

export function isDefault296Grid(map: AnimMapSource): boolean {
  const idle0 = map.frames["idle-0"];
  return idle0?.x === 0 && idle0?.y === 0 && idle0?.w === 296 && idle0?.h === 296;
}
