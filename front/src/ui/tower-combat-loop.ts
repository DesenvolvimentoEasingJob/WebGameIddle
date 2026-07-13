import {
  repeatTowerFloor,
  startTowerCombat,
  type GameStateResponse,
  type StartTowerCombatResponse,
  type TowerCombatResult,
} from "../api/gameplay";
import {
  clearPersistedCombatCache,
  findCachedRoundForSession,
  getLastCachedRound,
  hydrateCombatCacheFromStorage,
  rememberCombatRound,
  replayCachedEventMessages,
} from "../state/combat-cache";
import { applyGamePatch, applyTowerCombatPatch } from "../state/game-cache";
import {
  renderCombatDockWaiting,
  updateCombatDockWaitingTimer,
} from "./combat-dock";
import { getTowerAnimators, rebindEnemySprite, waitForTowerAnimatorsReady } from "./tower-sprites";
import {
  awaitCombatSessionEnd,
  awaitTowerCombatTiming,
  canStartTowerCombat,
  computeReplayResumePoint,
  estimateTowerCombatDurationMs,
  getCombatElapsedMs,
  getCombatSessionRemainingMs,
  hasActiveCombatSession,
  playTowerCombatReplay,
} from "./tower-combat";
import { updateTowerPanelAfterCombat } from "./tower-incremental";
import { resolveDockEnemy } from "./tower-panel";

const LOOP_PAUSE_MS = 480;

let activeLoopGeneration = 0;
let combatRequestInFlight = false;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function stopTowerCombatLoop(): void {
  activeLoopGeneration = 0;
}

export function isTowerCombatLoopRunning(): boolean {
  return activeLoopGeneration !== 0;
}

function tryAcquireLoop(): number | null {
  if (activeLoopGeneration !== 0 || combatRequestInFlight) return null;
  const generation = Date.now();
  activeLoopGeneration = generation;
  return generation;
}

async function requestSingleCombat(slotIndex: number): Promise<StartTowerCombatResponse> {
  if (combatRequestInFlight) {
    throw new Error("Combat request already in flight.");
  }

  combatRequestInFlight = true;
  try {
    return await startTowerCombat(slotIndex);
  } finally {
    combatRequestInFlight = false;
  }
}

async function ensureFloorReadyForCombat(
  slotIndex: number,
  state: GameStateResponse,
): Promise<GameStateResponse> {
  if (!state.characterJson.tower.bossDefeated) return state;
  return applyGamePatch(state, await repeatTowerFloor(slotIndex));
}

function getLiveArena(panelEl: HTMLElement): HTMLElement | null {
  const arena = panelEl.querySelector<HTMLElement>(".tower-arena");
  return arena?.isConnected ? arena : null;
}

function formatSessionWaitMessage(remainingMs: number, enemyName?: string): string {
  const seconds = Math.max(1, Math.ceil(remainingMs / 1000));
  return enemyName
    ? `Aguardando combate contra ${enemyName}… ${seconds}s`
    : `Combate em andamento… ${seconds}s`;
}

function showCombatDockLoading(
  dock: HTMLElement,
  enemyName: string,
  isBoss: boolean,
  remainingMs: number,
): void {
  const arena = dock.querySelector<HTMLElement>(".tower-arena");
  if (!arena) return;

  let overlay = arena.querySelector<HTMLElement>(".combat-dock__waiting-layer");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "combat-dock__waiting-layer";
    arena.appendChild(overlay);
  }

  overlay.innerHTML = renderCombatDockWaiting({ enemyName, isBoss, remainingMs });
}

function hideCombatDockLoading(dock: HTMLElement): void {
  dock.querySelector(".combat-dock__waiting-layer")?.remove();
}

async function waitForTowerSession(
  tower: GameStateResponse["characterJson"]["tower"],
  onStatus?: (message: string) => void,
  dock?: HTMLElement,
): Promise<void> {
  if (!hasActiveCombatSession(tower)) return;

  const session = tower.combatSession;
  let lastSecond = -1;

  await awaitCombatSessionEnd(tower, (remainingMs) => {
    const seconds = Math.max(1, Math.ceil(remainingMs / 1000));
    if (session?.enemyName) {
      if (dock) {
        showCombatDockLoading(dock, session.enemyName, session.isBoss, remainingMs);
        updateCombatDockWaitingTimer(remainingMs);
      }
    }
    if (seconds === lastSecond) return;
    lastSecond = seconds;
    onStatus?.(formatSessionWaitMessage(remainingMs, session?.enemyName));
  });

  if (dock) hideCombatDockLoading(dock);
}

