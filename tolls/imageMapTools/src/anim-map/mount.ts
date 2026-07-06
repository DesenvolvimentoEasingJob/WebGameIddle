import "./styles.css";

import type { AnimFrameRect, AnimMapSource, ResolvedAnimMap } from "@front/animation/anim-map-types";
import { getFrameLayout, validateAnimMap } from "@front/animation/anim-map";
import { createSpriteAnimator, type SpriteAnimator } from "@front/animation/SpriteAnimator";
import { projectFileUrl, readProjectFile, writeProjectFile } from "../api";

const ANIM_MAP_IDS = ["f1-slime", "f1-bat", "f1-guardian", "elf-mage"];
const ANIM_MAP_DIR = "front/src/animation/maps";

type EditorMap = ResolvedAnimMap;

let rootEl: HTMLElement | null = null;

function q<T extends HTMLElement>(sel: string): T | null {
  return rootEl?.querySelector<T>(sel) ?? null;
}

async function resolveAnimMap(id: string): Promise<EditorMap | null> {
  try {
    const raw = await readProjectFile(`${ANIM_MAP_DIR}/${id}.anim.json`);
    const source = JSON.parse(raw) as AnimMapSource;
    return {
      ...source,
      sheetUrl: projectFileUrl(`front/assets/${source.sheet}`),
    };
  } catch {
    return null;
  }
}

async function listAnimMaps(): Promise<EditorMap[]> {
  const maps = await Promise.all(ANIM_MAP_IDS.map((id) => resolveAnimMap(id)));
  return maps.filter((map): map is EditorMap => map !== null);
}
const DEFAULT_ZOOM = 0.35;
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 2.5;
const HANDLE = 8;

interface EditorState {
  map: EditorMap;
  selectedFrameId: string | null;
  selectedAnim: string;
  viewZoom: number;
  drag:
    | null
    | { kind: "move"; frameId: string; startX: number; startY: number; orig: AnimFrameRect }
    | { kind: "draw"; startX: number; startY: number; currentX: number; currentY: number };
}

let state: EditorState | null = null;
let sheetImage: HTMLImageElement | null = null;
let previewAnimator: SpriteAnimator | null = null;

const canvasRef = { current: null as HTMLCanvasElement | null };
const canvasWrapRef = { current: null as HTMLElement | null };
const previewRef = { current: null as HTMLElement | null };
const logRef = { current: null as HTMLElement | null };

function log(message: string): void {
  if (!logRef.current) return;
  logRef.current.textContent = `${new Date().toLocaleTimeString("pt-BR")} — ${message}`;
}

function cloneMap(map: EditorMap): EditorMap {
  return structuredClone(map);
}

function currentZoom(): number {
  return state?.viewZoom ?? DEFAULT_ZOOM;
}

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function canvasToSheet(x: number, y: number): { x: number; y: number } {
  const zoom = currentZoom();
  return { x: Math.round(x / zoom), y: Math.round(y / zoom) };
}

function syncZoomLabel(): void {
  const el = q<HTMLElement>("#anim-editor-zoom-label");
  if (!el || !state) return;
  el.textContent = `${Math.round(state.viewZoom * 100)}%`;
}

function setViewZoom(nextZoom: number, anchor?: { clientX: number; clientY: number }): void {
  if (!state || !canvasWrapRef.current || !sheetImage) return;

  const wrap = canvasWrapRef.current;
  const oldZoom = state.viewZoom;
  const newZoom = clampZoom(nextZoom);
  if (Math.abs(newZoom - oldZoom) < 0.0001) return;

  let scrollLeft = wrap.scrollLeft;
  let scrollTop = wrap.scrollTop;

  if (anchor) {
    const rect = wrap.getBoundingClientRect();
    const pointerX = anchor.clientX - rect.left + wrap.scrollLeft;
    const pointerY = anchor.clientY - rect.top + wrap.scrollTop;
    const sheetX = pointerX / oldZoom;
    const sheetY = pointerY / oldZoom;
    scrollLeft = sheetX * newZoom - (anchor.clientX - rect.left);
    scrollTop = sheetY * newZoom - (anchor.clientY - rect.top);
  }

  state.viewZoom = newZoom;
  drawCanvas();
  syncZoomLabel();

  wrap.scrollLeft = Math.max(0, scrollLeft);
  wrap.scrollTop = Math.max(0, scrollTop);
}

