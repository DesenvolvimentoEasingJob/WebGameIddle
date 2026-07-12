import type { GameStateResponse, TowerMobSummary } from "../api/gameplay";
import { resolveMobIcon } from "./game-assets";
import { renderTowerFloorNav } from "./tower-navigation";
import { canStartTowerCombat } from "./tower-combat";

export interface TowerPanelOptions {
  state: GameStateResponse;
  username: string;
}

/** Controles / progresso da torre — a arena fica no dock persistente. */
export function renderTowerPanel(options: TowerPanelOptions): string {
  const { state } = options;
  const char = state.characterJson;
  const floor = state.currentFloor;
  const tower = char.tower;

  if (!floor) {
    return `
      <div class="tower-layout">
        <h2 class="game-panel__title">Torre Infinita</h2>
        <p class="tower-layout__empty">Nenhum andar disponível no momento.</p>
      </div>
    `;
  }

  const mobCount = floor.mobCount;
  const killed = tower.mobsKilledThisFloor;
  const facingBoss = !tower.bossDefeated && killed >= mobCount;
  const bossIcon = resolveMobIcon(floor.boss.id, floor.boss.assets);
  const ownerLabel = floor.ownerName?.trim() || "Sem dono";
  const canCombat = canStartTowerCombat(state);
  const canRepeat = tower.bossDefeated;
  const combatLabel = facingBoss ? "Enfrentar chefe" : "Iniciar combate";

  return `
    <div class="tower-layout tower-layout--controls">
      <header class="tower-header">
        <div class="tower-header__info">
          <h2 class="game-panel__title">Andar ${floor.floor} — ${floor.name}</h2>
          <p class="tower-header__owner">Dono do andar: <strong>${ownerLabel}</strong></p>
        </div>
        <p class="tower-header__progress">${killed} / ${mobCount} inimigos · ${tower.bossDefeated ? "Chefe derrotado" : facingBoss ? "Chefe aguardando" : "Em progresso"}</p>
      </header>

      <section class="tower-track" aria-label="Progresso do andar">
        <h3 class="tower-track__title">Inimigos do andar</h3>
        <ol class="tower-track__list">
          ${Array.from({ length: mobCount }, (_, index) => {
            const mob = floor.mobPool[index % Math.max(1, floor.mobPool.length)];
            const mobId = mob?.id ?? "unknown";
            const iconUrl = resolveMobIcon(mobId, mob?.assets);
            let stateClass = "tower-track__entry--pending";
            if (index < killed) stateClass = "tower-track__entry--done";
            else if (index === killed && !facingBoss && !tower.bossDefeated) stateClass = "tower-track__entry--current";

            return `
              <li class="tower-track__entry ${stateClass}" title="${mob?.name ?? `Inimigo ${index + 1}`}">
                <div class="mob-icon-frame">
                  <img class="mob-icon-frame__portrait" src="${iconUrl}" alt="" aria-hidden="true" />
                  <span class="mob-icon-frame__badge">${index + 1}</span>
                </div>
              </li>
            `;
          }).join("")}
          <li class="tower-track__entry tower-track__entry--boss${tower.bossDefeated ? " tower-track__entry--done" : facingBoss ? " tower-track__entry--current" : ""}" title="${floor.boss.name}">
            <div class="mob-icon-frame mob-icon-frame--boss">
              <img class="mob-icon-frame__portrait" src="${bossIcon}" alt="" aria-hidden="true" />
              <span class="mob-icon-frame__badge" aria-hidden="true">★</span>
            </div>
          </li>
        </ol>
      </section>

      <section class="tower-boss-card" aria-label="Chefe do andar">
        <div class="guardian-portrait">
          <img class="guardian-portrait__icon" src="${bossIcon}" alt="" aria-hidden="true" />
        </div>
        <div class="tower-boss-card__info">
          <h3 class="tower-boss-card__name">${floor.boss.name}</h3>
          <p class="tower-boss-card__stats">Nv. ${floor.boss.level} · HP ${floor.boss.hp.toLocaleString("pt-BR")} · ATK ${floor.boss.attack} · DEF ${floor.boss.defense}</p>
          <p class="tower-boss-card__reward">Recompensa: ${floor.boss.xp.toLocaleString("pt-BR")} XP · ${floor.boss.gold.toLocaleString("pt-BR")} ouro</p>
        </div>
      </section>

      ${renderTowerFloorNav({ tower })}

      <footer class="tower-actions">
        <label class="tower-actions__continuous">
          <input
            id="tower-continuous-attack"
            class="ui-checkbox"
            type="checkbox"
            ${(tower.continuousAttack ?? false) ? "checked" : ""}
          />
          Ataque contínuo
        </label>
        <label class="tower-actions__continuous">
          <input
            id="tower-auto-ascend"
            class="ui-checkbox"
            type="checkbox"
            ${(tower.autoAscend ?? false) ? "checked" : ""}
          />
          Subir andar automaticamente
        </label>
        <div class="tower-actions__buttons">
          ${
            canRepeat
              ? `<button type="button" id="tower-repeat-floor" class="ui-atlas-btn ui-atlas-btn--hounting" aria-label="Repetir andar" title="Repetir andar"><span class="ui-atlas-btn__sr">Repetir andar</span></button>`
              : ""
          }
          <button
            type="button"
            id="tower-start-combat"
            class="ui-atlas-btn ui-atlas-btn--play"
            aria-label="${combatLabel}"
            title="${combatLabel}"
            ${canCombat ? "" : "disabled"}
          >
            <span class="ui-atlas-btn__sr">${combatLabel}</span>
          </button>
        </div>
      </footer>
    </div>
  `;
}

function getCurrentEnemy(
  floor: NonNullable<GameStateResponse["currentFloor"]>,
  tower: GameStateResponse["characterJson"]["tower"],
): TowerMobSummary {
  if (tower.bossDefeated) return floor.boss;
  if (tower.mobsKilledThisFloor >= floor.mobCount) return floor.boss;

  const pool = floor.mobPool;
  if (pool.length === 0) return floor.boss;

  return pool[tower.mobsKilledThisFloor % pool.length];
}

export function getCurrentTowerEnemy(
  floor: NonNullable<GameStateResponse["currentFloor"]>,
  tower: GameStateResponse["characterJson"]["tower"],
): TowerMobSummary {
  return getCurrentEnemy(floor, tower);
}
