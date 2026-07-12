import {
  CLASS_LABELS,
  RACE_LABELS,
  type GameStateResponse,
} from "../api/gameplay";
import { resolveCharacterSprite, resolveFloorBackground, resolveMobSprite } from "./game-assets";
import { resolveMobSpriteSheet, resolvePlayerSpriteSheet } from "../animation/sprite-registry";
import { computeDisplayStats } from "./inventory-panel";
import { getCurrentTowerEnemy } from "./tower-panel";

export interface CombatDockOptions {
  state: GameStateResponse;
  username: string;
}

/** Arena persistente — sempre visível no rodapé do hub. */
export function renderCombatDock(options: CombatDockOptions): string {
  const { state, username } = options;
  const char = state.characterJson;
  const floor = state.currentFloor;
  const tower = char.tower;

  if (!floor) {
    return `
      <div class="combat-dock__empty">
        <p>Entre na Torre Infinita para iniciar o combate.</p>
      </div>
    `;
  }

  const currentEnemy = getCurrentTowerEnemy(floor, tower);
  const facingBoss = !tower.bossDefeated && tower.mobsKilledThisFloor >= floor.mobCount;
  const playerHasSheet = Boolean(resolvePlayerSpriteSheet(char.raceId, char.classId));
  const enemyHasSheet = Boolean(resolveMobSpriteSheet(currentEnemy.id));
  const playerSprite = resolveCharacterSprite(char.assets);
  const enemySprite = resolveMobSprite(currentEnemy.id, currentEnemy.assets);
  const floorBg = resolveFloorBackground(floor.floor);
  const raceLabel = RACE_LABELS[char.raceId] ?? char.raceId;
  const classLabel = CLASS_LABELS[char.classId] ?? char.classId;
  const playerStats = computeDisplayStats(state);
  const xpToNext = Math.max(1, char.progression.level * 100);
  const xpPct = Math.min(100, Math.round((char.progression.xp / xpToNext) * 100));

  return `
    <div
      class="tower-arena combat-dock__arena"
      style="background-image: linear-gradient(to top, rgba(8, 6, 18, 0.45) 0%, transparent 32%), url('${floorBg}')"
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

      <div
        class="combat-dock__xp"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="${xpToNext}"
        aria-valuenow="${char.progression.xp}"
        aria-label="Experiência"
      >
        <div class="combat-dock__xp-fill" style="width: ${xpPct}%"></div>
        <span class="combat-dock__xp-text">EXP ${char.progression.xp.toLocaleString("pt-BR")} / ${xpToNext.toLocaleString("pt-BR")}</span>
      </div>
    </div>
  `;
}

export function renderCombatEventsShell(): string {
  return `
    <h2 class="combat-events__title">Eventos</h2>
    <ol id="combat-events-list" class="combat-events__list" aria-live="polite" aria-relevant="additions"></ol>
  `;
}

const MAX_COMBAT_EVENTS = 40;

export function pushCombatEvent(message: string): void {
  const list = document.querySelector<HTMLOListElement>("#combat-events-list");
  if (!list) return;

  const item = document.createElement("li");
  item.className = "combat-events__item";
  const time = new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  item.innerHTML = `<time class="combat-events__time">${time}</time><span>${message}</span>`;
  list.prepend(item);

  while (list.children.length > MAX_COMBAT_EVENTS) {
    list.lastElementChild?.remove();
  }
}

export function updateCombatDockXp(state: GameStateResponse): void {
  const bar = document.querySelector<HTMLElement>(".combat-dock__xp");
  if (!bar) return;

  const xp = state.characterJson.progression.xp;
  const level = state.characterJson.progression.level;
  const xpToNext = Math.max(1, level * 100);
  const xpPct = Math.min(100, Math.round((xp / xpToNext) * 100));

  bar.setAttribute("aria-valuemax", String(xpToNext));
  bar.setAttribute("aria-valuenow", String(xp));
  const fill = bar.querySelector<HTMLElement>(".combat-dock__xp-fill");
  const text = bar.querySelector<HTMLElement>(".combat-dock__xp-text");
  if (fill) fill.style.width = `${xpPct}%`;
  if (text) {
    text.textContent = `EXP ${xp.toLocaleString("pt-BR")} / ${xpToNext.toLocaleString("pt-BR")}`;
  }
}
