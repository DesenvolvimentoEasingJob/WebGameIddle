import { readApiError } from "./errors";
import { getToken } from "../router";
import type { GamePatchResponse } from "../state/game-cache";

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

export interface RolledAffix {
  affixId: string;
  label: string;
  value: number;
  suffix?: string | null;
  categoryPath?: string;
}

export interface InventoryEntry {
  instanceId: string;
  itemId: string;
  quantity: number;
  level?: number;
  rarity?: string;
  rolledCategories?: Record<string, unknown>;
  rolledAffixes?: RolledAffix[];
  dropMeta?: {
    floor: number;
    mobId: string;
    seed: string;
    rollIndex: number;
    rolledAt?: string;
  };
  integrity?: {
    hash: string;
    signature: string;
  };
}

export interface EquippedEntry {
  instanceId: string;
  itemId: string;
  level?: number;
  rarity?: string;
  rolledCategories?: Record<string, unknown>;
  rolledAffixes?: RolledAffix[];
  dropMeta?: InventoryEntry["dropMeta"];
  integrity?: InventoryEntry["integrity"];
}

export interface CharacterProgression {
  level: number;
  xp: number;
  gold: number;
}

export interface TowerCombatSession {
  sessionId: string;
  startedAt: string;
  endsAt: string;
  durationMs: number;
  remainingMs?: number;
  mode: "single" | "batch";
  fightsResolved: number;
  floor: number;
  mobIndex: number;
  enemyId: string;
  enemyName: string;
  isBoss: boolean;
  enemyMaxHp: number;
}

export interface TowerState {
  currentFloor: number;
  unlockedFloor: number;
  autoAscend: boolean;
  continuousAttack: boolean;
  mobsKilledThisFloor: number;
  bossDefeated: boolean;
  totalMobsKilled?: number;
  totalBossesKilled?: number;
  combatSession?: TowerCombatSession | null;
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

export interface RaritySummary {
  id: string;
  label: string;
  order: number;
  baseStatMultiplier: number;
  dropWeight?: number;
  affixRollMin: number;
  affixRollMax: number;
  slotFrame?: string | null;
}

export interface AffixSummary {
  id: string;
  label: string;
  suffix?: string | null;
}

export interface GameLootConfig {
  rarities: Record<string, RaritySummary>;
  affixes: Record<string, AffixSummary>;
}

export interface GameStateResponse {
  characterJson: CharacterGameJson;
  itemCatalog: Record<string, ItemSummary>;
  currentFloor: TowerFloorDetail | null;
  effectiveCategories: Record<string, unknown>;
  lootConfig: GameLootConfig;
}

export interface TowerCombatTurn {
  actor: "player" | "enemy";
  kind: "attack" | "critical";
  damage: number;
  playerHpRemaining: number;
  enemyHpRemaining: number;
  heal?: number;
}

export interface DroppedItem {
  instanceId: string;
  itemId: string;
  name: string;
  rarity: string;
  level: number;
  quantity: number;
  rolledCategories?: Record<string, unknown>;
  rolledAffixes?: RolledAffix[];
  assets?: { icon?: string };
  dropMeta?: InventoryEntry["dropMeta"];
  integrity?: InventoryEntry["integrity"];
}

export interface CombatRewardItem {
  instanceId: string;
  itemId: string;
  name: string;
  rarity: string;
  level: number;
  quantity: number;
}

export interface TowerCombatRewards {
  xp: number;
  gold: number;
  items: CombatRewardItem[];
  lostItems: CombatRewardItem[];
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
  patch: TowerCombatPatchResponse;
  session: TowerCombatSession;
}

export interface TowerCombatPatchResponse {
  progression?: CharacterProgression;
  tower?: TowerState;
  newInventoryItems?: InventoryEntry[];
  inventoryUpdates?: Array<{ instanceId: string; quantity: number }>;
  newCatalogEntries?: Record<string, ItemSummary> | null;
  currentFloor?: TowerFloorDetail | null;
  updatedAt?: string;
}

export interface TowerCombatBatchResult {
  killCount: number;
  wins: number;
  defeats: number;
  totalXp: number;
  totalGold: number;
  items: DroppedItem[];
  lostItems: DroppedItem[];
  batchSeed: string;
  combats: TowerCombatResult[];
}

export interface StartTowerCombatBatchResponse {
  batch: TowerCombatBatchResult;
  patch: TowerCombatPatchResponse;
  session: TowerCombatSession;
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

