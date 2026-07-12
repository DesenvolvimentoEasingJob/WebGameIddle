import type { GameStateResponse } from "../api/gameplay";
import { resolveMobAnimMap, resolvePlayerAnimMap } from "../animation/sprite-registry";
import {
  createEnemySprite,
  createPlayerSprite,
  type SpriteAnimator,
} from "../animation/SpriteAnimator";

let activeAnimators: SpriteAnimator[] = [];
let playerAnimator: SpriteAnimator | null = null;
let enemyAnimator: SpriteAnimator | null = null;

export function rebindEnemySprite(root: HTMLElement, state: GameStateResponse): void {
  if (enemyAnimator) {
    enemyAnimator.destroy();
    activeAnimators = activeAnimators.filter((a) => a !== enemyAnimator);
    enemyAnimator = null;
  }

  const floor = state.currentFloor;
  if (!floor) return;

  const tower = state.characterJson.tower;
  const killed = tower.mobsKilledThisFloor;
  const currentEnemy =
    tower.bossDefeated || killed >= floor.mobCount
      ? floor.boss
      : (floor.mobPool[killed % Math.max(1, floor.mobPool.length)] ?? floor.boss);

  const enemyEl = root.querySelector<HTMLElement>("[data-tower-enemy-sprite]");
  const enemyMap = resolveMobAnimMap(currentEnemy.id);
  if (enemyEl && enemyMap) {
    const animator = createEnemySprite(enemyEl, enemyMap);
    if (animator) {
      enemyAnimator = animator;
      activeAnimators.push(animator);
      void animator.whenReady().then(() => animator.play("idle"));
    }
  }
}

export function destroyTowerSprites(): void {
  for (const animator of activeAnimators) {
    animator.destroy();
  }
  activeAnimators = [];
  playerAnimator = null;
  enemyAnimator = null;
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
      playerAnimator = animator;
      activeAnimators.push(animator);
      void animator.whenReady().then(() => animator.play("idle"));
    }
  }

  const enemyMap = resolveMobAnimMap(currentEnemy.id);
  if (enemyEl && enemyMap) {
    const animator = createEnemySprite(enemyEl, enemyMap);
    if (animator) {
      enemyAnimator = animator;
      activeAnimators.push(animator);
      void animator.whenReady().then(() => animator.play("idle"));
    }
  }
}

export function getTowerAnimators(): {
  player: SpriteAnimator | null;
  enemy: SpriteAnimator | null;
} {
  return {
    player: playerAnimator,
    enemy: enemyAnimator,
  };
}

/** Garante sheets carregadas antes de reproduzir combate (ex.: após refresh). */
export async function waitForTowerAnimatorsReady(): Promise<void> {
  const { player, enemy } = getTowerAnimators();
  await Promise.all([
    player?.whenReady() ?? Promise.resolve(),
    enemy?.whenReady() ?? Promise.resolve(),
  ]);
}
