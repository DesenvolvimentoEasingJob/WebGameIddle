import type { DroppedItem, GameLootConfig, TowerCombatRewards } from "../api/gameplay";
import { resolveRarityLabel } from "./loot-config";

export function formatCombatRewardMessage(
  reward: TowerCombatRewards,
  lootConfig?: GameLootConfig | null,
): string {
  const parts = [`+${reward.xp} XP`, `+${reward.gold} ouro`];

  if (reward.items.length > 0) {
    parts.push(reward.items.map((item) => formatDroppedItem(item, lootConfig)).join(" · "));
  }

  if (reward.lostItems.length > 0) {
    parts.push(
      `Inventário cheio: ${reward.lostItems.map((item) => formatDroppedItem(item, lootConfig)).join(" · ")}`,
    );
  }

  return parts.join(" · ");
}

function formatDroppedItem(item: DroppedItem, lootConfig?: GameLootConfig | null): string {
  const rarity = resolveRarityLabel(item.rarity, lootConfig);
  const qty = item.quantity > 1 ? ` ×${item.quantity}` : "";
  return `[${rarity}] ${item.name}${qty}`;
}
