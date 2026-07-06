import type { GameStateResponse } from "../api/gameplay";
import { resolveMobAnimMap, resolvePlayerAnimMap } from "../animation/sprite-registry";
import {
  createEnemySprite,
  createPlayerSprite,
  type SpriteAnimator,
} from "../animation/SpriteAnimator";

let activeAnimators: SpriteAnimator[] = [];

export function destroyTowerSprites(): void {
  for (const animator of activeAnimators) {
    animator.destroy();
  }
  activeAnimators = [];
}

export function bindTowerSprites(root: HTMLElement, state: GameStateResponse): void {
  destroyTowerSprites();

  const char = state.characterJson;
  const floor = state.currentFloor;
  if (!floor) return;

  const tower = char.tower;
  const killed = tower.mobsKilledThisFloor;

  const currentEnemy =
    tower.bossDefeated || killed >= floor.mobCount
      ? floor.boss
      : floor.mobPool[killed % Math.max(1, floor.mobPool.length)] ?? floor.boss;

  const playerEl = root.querySelector<HTMLElement>("[data-tower-player-sprite]");
  const enemyEl = root.querySelector<HTMLElement>("[data-tower-enemy-sprite]");

  const playerMap = resolvePlayerAnimMap(char.raceId, char.classId);
  if (playerEl && playerMap) {
    const animator = createPlayerSprite(playerEl, playerMap);
    if (animator) {
      activeAnimators.push(animator);
      void animator.whenReady().then(() => animator.play("idle"));
    }
  }

  const enemyMap = resolveMobAnimMap(currentEnemy.id);
  if (enemyEl && enemyMap) {
    const animator = createEnemySprite(enemyEl, enemyMap);
    if (animator) {
      activeAnimators.push(animator);
      void animator.whenReady().then(() => animator.play("idle"));
    }
  }
}

/** Retorna animadores ativos para testes de combate (attack/critical). */
export function getTowerAnimators(): {
  player: SpriteAnimator | null;
  enemy: SpriteAnimator | null;
} {
  return {
    player: activeAnimators[0] ?? null,
    enemy: activeAnimators[1] ?? null,
  };
}
