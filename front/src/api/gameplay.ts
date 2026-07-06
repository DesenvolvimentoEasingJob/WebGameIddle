import { readApiError } from "./errors";
import { getToken } from "../router";

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

export interface ItemSummary {
  id: string;
  name: string;
  description?: string;
  type: string;
  slot?: string | null;
  rarity: string;
  level: number;
  classes: string[];
  stackable: boolean;
  maxStack: number;
  categories?: Record<string, unknown>;
  assets?: { icon?: string };
}

export interface InventoryEntry {
  instanceId: string;
  itemId: string;
  quantity: number;
}

export interface EquippedEntry {
  instanceId: string;
  itemId: string;
}

export interface CharacterProgression {
  level: number;
  xp: number;
  gold: number;
}

export interface TowerState {
  currentFloor: number;
  unlockedFloor: number;
  autoAscend: boolean;
  mobsKilledThisFloor: number;
  bossDefeated: boolean;
}

export interface CharacterGameJson {
  id: string;
  raceId: string;
  classId: string;
  status: string;
  assets?: { sprite?: string };
  categories?: Record<string, unknown>;
  progression: CharacterProgression;
  tower: TowerState;
  inventory: {
    capacity: number;
    items: InventoryEntry[];
  };
  equipment: Record<string, EquippedEntry | null>;
  equipmentSlots: string[];
}

export interface TowerMobSummary {
  id: string;
  name: string;
  level: number;
  hp: number;
  attack: number;
  defense: number;
  xp: number;
  gold: number;
  assets?: { sprite?: string; icon?: string };
}

export interface TowerFloorDetail {
  floor: number;
  name: string;
  ownerId?: string | null;
  ownerName?: string | null;
  mobCount: number;
  mobPool: TowerMobSummary[];
  boss: TowerMobSummary;
}

export interface GameStateResponse {
  characterJson: CharacterGameJson;
  itemCatalog: Record<string, ItemSummary>;
  currentFloor: TowerFloorDetail | null;
  effectiveCategories: Record<string, unknown>;
}

export interface TowerCombatTurn {
  actor: "player" | "enemy";
  kind: "attack" | "critical";
  damage: number;
  playerHpRemaining: number;
  enemyHpRemaining: number;
}

export interface TowerCombatRewards {
  xp: number;
  gold: number;
}

export interface TowerCombatResult {
  outcome: "player_win" | "player_defeat";
  enemyId: string;
  enemyName: string;
  isBoss: boolean;
  playerMaxHp: number;
  enemyMaxHp: number;
  turns: TowerCombatTurn[];
  rewards: TowerCombatRewards | null;
}

export interface StartTowerCombatResponse {
  combat: TowerCombatResult;
  gameState: GameStateResponse;
}

function authHeaders(): HeadersInit {
  const token = getToken();
  if (!token) throw new Error("Sessão expirada.");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function fetchGameState(slotIndex: number): Promise<GameStateResponse> {
  const response = await fetch(`${API_BASE}/characters/${slotIndex}/game`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw await readApiError(response, "Falha ao carregar o jogo.");
  }

  return (await response.json()) as GameStateResponse;
}

export async function equipItem(
  slotIndex: number,
  instanceId: string,
): Promise<GameStateResponse> {
  const response = await fetch(`${API_BASE}/characters/${slotIndex}/game/equip`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ instanceId }),
  });

  if (!response.ok) {
    throw await readApiError(response, "Falha ao equipar item.");
  }

  return (await response.json()) as GameStateResponse;
}

export async function unequipItem(
  slotIndex: number,
  equipSlot: string,
): Promise<GameStateResponse> {
  const response = await fetch(`${API_BASE}/characters/${slotIndex}/game/unequip`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ equipSlot }),
  });

  if (!response.ok) {
    throw await readApiError(response, "Falha ao desequipar item.");
  }

  return (await response.json()) as GameStateResponse;
}

export async function updateTowerSettings(
  slotIndex: number,
  autoAscend: boolean,
): Promise<GameStateResponse> {
  const response = await fetch(`${API_BASE}/characters/${slotIndex}/game/tower`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ autoAscend }),
  });

  if (!response.ok) {
    throw await readApiError(response, "Falha ao atualizar configurações da torre.");
  }

  return (await response.json()) as GameStateResponse;
}

export async function startTowerCombat(
  slotIndex: number,
): Promise<StartTowerCombatResponse> {
  const response = await fetch(`${API_BASE}/characters/${slotIndex}/game/tower/combat`, {
    method: "POST",
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw await readApiError(response, "Falha ao iniciar combate.");
  }

  const raw = (await response.json()) as {
    combat: {
      outcome: string;
      enemyId: string;
      enemyName: string;
      isBoss: boolean;
      playerMaxHp: number;
      enemyMaxHp: number;
      turns: Array<{
        actor: string;
        kind: string;
        damage: number;
        playerHpRemaining: number;
        enemyHpRemaining: number;
      }>;
      rewards: { xp: number; gold: number } | null;
    };
    gameState: GameStateResponse;
  };

  return {
    combat: {
      outcome: raw.combat.outcome as TowerCombatResult["outcome"],
      enemyId: raw.combat.enemyId,
      enemyName: raw.combat.enemyName,
      isBoss: raw.combat.isBoss,
      playerMaxHp: raw.combat.playerMaxHp,
      enemyMaxHp: raw.combat.enemyMaxHp,
      turns: raw.combat.turns.map((t) => ({
        actor: t.actor as TowerCombatTurn["actor"],
        kind: t.kind as TowerCombatTurn["kind"],
        damage: t.damage,
        playerHpRemaining: t.playerHpRemaining,
        enemyHpRemaining: t.enemyHpRemaining,
      })),
      rewards: raw.combat.rewards
        ? { xp: raw.combat.rewards.xp, gold: raw.combat.rewards.gold }
        : null,
    },
    gameState: raw.gameState,
  };
}

export const RARITY_LABELS: Record<string, string> = {
  common: "Comum",
  uncommon: "Incomum",
  rare: "Raro",
  epic: "Épico",
  legendary: "Lendário",
};

export const DEFAULT_EQUIPMENT_SLOTS = [
  "weapon",
  "offhand",
  "armor",
  "helmet",
  "boots",
  "ring",
  "amulet",
] as const;

export const EQUIP_SLOT_LABELS: Record<string, string> = {
  weapon: "Arma",
  weapon2: "Arma 2",
  offhand: "Escudo",
  offhand2: "Escudo 2",
  armor: "Armadura",
  helmet: "Elmo",
  boots: "Botas",
  ring: "Anel",
  amulet: "Amuleto",
};

export const CLASS_LABELS: Record<string, string> = {
  warrior: "Guerreiro",
  mage: "Mago",
  rogue: "Ladino",
};

export const RACE_LABELS: Record<string, string> = {
  human: "Humano",
  elf: "Elfo",
  dwarf: "Anão",
};
