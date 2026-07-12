import { applyFrameLayout } from "./anim-map";
import type { AnimSequenceDef, ResolvedAnimMap } from "./anim-map-types";
import { normalizeSpriteSheetUrl } from "./sprite-sheet-normalize";

export interface PlayOptions {
  onStart?: () => void;
  onFrameChange?: (frameIndex: number) => void;
  onEnd?: () => void;
}

export interface SpriteAnimatorOptions {
  element: HTMLElement;
  animMap: ResolvedAnimMap;
  /** Normaliza 1774×887 → 1776×888 antes de animar (padrão: true). */
  normalize?: boolean;
  /** Espelha horizontalmente — desligado por padrão. */
  flipX?: boolean;
}

export class SpriteAnimator {
  readonly element: HTMLElement;
  readonly animMap: ResolvedAnimMap;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly animations: Record<string, AnimSequenceDef>;

  private readonly imageUrl: string;
  private readonly normalize: boolean;
  private readonly flipX: boolean;

  private currentAnimation = "";
  private currentFrame = 0;
  private elapsedTime = 0;
  private isPlaying = false;
  private lastTimestamp = 0;
  private rafId = 0;
  private ready = false;
  private readyPromise: Promise<void>;
  private playOptions: PlayOptions | null = null;
  private pendingAnimation: { name: string; options?: PlayOptions } | null = null;

  constructor(options: SpriteAnimatorOptions) {
    this.element = options.element;
    this.animMap = options.animMap;
    this.imageUrl = options.animMap.sheetUrl;
    this.viewportWidth = options.animMap.viewportWidth;
    this.viewportHeight = options.animMap.viewportHeight;
    this.animations = options.animMap.animations;
    this.normalize = options.normalize ?? true;
    this.flipX = options.flipX ?? false;

    this.readyPromise = this.init();
  }

  private async init(): Promise<void> {
    const url = this.normalize
      ? await normalizeSpriteSheetUrl(this.imageUrl)
      : this.imageUrl;

    this.element.style.width = `${this.viewportWidth}px`;
    this.element.style.height = `${this.viewportHeight}px`;
    this.element.style.backgroundImage = `url("${url}")`;
    this.element.style.backgroundRepeat = "no-repeat";
    this.element.classList.add("sprite-sheet");

    if (this.flipX) {
      this.element.classList.add("sprite-sheet--flip-x");
    }

    this.ready = true;

    if (this.pendingAnimation) {
      const { name, options } = this.pendingAnimation;
      this.pendingAnimation = null;
      this.play(name, options);
    }
  }

  /** Aguarda normalização da sheet e setup do elemento. */
  async whenReady(): Promise<void> {
    await this.readyPromise;
  }

  getCurrentAnimation(): string {
    return this.currentAnimation;
  }

  getCurrentFrame(): number {
    return this.currentFrame;
  }

  play(animationName: string, options?: PlayOptions): void {
    if (!this.animations[animationName]) {
      console.warn(`[SpriteAnimator] Animação desconhecida: ${animationName}`);
      return;
    }

    if (!this.ready) {
      this.pendingAnimation = { name: animationName, options };
      return;
    }

    this.stopLoop();
    this.currentAnimation = animationName;
    this.currentFrame = 0;
    this.elapsedTime = 0;
    this.lastTimestamp = 0;
    this.isPlaying = true;
    this.playOptions = options ?? null;

    this.applyFrame();
    options?.onStart?.();
    options?.onFrameChange?.(0);

    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.stopLoop();
    this.isPlaying = false;
    this.playOptions = null;
  }

  destroy(): void {
    const pendingEnd = this.playOptions?.onEnd;
    this.stopLoop();
    this.isPlaying = false;
    this.playOptions = null;
    // Resolve waiters (ex.: replay de combate) se a sheet sumir ao trocar de aba.
    pendingEnd?.();
    this.element.style.backgroundImage = "";
    this.element.classList.remove("sprite-sheet", "sprite-sheet--flip-x");
  }

  private stopLoop(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  private tick = (timestamp: number): void => {
    if (!this.isPlaying) return;

    const anim = this.animations[this.currentAnimation];
    if (!anim) {
      this.stop();
      return;
    }

    const frameDuration = 1000 / anim.fps;

    if (this.lastTimestamp === 0) {
      this.lastTimestamp = timestamp;
    }

    const delta = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;
    this.elapsedTime += delta;

    while (this.elapsedTime >= frameDuration) {
      this.elapsedTime -= frameDuration;
      this.currentFrame++;

      if (this.currentFrame >= anim.frames.length) {
        if (anim.loop) {
          this.currentFrame = 0;
        } else {
          this.finishNonLoopAnimation(anim);
          return;
        }
      }

      this.applyFrame();
      this.playOptions?.onFrameChange?.(this.currentFrame);
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

  private finishNonLoopAnimation(anim: AnimSequenceDef): void {
    this.currentFrame = anim.frames.length - 1;
    this.applyFrame();
    this.playOptions?.onFrameChange?.(this.currentFrame);

    const onEnd = this.playOptions?.onEnd;
    const next = anim.next;

    this.playOptions = null;
    this.stopLoop();
    this.isPlaying = false;

    onEnd?.();

    if (next && this.animations[next]) {
      this.play(next);
    }
  }

  private applyFrame(): void {
    const anim = this.animations[this.currentAnimation];
    if (!anim) return;

    const frameId = anim.frames[this.currentFrame];
    const frame = this.animMap.frames[frameId];
    if (!frame) return;

    applyFrameLayout(this.element, frame, this.viewportWidth, this.viewportHeight);
  }
}

export function createSpriteAnimator(
  target: HTMLElement | string | null | undefined,
  animMap: ResolvedAnimMap,
  extra?: Pick<SpriteAnimatorOptions, "normalize" | "flipX">,
): SpriteAnimator | null {
  const element =
    typeof target === "string"
      ? document.querySelector<HTMLElement>(target)
      : target;

  if (!element) return null;

  return new SpriteAnimator({
    element,
    animMap,
    ...extra,
  });
}

export function createEnemySprite(
  target: HTMLElement | string | null | undefined,
  animMap: ResolvedAnimMap,
): SpriteAnimator | null {
  return createSpriteAnimator(target, animMap, { flipX: false });
}

export function createPlayerSprite(
  target: HTMLElement | string | null | undefined,
  animMap: ResolvedAnimMap,
): SpriteAnimator | null {
  return createSpriteAnimator(target, animMap, { flipX: false });
}

/** Define um frame estático sem iniciar animação. */
export function applyStaticSpriteFrame(
  element: HTMLElement,
  animMap: ResolvedAnimMap,
  frameId?: string,
): Promise<void> {
  const fallbackId = animMap.animations.idle?.frames[0];
  const id = frameId ?? fallbackId;
  const frame = id ? animMap.frames[id] : null;

  return normalizeSpriteSheetUrl(animMap.sheetUrl).then((url) => {
    element.style.backgroundImage = `url("${url}")`;
    element.style.backgroundRepeat = "no-repeat";
    if (frame) {
      applyFrameLayout(element, frame, animMap.viewportWidth, animMap.viewportHeight);
    } else {
      element.style.width = `${animMap.viewportWidth}px`;
      element.style.height = `${animMap.viewportHeight}px`;
    }
    element.classList.add("sprite-sheet", "sprite-sheet--static");
  });
}
