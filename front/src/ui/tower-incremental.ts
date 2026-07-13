import type { GameStateResponse, TowerMobSummary } from "../api/gameplay";
import { resolveMobIcon } from "./game-assets";
import { getTowerFloorNavState } from "./tower-navigation";
import { canStartTowerCombat, hasActiveCombatSession } from "./tower-combat";
import {
  getEffectiveMobIndex,
  getNextTowerEnemy,
  getTowerEnemyAtIndex,
  resolveDockEnemy,
} from "./tower-panel";
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
  const activeMobIndex = getEffectiveMobIndex(tower);
  const killed = tower.mobsKilledThisFloor;
  const facingBoss = !tower.bossDefeated && activeMobIndex >= mobCount;
  const bossDefeated = tower.bossDefeated;
  const currentEnemy = resolveDockEnemy(floor, tower);
  const nextEnemy =
    hasActiveCombatSession(tower)
      ? (activeMobIndex + 1 > mobCount
          ? null
          : getTowerEnemyAtIndex(floor, activeMobIndex + 1))
      : getNextTowerEnemy(floor, tower);
  const currentIsBoss = facingBoss || bossDefeated || killed >= mobCount;
  const nextIsBoss = nextEnemy != null && nextEnemy.id === floor.boss.id;

  const progressEl = panelEl.querySelector<HTMLElement>(".tower-header__progress");
  if (progressEl) {
    progressEl.textContent = `${killed} / ${mobCount} · ${
      tower.bossDefeated
        ? "Chefe derrotado"
        : facingBoss
          ? "Chefe aguardando"
          : "Em progresso"
    }`;
  }

  const progressPct = Math.min(
    100,
    Math.round(((tower.bossDefeated ? mobCount + 1 : killed) / (mobCount + 1)) * 100),
  );
  const fillEl = panelEl.querySelector<HTMLElement>(".tower-mission-progress__fill");
  const pctEl = panelEl.querySelector<HTMLElement>(".tower-mission-progress__pct");
  if (fillEl) fillEl.style.width = `${progressPct}%`;
  if (pctEl) pctEl.textContent = `${progressPct}%`;

  updateTowerTrack(panelEl, tower, activeMobIndex, facingBoss);
  updateTowerTargetCard(panelEl, "current", currentEnemy, currentIsBoss);
  updateTowerTargetCard(
    panelEl,
    "next",
    nextEnemy,
    nextIsBoss,
    bossDefeated ? "Andar concluído" : "Fim da rota do andar",
  );

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

function updateTowerTargetCard(
  panelEl: HTMLElement,
  role: "current" | "next",
  enemy: TowerMobSummary | null,
  isBossTarget: boolean,
  emptyText = "Nenhum inimigo restante",
): void {
  const target = panelEl.querySelector<HTMLElement>(`[data-tower-target="${role}"]`);
  if (!target) return;

  const labelText = role === "current" ? "Alvo atual" : "Próximo alvo";
  let label = target.querySelector<HTMLElement>(".tower-target__label");
  if (!label) {
    label = document.createElement("p");
    label.className = "tower-target__label";
    target.prepend(label);
  }
  label.textContent = labelText;

  if (!enemy) {
    target.classList.add("tower-target--empty");
    target.querySelector(".tower-target__main")?.remove();
    let empty = target.querySelector<HTMLElement>(".tower-target__empty");
    if (!empty) {
      empty = document.createElement("p");
      empty.className = "tower-target__empty";
      target.appendChild(empty);
    }
    empty.textContent = emptyText;
    return;
  }

  target.classList.remove("tower-target--empty");
  target.querySelector(".tower-target__empty")?.remove();

  let main = target.querySelector<HTMLElement>(".tower-target__main");
  if (!main) {
    main = document.createElement("div");
    main.className = "tower-target__main";
    main.innerHTML = `
      <div class="tower-target__frame">
        <img class="tower-target__icon" src="" alt="" aria-hidden="true" data-tower-target-icon />
      </div>
      <div class="tower-target__info">
        <h3 class="tower-target__name"></h3>
        <p class="tower-target__stats"></p>
        <p class="tower-target__reward"></p>
      </div>
    `;
    target.appendChild(main);
  }

  const frame = target.querySelector<HTMLElement>(".tower-target__frame");
  frame?.classList.toggle("tower-target__frame--boss", isBossTarget);

  const icon = target.querySelector<HTMLImageElement>("[data-tower-target-icon]");
  if (icon) icon.src = resolveMobIcon(enemy.id, enemy.assets);

  const name = target.querySelector<HTMLElement>(".tower-target__name");
  if (name) name.textContent = enemy.name;

  const stats = target.querySelector<HTMLElement>(".tower-target__stats");
  if (stats) {
    stats.textContent = `Nv. ${enemy.level} · HP ${enemy.hp.toLocaleString("pt-BR")} · ATK ${enemy.attack.toLocaleString("pt-BR")} · DEF ${enemy.defense.toLocaleString("pt-BR")}`;
  }

  const reward = target.querySelector<HTMLElement>(".tower-target__reward");
  if (reward) {
    reward.textContent = `+${enemy.xp.toLocaleString("pt-BR")} XP · +${enemy.gold.toLocaleString("pt-BR")} ouro`;
  }
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
