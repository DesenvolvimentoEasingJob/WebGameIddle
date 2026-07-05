import type { DragState, Frame, Handle } from "./types";

const HANDLE_SIZE = 8;
const HANDLE_HIT_CORNER = 12;
const HANDLE_HIT_EDGE = 10;

const CORNER_HANDLES: Handle[] = ["nw", "ne", "se", "sw"];
const EDGE_HANDLES: Handle[] = ["n", "e", "s", "w"];

export class AtlasEditor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private image: HTMLImageElement | null = null;
  private frames: Record<string, Frame> = {};
  private selected: string | null = null;
  private activeHandle: Handle | null = null;
  private hoverHandle: Handle | null = null;
  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private drag: DragState | null = null;
  private spaceHeld = false;
  private onChange: () => void;
  private onSelect: (name: string | null) => void;
  private onHandleSelect: (handle: Handle | null) => void;

  constructor(
    canvas: HTMLCanvasElement,
    callbacks: {
      onChange: () => void;
      onSelect: (name: string | null) => void;
      onHandleSelect?: (handle: Handle | null) => void;
    },
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.onChange = callbacks.onChange;
    this.onSelect = callbacks.onSelect;
    this.onHandleSelect = callbacks.onHandleSelect ?? (() => {});
    this.bindEvents();
  }

  setImage(img: HTMLImageElement) {
    this.image = img;
    this.zoom = 1;
    this.panX = 20;
    this.panY = 20;
    this.fitToView();
    this.draw();
  }

  setFrames(frames: Record<string, Frame>) {
    this.frames = { ...frames };
    if (this.selected && !this.frames[this.selected]) {
      this.selected = null;
      this.onSelect(null);
    }
    this.draw();
  }

  getFrames(): Record<string, Frame> {
    return this.frames;
  }

  getSelected(): string | null {
    return this.selected;
  }

  getActiveHandle(): Handle | null {
    return this.activeHandle;
  }

  select(name: string | null) {
    this.selected = name;
    if (!name) this.setActiveHandle(null);
    this.onSelect(name);
    this.updateCursor();
    this.draw();
  }

  private setActiveHandle(handle: Handle | null) {
    this.activeHandle = handle;
    this.onHandleSelect(handle);
  }

  updateFrame(name: string, frame: Frame) {
    if (!this.frames[name]) return;
    this.frames[name] = clampFrame(frame, this.image);
    this.draw();
    this.onChange();
  }

  renameFrame(oldName: string, newName: string): boolean {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return false;
    if (this.frames[trimmed]) return false;

    const frame = this.frames[oldName];
    delete this.frames[oldName];
    this.frames[trimmed] = frame;
    if (this.selected === oldName) this.selected = trimmed;
    this.onChange();
    this.draw();
    return true;
  }

  addFrame(name: string, frame: Frame): boolean {
    const trimmed = name.trim();
    if (!trimmed || this.frames[trimmed]) return false;
    this.frames[trimmed] = clampFrame(frame, this.image);
    this.selected = trimmed;
    this.onSelect(trimmed);
    this.onChange();
    this.draw();
    return true;
  }

  deleteFrame(name: string) {
    if (!this.frames[name]) return;
    delete this.frames[name];
    if (this.selected === name) {
      this.selected = null;
      this.onSelect(null);
    }
    this.onChange();
    this.draw();
  }

  duplicateFrame(name: string): string | null {
    const frame = this.frames[name];
    if (!frame) return null;

    let i = 1;
    let newName = `${name}-copy`;
    while (this.frames[newName]) {
      i++;
      newName = `${name}-copy${i}`;
    }

    this.frames[newName] = {
      x: frame.x + 4,
      y: frame.y + 4,
      w: frame.w,
      h: frame.h,
    };
    this.selected = newName;
    this.onSelect(newName);
    this.onChange();
    this.draw();
    return newName;
  }

  private fitToView() {
    if (!this.image) return;
    const wrap = this.canvas.parentElement!;
    const pad = 40;
    const scaleX = (wrap.clientWidth - pad) / this.image.width;
    const scaleY = (wrap.clientHeight - pad) / this.image.height;
    this.zoom = Math.min(scaleX, scaleY, 1);
    this.panX = (wrap.clientWidth - this.image.width * this.zoom) / 2;
    this.panY = (wrap.clientHeight - this.image.height * this.zoom) / 2;
  }

  private bindEvents() {
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mouseup", this.onMouseUp);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("resize", () => {
      this.resizeCanvas();
      this.draw();
    });
    this.resizeCanvas();
  }

  private resizeCanvas() {
    const wrap = this.canvas.parentElement!;
    this.canvas.width = wrap.clientWidth;
    this.canvas.height = wrap.clientHeight;
  }

  private screenToImage(sx: number, sy: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const cx = sx - rect.left;
    const cy = sy - rect.top;
    return {
      x: Math.round((cx - this.panX) / this.zoom),
      y: Math.round((cy - this.panY) / this.zoom),
    };
  }

  private screenPoint(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private onMouseDown = (e: MouseEvent) => {
    if (!this.image) return;
    const screen = this.screenPoint(e);
    const { x, y } = this.screenToImage(e.clientX, e.clientY);

    if (this.spaceHeld || e.button === 1) {
      this.drag = {
        mode: "move",
        handle: "move",
        startX: e.clientX,
        startY: e.clientY,
        origFrame: { x: this.panX, y: this.panY, w: 0, h: 0 },
        frameName: null,
      };
      e.preventDefault();
      return;
    }

    if (this.selected) {
      const handle = hitHandle(this.frames[this.selected], screen.x, screen.y, this.zoom, this.panX, this.panY);
      if (handle && handle !== "move") {
        this.setActiveHandle(handle);
        this.drag = {
          mode: "resize",
          handle,
          startX: x,
          startY: y,
          origFrame: { ...this.frames[this.selected] },
          frameName: this.selected,
        };
        this.updateCursor(handle);
        this.draw();
        return;
      }
      if (handle === "move") {
        this.setActiveHandle("move");
        this.drag = {
          mode: "move",
          handle: "move",
          startX: x,
          startY: y,
          origFrame: { ...this.frames[this.selected] },
          frameName: this.selected,
        };
        this.updateCursor("move");
        this.draw();
        return;
      }
    }

    const hit = hitFrame(this.frames, x, y);
    if (hit) {
      this.select(hit);
      const handle = hitHandle(this.frames[hit], screen.x, screen.y, this.zoom, this.panX, this.panY);
      if (handle && handle !== "move") {
        this.setActiveHandle(handle);
        this.drag = {
          mode: "resize",
          handle,
          startX: x,
          startY: y,
          origFrame: { ...this.frames[hit] },
          frameName: hit,
        };
        this.updateCursor(handle);
        this.draw();
        return;
      }
      this.setActiveHandle("move");
      this.drag = {
        mode: "move",
        handle: "move",
        startX: x,
        startY: y,
        origFrame: { ...this.frames[hit] },
        frameName: hit,
      };
      this.updateCursor("move");
      this.draw();
      return;
    }

    this.select(null);
    this.setActiveHandle(null);
    this.drag = {
      mode: "create",
      handle: null,
      startX: x,
      startY: y,
      origFrame: { x, y, w: 0, h: 0 },
      frameName: null,
    };
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.image) return;

    if (!this.drag) {
      const screen = this.screenPoint(e);
      const { x, y } = this.screenToImage(e.clientX, e.clientY);
      if (this.selected && this.frames[this.selected]) {
        const handle = hitHandle(this.frames[this.selected], screen.x, screen.y, this.zoom, this.panX, this.panY);
        if (this.hoverHandle !== handle) {
          this.hoverHandle = handle;
          this.updateCursor(handle ?? this.activeHandle);
          this.draw();
        }
      } else if (this.hoverHandle) {
        this.hoverHandle = null;
        this.updateCursor();
        this.draw();
      } else if (hitFrame(this.frames, x, y)) {
        this.canvas.style.cursor = "pointer";
      } else {
        this.canvas.style.cursor = this.spaceHeld ? "grab" : "crosshair";
      }
      return;
    }

    if (this.drag.frameName === null && this.drag.handle === "move" && this.drag.origFrame.w === 0) {
      this.panX = this.drag.origFrame.x + (e.clientX - this.drag.startX);
      this.panY = this.drag.origFrame.y + (e.clientY - this.drag.startY);
      this.draw();
      return;
    }

    const { x, y } = this.screenToImage(e.clientX, e.clientY);

    if (this.drag.mode === "create") {
      const frame = rectFromPoints(this.drag.startX, this.drag.startY, x, y);
      this.drag.origFrame = clampFrame(frame, this.image);
      this.draw(this.drag.origFrame);
      return;
    }

    if (!this.drag.frameName) return;
    const updated = applyDrag(this.drag, x, y, this.image);
    this.frames[this.drag.frameName] = updated;
    this.draw();
    this.onChange();
  };

  private onMouseUp = () => {
    if (!this.drag || !this.image) {
      this.drag = null;
      return;
    }

    if (this.drag.mode === "create") {
      const frame = this.drag.origFrame;
      if (frame.w >= 2 && frame.h >= 2) {
        const name = prompt("Nome do novo frame:");
        if (name?.trim()) {
          this.addFrame(name.trim(), frame);
        }
      }
    }

    this.drag = null;
    this.updateCursor(this.activeHandle ?? this.hoverHandle);
    this.draw();
  };

  private updateCursor(handle: Handle | null = this.hoverHandle ?? this.activeHandle) {
    const map: Partial<Record<NonNullable<Handle>, string>> = {
      nw: "nw-resize",
      n: "n-resize",
      ne: "ne-resize",
      e: "e-resize",
      se: "se-resize",
      s: "s-resize",
      sw: "sw-resize",
      w: "w-resize",
      move: "move",
    };
    this.canvas.style.cursor = (handle && map[handle]) || (this.spaceHeld ? "grab" : "crosshair");
  }

  private onWheel = (e: WheelEvent) => {
    if (!this.image) return;
    e.preventDefault();

    if (e.ctrlKey) {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const before = this.screenToImage(e.clientX, e.clientY);
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      this.zoom = clamp(this.zoom * factor, 0.1, 8);
      this.panX = mx - before.x * this.zoom;
      this.panY = my - before.y * this.zoom;
    } else {
      this.panX -= e.deltaX;
      this.panY -= e.deltaY;
    }
    this.draw();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === "Space") {
      this.spaceHeld = true;
      e.preventDefault();
    }
    if (e.key === "Delete" && this.selected) {
      this.deleteFrame(this.selected);
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.code === "Space") this.spaceHeld = false;
  };

  draw(preview?: Frame) {
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.fillStyle = "#12141a";
    this.ctx.fillRect(0, 0, width, height);

    if (!this.image) return;

    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(
      this.image,
      this.panX,
      this.panY,
      this.image.width * this.zoom,
      this.image.height * this.zoom,
    );

    const names = Object.keys(this.frames).sort();
    for (const name of names) {
      if (name === this.selected) continue;
      drawFrameRect(this.ctx, this.frames[name], this.zoom, this.panX, this.panY, {
        stroke: "rgba(100, 180, 255, 0.7)",
        fill: "rgba(100, 180, 255, 0.08)",
        label: name,
      });
    }

    if (this.selected && this.frames[this.selected]) {
      drawFrameRect(this.ctx, this.frames[this.selected], this.zoom, this.panX, this.panY, {
        stroke: "#f5c542",
        fill: "rgba(245, 197, 66, 0.15)",
        label: this.selected,
        handles: true,
        activeHandle: this.activeHandle,
        hoverHandle: this.hoverHandle,
      });
    }

    if (preview) {
      drawFrameRect(this.ctx, preview, this.zoom, this.panX, this.panY, {
        stroke: "#6ee7a0",
        fill: "rgba(110, 231, 160, 0.12)",
        dash: true,
      });
    }
  }
}

