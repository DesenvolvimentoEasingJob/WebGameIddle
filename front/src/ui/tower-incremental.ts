import type { GameStateResponse } from "../api/gameplay";
import { getTowerFloorNavState } from "./tower-navigation";
import { canStartTowerCombat } from "./tower-combat";
import { getCurrentTowerEnemy } from "./tower-panel";
import { rebindEnemySprite } from "./tower-sprites";

export function updateTowerPanelAfterCombat(
  panelEl: HTMLElement,
  state: GameStateResponse,
  options?: { floorChanged?: boolean; previousEnemyId?: string },
): boolean {
  if (options?.floorChanged) return true;

  const floor = state.currentFloor;
  if (!floor) return true;

  const tower = state.characterJson.tower;
  const mobCount = floor.mobCount;
  const killed = tower.mobsKilledThisFloor;
  const facingBoss = !tower.bossDefeated && killed >= mobCount;
  const bossDefeated = tower.bossDefeated;
  const currentEnemy = getCurrentTowerEnemy(floor, tower);

  const progressEl = panelEl.querySelector<HTMLElement>(".tower-header__progress");
  if (progressEl) {
    progressEl.textContent = `${killed} / ${mobCount} inimigos · ${
      tower.bossDefeated
        ? "Chefe derrotado"
        : facingBoss
          ? "Chefe aguardando"
          : "Em progresso"
    }`;
  }

  updateTowerTrack(panelEl, tower, killed, facingBoss);

  const enemyFigure = panelEl.querySelector<HTMLElement>(".tower-fighter--enemy");
  if (enemyFigure) {
    enemyFigure.classList.toggle(
      "tower-fighter--boss",
      facingBoss || tower.bossDefeated,
    );

    const nameEl = enemyFigure.querySelector<HTMLElement>(".tower-fighter__caption strong");
    const statsEl = enemyFigure.querySelector<HTMLElement>(".tower-fighter__caption span");
    if (nameEl) nameEl.textContent = currentEnemy.name;
    if (statsEl) {
      statsEl.textContent = `Nv. ${currentEnemy.level} · HP ${currentEnemy.hp.toLocaleString("pt-BR")}`;
    }

    const enemyHpBar = enemyFigure.querySelector<HTMLElement>('[data-combat-hp="enemy"]');
    if (enemyHpBar) {
      enemyHpBar.setAttribute("aria-valuemax", String(currentEnemy.hp));
      enemyHpBar.setAttribute("aria-valuenow", String(currentEnemy.hp));
      const fill = enemyHpBar.querySelector<HTMLElement>(".tower-combat-hp__fill");
      const text = enemyHpBar.querySelector<HTMLElement>(".tower-combat-hp__text");
      if (fill) fill.style.width = "100%";
      if (text) {
        text.textContent = `${currentEnemy.hp.toLocaleString("pt-BR")} / ${currentEnemy.hp.toLocaleString("pt-BR")}`;
      }
    }
  }

  if (options?.previousEnemyId && options.previousEnemyId !== currentEnemy.id) {
    rebindEnemySprite(panelEl, state);
  }

  updateTowerFloorNav(panelEl, tower);
  const needsRepeatButton = bossDefeated && !panelEl.querySelector("#tower-repeat-floor");
  updateTowerActionButtons(panelEl, state, canStartTowerCombat(state), bossDefeated);

  return needsRepeatButton;
}

function updateTowerTrack(
  panelEl: HTMLElement,
  tower: GameStateResponse["characterJson"]["tower"],
  killed: number,
  facingBoss: boolean,
): void {
  const entries = panelEl.querySelectorAll<HTMLElement>(".tower-track__entry");
  entries.forEach((entry, index) => {
    const isBoss = entry.classList.contains("tower-track__entry--boss");
    entry.classList.remove(
      "tower-track__entry--done",
      "tower-track__entry--current",
      "tower-track__entry--pending",
    );

    if (isBoss) {
      if (tower.bossDefeated) entry.classList.add("tower-track__entry--done");
      else if (facingBoss) entry.classList.add("tower-track__entry--current");
      else entry.classList.add("tower-track__entry--pending");
      return;
    }

    if (index < killed) entry.classList.add("tower-track__entry--done");
    else if (index === killed && !facingBoss && !tower.bossDefeated) {
      entry.classList.add("tower-track__entry--current");
    } else {
      entry.classList.add("tower-track__entry--pending");
    }
  });
}

function updateTowerFloorNav(
  panelEl: HTMLElement,
  tower: GameStateResponse["characterJson"]["tower"],
): void {
  const nav = getTowerFloorNavState(tower);
  const valueEl = panelEl.querySelector<HTMLElement>(".tower-floor-nav__value");
  const unlockedEl = panelEl.querySelector<HTMLElement>(".tower-floor-nav__unlocked");
  if (valueEl) valueEl.textContent = String(tower.currentFloor);
  if (unlockedEl) unlockedEl.textContent = `/ ${tower.unlockedFloor}`;

  const upBtn = panelEl.querySelector<HTMLButtonElement>("#tower-floor-up");
  const downBtn = panelEl.querySelector<HTMLButtonElement>("#tower-floor-down");
  if (upBtn) upBtn.disabled = !nav.canGoUp;
  if (downBtn) downBtn.disabled = !nav.canGoDown;
}

function updateTowerActionButtons(
  panelEl: HTMLElement,
  state: GameStateResponse,
  canCombat: boolean,
  bossDefeated: boolean,
): void {
  const combatBtn = panelEl.querySelector<HTMLButtonElement>("#tower-start-combat");
  if (combatBtn) combatBtn.disabled = !canCombat;

  const repeatBtn = panelEl.querySelector<HTMLButtonElement>("#tower-repeat-floor");
  if (repeatBtn) {
    repeatBtn.disabled = !bossDefeated;
  } else if (bossDefeated) {
    // Repeat button appears only after boss defeated — full render needed once.
  }

  const facingBoss =
    !bossDefeated &&
    state.currentFloor != null &&
    state.characterJson.tower.mobsKilledThisFloor >= state.currentFloor.mobCount;
  const combatLabel = facingBoss ? "Enfrentar chefe" : "Iniciar combate";
  if (combatBtn) {
    combatBtn.setAttribute("aria-label", combatLabel);
    combatBtn.setAttribute("title", combatLabel);
    const sr = combatBtn.querySelector<HTMLElement>(".ui-atlas-btn__sr");
    if (sr) sr.textContent = combatLabel;
  }
}