  return normalizeGameState((await response.json()) as GameStateResponse);
}

export async function fetchLootConfig(): Promise<GameLootConfig> {
  const response = await fetch(`${API_BASE}/game/loot-config`);
  if (!response.ok) {
    throw await readApiError(response, "Falha ao carregar configuração de loot.");
  }

  return normalizeLootConfig((await response.json()) as GameLootConfig);
}

function normalizeGameState(state: GameStateResponse): GameStateResponse {
  const tower = state.characterJson.tower;
  const normalizedTower = tower.combatSession
    ? {
        ...tower,
        combatSession: normalizeCombatSession(tower.combatSession as Parameters<typeof normalizeCombatSession>[0]),
      }
    : tower;

  return {
    ...state,
    characterJson: {
      ...state.characterJson,
      tower: normalizedTower,
    },
    lootConfig: normalizeLootConfig(state.lootConfig),
  };
}

function normalizeGamePatch(patch: GamePatchResponse): GamePatchResponse {
  return {
    ...patch,
    newCatalogEntries: patch.newCatalogEntries ?? undefined,
    currentFloor: patch.currentFloor ?? undefined,
    effectiveCategories: patch.effectiveCategories ?? undefined,
  };
}

function normalizeLootConfig(config?: GameLootConfig | null): GameLootConfig {
  if (!config?.rarities) {
    return { rarities: fallbackRarityMap(), affixes: config?.affixes ?? {} };
  }

  return {
    rarities: config.rarities,
    affixes: config.affixes ?? {},
  };
}

function fallbackRarityMap(): Record<string, RaritySummary> {
  return Object.fromEntries(
    Object.entries(RARITY_LABELS).map(([id, label]) => [
      id,
      {
        id,
        label,
        order: 0,
        baseStatMultiplier: 1,
        dropWeight: 1,
        affixRollMin: 0,
        affixRollMax: 0,
        slotFrame: id === "common" ? "slot-common" : `slot-${id}`,
      },
    ]),
  );
}

export async function equipItem(
  slotIndex: number,
  instanceId: string,
): Promise<GamePatchResponse> {
  const response = await fetch(`${API_BASE}/characters/${slotIndex}/game/equip`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ instanceId }),
  });

  if (!response.ok) {
    throw await readApiError(response, "Falha ao equipar item.");
  }

  return normalizeGamePatch((await response.json()) as GamePatchResponse);
}

export async function unequipItem(
  slotIndex: number,
  equipSlot: string,
): Promise<GamePatchResponse> {
  const response = await fetch(`${API_BASE}/characters/${slotIndex}/game/unequip`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ equipSlot }),
  });

  if (!response.ok) {
    throw await readApiError(response, "Falha ao desequipar item.");
  }

  return normalizeGamePatch((await response.json()) as GamePatchResponse);
}

export async function discardItem(
  slotIndex: number,
  instanceId: string,
): Promise<GamePatchResponse> {
  const response = await fetch(`${API_BASE}/characters/${slotIndex}/game/discard`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ instanceId }),
  });

  if (!response.ok) {
    throw await readApiError(response, "Falha ao descartar item.");
  }

  return normalizeGamePatch((await response.json()) as GamePatchResponse);
}

export async function updateTowerSettings(
  slotIndex: number,
  settings: { autoAscend: boolean; continuousAttack: boolean },
): Promise<GamePatchResponse> {
  const response = await fetch(`${API_BASE}/characters/${slotIndex}/game/tower`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    throw await readApiError(response, "Falha ao atualizar configurações da torre.");
  }

  return normalizeGamePatch((await response.json()) as GamePatchResponse);
}

export async function repeatTowerFloor(slotIndex: number): Promise<GamePatchResponse> {
  const response = await fetch(`${API_BASE}/characters/${slotIndex}/game/tower/repeat`, {
    method: "POST",
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw await readApiError(response, "Falha ao repetir o andar.");
  }

  return normalizeGamePatch((await response.json()) as GamePatchResponse);
}

export async function advanceTowerFloor(slotIndex: number): Promise<GamePatchResponse> {
  return navigateTowerFloor(slotIndex, "up");
}

export async function navigateTowerFloor(
  slotIndex: number,
  direction: "up" | "down",
): Promise<GamePatchResponse> {
  const response = await fetch(`${API_BASE}/characters/${slotIndex}/game/tower/navigate`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ direction }),
  });

  if (!response.ok) {
    throw await readApiError(
      response,
      direction === "up" ? "Falha ao subir de andar." : "Falha ao descer de andar.",
    );
  }

  return normalizeGamePatch((await response.json()) as GamePatchResponse);
}

function normalizeCombatSession(session: {
  sessionId: string;
  startedAt: string;
  endsAt: string;
  durationMs: number;
  remainingMs?: number;
  mode: string;
  fightsResolved: number;
  floor?: number;
  mobIndex?: number;
  enemyId?: string;
  enemyName?: string;
  isBoss?: boolean;
  enemyMaxHp?: number;
}): TowerCombatSession {
  const remainingMs = session.remainingMs
    ?? Math.max(0, new Date(session.endsAt).getTime() - Date.now());

  return {
    sessionId: session.sessionId,
    startedAt: session.startedAt,
    endsAt: session.endsAt,
    durationMs: session.durationMs,
    remainingMs,
    mode: session.mode === "batch" ? "batch" : "single",
    fightsResolved: session.fightsResolved,
    floor: session.floor ?? 1,
    mobIndex: session.mobIndex ?? 0,
    enemyId: session.enemyId ?? "",
    enemyName: session.enemyName ?? "",
    isBoss: session.isBoss ?? false,
    enemyMaxHp: session.enemyMaxHp ?? 0,
  };
}

