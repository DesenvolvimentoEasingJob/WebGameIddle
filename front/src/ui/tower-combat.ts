import type { SpriteAnimator } from "../animation/SpriteAnimator";
import type { TowerCombatResult } from "../api/gameplay";
import { getTowerAnimators, waitForTowerAnimatorsReady } from "./tower-sprites";

/** Duração aproximada de um swing (6 frames @ 12fps + folga do fallback sem sheet). */
const ATTACK_SWING_MS = 520;
const CRITICAL_SWING_MS = 650;
const TURN_GAP_MS = 320;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** Tempo total que o replay visual levaria — usado para pacing headless. */
export function estimateTowerCombatDurationMs(combat: TowerCombatResult): number {
  let total = 0;
  for (const turn of combat.turns) {
    total += turn.kind === "critical" ? CRITICAL_SWING_MS : ATTACK_SWING_MS;
    total += TURN_GAP_MS;
  }
  return total;
}

/** Espera o mesmo tempo do combate animado, sem precisar da arena. */
export async function awaitTowerCombatTiming(combat: TowerCombatResult): Promise<void> {
  const ms = estimateTowerCombatDurationMs(combat);
  if (ms > 0) await delay(ms);
}

function resolveCombatStages(arena: HTMLElement): {
  playerStage: HTMLElement | null;
  enemyStage: HTMLElement | null;
  playerHpBar: HTMLElement | null;
  enemyHpBar: HTMLElement | null;
} {
  return {
    playerStage: arena.querySelector<HTMLElement>(".tower-fighter--player .tower-fighter__stage"),
    enemyStage: arena.querySelector<HTMLElement>(".tower-fighter--enemy .tower-fighter__stage"),
    playerHpBar: arena.querySelector<HTMLElement>('[data-combat-hp="player"]'),
    enemyHpBar: arena.querySelector<HTMLElement>('[data-combat-hp="enemy"]'),
  };
}

function playAnimation(
  animator: SpriteAnimator,
  kind: "attack" | "critical",
): Promise<void> {
  return new Promise((resolve) => {
    animator.play(kind, { onEnd: () => resolve() });
  });
}

function updateCombatHpBar(
  bar: HTMLElement | null,
  current: number,
  max: number,
): void {
  if (!bar) return;

  const fill = bar.querySelector<HTMLElement>(".tower-combat-hp__fill");
  const text = bar.querySelector<HTMLElement>(".tower-combat-hp__text");
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((current / max) * 100))) : 0;

  if (fill) fill.style.width = `${pct}%`;
  if (text) text.textContent = `${current.toLocaleString("pt-BR")} / ${max.toLocaleString("pt-BR")}`;
  bar.setAttribute("aria-valuenow", String(current));
  bar.setAttribute("aria-valuemax", String(max));
}

function showDamageFloater(
  stage: HTMLElement,
  damage: number,
  options: { critical: boolean; target: "player" | "enemy" },
): void {
  const jitter = Math.round((Math.random() - 0.5) * 28);
  const floater = document.createElement("span");
  floater.className = [
    "tower-damage",
    `tower-damage--${options.target}`,
    options.critical ? "tower-damage--critical" : "",
  ]
    .filter(Boolean)
    .join(" ");
  floater.textContent = `-${damage.toLocaleString("pt-BR")}`;
  floater.style.setProperty("--tower-damage-jitter", `${jitter}px`);
  stage.appendChild(floater);

  stage.classList.remove("tower-fighter__stage--hit");
  void stage.offsetWidth;
  stage.classList.add("tower-fighter__stage--hit");
  window.setTimeout(() => stage.classList.remove("tower-fighter__stage--hit"), 240);

  // Dois frames garantem que o browser aplica opacity:0 antes da animação.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      floater.classList.add("tower-damage--show");
    });
  });

  window.setTimeout(() => floater.remove(), 1100);
}

/** Reproduz animações e números de dano com base no log assinado pelo backend. */
export async function playTowerCombatReplay(
  arena: HTMLElement,
  combat: TowerCombatResult,
  animators?: { player: SpriteAnimator | null; enemy: SpriteAnimator | null },
): Promise<void> {
  if (!arena.isConnected) return;

  await waitForTowerAnimatorsReady();
  const resolvedAnimators = animators ?? getTowerAnimators();

  const { playerStage, enemyStage, playerHpBar, enemyHpBar } = resolveCombatStages(arena);
  updateCombatHpBar(playerHpBar, combat.playerMaxHp, combat.playerMaxHp);
  updateCombatHpBar(enemyHpBar, combat.enemyMaxHp, combat.enemyMaxHp);

  arena.classList.add("tower-arena--combat");

  for (const turn of combat.turns) {
    // Só aborta se a arena sumir de verdade; torre "parked" continua conectada.
    if (!arena.isConnected) break;
    if (document.hidden) break;

    const isPlayer = turn.actor === "player";
    const animator = isPlayer ? resolvedAnimators.player : resolvedAnimators.enemy;
    const targetStage = isPlayer ? enemyStage : playerStage;
    const kind = turn.kind === "critical" ? "critical" : "attack";

    if (animator) {
      await playAnimation(animator, kind);
    } else {
      await delay(kind === "critical" ? CRITICAL_SWING_MS : ATTACK_SWING_MS);
    }

    if (!arena.isConnected || document.hidden) break;

    if (targetStage) {
      showDamageFloater(targetStage, turn.damage, {
        critical: turn.kind === "critical",
        target: isPlayer ? "enemy" : "player",
      });
    }

    updateCombatHpBar(playerHpBar, turn.playerHpRemaining, combat.playerMaxHp);
    updateCombatHpBar(enemyHpBar, turn.enemyHpRemaining, combat.enemyMaxHp);

    await delay(TURN_GAP_MS);
  }

  resolvedAnimators.player?.play("idle");
  resolvedAnimators.enemy?.play("idle");
  arena.classList.remove("tower-arena--combat");
}

export function canStartTowerCombat(state: {
  characterJson: { tower: { bossDefeated: boolean } };
}): boolean {
  return !state.characterJson.tower.bossDefeated;
}
