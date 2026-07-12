import {
  CLASS_LABELS,
  RACE_LABELS,
  type GameStateResponse,
} from "../api/gameplay";
import { type CategoryTree } from "./game-assets";
import { computeDisplayStats } from "./inventory-panel";

const ATTRIBUTE_LABELS: Record<string, string> = {
  strength: "Força",
  agility: "Agilidade",
  intelligence: "Inteligência",
};

const ATTRIBUTE_ORDER = ["strength", "agility", "intelligence"] as const;

const COMBAT_LABELS: Record<string, string> = {
  critChancePercent: "Chance crítica",
  lifeStealPercent: "Roubo de vida",
  hpBonus: "Vida adicional",
};

const DAMAGE_LABELS: Record<string, string> = {
  physical: "Bônus de dano físico",
  magical: "Bônus de dano mágico",
};

export interface StatusPanelOptions {
  state: GameStateResponse;
  username: string;
}

interface AttrBreakdown {
  key: string;
  label: string;
  base: number;
  bonus: number;
  total: number;
}

function readAttr(
  attrs: CategoryTree["attributes"] | undefined,
  key: string,
): { base: number; bonus: number; total: number } {
  const node = attrs?.[key];
  const base = node?.base ?? 0;
  const bonus = node?.bonus ?? 0;
  return { base, bonus, total: base + bonus };
}

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function collectAttributeRows(state: GameStateResponse): AttrBreakdown[] {
  const attrs = (state.effectiveCategories as CategoryTree)?.attributes ?? {};
  const keys = new Set([...ATTRIBUTE_ORDER, ...Object.keys(attrs)]);

  return [...keys].map((key) => {
    const { base, bonus, total } = readAttr(attrs, key);
    return {
      key,
      label: ATTRIBUTE_LABELS[key] ?? capitalize(key),
      base,
      bonus,
      total,
    };
  });
}

export function collectCombatBonusRows(state: GameStateResponse): { label: string; value: string }[] {
  const tree = state.effectiveCategories as CategoryTree;
  const rows: { label: string; value: string }[] = [];

  if (tree?.damage) {
    for (const [key, value] of Object.entries(tree.damage)) {
      const pct = value?.bonusPercent ?? 0;
      if (pct === 0) continue;
      rows.push({
        label: DAMAGE_LABELS[key] ?? capitalize(key),
        value: `+${formatNumber(pct)}%`,
      });
    }
  }

  if (tree?.combat) {
    for (const [key, raw] of Object.entries(tree.combat)) {
      const value = Number(raw) || 0;
      if (value === 0) continue;
      const isPercent = key.toLowerCase().includes("percent");
      rows.push({
        label: COMBAT_LABELS[key] ?? capitalize(key),
        value: isPercent ? `+${formatNumber(value)}%` : `+${formatNumber(value)}`,
      });
    }
  }

  return rows;
}

/** Stats derivados alinhados ao backend (base + bônus nos atributos). */
export function computeFullCombatStats(state: GameStateResponse): {
  attack: number;
  defense: number;
  hp: number;
  mp: number;
} {
  const attrs = (state.effectiveCategories as CategoryTree)?.attributes ?? {};
  const combat = (state.effectiveCategories as CategoryTree)?.combat ?? {};
  const damage = (state.effectiveCategories as CategoryTree)?.damage ?? {};
  const str = readAttr(attrs, "strength").total;
  const agi = readAttr(attrs, "agility").total;
  const intel = readAttr(attrs, "intelligence").total;
  const level = state.characterJson.progression?.level ?? 1;
  const hpBonus = Number(combat.hpBonus) || 0;
  const physicalBonus = damage.physical?.bonusPercent ?? 0;
  const magicalBonus = damage.magical?.bonusPercent ?? 0;

  let attack = str * 12 + agi * 4 + intel * 2 + level * 10;
  const bonusPercent = Math.max(physicalBonus, magicalBonus);
  if (bonusPercent > 0) {
    attack = Math.round(attack * (1 + bonusPercent / 100));
  }

  return {
    attack,
    defense: Math.round(str * 3 + agi * 6 + intel * 2 + level * 8),
    hp: Math.round(str * 8 + agi * 4 + intel * 3 + level * 50 + hpBonus),
    mp: Math.round(intel * 12 + level * 30),
  };
}

