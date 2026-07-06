import type { AnimFrameRect, AnimMapSource, ResolvedAnimMap } from "./anim-map-types";

export type { AnimFrameRect, AnimMapSource, AnimSequenceDef, ResolvedAnimMap } from "./anim-map-types";

export interface FrameLayout {
  displayWidth: number;
  displayHeight: number;
  backgroundPosition: string;
  /** Caixa expandida usada no runtime (sheet coords). */
  displayGuide: { x: number; y: number; w: number; h: number };
  /** Viewport lógico ancorado na base (sheet coords). */
  viewportGuide: { x: number; y: number; w: number; h: number };
}

/** Calcula layout do frame: expande display quando w/h excedem o viewport. */
export function getFrameLayout(
  frame: AnimFrameRect,
  viewportWidth: number,
  viewportHeight: number,
): FrameLayout {
  const displayWidth = Math.max(viewportWidth, frame.w);
  const displayHeight = Math.max(viewportHeight, frame.h);

  const slotX = Math.round((displayWidth - viewportWidth) / 2);
  const slotY = displayHeight - viewportHeight;

  const offsetX = frame.offsetX ?? Math.round((viewportWidth - frame.w) / 2);
  const offsetY = frame.offsetY ?? viewportHeight - frame.h;

  const totalX = slotX + offsetX;
  const totalY = slotY + offsetY;

  const displayGuide = {
    x: frame.x - totalX,
    y: frame.y - totalY,
    w: displayWidth,
    h: displayHeight,
  };

  const viewportGuide = {
    x: displayGuide.x + slotX,
    y: displayGuide.y + slotY,
    w: viewportWidth,
    h: viewportHeight,
  };

  return {
    displayWidth,
    displayHeight,
    backgroundPosition: `-${frame.x - totalX}px -${frame.y - totalY}px`,
    displayGuide,
    viewportGuide,
  };
}

/** @deprecated Use getFrameLayout */
export function getFrameOffset(
  frame: AnimFrameRect,
  viewportWidth: number,
  viewportHeight: number,
): { offsetX: number; offsetY: number } {
  const layout = getFrameLayout(frame, viewportWidth, viewportHeight);
  return {
    offsetX: frame.offsetX ?? Math.round((viewportWidth - frame.w) / 2),
    offsetY: frame.offsetY ?? layout.displayHeight - frame.h,
  };
}

/** @deprecated Use getFrameLayout */
export function frameBackgroundPosition(
  frame: AnimFrameRect,
  viewportWidth: number,
  viewportHeight: number,
): string {
  return getFrameLayout(frame, viewportWidth, viewportHeight).backgroundPosition;
}

export function applyFrameLayout(
  element: HTMLElement,
  frame: AnimFrameRect,
  viewportWidth: number,
  viewportHeight: number,
): FrameLayout {
  const layout = getFrameLayout(frame, viewportWidth, viewportHeight);
  element.style.width = `${layout.displayWidth}px`;
  element.style.height = `${layout.displayHeight}px`;
  element.style.backgroundPosition = layout.backgroundPosition;
  return layout;
}

export function bindAnimMap(source: AnimMapSource, sheetUrl: string): ResolvedAnimMap {
  return { ...source, sheetUrl };
}

export function validateAnimMap(map: AnimMapSource): string[] {
  const errors: string[] = [];

  if (!map.id) errors.push("id ausente");
  if (!map.sheet) errors.push("sheet ausente");
  if (map.viewportWidth <= 0 || map.viewportHeight <= 0) {
    errors.push("viewportWidth/viewportHeight inválidos");
  }

  for (const [animName, anim] of Object.entries(map.animations)) {
    if (!anim.frames.length) {
      errors.push(`animação "${animName}" sem frames`);
    }
    for (const frameId of anim.frames) {
      if (!map.frames[frameId]) {
        errors.push(`animação "${animName}" referencia frame desconhecido "${frameId}"`);
      }
    }
    if (anim.next && !map.animations[anim.next]) {
      errors.push(`animação "${animName}" referencia next desconhecido "${anim.next}"`);
    }
  }

  return errors;
}
