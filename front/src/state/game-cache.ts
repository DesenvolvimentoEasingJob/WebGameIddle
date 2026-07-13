import type {
  CharacterGameJson,
  GameLootConfig,
  GameStateResponse,
  ItemSummary,
  TowerCombatPatchResponse,
  TowerFloorDetail,
} from "../api/gameplay";

let staticLootConfig: GameLootConfig | null = null;
let baseItemCatalog: Record<string, ItemSummary> = {};
let currentFloorCache: TowerFloorDetail | null = null;
let effectiveCategoriesCache: Record<string, unknown> = {};

export interface GamePatchResponse {
  characterJson: CharacterGameJson;
  newCatalogEntries?: Record<string, ItemSummary> | null;
  currentFloor?: TowerFloorDetail | null;
  effectiveCategories?: Record<string, unknown> | null;
}

export type { TowerCombatPatchResponse } from "../api/gameplay";

export function initGameCacheFromBootstrap(state: GameStateResponse): GameStateResponse {
  staticLootConfig = state.lootConfig;
  baseItemCatalog = { ...state.itemCatalog };
  currentFloorCache = state.currentFloor;
  effectiveCategoriesCache = state.effectiveCategories;
  return assembleGameState(state.characterJson);
}

export function resetGameCache(): void {
  staticLootConfig = null;
  baseItemCatalog = {};
  currentFloorCache = null;
  effectiveCategoriesCache = {};
}

export function mergeCatalogEntries(entries?: Record<string, ItemSummary> | null): void {
  if (!entries) return;
  Object.assign(baseItemCatalog, entries);
}

export function applyGamePatch(
  prev: GameStateResponse | null,
  patch: GamePatchResponse,
): GameStateResponse {
  mergeCatalogEntries(patch.newCatalogEntries);

  if (patch.currentFloor !== undefined && patch.currentFloor !== null) {
    currentFloorCache = patch.currentFloor;
  }

  if (patch.effectiveCategories) {
    effectiveCategoriesCache = patch.effectiveCategories;
  }

  return assembleGameState(patch.characterJson, prev);
}

/** Aplica apenas o delta do combate sobre o estado em cache. */
export function applyTowerCombatPatch(
  prev: GameStateResponse,
  patch: TowerCombatPatchResponse,
): GameStateResponse {
  const characterJson = structuredClone(prev.characterJson);

  if (patch.progression) {
    characterJson.progression = patch.progression;
  }

  if (patch.tower) {
    characterJson.tower = patch.tower;
  }

  if (patch.updatedAt) {
    (characterJson as CharacterGameJson & { updatedAt?: string }).updatedAt = patch.updatedAt;
  }

  if (patch.newInventoryItems?.length) {
    characterJson.inventory.items.push(...patch.newInventoryItems);
  }

  if (patch.inventoryUpdates?.length) {
    for (const update of patch.inventoryUpdates) {
      const entry = characterJson.inventory.items.find(
        (item) => item.instanceId === update.instanceId,
      );
      if (entry) {
        entry.quantity = update.quantity;
      }
    }
  }

  mergeCatalogEntries(patch.newCatalogEntries);

  if (patch.currentFloor !== undefined && patch.currentFloor !== null) {
    currentFloorCache = patch.currentFloor;
  }

  return assembleGameState(characterJson, prev);
}

export function assembleGameState(
  characterJson: CharacterGameJson,
  fallback?: GameStateResponse | null,
): GameStateResponse {
  return {
    characterJson,
    itemCatalog: baseItemCatalog,
    currentFloor: currentFloorCache ?? fallback?.currentFloor ?? null,
    effectiveCategories:
      Object.keys(effectiveCategoriesCache).length > 0
        ? effectiveCategoriesCache
        : (fallback?.effectiveCategories ?? {}),
    lootConfig: staticLootConfig ?? fallback?.lootConfig ?? { rarities: {}, affixes: {} },
  };
}

export function getCachedLootConfig(): GameLootConfig | null {
  return staticLootConfig;
}