export function renderStatusPanel(options: StatusPanelOptions): string {
  const { state, username } = options;
  const char = state.characterJson;
  const raceLabel = RACE_LABELS[char.raceId] ?? capitalize(char.raceId);
  const classLabel = CLASS_LABELS[char.classId] ?? capitalize(char.classId);
  const level = char.progression.level;
  const xp = char.progression.xp;
  const xpToNext = Math.max(1, level * 100);
  const gold = char.progression.gold;
  const attrs = collectAttributeRows(state);
  const combatBonuses = collectCombatBonusRows(state);
  const derived = computeFullCombatStats(state);
  void computeDisplayStats;

  const totalMobsKilled = char.tower.totalMobsKilled ?? 0;
  const totalBossesKilled = char.tower.totalBossesKilled ?? 0;

  return `
    <div class="status-layout">
      <header class="status-header">
        <div class="status-header__identity">
          <h2 class="game-panel__title">Status</h2>
          <p class="status-header__name"><strong>${username}</strong></p>
          <p class="status-header__meta">${raceLabel} · ${classLabel} · Nv. ${formatNumber(level)}</p>
        </div>
        <dl class="status-header__progress">
          <div>
            <dt>Experiência</dt>
            <dd>${formatNumber(xp)} / ${formatNumber(xpToNext)}</dd>
          </div>
          <div>
            <dt>Ouro</dt>
            <dd>${formatNumber(gold)}</dd>
          </div>
          <div>
            <dt>Andar atual</dt>
            <dd>${formatNumber(char.tower.currentFloor)}</dd>
          </div>
          <div>
            <dt>Andar desbloqueado</dt>
            <dd>${formatNumber(char.tower.unlockedFloor)}</dd>
          </div>
        </dl>
      </header>

      <div class="status-grid">
        <div class="status-column">
          <section class="status-section" aria-label="Atributos">
            <h3 class="status-section__title">Atributos</h3>
            <table class="status-table">
              <thead>
                <tr>
                  <th scope="col">Atributo</th>
                  <th scope="col">Base</th>
                  <th scope="col">Bônus</th>
                  <th scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                ${attrs
                  .map(
                    (row) => `
                  <tr>
                    <th scope="row">${row.label}</th>
                    <td>${formatNumber(row.base)}</td>
                    <td class="${row.bonus > 0 ? "status-table__bonus" : ""}">${
                      row.bonus > 0 ? `+${formatNumber(row.bonus)}` : "—"
                    }</td>
                    <td><strong>${formatNumber(row.total)}</strong></td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>
          </section>

          <section class="status-section status-section--tower" aria-label="Histórico de abates">
            <h3 class="status-section__title">Histórico de abates</h3>
            <dl class="status-stat-list">
              <div class="status-stat-list__row">
                <dt>Monstros derrotados</dt>
                <dd>${formatNumber(totalMobsKilled)}</dd>
              </div>
              <div class="status-stat-list__row">
                <dt>Chefes derrotados</dt>
                <dd>${formatNumber(totalBossesKilled)}</dd>
              </div>
            </dl>
          </section>
        </div>

        <section class="status-section" aria-label="Combate">
          <h3 class="status-section__title">Combate</h3>
          <dl class="status-stat-list">
            <div class="status-stat-list__row">
              <dt>Ataque</dt>
              <dd>${formatNumber(derived.attack)}</dd>
            </div>
            <div class="status-stat-list__row">
              <dt>Defesa</dt>
              <dd>${formatNumber(derived.defense)}</dd>
            </div>
            <div class="status-stat-list__row">
              <dt>HP máximo</dt>
              <dd>${formatNumber(derived.hp)}</dd>
            </div>
            <div class="status-stat-list__row">
              <dt>MP máximo</dt>
              <dd>${formatNumber(derived.mp)}</dd>
            </div>
            ${combatBonuses
              .map(
                (row) => `
              <div class="status-stat-list__row">
                <dt>${row.label}</dt>
                <dd class="status-table__bonus">${row.value}</dd>
              </div>
            `,
              )
              .join("")}
          </dl>
        </section>
      </div>
    </div>
  `;
}
