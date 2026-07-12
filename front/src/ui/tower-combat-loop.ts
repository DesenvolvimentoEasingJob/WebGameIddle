import { repeatTowerFloor, startTowerCombat, type GameStateResponse } from "../api/gameplay";
import { applyGamePatch } from "../state/game-cache";
import { publishCombatRewardEvents } from "./combat-rewards";
import { getTowerAnimators, waitForTowerAnimatorsReady } from "./tower-sprites";
import {
  awaitTowerCombatTiming,
  canStartTowerCombat,
  estimateTowerCombatDurationMs,
  playTowerCombatReplay,
} from "./tower-combat";
import { updateTowerPanelAfterCombat } from "./tower-incremental";
import { getCurrentTowerEnemy } from "./tower-panel";

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

async function requestTowerCombat(slotIndex: number) {
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

/** Replay na arena (HP sempre) ou só espera quando não há dock. */
async function paceCombatReplay(
  panelEl: HTMLElement,
  combat: Parameters<typeof playTowerCombatReplay>[1],
): Promise<void> {
  const expectedMs = estimateTowerCombatDurationMs(combat);
  const startedAt = performance.now();
  const arena = getLiveArena(panelEl);

  if (arena) {
    // Com arena montada, sempre atualiza HP no tempo certo.
    // Sprites só com a aba visível (em background o RAF fica throttled).
    await playTowerCombatReplay(arena, combat, getTowerAnimators(), {
      animate: !document.hidden,
    });
  } else {
    await awaitTowerCombatTiming(combat);
  }

  // Se o replay abortou cedo (arena desmontada), completa o tempo restante.
  const remaining = expectedMs - (performance.now() - startedAt);
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
    onError,
    onFinished,
  } = options;

  let fightCount = 0;

  try {
    let state = getState();
    if (!state?.characterJson.tower.continuousAttack) {
      return;
    }

    state = await ensureFloorReadyForCombat(slotIndex, state);
    setState(state);
    onSidebarUpdate(state);

    while (generation === activeLoopGeneration) {
      state = getState();
      if (!state?.characterJson.tower.continuousAttack) break;
      if (!canStartTowerCombat(state)) break;

      if (getLiveArena(panelEl) && !document.hidden) {
        await waitForTowerAnimatorsReady();
      }

      const previousEnemyId =
        state.currentFloor != null
          ? getCurrentTowerEnemy(state.currentFloor, state.characterJson.tower).id
          : undefined;

      fightCount += 1;

      const { combat, patch } = await requestTowerCombat(slotIndex);

      if (generation !== activeLoopGeneration) break;

      await paceCombatReplay(panelEl, combat);

      if (generation !== activeLoopGeneration) break;

      const gameState = applyGamePatch(state, patch);
      setState(gameState);
      onSidebarUpdate(gameState);

      if (getLiveArena(panelEl)) {
        const floorChanged = patch.currentFloor != null;
        const needsFullRefresh = updateTowerPanelAfterCombat(panelEl, gameState, {
          floorChanged,
          previousEnemyId,
        });
        if (needsFullRefresh) {
          onPanelRefresh();
        }
      }

      if (combat.outcome !== "player_win") {
        onStatus("Derrota — ataque contínuo pausado. Equipe-se melhor e tente de novo.");
        onError("Derrota no combate. Ataque contínuo foi interrompido.");
        break;
      }

      const reward = combat.rewards;
      if (reward) {
        publishCombatRewardEvents(reward, gameState.lootConfig, onStatus);
      } else {
        onStatus("Vitória!");
      }

      if (!getState()?.characterJson.tower.continuousAttack) break;
      if (!canStartTowerCombat({ characterJson: gameState.characterJson })) break;

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
}): Promise<"win" | "defeat" | "error"> {
  const { slotIndex, panelEl, getState, setState, onSidebarUpdate, onStatus } = options;

  const arena = getLiveArena(panelEl);
  if (!arena) return "error";

  const state = getState();
  if (!state) return "error";

  try {
    const { combat, patch } = await requestTowerCombat(slotIndex);

    const liveArena = getLiveArena(panelEl);
    if (liveArena) {
      await playTowerCombatReplay(liveArena, combat, getTowerAnimators(), {
        animate: !document.hidden,
      });
    } else {
      await awaitTowerCombatTiming(combat);
    }

    const gameState = applyGamePatch(state, patch);
    setState(gameState);
    onSidebarUpdate(gameState);

    if (combat.outcome === "player_win") {
      const reward = combat.rewards;
      if (reward) {
        publishCombatRewardEvents(reward, gameState.lootConfig, onStatus);
      } else {
        onStatus("Vitória!");
      }
      return "win";
    }

    onStatus("Derrota — tente novamente após se equipar melhor.");
    return "defeat";
  } catch {
    onStatus("O servidor calcula o combate; o front apenas anima o resultado.");
    return "error";
  }
}