function drawFrameRect(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
  zoom: number,
  panX: number,
  panY: number,
  style: {
    stroke: string;
    fill: string;
    label?: string;
    handles?: boolean;
    dash?: boolean;
    activeHandle?: Handle | null;
    hoverHandle?: Handle | null;
  },
) {
  const x = panX + frame.x * zoom;
  const y = panY + frame.y * zoom;
  const w = frame.w * zoom;
  const h = frame.h * zoom;

  ctx.save();
  if (style.dash) ctx.setLineDash([6, 4]);
  ctx.strokeStyle = style.stroke;
  ctx.fillStyle = style.fill;
  ctx.lineWidth = 2;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);

  if (style.label && w > 40) {
    ctx.font = "11px Segoe UI, sans-serif";
    ctx.fillStyle = style.stroke;
    ctx.fillText(style.label, x + 4, y + 14);
  }

  if (style.handles) {
    const pts = handlePoints(frame, zoom, panX, panY);
    for (const p of pts) {
      const isActive = p.handle === style.activeHandle;
      const isHover = p.handle === style.hoverHandle && !isActive;
      const isCorner = CORNER_HANDLES.includes(p.handle);

      let fill = "#f5c542";
      let stroke = "#1a1408";
      if (isActive || isHover) {
        if (isCorner) {
          fill = isActive ? "#2f8cff" : "#5cb0ff";
          stroke = "#0d2848";
        } else if (p.handle === "move") {
          fill = isActive ? "#9b7dff" : "#b9a0ff";
          stroke = "#2a1f52";
        } else {
          fill = isActive ? "#2fd4c8" : "#5ce8de";
          stroke = "#0d3d38";
        }
      }

      const size = isActive ? HANDLE_SIZE + 2 : HANDLE_SIZE;
      const half = size / 2;
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.fillRect(p.x - half, p.y - half, size, size);
      ctx.strokeRect(p.x - half, p.y - half, size, size);
    }
  }
  ctx.restore();
}

