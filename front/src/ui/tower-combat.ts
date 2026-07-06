import type { SpriteAnimator } from "../animation/SpriteAnimator";
import type { TowerCombatResult } from "../api/gameplay";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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
  critical: boolean,
): void {
  const floater = document.createElement("span");
  floater.className = `tower-damage${critical ? " tower-damage--critical" : ""}`;
  floater.textContent = `-${damage.toLocaleString("pt-BR")}`;
  stage.appendChild(floater);

  requestAnimationFrame(() => {
    floater.classList.add("tower-damage--show");
  });

  window.setTimeout(() => floater.remove(), 950);
}

/** Reproduz animações e números de dano com base no log assinado pelo backend. */
export async function playTowerCombatReplay(
  arena: HTMLElement,
  combat: TowerCombatResult,
  animators: { player: SpriteAnimator | null; enemy: SpriteAnimator | null },
): Promise<void> {
  const playerStage = arena.querySelector<HTMLElement>(
    ".tower-fighter--player .tower-fighter__stage",
  );
  const enemyStage = arena.querySelector<HTMLElement>(
    ".tower-fighter--enemy .tower-fighter__stage",
  );
  const playerHpBar = arena.querySelector<HTMLElement>('[data-combat-hp="player"]');
  const enemyHpBar = arena.querySelector<HTMLElement>('[data-combat-hp="enemy"]');

  updateCombatHpBar(playerHpBar, combat.playerMaxHp, combat.playerMaxHp);
  updateCombatHpBar(enemyHpBar, combat.enemyMaxHp, combat.enemyMaxHp);

  arena.classList.add("tower-arena--combat");

  for (const turn of combat.turns) {
    const isPlayer = turn.actor === "player";
    const animator = isPlayer ? animators.player : animators.enemy;
    const targetStage = isPlayer ? enemyStage : playerStage;
    const kind = turn.kind === "critical" ? "critical" : "attack";

    if (animator) {
      await playAnimation(animator, kind);
    } else {
      await delay(kind === "critical" ? 650 : 520);
    }

    if (targetStage) {
      showDamageFloater(targetStage, turn.damage, turn.kind === "critical");
    }

    updateCombatHpBar(playerHpBar, turn.playerHpRemaining, combat.playerMaxHp);
    updateCombatHpBar(enemyHpBar, turn.enemyHpRemaining, combat.enemyMaxHp);

    await delay(320);
  }

  animators.player?.play("idle");
  animators.enemy?.play("idle");

  arena.classList.remove("tower-arena--combat");
}

export function canStartTowerCombat(state: {
  characterJson: { tower: { bossDefeated: boolean } };
}): boolean {
  return !state.characterJson.tower.bossDefeated;
}
