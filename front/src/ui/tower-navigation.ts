import type { TowerState } from "../api/gameplay";
import { TOWER_CONTROL_FRAMES } from "./atlas";

export type TowerFloorDirection = "up" | "down";

export interface TowerFloorNavState {
  canGoUp: boolean;
  canGoDown: boolean;
}

export function getTowerFloorNavState(tower: TowerState): TowerFloorNavState {
  return {
    canGoUp: tower.currentFloor < tower.unlockedFloor,
    canGoDown: tower.currentFloor > 1,
  };
}

export function renderTowerFloorNav(options: {
  tower: TowerState;
  idPrefix?: string;
}): string {
  const { tower, idPrefix = "tower" } = options;
  const nav = getTowerFloorNavState(tower);

  return `
    <nav class="tower-floor-nav" aria-label="Navegação entre andares">
      <button
        type="button"
        id="${idPrefix}-floor-down"
        class="ui-atlas-btn ui-atlas-btn--back"
        aria-label="Descer andar"
        title="Andar anterior"
        data-atlas-frame="${TOWER_CONTROL_FRAMES.floorDown}"
        ${nav.canGoDown ? "" : "disabled"}
      >
        <span class="ui-atlas-btn__sr">Descer andar</span>
      </button>
      <p class="tower-floor-nav__current" aria-live="polite">
        <span class="tower-floor-nav__label">Andar</span>
        <strong class="tower-floor-nav__value">${tower.currentFloor}</strong>
        <span class="tower-floor-nav__unlocked">/ ${tower.unlockedFloor}</span>
      </p>
      <button
        type="button"
        id="${idPrefix}-floor-up"
        class="ui-atlas-btn ui-atlas-btn--next"
        aria-label="Subir andar"
        title="Próximo andar"
        data-atlas-frame="${TOWER_CONTROL_FRAMES.floorUp}"
        ${nav.canGoUp ? "" : "disabled"}
      >
        <span class="ui-atlas-btn__sr">Subir andar</span>
      </button>
    </nav>
  `;
}

export function bindTowerFloorNav(
  root: HTMLElement,
  options: {
    idPrefix?: string;
    onNavigate: (direction: TowerFloorDirection) => void;
  },
): void {
  const prefix = options.idPrefix ?? "tower";

  root.querySelector<HTMLButtonElement>(`#${prefix}-floor-up`)?.addEventListener("click", () => {
    options.onNavigate("up");
  });
  root.querySelector<HTMLButtonElement>(`#${prefix}-floor-down`)?.addEventListener("click", () => {
    options.onNavigate("down");
  });
}