async function paceCombatReplay(
  panelEl: HTMLElement,
  combat: TowerCombatResult,
  expectedMs?: number,
  resumeFrom?: ReturnType<typeof computeReplayResumePoint>,
): Promise<void> {
  const targetMs = expectedMs ?? estimateTowerCombatDurationMs(combat);
  const startedAt = performance.now();
  const arena = getLiveArena(panelEl);

  if (arena) {
    await playTowerCombatReplay(arena, combat, getTowerAnimators(), {
      animate: !document.hidden,
      startTurnIndex: resumeFrom?.turnIndex,
      initialPlayerHp: resumeFrom?.playerHp,
      initialEnemyHp: resumeFrom?.enemyHp,
    });
  } else {
    await awaitTowerCombatTiming(combat);
  }

  const remaining = targetMs - (performance.now() - startedAt);
  if (remaining > 16) {
    await delay(remaining);
  }
}

export interface TowerCombatLoopOptions {
  slotIndex: number;
  panelEl: HTMLElement;
  getState: () => GameStateResponse | null;
  setState: (state: GameStateResponse) => void;
  onSidebarUpdate: (state: GameStateResponse) => void;
  onPanelRefresh: () => void;
  onStatus: (message: string) => void;
  onEvent: (message: string) => void;
  onError: (message: string) => void;
  onFinished: () => void;
}

export async function runTowerCombatLoop(options: TowerCombatLoopOptions): Promise<void> {
  const generation = tryAcquireLoop();
  if (generation === null) {
    options.onFinished();
    return;
  }

  const {
    slotIndex,
    panelEl,
    getState,
    setState,
    onSidebarUpdate,
    onPanelRefresh,
    onStatus,
    onEvent,
    onError,
    onFinished,
  } = options;

  try {
    let state = getState();
    if (!state?.characterJson.tower.continuousAttack) {
      return;
    }

    state = await ensureFloorReadyForCombat(slotIndex, state);
    setState(state);
    onSidebarUpdate(state);

    await waitForTowerSession(state.characterJson.tower, onStatus, getLiveArena(panelEl)?.parentElement ?? undefined);

    while (generation === activeLoopGeneration) {
      state = getState();
      if (!state?.characterJson.tower.continuousAttack) break;
      if (!canStartTowerCombat(state)) break;

      if (getLiveArena(panelEl) && !document.hidden) {
        await waitForTowerAnimatorsReady();
      }

      const previousEnemyId =
        state.currentFloor != null
          ? resolveDockEnemy(state.currentFloor, state.characterJson.tower).id
          : undefined;

      const response = await requestSingleCombat(slotIndex);
      if (generation !== activeLoopGeneration) break;

      const cachedRound = rememberCombatRound(
        state.characterJson.id,
        slotIndex,
        response,
        state.lootConfig,
      );
      await paceCombatReplay(panelEl, response.combat, response.session.durationMs);
      if (generation !== activeLoopGeneration) break;

      const gameState = applyTowerCombatPatch(state, response.patch);
      setState(gameState);
      onSidebarUpdate(gameState);

      if (getLiveArena(panelEl)) {
        const floorChanged = response.patch.currentFloor != null;
        const needsFullRefresh = updateTowerPanelAfterCombat(panelEl, gameState, {
          floorChanged,
          previousEnemyId,
        });
        if (needsFullRefresh) {
          onPanelRefresh();
        }
      }

      replayCachedEventMessages(cachedRound, onEvent);

      if (response.combat.outcome !== "player_win") {
        onStatus("Derrota — ataque contínuo pausado. Equipe-se melhor e tente de novo.");
        onError("Derrota no combate. Ataque contínuo foi interrompido.");
        break;
      }

      await waitForTowerSession(
        gameState.characterJson.tower,
        onStatus,
        getLiveArena(panelEl)?.parentElement ?? undefined,
      );

      if (!getState()?.characterJson.tower.continuousAttack) break;
      const latest = getState();
      if (!latest || !canStartTowerCombat(latest)) break;

      await delay(LOOP_PAUSE_MS);
    }
  } catch (err) {
    onError(err instanceof Error ? err.message : "Falha no ataque contínuo.");
    onStatus("Ataque contínuo interrompido.");
  } finally {
    if (generation === activeLoopGeneration) {
      activeLoopGeneration = 0;
    }
    onFinished();
  }
}

