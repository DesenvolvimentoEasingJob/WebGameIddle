import type {
  GameLootConfig,
  StartTowerCombatResponse,
  TowerCombatResult,
  TowerCombatSession,
} from "../api/gameplay";
import { buildCombatEventMessages } from "../ui/combat-rewards";

const MAX_CACHED_ROUNDS = 24;
const STORAGE_PREFIX = "skyspire-combat-cache:";

export interface CombatEncounterContext {
  floor: number;
  mobIndex: number;
  enemyId: string;
  enemyName: string;
  isBoss: boolean;
  enemyMaxHp: number;
}

export interface CachedCombatRound {
  characterId: string;
  slotIndex: number;
  combat: TowerCombatResult;
  session: TowerCombatSession;
  encounter: CombatEncounterContext;
  eventMessages: string[];
  cachedAt: number;
}

interface PersistedCombatCacheV2 {
  version: 2;
  characterId: string;
  slotIndex: number;
  combat: TowerCombatResult;
  session: TowerCombatSession;
  encounter: CombatEncounterContext;
  eventMessages: string[];
  cachedAt: number;
}

interface PersistedCombatCacheV1 {
  version: 1;
  characterId: string;
  slotIndex: number;
  combat: TowerCombatResult;
  session: TowerCombatSession;
  eventMessages: string[];
  cachedAt: number;
}

let cachedRounds: CachedCombatRound[] = [];

function storageKey(characterId: string): string {
  return `${STORAGE_PREFIX}${characterId}`;
}

function buildEncounterFromResponse(response: StartTowerCombatResponse): CombatEncounterContext {
  const { combat, session } = response;
  return {
    floor: session.floor,
    mobIndex: session.mobIndex,
    enemyId: combat.enemyId,
    enemyName: combat.enemyName,
    isBoss: combat.isBoss,
    enemyMaxHp: combat.enemyMaxHp,
  };
}

function buildEncounterFromSession(session: TowerCombatSession): CombatEncounterContext {
  return {
    floor: session.floor,
    mobIndex: session.mobIndex,
    enemyId: session.enemyId,
    enemyName: session.enemyName,
    isBoss: session.isBoss,
    enemyMaxHp: session.enemyMaxHp,
  };
}

function readPersisted(characterId: string): PersistedCombatCacheV2 | null {
  try {
    const raw = sessionStorage.getItem(storageKey(characterId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PersistedCombatCacheV2 | PersistedCombatCacheV1;
    if (parsed.characterId !== characterId) return null;

    if (parsed.version === 2) return parsed;

    if (parsed.version === 1) {
      const encounter = buildEncounterFromSession(parsed.session);
      return {
        version: 2,
        characterId: parsed.characterId,
        slotIndex: parsed.slotIndex,
        combat: parsed.combat,
        session: parsed.session,
        encounter,
        eventMessages: parsed.eventMessages,
        cachedAt: parsed.cachedAt,
      };
    }

    return null;
  } catch {
    return null;
  }
}

function writePersisted(entry: CachedCombatRound): void {
  try {
    const payload: PersistedCombatCacheV2 = {
      version: 2,
      characterId: entry.characterId,
      slotIndex: entry.slotIndex,
      combat: entry.combat,
      session: entry.session,
      encounter: entry.encounter,
      eventMessages: entry.eventMessages,
      cachedAt: entry.cachedAt,
    };
    sessionStorage.setItem(storageKey(entry.characterId), JSON.stringify(payload));
  } catch {
    // sessionStorage pode estar indisponível
  }
}

export function clearPersistedCombatCache(characterId: string): void {
  try {
    sessionStorage.removeItem(storageKey(characterId));
  } catch {
    // ignore
  }
}

export function hydrateCombatCacheFromStorage(
  characterId: string,
  slotIndex: number,
): CachedCombatRound | null {
  const persisted = readPersisted(characterId);
  if (!persisted || persisted.slotIndex !== slotIndex) return null;

  const entry: CachedCombatRound = {
    characterId: persisted.characterId,
    slotIndex: persisted.slotIndex,
    combat: persisted.combat,
    session: persisted.session,
    encounter: persisted.encounter,
    eventMessages: persisted.eventMessages,
    cachedAt: persisted.cachedAt,
  };

  cachedRounds = [
    entry,
    ...cachedRounds.filter(
      (round) =>
        round.slotIndex !== slotIndex || round.session.sessionId !== entry.session.sessionId,
    ),
  ].slice(0, MAX_CACHED_ROUNDS);

  return entry;
}

export function rememberCombatRound(
  characterId: string,
  slotIndex: number,
  response: StartTowerCombatResponse,
  lootConfig?: GameLootConfig | null,
): CachedCombatRound {
  const entry: CachedCombatRound = {
    characterId,
    slotIndex,
    combat: response.combat,
    session: response.session,
    encounter: buildEncounterFromResponse(response),
    eventMessages: buildCombatEventMessages(response.combat, lootConfig),
    cachedAt: Date.now(),
  };

  cachedRounds = [
    entry,
    ...cachedRounds.filter(
      (round) =>
        round.slotIndex !== slotIndex || round.session.sessionId !== entry.session.sessionId,
    ),
  ].slice(0, MAX_CACHED_ROUNDS);

  writePersisted(entry);
  return entry;
}

export function getCachedRounds(slotIndex?: number): CachedCombatRound[] {
  if (slotIndex === undefined) return [...cachedRounds];
  return cachedRounds.filter((round) => round.slotIndex === slotIndex);
}

export function getLastCachedRound(slotIndex: number): CachedCombatRound | null {
  return cachedRounds.find((round) => round.slotIndex === slotIndex) ?? null;
}

export function findCachedRoundForSession(
  slotIndex: number,
  sessionId: string,
): CachedCombatRound | null {
  return (
    cachedRounds.find(
      (round) => round.slotIndex === slotIndex && round.session.sessionId === sessionId,
    ) ?? null
  );
}

export function findCachedRoundBySessionId(sessionId: string): CachedCombatRound | null {
  return cachedRounds.find((round) => round.session.sessionId === sessionId) ?? null;
}

export function getActiveEncounterForSlot(slotIndex: number): CombatEncounterContext | null {
  const round = getLastCachedRound(slotIndex);
  return round?.encounter ?? null;
}

export function replayCachedEventMessages(
  entry: CachedCombatRound,
  onEvent: (message: string) => void,
): void {
  for (const message of entry.eventMessages) {
    onEvent(message);
  }
}

export function resetCombatCache(): void {
  cachedRounds = [];
}
