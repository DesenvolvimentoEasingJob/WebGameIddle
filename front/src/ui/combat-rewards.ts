import type { DroppedItem, GameLootConfig, TowerCombatRewards } from "../api/gameplay";
import { resolveRarityLabel } from "./loot-config";

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}

function formatDroppedItem(item: DroppedItem, lootConfig?: GameLootConfig | null): string {
  const rarity = resolveRarityLabel(item.rarity, lootConfig);
  const qty = item.quantity > 1 ? ` ×${item.quantity}` : "";
  return `[${rarity}] ${item.name}${qty}`;
}

export function formatVictoryMessage(reward: TowerCombatRewards): string {
  return `Vitória! +${formatNumber(reward.xp)} XP · +${formatNumber(reward.gold)} ouro`;
}

export function formatDropEventMessages(
  reward: TowerCombatRewards,
  lootConfig?: GameLootConfig | null,
): string[] {
  const messages: string[] = [];

  for (const item of reward.items) {
    messages.push(`Drop: ${formatDroppedItem(item, lootConfig)}`);
  }

  for (const item of reward.lostItems) {
    messages.push(`Inventário cheio: ${formatDroppedItem(item, lootConfig)}`);
  }

  return messages;
}

export function publishCombatRewardEvents(
  reward: TowerCombatRewards,
  lootConfig: GameLootConfig | null | undefined,
  onEvent: (message: string) => void,
): void {
  onEvent(formatVictoryMessage(reward));
  for (const message of formatDropEventMessages(reward, lootConfig)) {
    onEvent(message);
  }
}