function handlePoints(frame: Frame, zoom: number, panX: number, panY: number) {
  const x = panX + frame.x * zoom;
  const y = panY + frame.y * zoom;
  const w = frame.w * zoom;
  const h = frame.h * zoom;
  const cx = x + w / 2;
  const cy = y + h / 2;
  return [
    { handle: "nw" as Handle, x, y },
    { handle: "n" as Handle, x: cx, y },
    { handle: "ne" as Handle, x: x + w, y },
    { handle: "e" as Handle, x: x + w, y: cy },
    { handle: "se" as Handle, x: x + w, y: y + h },
    { handle: "s" as Handle, x: cx, y: y + h },
    { handle: "sw" as Handle, x, y: y + h },
    { handle: "w" as Handle, x, y: cy },
  ];
}

function hitFrame(frames: Record<string, Frame>, x: number, y: number): string | null {
  const names = Object.keys(frames).reverse();
  for (const name of names) {
    const f = frames[name];
    if (x >= f.x && y >= f.y && x <= f.x + f.w && y <= f.y + f.h) return name;
  }
  return null;
}

function hitHandle(
  frame: Frame,
  screenX: number,
  screenY: number,
  zoom: number,
  panX: number,
  panY: number,
): Handle {
  const pts = handlePoints(frame, zoom, panX, panY);

  for (const p of pts) {
    if (!CORNER_HANDLES.includes(p.handle)) continue;
    if (Math.abs(screenX - p.x) <= HANDLE_HIT_CORNER && Math.abs(screenY - p.y) <= HANDLE_HIT_CORNER) {
      return p.handle;
    }
  }

  for (const p of pts) {
    if (!EDGE_HANDLES.includes(p.handle)) continue;
    if (Math.abs(screenX - p.x) <= HANDLE_HIT_EDGE && Math.abs(screenY - p.y) <= HANDLE_HIT_EDGE) {
      return p.handle;
    }
  }

  const ix = (screenX - panX) / zoom;
  const iy = (screenY - panY) / zoom;
  if (ix >= frame.x && iy >= frame.y && ix <= frame.x + frame.w && iy <= frame.y + frame.h) {
    return "move";
  }
  return null;
}