function normalizeCombatRewardItem(item: {
  instanceId: string;
  itemId: string;
  name: string;
  rarity: string;
  level?: number;
  quantity: number;
}): CombatRewardItem {
  return {
    instanceId: item.instanceId,
    itemId: item.itemId,
    name: item.name,
    rarity: item.rarity,
    level: item.level ?? 1,
    quantity: item.quantity,
  };
}

function normalizeTowerCombatPatch(patch: TowerCombatPatchResponse): TowerCombatPatchResponse {
  const tower = patch.tower;
  return {
    progression: patch.progression,
    tower: tower?.combatSession
      ? {
          ...tower,
          combatSession: normalizeCombatSession(
            tower.combatSession as Parameters<typeof normalizeCombatSession>[0],
          ),
        }
      : tower,
    newInventoryItems: patch.newInventoryItems,
    inventoryUpdates: patch.inventoryUpdates,
    newCatalogEntries: patch.newCatalogEntries,
    currentFloor: patch.currentFloor,
    updatedAt: patch.updatedAt,
  };
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
        heal?: number;
      }>;
      rewards: {
        xp: number;
        gold: number;
        items?: Array<{
          instanceId: string;
          itemId: string;
          name: string;
          rarity: string;
          level?: number;
          quantity: number;
        }>;
        lostItems?: Array<{
          instanceId: string;
          itemId: string;
          name: string;
          rarity: string;
          level?: number;
          quantity: number;
        }>;
      } | null;
    };
    patch: TowerCombatPatchResponse;
    session: Parameters<typeof normalizeCombatSession>[0];
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
        heal: t.heal ?? 0,
      })),
      rewards: raw.combat.rewards
        ? {
            xp: raw.combat.rewards.xp,
            gold: raw.combat.rewards.gold,
            items: (raw.combat.rewards.items ?? []).map(normalizeCombatRewardItem),
            lostItems: (raw.combat.rewards.lostItems ?? []).map(normalizeCombatRewardItem),
          }
        : null,
    },
    patch: normalizeTowerCombatPatch(raw.patch),
    session: normalizeCombatSession(raw.session),
  };
}

export async function startTowerCombatBatch(
  slotIndex: number,
  killCount = 5,
): Promise<StartTowerCombatBatchResponse> {
  // Mantido no client para ferramentas/debug; o loop de farm usa combates unitários.
  const response = await fetch(`${API_BASE}/characters/${slotIndex}/game/tower/combat-batch`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ killCount }),
  });

  if (!response.ok) {
    throw await readApiError(response, "Falha ao iniciar combate em lote.");
  }

  const raw = (await response.json()) as {
    batch: {
      killCount: number;
      wins: number;
      defeats: number;
      totalXp: number;
      totalGold: number;
      items: Parameters<typeof normalizeCombatRewardItem>[0][];
      lostItems: Parameters<typeof normalizeCombatRewardItem>[0][];
      batchSeed: string;
      combats: Array<{
        outcome: string;
        enemyId: string;
        enemyName: string;
        isBoss: boolean;
        playerMaxHp: number;
        enemyMaxHp: number;
        turns: TowerCombatTurn[];
        rewards: TowerCombatRewards | null;
      }>;
    };
    patch: TowerCombatPatchResponse;
    session: Parameters<typeof normalizeCombatSession>[0];
  };

  return {
    batch: {
      killCount: raw.batch.killCount,
      wins: raw.batch.wins,
      defeats: raw.batch.defeats,
      totalXp: raw.batch.totalXp,
      totalGold: raw.batch.totalGold,
      items: raw.batch.items.map(normalizeCombatRewardItem),
      lostItems: raw.batch.lostItems.map(normalizeCombatRewardItem),
      batchSeed: raw.batch.batchSeed,
      combats: raw.batch.combats.map((c) => ({
        outcome: c.outcome as TowerCombatResult["outcome"],
        enemyId: c.enemyId,
        enemyName: c.enemyName,
        isBoss: c.isBoss,
        playerMaxHp: c.playerMaxHp,
        enemyMaxHp: c.enemyMaxHp,
        turns: c.turns,
        rewards: c.rewards,
      })),
    },
    patch: normalizeTowerCombatPatch(raw.patch),
    session: normalizeCombatSession(raw.session),
  };
}

export async function tradeItem(
  slotIndex: number,
  targetSlotIndex: number,
  instanceId: string,
): Promise<GamePatchResponse> {
  const response = await fetch(`${API_BASE}/characters/${slotIndex}/game/trade`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ targetSlotIndex, instanceId }),
  });

  if (!response.ok) {
    throw await readApiError(response, "Falha ao transferir item.");
  }

  return normalizeGamePatch((await response.json()) as GamePatchResponse);
}

export async function applyGem(
  slotIndex: number,
  itemInstanceId: string,
  gemInstanceId: string,
): Promise<GamePatchResponse> {
  const response = await fetch(`${API_BASE}/characters/${slotIndex}/game/apply-gem`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ itemInstanceId, gemInstanceId }),
  });

  if (!response.ok) {
    throw await readApiError(response, "Falha ao aplicar joia.");
  }

  return normalizeGamePatch((await response.json()) as GamePatchResponse);
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
