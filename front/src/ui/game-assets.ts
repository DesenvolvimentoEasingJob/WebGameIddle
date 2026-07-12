/** Caminhos relativos a `front/assets/` vindos do JSON do backend. */

import type { RolledAffix } from "../api/gameplay";

export const UNKNOWN_ASSET_URL = "/assets/unknown.png";

const raceAssets = import.meta.glob<string>("../../assets/races/*.png", {
  eager: true,
  query: "?url",
  import: "default",
});

const raceProfileAssets = import.meta.glob<string>("../../assets/races/profile/*.png", {
  eager: true,
  query: "?url",
  import: "default",
});

const classAssets = import.meta.glob<string>("../../assets/classes/*.png", {
  eager: true,
  query: "?url",
  import: "default",
});

const itemAssets = import.meta.glob<string>("../../assets/items/**/*.png", {
  eager: true,
  query: "?url",
  import: "default",
});

const mobAssets = import.meta.glob<string>("../../assets/mobs/**/*.png", {
  eager: true,
  query: "?url",
  import: "default",
});

const mobIconAssets = import.meta.glob<string>("../../assets/mobs/*-icon.png", {
  eager: true,
  query: "?url",
  import: "default",
});

const floorBackgroundAssets = import.meta.glob<string>("../../assets/backgrounds/flor-*.png", {
  eager: true,
  query: "?url",
  import: "default",
});

const gameAssetModules: Record<string, string> = {
  ...raceAssets,
  ...classAssets,
  ...itemAssets,
  ...mobAssets,
  ...mobIconAssets,
};

/** Background do andar na arena (ex.: backgrounds/flor-1.png). */
export function resolveFloorBackground(floor: number): string {
  const entries = Object.entries(floorBackgroundAssets)
    .map(([path, url]) => ({ path: path.replace(/\\/g, "/"), url }))
    .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));

  if (entries.length === 0) return UNKNOWN_ASSET_URL;

  const target = `flor-${floor}.png`;
  const exact = entries.find((entry) => entry.path.endsWith(`/${target}`));
  if (exact) return exact.url;

  // Reutiliza os fundos disponíveis em ciclo (só existe flor-1 por enquanto).
  const index = Math.max(0, floor - 1) % entries.length;
  return entries[index]!.url;
}

export function resolveGameAsset(relativePath: string): string | null {
  const normalized = relativePath.replace(/\\/g, "/");
  for (const [path, url] of Object.entries(gameAssetModules)) {
    if (path.replace(/\\/g, "/").endsWith(`/${normalized}`)) {
      return url;
    }
  }
  return null;
}

/** Retorna o asset resolvido ou `unknown.png` quando o arquivo ainda não existe. */
export function resolveGameAssetOrUnknown(relativePath?: string | null): string {
  if (!relativePath) return UNKNOWN_ASSET_URL;
  return resolveGameAsset(relativePath) ?? UNKNOWN_ASSET_URL;
}

export function resolveRaceSprite(assets?: Record<string, string>): string {
  return resolveGameAssetOrUnknown(assets?.sprite);
}

export function resolveRaceProfile(raceId: string): string {
  const target = `profile/${raceId}.png`;
  for (const [path, url] of Object.entries(raceProfileAssets)) {
    if (path.replace(/\\/g, "/").endsWith(`/${target}`)) {
      return url;
    }
  }
  return UNKNOWN_ASSET_URL;
}

export function resolveClassSprite(
  raceId: string,
  assets?: Record<string, string>,
): string {
  const suffix = assets?.spriteSuffix;
  if (!suffix) return UNKNOWN_ASSET_URL;
  return resolveGameAssetOrUnknown(`classes/${raceId}-${suffix}.png`);
}

export function resolveItemIcon(assets?: { icon?: string }): string {
  if (!assets?.icon || assets.icon === "unknown.png")
    return UNKNOWN_ASSET_URL;

  return resolveGameAssetOrUnknown(assets.icon);
}

export function resolveCharacterSprite(assets?: { sprite?: string }): string {
  return resolveGameAssetOrUnknown(assets?.sprite);
}

export function resolveMobSprite(
  mobId: string,
  assets?: { sprite?: string },
): string {
  const path = assets?.sprite ?? `mobs/${mobId}.png`;
  return resolveGameAssetOrUnknown(path);
}

/** Profile card / ícone estático do mob (não usar sprite sheet de animação). */
export function resolveMobIcon(
  mobId: string,
  assets?: { icon?: string },
): string {
  const path = assets?.icon ?? `mobs/${mobId}-icon.png`;
  return resolveGameAssetOrUnknown(path);
}

const ATTRIBUTE_LABELS: Record<string, string> = {
  strength: "Força",
  agility: "Agilidade",
  intelligence: "Inteligência",
};

const DAMAGE_LABELS: Record<string, string> = {
  physical: "Dano físico",
  magical: "Dano mágico",
};

export interface CategoryTree {
  attributes?: Record<string, { base?: number; bonus?: number }>;
  damage?: Record<string, { bonusPercent?: number }>;
  combat?: Record<string, number>;
}

export function formatAffixSummary(affixes?: RolledAffix[]): string[] {
  if (!affixes?.length) return [];

  return affixes.map((affix) => {
    const suffix = affix.suffix ?? "";
    return `${affix.label}: +${affix.value}${suffix}`;
  });
}

export function formatCategorySummary(categories?: CategoryTree): string[] {
  if (!categories) return [];

  const lines: string[] = [];

  if (categories.attributes) {
    for (const [key, value] of Object.entries(categories.attributes)) {
      const label = ATTRIBUTE_LABELS[key] ?? key;
      if (value.base !== undefined) lines.push(`${label}: +${value.base}`);
    }
  }

  if (categories.damage) {
    for (const [key, value] of Object.entries(categories.damage)) {
      const label = DAMAGE_LABELS[key] ?? key;
      if (value.bonusPercent !== undefined && value.bonusPercent !== 0) {
        lines.push(`${label}: +${value.bonusPercent}%`);
      }
    }
  }

  return lines;
}

export function formatItemStatSections(entry?: {
  rolledCategories?: CategoryTree;
  rolledAffixes?: RolledAffix[];
}, catalogCategories?: CategoryTree): { base: string[]; additional: string[] } {
  const base = formatCategorySummary(entry?.rolledCategories ?? catalogCategories);
  const additional = formatAffixSummary(entry?.rolledAffixes);
  return { base, additional };
}