function frameAtPoint(sheetX: number, sheetY: number): string | null {
  if (!state) return null;

  const currentAnimFrameIds = state.map.animations[state.selectedAnim]?.frames ?? [];
  const orderedFrameIds = [
    ...currentAnimFrameIds,
    ...Object.keys(state.map.frames).filter((id) => !currentAnimFrameIds.includes(id)),
  ];

  for (const id of orderedFrameIds) {
    const rect = state.map.frames[id];
    if (!rect) continue;
    if (
      sheetX >= rect.x &&
      sheetY >= rect.y &&
      sheetX < rect.x + rect.w &&
      sheetY < rect.y + rect.h
    ) {
      return id;
    }
  }
  return null;
}

function drawCanvas(): void {
  const canvas = canvasRef.current;
  if (!canvas || !state || !sheetImage) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const zoom = currentZoom();
  canvas.width = sheetImage.width * zoom;
  canvas.height = sheetImage.height * zoom;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheetImage, 0, 0, canvas.width, canvas.height);

  const animFrames = new Set(state.map.animations[state.selectedAnim]?.frames ?? []);

  for (const [id, rect] of Object.entries(state.map.frames)) {
    const selected = id === state.selectedFrameId;
    const inAnim = animFrames.has(id);

    ctx.strokeStyle = selected ? "#ffd54a" : inAnim ? "#6ec6ff" : "rgba(255,255,255,0.35)";
    ctx.lineWidth = selected ? 2 : 1;
    ctx.strokeRect(rect.x * zoom, rect.y * zoom, rect.w * zoom, rect.h * zoom);

    ctx.fillStyle = selected ? "rgba(255,213,74,0.15)" : "rgba(0,0,0,0.08)";
    ctx.fillRect(rect.x * zoom, rect.y * zoom, rect.w * zoom, rect.h * zoom);

    ctx.fillStyle = selected ? "#ffd54a" : "#ccc";
    ctx.font = "11px system-ui";
    ctx.fillText(id, rect.x * zoom + 4, rect.y * zoom + 14);
  }

  if (state.drag?.kind === "draw") {
    const x1 = state.drag.startX;
    const y1 = state.drag.startY;
    const x2 = state.drag.currentX;
    const y2 = state.drag.currentY;
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    ctx.strokeStyle = "#7cff7c";
    ctx.lineWidth = 2;
    ctx.strokeRect(left, top, w, h);
  }

  if (state.selectedFrameId) {
    const frame = state.map.frames[state.selectedFrameId];
    if (frame) {
      const layout = getFrameLayout(frame, state.map.viewportWidth, state.map.viewportHeight);

      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2;

      ctx.strokeStyle = "rgba(255, 121, 198, 0.95)";
      ctx.strokeRect(
        layout.displayGuide.x * zoom,
        layout.displayGuide.y * zoom,
        layout.displayGuide.w * zoom,
        layout.displayGuide.h * zoom,
      );

      ctx.strokeStyle = "rgba(124, 255, 124, 0.95)";
      ctx.strokeRect(
        layout.viewportGuide.x * zoom,
        layout.viewportGuide.y * zoom,
        layout.viewportGuide.w * zoom,
        layout.viewportGuide.h * zoom,
      );

      ctx.setLineDash([]);
    }
  }

  renderLayoutInfo();
}

