import { repeatTowerFloor, startTowerCombat, type GameStateResponse } from "../api/gameplay";

import { applyGamePatch } from "../state/game-cache";

import { formatCombatRewardMessage } from "./combat-rewards";

import { getTowerAnimators, waitForTowerAnimatorsReady } from "./tower-sprites";

import { canStartTowerCombat, playTowerCombatReplay } from "./tower-combat";

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
      const arena = panelEl.querySelector<HTMLElement>(".tower-arena");
      if (!arena?.isConnected) break;

      state = getState();
      if (!state?.characterJson.tower.continuousAttack) break;
      if (!canStartTowerCombat(state)) break;

      await waitForTowerAnimatorsReady();

      const previousEnemyId =
        state.currentFloor != null
          ? getCurrentTowerEnemy(state.currentFloor, state.characterJson.tower).id
          : undefined;

      fightCount += 1;
      onStatus(`Farmando andar… combate ${fightCount}`);

      const { combat, patch } = await requestTowerCombat(slotIndex);
      onStatus(`Reproduzindo combate ${fightCount}…`);

      const liveArena = panelEl.querySelector<HTMLElement>(".tower-arena");
      if (!liveArena?.isConnected) break;

      await playTowerCombatReplay(liveArena, combat, getTowerAnimators());

      const gameState = applyGamePatch(state, patch);
      setState(gameState);
      onSidebarUpdate(gameState);

      const floorChanged = patch.currentFloor != null;
      const needsFullRefresh = updateTowerPanelAfterCombat(panelEl, gameState, {
        floorChanged,
        previousEnemyId,
      });
      if (needsFullRefresh) {
        onPanelRefresh();
      }

      if (combat.outcome !== "player_win") {
        onStatus("Derrota — ataque contínuo pausado. Equipe-se melhor e tente de novo.");
        onError("Derrota no combate. Ataque contínuo foi interrompido.");
        break;
      }

      const reward = combat.rewards;
      onStatus(
        reward
          ? `Vitória ${fightCount}! ${formatCombatRewardMessage(reward, gameState.lootConfig)}`
          : `Vitória ${fightCount}!`,
      );

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

  const arena = panelEl.querySelector<HTMLElement>(".tower-arena");

  if (!arena) return "error";



  const state = getState();

  if (!state) return "error";



  try {

    onStatus("Calculando combate no servidor…");

    const { combat, patch } = await requestTowerCombat(slotIndex);

    onStatus("Reproduzindo combate…");



    const liveArena = panelEl.querySelector<HTMLElement>(".tower-arena");

    if (!liveArena?.isConnected) return "error";



    await playTowerCombatReplay(liveArena, combat, getTowerAnimators());

    const gameState = applyGamePatch(state, patch);

    setState(gameState);

    onSidebarUpdate(gameState);



    if (combat.outcome === "player_win") {

      const reward = combat.rewards;

      onStatus(

        reward

          ? `Vitória! ${formatCombatRewardMessage(reward, gameState.lootConfig)}`

          : "Vitória!",

      );

      return "win";

    }



    onStatus("Derrota — tente novamente após se equipar melhor.");

    return "defeat";

  } catch {

    onStatus("O servidor calcula o combate; o front apenas anima o resultado.");

    return "error";

  }

}


