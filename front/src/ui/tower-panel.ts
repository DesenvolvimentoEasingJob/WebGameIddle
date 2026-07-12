import type { GameStateResponse, TowerMobSummary } from "../api/gameplay";
import { resolveMobIcon } from "./game-assets";
import { renderTowerFloorNav } from "./tower-navigation";
import { canStartTowerCombat } from "./tower-combat";

export interface TowerPanelOptions {
  state: GameStateResponse;
  username: string;
}

function getEnemyAtIndex(
  floor: NonNullable<GameStateResponse["currentFloor"]>,
  index: number,
): TowerMobSummary {
  if (index >= floor.mobCount) return floor.boss;
  const pool = floor.mobPool;
  if (pool.length === 0) return floor.boss;
  return pool[index % pool.length]!;
}

function getCurrentEnemy(
  floor: NonNullable<GameStateResponse["currentFloor"]>,
  tower: GameStateResponse["characterJson"]["tower"],
): TowerMobSummary {
  if (tower.bossDefeated) return floor.boss;
  return getEnemyAtIndex(floor, tower.mobsKilledThisFloor);
}

/** Inimigo seguinte na rota do andar (após o alvo atual), se houver. */
export function getNextTowerEnemy(
  floor: NonNullable<GameStateResponse["currentFloor"]>,
  tower: GameStateResponse["characterJson"]["tower"],
): TowerMobSummary | null {
  if (tower.bossDefeated) return null;
  const nextIndex = tower.mobsKilledThisFloor + 1;
  if (nextIndex > floor.mobCount) return null;
  return getEnemyAtIndex(floor, nextIndex);
}

export function getCurrentTowerEnemy(
  floor: NonNullable<GameStateResponse["currentFloor"]>,
  tower: GameStateResponse["characterJson"]["tower"],
): TowerMobSummary {
  return getCurrentEnemy(floor, tower);
}

function progressPhaseLabel(
  tower: GameStateResponse["characterJson"]["tower"],
  facingBoss: boolean,
): string {
  if (tower.bossDefeated) return "Chefe derrotado";
  if (facingBoss) return "Chefe aguardando";
  return "Em progresso";
}

