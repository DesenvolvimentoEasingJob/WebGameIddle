import {
  CLASS_LABELS,
  RACE_LABELS,
  type GameStateResponse,
  type TowerMobSummary,
} from "../api/gameplay";
import { resolveCharacterSprite, resolveFloorBackground, resolveMobIcon, resolveMobSprite } from "./game-assets";
import { resolveMobSpriteSheet, resolvePlayerSpriteSheet } from "../animation/sprite-registry";
import { computeDisplayStats } from "./inventory-panel";
import { canStartTowerCombat } from "./tower-combat";

export interface TowerPanelOptions {
  state: GameStateResponse;
  username: string;
}

export function renderTowerPanel(options: TowerPanelOptions): string {
  const { state, username } = options;
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
  const currentEnemy = getCurrentEnemy(floor, tower);
  const playerHasSheet = Boolean(resolvePlayerSpriteSheet(char.raceId, char.classId));
  const enemyHasSheet = Boolean(resolveMobSpriteSheet(currentEnemy.id));
  const playerSprite = resolveCharacterSprite(char.assets);
  const enemySprite = resolveMobSprite(currentEnemy.id, currentEnemy.assets);
  const bossIcon = resolveMobIcon(floor.boss.id, floor.boss.assets);
  const floorBg = resolveFloorBackground(floor.floor);
  const ownerLabel = floor.ownerName?.trim() || "Sem dono";
  const raceLabel = RACE_LABELS[char.raceId] ?? char.raceId;
  const classLabel = CLASS_LABELS[char.classId] ?? char.classId;
  const playerStats = computeDisplayStats(state);
  const canCombat = canStartTowerCombat(state);
  const combatLabel = facingBoss ? "Enfrentar chefe" : "Iniciar combate";

  return `
    <div class="tower-layout">
      <header class="tower-header">
        <div class="tower-header__info">
          <h2 class="game-panel__title">Andar ${floor.floor} — ${floor.name}</h2>
          <p class="tower-header__owner">Dono do andar: <strong>${ownerLabel}</strong></p>
        </div>
        <p class="tower-header__progress">${killed} / ${mobCount} inimigos · ${tower.bossDefeated ? "Chefe derrotado" : facingBoss ? "Chefe aguardando" : "Em progresso"}</p>
      </header>

      <div
        class="tower-arena"
        style="background-image: linear-gradient(to top, rgba(8, 6, 18, 0.35) 0%, transparent 28%), url('${floorBg}')"
        aria-label="Arena de combate"
      >
        <figure class="tower-fighter tower-fighter--player">
          <div
            class="tower-combat-hp tower-combat-hp--player"
            data-combat-hp="player"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="${playerStats.hp}"
            aria-valuenow="${playerStats.hp}"
            aria-label="HP do jogador"
          >
            <div class="tower-combat-hp__fill" style="width: 100%"></div>
            <span class="tower-combat-hp__text">${playerStats.hp.toLocaleString("pt-BR")} / ${playerStats.hp.toLocaleString("pt-BR")}</span>
          </div>
          <div class="tower-fighter__stage">
            ${
              playerHasSheet
                ? `<div class="sprite-sheet-stage sprite-sheet-stage--player" data-tower-player-sprite aria-hidden="true"></div>`
                : `<img class="tower-fighter__fallback" src="${playerSprite}" alt="" aria-hidden="true" />`
            }
          </div>
          <figcaption class="tower-fighter__caption">
            <strong>${username}</strong>
            <span>${raceLabel} · ${classLabel} · Nv. ${char.progression.level}</span>
          </figcaption>
        </figure>

        <figure class="tower-fighter tower-fighter--enemy${facingBoss || tower.bossDefeated ? " tower-fighter--boss" : ""}">
          <div
            class="tower-combat-hp tower-combat-hp--enemy"
            data-combat-hp="enemy"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="${currentEnemy.hp}"
            aria-valuenow="${currentEnemy.hp}"
            aria-label="HP do inimigo"
          >
            <div class="tower-combat-hp__fill" style="width: 100%"></div>
            <span class="tower-combat-hp__text">${currentEnemy.hp.toLocaleString("pt-BR")} / ${currentEnemy.hp.toLocaleString("pt-BR")}</span>
          </div>
          <div class="tower-fighter__stage">
            ${
              enemyHasSheet
                ? `<div class="sprite-sheet-stage sprite-sheet-stage--enemy" data-tower-enemy-sprite aria-hidden="true"></div>`
                : `<img class="tower-fighter__fallback" src="${enemySprite}" alt="" aria-hidden="true" />`
            }
          </div>
          <figcaption class="tower-fighter__caption">
            <strong>${currentEnemy.name}</strong>
            <span>Nv. ${currentEnemy.level} · HP ${currentEnemy.hp.toLocaleString("pt-BR")}</span>
          </figcaption>
        </figure>
      </div>

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

      <footer class="tower-actions">
        <p class="tower-actions__hint" id="tower-combat-status">
          ${
            tower.bossDefeated
              ? "Andar concluído — ative subir automático ou avance manualmente (em breve)."
              : "O servidor calcula o combate; o front apenas anima o resultado."
          }
        </p>
        <button
          type="button"
          id="tower-start-combat"
          class="ui-btn ui-btn--sm"
          ${canCombat ? "" : "disabled"}
        >
          ${combatLabel}
        </button>
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