async function loadSheet(url: string): Promise<void> {
  sheetImage = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function syncPreview(): void {
  if (!state || !previewRef.current) return;

  previewAnimator?.destroy();
  previewAnimator = createSpriteAnimator(previewRef.current, state.map);
  void previewAnimator?.whenReady().then(() => {
    previewAnimator?.play(state!.selectedAnim);
  });
}

function selectFrame(frameId: string | null): void {
  if (!state) return;
  state.selectedFrameId = frameId;
  drawCanvas();
  renderProps();
  renderAnimEditor();
}

function selectAnim(animName: string): void {
  if (!state) return;
  state.selectedAnim = animName;
  drawCanvas();
  renderAnimEditor();
  syncPreview();
}

function renderLayoutInfo(): void {
  const el = q<HTMLElement>("#anim-editor-layout-info");
  if (!el || !state) return;

  if (!state.selectedFrameId) {
    el.innerHTML = `Viewport base: <strong>${state.map.viewportWidth}×${state.map.viewportHeight}</strong>`;
    return;
  }

  const frame = state.map.frames[state.selectedFrameId];
  if (!frame) return;

  const layout = getFrameLayout(frame, state.map.viewportWidth, state.map.viewportHeight);
  const expanded =
    layout.displayWidth > state.map.viewportWidth ||
    layout.displayHeight > state.map.viewportHeight;

  el.innerHTML = `
    Frame <strong>${frame.w}×${frame.h}</strong>
    · Display runtime <strong>${layout.displayWidth}×${layout.displayHeight}</strong>
    ${expanded ? '<span class="anim-editor-tag anim-editor-tag--expand">expande</span>' : ""}
  `;
}

function syncViewportInputs(): void {
  if (!state) return;
  const wInput = q<HTMLInputElement>("#map-vp-w");
  const hInput = q<HTMLInputElement>("#map-vp-h");
  if (wInput) wInput.value = String(state.map.viewportWidth);
  if (hInput) hInput.value = String(state.map.viewportHeight);
}

function bindViewportSettings(): void {
  const wInput = q<HTMLInputElement>("#map-vp-w");
  const hInput = q<HTMLInputElement>("#map-vp-h");
  if (!wInput || !hInput || wInput.dataset.bound === "1") return;

  wInput.dataset.bound = "1";
  hInput.dataset.bound = "1";

  const apply = () => {
    if (!state) return;
    state.map.viewportWidth = Math.max(1, Number(wInput.value) || 296);
    state.map.viewportHeight = Math.max(1, Number(hInput.value) || 296);
    drawCanvas();
    syncPreview();
    log(`Viewport ${state.map.viewportWidth}×${state.map.viewportHeight}`);
  };

  wInput.addEventListener("change", apply);
  hInput.addEventListener("change", apply);
}

function renderProps(): void {
  const panel = q<HTMLElement>("#anim-editor-props");
  if (!panel || !state) return;

  const frameId = state.selectedFrameId;
  const frame = frameId ? state.map.frames[frameId] : null;

  if (!frameId || !frame) {
    panel.innerHTML = `<p class="anim-editor-hint">Selecione um frame no canvas. Rosa = display runtime · Verde = viewport base.</p>`;
    return;
  }

  const layout = getFrameLayout(frame, state.map.viewportWidth, state.map.viewportHeight);

  panel.innerHTML = `
    <h3>Frame: ${frameId}</h3>
    <p class="anim-editor-frame-meta">Display: ${layout.displayWidth}×${layout.displayHeight}px</p>
    <label>x <input type="number" data-prop="x" value="${frame.x}"></label>
    <label>y <input type="number" data-prop="y" value="${frame.y}"></label>
    <label>w <input type="number" data-prop="w" value="${frame.w}" min="1"></label>
    <label>h <input type="number" data-prop="h" value="${frame.h}" min="1"></label>
    <label>offsetX <input type="number" data-prop="offsetX" value="${frame.offsetX ?? ""}" placeholder="auto"></label>
    <label>offsetY <input type="number" data-prop="offsetY" value="${frame.offsetY ?? ""}" placeholder="auto"></label>
    <div class="anim-editor-prop-actions">
      <button type="button" data-action="add-to-anim">+ ${state.selectedAnim}</button>
      <button type="button" data-action="delete-frame">Excluir frame</button>
    </div>
  `;

  panel.querySelectorAll<HTMLInputElement>("[data-prop]").forEach((input) => {
    input.addEventListener("change", () => {
      const prop = input.dataset.prop as keyof AnimFrameRect;
      const raw = input.value.trim();
      if (prop === "offsetX" || prop === "offsetY") {
        if (raw === "") delete frame[prop];
        else frame[prop] = Number(raw);
      } else {
        frame[prop] = Number(raw) as never;
      }
      drawCanvas();
      syncPreview();
    });
  });

  panel.querySelector('[data-action="add-to-anim"]')?.addEventListener("click", () => {
    const anim = state!.map.animations[state!.selectedAnim];
    if (anim && !anim.frames.includes(frameId)) {
      anim.frames.push(frameId);
      renderAnimEditor();
      drawCanvas();
      syncPreview();
      log(`Frame ${frameId} adicionado a ${state!.selectedAnim}`);
    }
  });

  panel.querySelector('[data-action="delete-frame"]')?.addEventListener("click", () => {
    delete state!.map.frames[frameId];
    for (const anim of Object.values(state!.map.animations)) {
      anim.frames = anim.frames.filter((f) => f !== frameId);
    }
    state!.selectedFrameId = null;
    renderProps();
    renderAnimEditor();
    drawCanvas();
    syncPreview();
    log(`Frame ${frameId} removido`);
  });
}

function renderAnimEditor(): void {
  const panel = q<HTMLElement>("#anim-editor-anims");
  if (!panel || !state) return;

  const animNames = Object.keys(state.map.animations);
  const anim = state.map.animations[state.selectedAnim];

  panel.innerHTML = `
    <div class="anim-editor-anim-tabs">
      ${animNames
        .map(
          (name) =>
            `<button type="button" class="${name === state!.selectedAnim ? "is-active" : ""}" data-anim-tab="${name}">${name}</button>`,
        )
        .join("")}
      <button type="button" data-anim-add>+ anim</button>
    </div>
    ${
      anim
        ? `
      <label>fps <input type="number" id="anim-fps" value="${anim.fps}" min="1" max="60"></label>
      <label><input type="checkbox" id="anim-loop" ${anim.loop ? "checked" : ""}> loop</label>
      <label>next <input type="text" id="anim-next" value="${anim.next ?? ""}" placeholder="idle"></label>
      <ul class="anim-editor-seq" id="anim-seq">
        ${anim.frames
          .map(
            (fid, i) => `
          <li data-seq-select="${fid}" class="${fid === state!.selectedFrameId ? "is-selected" : ""}">
            <span>${i + 1}. ${fid}</span>
            <button type="button" data-seq-up="${i}">↑</button>
            <button type="button" data-seq-down="${i}">↓</button>
            <button type="button" data-seq-remove="${i}">×</button>
          </li>`,
          )
          .join("")}
      </ul>
    `
        : ""
    }
    <div class="anim-editor-available">
      <h4>Frames disponíveis</h4>
      <div class="anim-editor-chip-list">
        ${Object.keys(state.map.frames)
          .map((fid) => `<button type="button" class="anim-editor-chip" data-add-frame="${fid}">${fid}</button>`)
          .join("")}
      </div>
    </div>
  `;

  panel.querySelectorAll<HTMLButtonElement>("[data-anim-tab]").forEach((btn) => {
    btn.addEventListener("click", () => selectAnim(btn.dataset.animTab!));
  });

  panel.querySelector("#anim-fps")?.addEventListener("change", (e) => {
    anim!.fps = Number((e.target as HTMLInputElement).value) || 10;
    syncPreview();
  });

  panel.querySelector("#anim-loop")?.addEventListener("change", (e) => {
    anim!.loop = (e.target as HTMLInputElement).checked;
  });

  panel.querySelector("#anim-next")?.addEventListener("change", (e) => {
    const val = (e.target as HTMLInputElement).value.trim();
    if (val) anim!.next = val;
    else delete anim!.next;
  });

  panel.querySelectorAll("[data-seq-select]").forEach((row) => {
    row.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("button")) return;
      selectFrame((row as HTMLElement).dataset.seqSelect!);
    });
  });

  panel.querySelectorAll("[data-seq-up]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number((btn as HTMLElement).dataset.seqUp);
      if (i > 0) {
        [anim!.frames[i - 1], anim!.frames[i]] = [anim!.frames[i], anim!.frames[i - 1]];
        renderAnimEditor();
        syncPreview();
      }
    });
  });

  panel.querySelectorAll("[data-seq-down]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number((btn as HTMLElement).dataset.seqDown);
      if (i < anim!.frames.length - 1) {
        [anim!.frames[i + 1], anim!.frames[i]] = [anim!.frames[i], anim!.frames[i + 1]];
        renderAnimEditor();
        syncPreview();
      }
    });
  });

  panel.querySelectorAll("[data-seq-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number((btn as HTMLElement).dataset.seqRemove);
      anim!.frames.splice(i, 1);
      renderAnimEditor();
      syncPreview();
    });
  });

  panel.querySelectorAll("[data-add-frame]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const fid = (btn as HTMLElement).dataset.addFrame!;
      if (!anim!.frames.includes(fid)) {
        anim!.frames.push(fid);
        renderAnimEditor();
        drawCanvas();
        syncPreview();
      }
    });
  });

  panel.querySelector("[data-anim-add]")?.addEventListener("click", () => {
    const name = window.prompt("Nome da animação:");
    if (!name || state!.map.animations[name]) return;
    state!.map.animations[name] = { frames: [], fps: 10, loop: true };
    selectAnim(name);
  });
}