function rectFromPoints(x1: number, y1: number, x2: number, y2: number): Frame {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  return { x, y, w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
}

function applyDrag(drag: DragState, x: number, y: number, image: HTMLImageElement | null): Frame {
  const dx = x - drag.startX;
  const dy = y - drag.startY;
  const o = drag.origFrame;

  if (drag.mode === "move" && drag.frameName) {
    return clampFrame({ x: o.x + dx, y: o.y + dy, w: o.w, h: o.h }, image);
  }

  let nx = o.x;
  let ny = o.y;
  let nw = o.w;
  let nh = o.h;
  const handle = drag.handle;

  switch (handle) {
    case "nw":
      nx = o.x + dx;
      ny = o.y + dy;
      nw = o.w - dx;
      nh = o.h - dy;
      break;
    case "n":
      ny = o.y + dy;
      nh = o.h - dy;
      break;
    case "ne":
      ny = o.y + dy;
      nw = o.w + dx;
      nh = o.h - dy;
      break;
    case "e":
      nw = o.w + dx;
      break;
    case "se":
      nw = o.w + dx;
      nh = o.h + dy;
      break;
    case "s":
      nh = o.h + dy;
      break;
    case "sw":
      nx = o.x + dx;
      nw = o.w - dx;
      nh = o.h + dy;
      break;
    case "w":
      nx = o.x + dx;
      nw = o.w - dx;
      break;
  }

  if (nw < 1) {
    nx = o.x + o.w - 1;
    nw = 1;
  }
  if (nh < 1) {
    ny = o.y + o.h - 1;
    nh = 1;
  }

  return clampFrame({ x: nx, y: ny, w: nw, h: nh }, image);
}

function clampFrame(frame: Frame, image: HTMLImageElement | null): Frame {
  if (!image) return frame;
  const x = clamp(frame.x, 0, image.width - 1);
  const y = clamp(frame.y, 0, image.height - 1);
  const w = clamp(frame.w, 1, image.width - x);
  const h = clamp(frame.h, 1, image.height - y);
  return { x, y, w, h };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
