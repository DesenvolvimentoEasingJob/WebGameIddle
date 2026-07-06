/** Retângulo de um frame dentro da sprite sheet. */
export interface AnimFrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Deslocamento dentro do viewport (px). Padrão: centraliza X, alinha base Y. */
  offsetX?: number;
  offsetY?: number;
}

/** Sequência de frames reproduzida em ordem. */
export interface AnimSequenceDef {
  frames: string[];
  fps: number;
  loop: boolean;
  next?: string;
}

/** Mapa de animação serializado em JSON (`.anim.json`). */
export interface AnimMapSource {
  id: string;
  /** Caminho relativo em `assets/` — referência para a tool; URL resolvida no registry. */
  sheet: string;
  viewportWidth: number;
  viewportHeight: number;
  frames: Record<string, AnimFrameRect>;
  animations: Record<string, AnimSequenceDef>;
}

/** Mapa pronto para runtime com URL da sheet resolvida pelo Vite. */
export interface ResolvedAnimMap extends AnimMapSource {
  sheetUrl: string;
}
