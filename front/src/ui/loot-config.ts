import type { GameLootConfig } from "../api/gameplay";
import atlasData from "./atlas.json";
import { slotFrameForRarity, type FrameName } from "./atlas";

/** Label from backend loot config, with optional fallback map. */
export function resolveRarityLabel(
  rarityId: string,
  lootConfig?: GameLootConfig | null,
): string {
  const fromConfig = lootConfig?.rarities[rarityId]?.label;
  if (fromConfig) return fromConfig;
  return rarityId.charAt(0).toUpperCase() + rarityId.slice(1);
}

/** CSS class suffix for inventory slot border (`item-slot--frame-rare`). */
export function raritySlotFrameClass(
  rarityId: string,
  lootConfig?: GameLootConfig | null,
): string {
  if (!rarityId || rarityId === "common") return "";

  const slotFrame = lootConfig?.rarities[rarityId]?.slotFrame ?? `slot-${rarityId}`;
  const frameName = resolveSlotFrameName(rarityId, slotFrame);
  if (frameName === "slot-common") return "";

  return ` item-slot--frame-${rarityId}`;
}

/** Inline style for dynamic atlas frames (works for new rarities added to atlas.json). */
export function raritySlotFrameStyle(
  rarityId: string,
  lootConfig?: GameLootConfig | null,
): string | undefined {
  if (!rarityId || rarityId === "common") return undefined;

  const slotFrame = lootConfig?.rarities[rarityId]?.slotFrame ?? `slot-${rarityId}`;
  const frameName = resolveSlotFrameName(rarityId, slotFrame);
  if (frameName === "slot-common") return undefined;

  return `--item-rarity-frame: var(--ui-${frameName}, var(--ui-slot-common));`;
}

function resolveSlotFrameName(rarityId: string, slotFrame?: string | null): FrameName {
  if (slotFrame && slotFrame in atlasData.frames) {
    return slotFrame as FrameName;
  }

  return slotFrameForRarity(rarityId);
}

export function buildRarityLabelMap(lootConfig?: GameLootConfig | null): Record<string, string> {
  if (!lootConfig) return {};

  return Object.fromEntries(
    Object.entries(lootConfig.rarities).map(([id, rarity]) => [id, rarity.label]),
  );
}