function bindCanvasEvents(canvas: HTMLCanvasElement, onMouseUp: () => void): void {
  const wrap = canvasWrapRef.current;

  wrap?.addEventListener(
    "wheel",
    (e) => {
      if (!state) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      setViewZoom(state.viewZoom * factor, { clientX: e.clientX, clientY: e.clientY });
    },
    { passive: false },
  );

  canvas.addEventListener("mousedown", (e) => {
    if (!state) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const sheet = canvasToSheet(cx, cy);

    if (e.shiftKey) {
      state.drag = { kind: "draw", startX: cx, startY: cy, currentX: cx, currentY: cy };
      return;
    }

    const hit = frameAtPoint(sheet.x, sheet.y);
    if (hit) {
      selectFrame(hit);
      const frame = state.map.frames[hit];
      state.drag = { kind: "move", frameId: hit, startX: sheet.x, startY: sheet.y, orig: { ...frame } };
    } else {
      selectFrame(null);
    }
  });

  canvas.addEventListener("mousemove", (e) => {
    if (!state?.drag) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    if (state.drag.kind === "draw") {
      state.drag.currentX = cx;
      state.drag.currentY = cy;
      drawCanvas();
      return;
    }

    const sheet = canvasToSheet(cx, cy);
    const dx = sheet.x - state.drag.startX;
    const dy = sheet.y - state.drag.startY;
    const frame = state.map.frames[state.drag.frameId];
    frame.x = Math.max(0, state.drag.orig.x + dx);
    frame.y = Math.max(0, state.drag.orig.y + dy);
    drawCanvas();
    renderProps();
  });

  window.addEventListener("mouseup", onMouseUp);
}

