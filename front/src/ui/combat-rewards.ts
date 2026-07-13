import type { CombatRewardItem, GameLootConfig, TowerCombatBatchResult, TowerCombatRewards } from "../api/gameplay";
import { resolveRarityLabel } from "./loot-config";

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}

function formatDroppedItem(item: CombatRewardItem, lootConfig?: GameLootConfig | null): string {
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

/** Mensagens de evento derivadas localmente — usadas pelo cache de combate. */
export function buildCombatEventMessages(
  combat: { outcome: string; rewards: TowerCombatRewards | null },
  lootConfig?: GameLootConfig | null,
): string[] {
  if (combat.outcome !== "player_win" || !combat.rewards) {
    return [];
  }

  return [formatVictoryMessage(combat.rewards), ...formatDropEventMessages(combat.rewards, lootConfig)];
}

export function publishCombatRewardEvents(
  reward: TowerCombatRewards,
  lootConfig: GameLootConfig | null | undefined,
  onEvent: (message: string) => void,
): void {
  for (const message of buildCombatEventMessages(
    { outcome: "player_win", rewards: reward },
    lootConfig,
  )) {
    onEvent(message);
  }
}

export function publishBatchCombatRewardEvents(
  batch: TowerCombatBatchResult,
  lootConfig: GameLootConfig | null | undefined,
  onEvent: (message: string) => void,
): void {
  for (let i = 0; i < batch.combats.length; i++) {
    const combat = batch.combats[i]!;
    if (combat.outcome !== "player_win" || !combat.rewards) {
      if (combat.outcome === "player_defeat") {
        onEvent(`Derrota contra ${combat.enemyName}.`);
      }
      break;
    }

    publishCombatRewardEvents(combat.rewards, lootConfig, onEvent);
  }
}
