export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AtlasData {
  sheet: string;
  frames: Record<string, Frame>;
}

export type Handle =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"
  | "move"
  | null;

export interface DragState {
  mode: "create" | "move" | "resize";
  handle: Handle;
  startX: number;
  startY: number;
  origFrame: Frame;
  frameName: string | null;
}