export async function runSingleTowerCombat(options: {
  slotIndex: number;
  panelEl: HTMLElement;
  getState: () => GameStateResponse | null;
  setState: (state: GameStateResponse) => void;
  onSidebarUpdate: (state: GameStateResponse) => void;
  onStatus: (message: string) => void;
  onEvent: (message: string) => void;
}): Promise<"win" | "defeat" | "error"> {
  const { slotIndex, panelEl, getState, setState, onSidebarUpdate, onStatus, onEvent } = options;

  const arena = getLiveArena(panelEl);
  if (!arena) return "error";

  const state = getState();
  if (!state) return "error";

  try {
    await waitForTowerSession(
      state.characterJson.tower,
      onStatus,
      arena.parentElement ?? undefined,
    );

    const response = await requestSingleCombat(slotIndex);
    const cachedRound = rememberCombatRound(
      state.characterJson.id,
      slotIndex,
      response,
      state.lootConfig,
    );

    await paceCombatReplay(panelEl, response.combat, response.session.durationMs);

    const gameState = applyTowerCombatPatch(state, response.patch);
    setState(gameState);
    onSidebarUpdate(gameState);

    replayCachedEventMessages(cachedRound, onEvent);

    await waitForTowerSession(
      { ...gameState.characterJson.tower, combatSession: response.session },
      onStatus,
      arena.parentElement ?? undefined,
    );

    clearPersistedCombatCache(state.characterJson.id);

    if (response.combat.outcome !== "player_win") {
      onStatus("Derrota — tente novamente após se equipar melhor.");
      return "defeat";
    }

    return "win";
  } catch {
    onStatus("O servidor calcula o combate; o front apenas anima o resultado.");
    return "error";
  }
}

export async function resumePendingCombatSession(
  state: GameStateResponse,
  slotIndex: number,
  panelEl: HTMLElement,
  options?: {
    onStatus?: (message: string) => void;
    onEvent?: (message: string) => void;
  },
): Promise<void> {
  const onStatus = options?.onStatus;
  const onEvent = options?.onEvent;
  const tower = state.characterJson.tower;
  const session = tower.combatSession;

  if (!session || !hasActiveCombatSession(tower)) return;

  const dock = getLiveArena(panelEl)?.parentElement ?? getLiveArena(panelEl);
  const enemyName = session.enemyName || "inimigo";

  const cached =
    findCachedRoundForSession(slotIndex, session.sessionId)
    ?? getLastCachedRound(slotIndex);

  const remainingMs = getCombatSessionRemainingMs(tower);

  if (
    cached
    && cached.session.sessionId === session.sessionId
    && remainingMs > 0
  ) {
    onStatus?.(`Retomando combate contra ${cached.combat.enemyName} (andar ${cached.encounter.floor})…`);
    rebindEnemySprite(panelEl, state);

    const elapsedMs = getCombatElapsedMs(session);
    const resumeFrom = computeReplayResumePoint(cached.combat, elapsedMs);

    await paceCombatReplay(panelEl, cached.combat, session.durationMs, resumeFrom);
    if (onEvent) replayCachedEventMessages(cached, onEvent);
  } else {
    onStatus?.(`Aguardando servidor finalizar combate contra ${enemyName}…`);
    if (dock) {
      showCombatDockLoading(dock, enemyName, session.isBoss, remainingMs);
    }
    await waitForTowerSession(tower, onStatus, dock ?? undefined);
  }

  await waitForTowerSession(tower, onStatus, dock ?? undefined);
  clearPersistedCombatCache(state.characterJson.id);
  if (dock) hideCombatDockLoading(dock);
}

export function prepareCombatResumeFromStorage(
  characterId: string,
  slotIndex: number,
): void {
  hydrateCombatCacheFromStorage(characterId, slotIndex);
}
