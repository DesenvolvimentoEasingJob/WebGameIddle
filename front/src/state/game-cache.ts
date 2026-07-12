import type {
  CharacterGameJson,
  GameLootConfig,
  GameStateResponse,
  ItemSummary,
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
