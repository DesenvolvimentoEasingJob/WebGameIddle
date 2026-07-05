/** Caminhos relativos a `front/assets/` vindos do JSON do backend. */

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

const gameAssetModules: Record<string, string> = {
  ...raceAssets,
  ...classAssets,
  ...itemAssets,
};

export function resolveGameAsset(relativePath: string): string | null {
  const normalized = relativePath.replace(/\\/g, "/");
  for (const [path, url] of Object.entries(gameAssetModules)) {
    if (path.replace(/\\/g, "/").endsWith(`/${normalized}`)) {
      return url;
    }
  }
  return null;
}

export function resolveRaceSprite(assets?: Record<string, string>): string | null {
  const path = assets?.sprite;
  return path ? resolveGameAsset(path) : null;
}

export function resolveRaceProfile(raceId: string): string | null {
  const target = `profile/${raceId}.png`;
  for (const [path, url] of Object.entries(raceProfileAssets)) {
    if (path.replace(/\\/g, "/").endsWith(`/${target}`)) {
      return url;
    }
  }
  return null;
}

export function resolveClassSprite(
  raceId: string,
  assets?: Record<string, string>,
): string | null {
  const suffix = assets?.spriteSuffix;
  if (!suffix) return null;
  return resolveGameAsset(`classes/${raceId}-${suffix}.png`);
}

export function resolveItemIcon(assets?: { icon?: string }): string | null {
  const path = assets?.icon;
  return path ? resolveGameAsset(path) : null;
}

export interface CategoryTree {
  attributes?: Record<string, { base?: number }>;
  damage?: Record<string, { bonusPercent?: number }>;
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
