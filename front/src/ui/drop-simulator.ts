import type { GameLootConfig } from "../api/gameplay";

/** Deterministic drop preview for VFX — does not mutate inventory. */
export function simulateDropPreview(
  lootConfig: GameLootConfig,
  seed: string,
  rollIndex: number,
): { rarityId: string; label: string } | null {
  const rng = seededRandom(`${seed}:${rollIndex}`);
  const rarities = Object.entries(lootConfig.rarities)
    .map(([id, rarity]) => ({ ...rarity, id }))
    .sort((a, b) => a.order - b.order);

  if (rarities.length === 0)
    return null;

  const totalWeight = rarities.reduce(
    (sum, r) => sum + ((r as { dropWeight?: number }).dropWeight ?? 1),
    0,
  );
  let roll = rng() * totalWeight;

  for (const rarity of rarities) {
    const weight = (rarity as { dropWeight?: number }).dropWeight ?? 1;
    roll -= weight;
    if (roll <= 0) {
      return { rarityId: rarity.id, label: rarity.label };
    }
  }

  const last = rarities[rarities.length - 1]!;
  return { rarityId: last.id, label: last.label };
}

function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function formatSimulatedDrop(
  preview: { rarityId: string; label: string } | null,
  lootConfig?: GameLootConfig | null,
): string {
  if (!preview) return "";
  const label = lootConfig?.rarities[preview.rarityId]?.label ?? preview.label;
  return `[${label}] item?`;
}
