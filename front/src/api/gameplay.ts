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

export interface TowerFloorSummary {
  floor: number;
  name: string;
  ownerId?: string | null;
  ownerName?: string | null;
  mobCount: number;
}

export interface GameStateResponse {
  characterJson: CharacterGameJson;
  itemCatalog: Record<string, ItemSummary>;
  currentFloor: TowerFloorSummary | null;
  effectiveCategories: Record<string, unknown>;
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