function handleMouseUp(): void {
  if (!state?.drag) return;

  if (state.drag.kind === "draw") {
    const { startX, startY, currentX, currentY } = state.drag;
    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const w = Math.abs(currentX - startX);
    const h = Math.abs(currentY - startY);

    if (w > HANDLE && h > HANDLE) {
      const sheet = canvasToSheet(left, top);
      const sheetEnd = canvasToSheet(left + w, top + h);
      const id = window.prompt("Nome do novo frame:", `frame-${Object.keys(state.map.frames).length}`);
      if (id && !state.map.frames[id]) {
        state.map.frames[id] = {
          x: sheet.x,
          y: sheet.y,
          w: Math.max(1, sheetEnd.x - sheet.x),
          h: Math.max(1, sheetEnd.y - sheet.y),
        };
        selectFrame(id);
        log(`Frame ${id} criado`);
      }
    }
  } else if (state.drag.kind === "move") {
    syncPreview();
  }

  state.drag = null;
  drawCanvas();
}

function getMapSource(): AnimMapSource | null {
  if (!state) return null;
  const { sheetUrl: _, ...source } = state.map;
  return source;
}

function exportMap(): void {
  const source = getMapSource();
  if (!source) return;

  const errors = validateAnimMap(source);
  if (errors.length) {
    log(`Erros: ${errors.join("; ")}`);
    return;
  }

  const blob = new Blob([JSON.stringify(source, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${source.id}.anim.json`;
  a.click();
  URL.revokeObjectURL(url);
  log(`Exportado ${source.id}.anim.json`);
}

async function saveMap(): Promise<void> {
  const source = getMapSource();
  if (!source) return;

  const errors = validateAnimMap(source);
  if (errors.length) {
    log(`Erros: ${errors.join("; ")}`);
    return;
  }

  const saveBtn = q<HTMLButtonElement>("#anim-editor-save");
  saveBtn?.setAttribute("disabled", "true");

  try {
    const path = `${ANIM_MAP_DIR}/${source.id}.anim.json`;
    await writeProjectFile(path, `${JSON.stringify(source, null, 2)}\n`);
    log(`Salvo em ${path}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`Falha ao salvar: ${message}`);
  } finally {
    saveBtn?.removeAttribute("disabled");
  }
}

async function loadMapById(id: string): Promise<void> {
  const resolved = await resolveAnimMap(id);
  if (!resolved) {
    log(`Mapa não encontrado: ${id}`);
    return;
  }

  state = {
    map: cloneMap(resolved),
    selectedFrameId: null,
    selectedAnim: "idle",
    viewZoom: DEFAULT_ZOOM,
    drag: null,
  };

  await loadSheet(state.map.sheetUrl);
  syncViewportInputs();
  if (canvasWrapRef.current) {
    canvasWrapRef.current.scrollLeft = 0;
    canvasWrapRef.current.scrollTop = 0;
  }
  drawCanvas();
  syncZoomLabel();
  renderProps();
  renderAnimEditor();
  syncPreview();
  log(`Carregado ${id}`);
}

export function mountAnimMapTool(container: HTMLElement): () => void {
  rootEl = container;

  void listAnimMaps().then((maps) => {
    container.innerHTML = `
    <main class="anim-editor-page">
      <header class="anim-editor-header">
        <div class="anim-editor-header__title">
          <h1>Animações</h1>
          <p>Shift+drag cria frame · scroll zoom · arraste para mover</p>
        </div>
        <div class="anim-editor-toolbar">
          <label>Entidade
            <select id="anim-editor-select">
              ${maps.map((m) => `<option value="${m.id}">${m.id}</option>`).join("")}
            </select>
          </label>
          <label class="anim-editor-file-input">Importar JSON
            <input type="file" id="anim-editor-import" accept=".json,application/json">
          </label>
          <button type="button" id="anim-editor-save" class="anim-editor-btn--primary">Salvar</button>
          <button type="button" id="anim-editor-export">Exportar .anim.json</button>
        </div>
      </header>

      <div class="anim-editor-workspace">
        <section class="anim-editor-canvas-panel">
          <div class="anim-editor-canvas-toolbar">
            <span>Sheet</span>
            <span id="anim-editor-zoom-label" class="anim-editor-zoom-label">35%</span>
            <button type="button" id="anim-editor-zoom-reset" title="Resetar zoom">Ajustar</button>
          </div>
          <div class="anim-editor-canvas-wrap">
            <canvas id="anim-editor-canvas"></canvas>
          </div>
        </section>

        <aside class="anim-editor-rail">
          <section class="anim-editor-panel anim-editor-preview-wrap">
            <div class="anim-editor-preview-head">
              <h3>Preview</h3>
              <div class="anim-editor-preview-controls">
                <button type="button" id="anim-preview-idle">idle</button>
                <button type="button" id="anim-preview-attack">attack</button>
                <button type="button" id="anim-preview-critical">critical</button>
              </div>
            </div>
            <div class="anim-editor-preview-stage">
              <div id="anim-editor-preview"></div>
            </div>
            <div class="anim-editor-viewport-settings">
              <label>Viewport W
                <input type="number" id="map-vp-w" min="1" value="296">
              </label>
              <label>Viewport H
                <input type="number" id="map-vp-h" min="1" value="296">
              </label>
            </div>
            <div class="anim-editor-legend-row">
              <span><i class="legend-swatch legend-swatch--frame"></i> Frame</span>
              <span><i class="legend-swatch legend-swatch--viewport"></i> Viewport</span>
              <span><i class="legend-swatch legend-swatch--display"></i> Display</span>
            </div>
            <div class="anim-editor-layout-info" id="anim-editor-layout-info"></div>
          </section>

          <div class="anim-editor-rail-scroll">
            <section id="anim-editor-props" class="anim-editor-panel anim-editor-panel--compact"></section>
            <section id="anim-editor-anims" class="anim-editor-panel anim-editor-panel--grow"></section>
          </div>
        </aside>
      </div>

      <footer class="anim-editor-log" id="anim-editor-log" aria-live="polite"></footer>
    </main>
  `;

    canvasRef.current = container.querySelector("#anim-editor-canvas");
    canvasWrapRef.current = container.querySelector(".anim-editor-canvas-wrap");
    previewRef.current = container.querySelector("#anim-editor-preview");
    logRef.current = container.querySelector("#anim-editor-log");

    if (canvasRef.current) bindCanvasEvents(canvasRef.current, handleMouseUp);
    bindViewportSettings();

    container.querySelector("#anim-editor-zoom-reset")?.addEventListener("click", () => {
      if (!state || !canvasWrapRef.current || !sheetImage) return;
      const wrap = canvasWrapRef.current;
      const fitX = wrap.clientWidth / sheetImage.width;
      const fitY = (wrap.clientHeight - 28) / sheetImage.height;
      setViewZoom(clampZoom(Math.min(fitX, fitY, 1)));
      wrap.scrollLeft = 0;
      wrap.scrollTop = 0;
    });

    container.querySelector("#anim-editor-select")?.addEventListener("change", (e) => {
      void loadMapById((e.target as HTMLSelectElement).value);
    });

    container.querySelector("#anim-editor-save")?.addEventListener("click", () => {
      void saveMap();
    });

    container.querySelector("#anim-editor-export")?.addEventListener("click", exportMap);

    container.querySelector("#anim-editor-import")?.addEventListener("change", async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const parsed = JSON.parse(text) as AnimMapSource;
      const resolved = await resolveAnimMap(parsed.id);
      state = {
        map: {
          ...parsed,
          sheetUrl: resolved?.sheetUrl ?? projectFileUrl(`front/assets/${parsed.sheet}`),
        },
        selectedFrameId: null,
        selectedAnim: Object.keys(parsed.animations)[0] ?? "idle",
        viewZoom: DEFAULT_ZOOM,
        drag: null,
      };
      await loadSheet(state.map.sheetUrl);
      syncViewportInputs();
      drawCanvas();
      renderProps();
      renderAnimEditor();
      syncPreview();
      log(`Importado ${parsed.id}`);
    });

    container.querySelector("#anim-preview-idle")?.addEventListener("click", () => {
      previewAnimator?.play("idle");
    });

    container.querySelector("#anim-preview-attack")?.addEventListener("click", () => {
      previewAnimator?.play("attack");
    });

    container.querySelector("#anim-preview-critical")?.addEventListener("click", () => {
      previewAnimator?.play("critical");
    });

    if (maps[0]) {
      void loadMapById(maps[0].id);
    }
  });

  return () => {
    window.removeEventListener("mouseup", handleMouseUp);
    previewAnimator?.destroy();
    previewAnimator = null;
    state = null;
    rootEl = null;
    container.innerHTML = "";
  };
}