function renderTargetCard(options: {
  role: "current" | "next";
  label: string;
  enemy: TowerMobSummary | null;
  isBoss: boolean;
  emptyText?: string;
}): string {
  const { role, label, enemy, isBoss, emptyText = "Nenhum inimigo restante" } = options;

  if (!enemy) {
    return `
      <section class="tower-target tower-target--${role} tower-target--empty" data-tower-target="${role}" aria-label="${label}">
        <p class="tower-target__label">${label}</p>
        <p class="tower-target__empty">${emptyText}</p>
      </section>
    `;
  }

  const icon = resolveMobIcon(enemy.id, enemy.assets);

  return `
    <section class="tower-target tower-target--${role}" data-tower-target="${role}" aria-label="${label}">
      <p class="tower-target__label">${label}</p>
      <div class="tower-target__main">
        <div class="tower-target__frame${isBoss ? " tower-target__frame--boss" : ""}">
          <img
            class="tower-target__icon"
            src="${icon}"
            alt=""
            aria-hidden="true"
            data-tower-target-icon
          />
        </div>
        <div class="tower-target__info">
          <h3 class="tower-target__name">${enemy.name}</h3>
          <p class="tower-target__stats">
            Nv. ${enemy.level}
            · HP ${enemy.hp.toLocaleString("pt-BR")}
            · ATK ${enemy.attack.toLocaleString("pt-BR")}
            · DEF ${enemy.defense.toLocaleString("pt-BR")}
          </p>
          <p class="tower-target__reward">
            +${enemy.xp.toLocaleString("pt-BR")} XP
            · +${enemy.gold.toLocaleString("pt-BR")} ouro
          </p>
        </div>
      </div>
    </section>
  `;
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
  const currentEnemy = getCurrentEnemy(floor, tower);
  const nextEnemy = getNextTowerEnemy(floor, tower);
  const currentIsBoss = facingBoss || tower.bossDefeated || killed >= mobCount;
  const nextIsBoss = nextEnemy != null && nextEnemy.id === floor.boss.id;
  const phase = progressPhaseLabel(tower, facingBoss);
  const progressPct = Math.min(
    100,
    Math.round(((tower.bossDefeated ? mobCount + 1 : killed) / (mobCount + 1)) * 100),
  );

  return `
    <div class="tower-layout tower-layout--controls tower-layout--mission">
      <header class="tower-mission-top">
        <div class="tower-mission-top__title">
          <p class="tower-mission-top__eyebrow">Torre Infinita</p>
          <h2 class="tower-mission-top__name">Andar ${floor.floor} · ${floor.name}</h2>
          <p class="tower-mission-top__meta">Dono: <strong>${ownerLabel}</strong> · Nv. ${floor.floor}</p>
        </div>
        <div class="tower-mission-progress" aria-label="Progresso do andar">
          <div class="tower-mission-progress__row">
            <span class="tower-header__progress">${killed} / ${mobCount} · ${phase}</span>
            <span class="tower-mission-progress__pct">${progressPct}%</span>
          </div>
          <div class="tower-mission-progress__track" role="presentation">
            <div class="tower-mission-progress__fill" style="width: ${progressPct}%"></div>
          </div>
        </div>
      </header>

      <div class="tower-mission-body">
        <div class="tower-target-stack">
          ${renderTargetCard({
            role: "current",
            label: "Alvo atual",
            enemy: currentEnemy,
            isBoss: currentIsBoss,
          })}
          ${renderTargetCard({
            role: "next",
            label: "Próximo alvo",
            enemy: nextEnemy,
            isBoss: nextIsBoss,
            emptyText: tower.bossDefeated ? "Andar concluído" : "Fim da rota do andar",
          })}
        </div>

        <div class="tower-farm-options" aria-label="Opções de farm">
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
        </div>

        <aside class="tower-mission-side" aria-label="Rota do andar">
          <section class="tower-track" aria-label="Inimigos do andar">
            <h3 class="tower-track__title">Rota</h3>
            <ol class="tower-track__list">
              ${Array.from({ length: mobCount }, (_, index) => {
                const mob = floor.mobPool[index % Math.max(1, floor.mobPool.length)];
                const mobId = mob?.id ?? "unknown";
                const iconUrl = resolveMobIcon(mobId, mob?.assets);
                let stateClass = "tower-track__entry--pending";
                if (index < killed) stateClass = "tower-track__entry--done";
                else if (index === killed && !facingBoss && !tower.bossDefeated) {
                  stateClass = "tower-track__entry--current";
                }

                return `
                  <li class="tower-track__entry ${stateClass}" title="${mob?.name ?? `Inimigo ${index + 1}`}">
                    <div class="mob-icon-frame">
                      <img class="mob-icon-frame__portrait" src="${iconUrl}" alt="" aria-hidden="true" />
                      <span class="mob-icon-frame__badge">${index + 1}</span>
                    </div>
                  </li>
                `;
              }).join("")}
              <li class="tower-track__entry tower-track__entry--boss${
                tower.bossDefeated
                  ? " tower-track__entry--done"
                  : facingBoss
                    ? " tower-track__entry--current"
                    : ""
              }" title="${floor.boss.name}">
                <div class="mob-icon-frame mob-icon-frame--boss">
                  <img class="mob-icon-frame__portrait" src="${bossIcon}" alt="" aria-hidden="true" />
                  <span class="mob-icon-frame__badge" aria-hidden="true">★</span>
                </div>
              </li>
            </ol>
          </section>

          <section class="tower-boss-peek" aria-label="Chefe do andar">
            <p class="tower-boss-peek__label">Chefe</p>
            <div class="tower-boss-peek__row">
              <div class="mob-icon-frame mob-icon-frame--boss tower-boss-peek__icon">
                <img class="mob-icon-frame__portrait" src="${bossIcon}" alt="" aria-hidden="true" />
              </div>
              <div class="tower-boss-peek__info">
                <strong class="tower-boss-card__name">${floor.boss.name}</strong>
                <p class="tower-boss-card__stats">
                  Nv. ${floor.boss.level}
                  · HP ${floor.boss.hp.toLocaleString("pt-BR")}
                </p>
                <p class="tower-boss-card__reward">
                  ${floor.boss.xp.toLocaleString("pt-BR")} XP
                  · ${floor.boss.gold.toLocaleString("pt-BR")} ouro
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <footer class="tower-actions tower-actions--bar">
        ${renderTowerFloorNav({ tower })}
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
