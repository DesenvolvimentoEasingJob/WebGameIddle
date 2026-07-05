import { projectFileUrl, readProjectFile, writeProjectFile } from "./api";
import { extractFrameOrder, formatAtlasJson } from "./atlas-format";
import { AtlasEditor } from "./editor";
import type { AtlasData, Frame, Handle } from "./types";

const imagePathInput = document.getElementById("image-path") as HTMLInputElement;
const atlasPathInput = document.getElementById("atlas-path") as HTMLInputElement;
const btnLoad = document.getElementById("btn-load") as HTMLButtonElement;
const btnSave = document.getElementById("btn-save") as HTMLButtonElement;
const btnAdd = document.getElementById("btn-add") as HTMLButtonElement;
const frameSearch = document.getElementById("frame-search") as HTMLInputElement;
const frameList = document.getElementById("frame-list") as HTMLUListElement;
const frameCount = document.getElementById("frame-count") as HTMLSpanElement;
const canvasEmpty = document.getElementById("canvas-empty") as HTMLDivElement;
const statusEl = document.getElementById("status") as HTMLDivElement;

const inspectorEmpty = document.getElementById("inspector-empty") as HTMLDivElement;
const inspectorForm = document.getElementById("inspector-form") as HTMLFormElement;
const propName = document.getElementById("prop-name") as HTMLInputElement;
const propX = document.getElementById("prop-x") as HTMLInputElement;
const propY = document.getElementById("prop-y") as HTMLInputElement;
const propW = document.getElementById("prop-w") as HTMLInputElement;
const propH = document.getElementById("prop-h") as HTMLInputElement;
const btnDuplicate = document.getElementById("btn-duplicate") as HTMLButtonElement;
const btnDelete = document.getElementById("btn-delete") as HTMLButtonElement;
const previewCanvas = document.getElementById("preview-canvas") as HTMLCanvasElement;
const handleMode = document.getElementById("handle-mode") as HTMLParagraphElement;

let atlasData: AtlasData | null = null;
let frameOrder: string[] = [];
let atlasLineEnding = "\n";
let imageEl: HTMLImageElement | null = null;
let dirty = false;
let suppressInspector = false;

const editor = new AtlasEditor(document.getElementById("editor-canvas") as HTMLCanvasElement, {
  onChange: () => {
    dirty = true;
    btnSave.disabled = false;
    syncFrameOrder();
    refreshSidebar();
    updateInspectorFromSelection();
  },
  onSelect: (name) => {
    refreshSidebar();
    updateInspectorFromSelection(name);
  },
  onHandleSelect: (handle) => updateHandleMode(handle),
});

const HANDLE_LABELS: Record<NonNullable<Handle>, string> = {
  nw: "Canto superior esquerdo",
  n: "Borda superior",
  ne: "Canto superior direito",
  e: "Borda direita",
  se: "Canto inferior direito",
  s: "Borda inferior",
  sw: "Canto inferior esquerdo",
  w: "Borda esquerda",
  move: "Mover frame inteiro",
};

function updateHandleMode(handle: Handle | null) {
  if (!handle) {
    handleMode.textContent = "Clique em um indicador do frame para redimensionar ou mover";
    handleMode.className = "handle-mode";
    return;
  }

  const corner = ["nw", "ne", "se", "sw"].includes(handle);
  const edge = ["n", "e", "s", "w"].includes(handle);
  handleMode.textContent = corner
    ? `Resize: ${HANDLE_LABELS[handle]} (azul)`
    : edge
      ? `Resize: ${HANDLE_LABELS[handle]} (ciano)`
      : HANDLE_LABELS[handle];
  handleMode.className = `handle-mode${corner ? " corner" : edge ? " edge" : " move"}`;
}

function setStatus(msg: string, type: "normal" | "error" | "success" = "normal") {
  statusEl.textContent = msg;
  statusEl.className = `status${type === "error" ? " error" : type === "success" ? " success" : ""}`;
}

function syncFrameOrder() {
  const frames = editor.getFrames();
  frameOrder = frameOrder.filter((name) => frames[name]);
  for (const name of Object.keys(frames)) {
    if (!frameOrder.includes(name)) frameOrder.push(name);
  }
}

function sortedFrameNames(frames: Record<string, Frame>, filter = ""): string[] {
  const q = filter.trim().toLowerCase();
  return Object.keys(frames)
    .filter((n) => !q || n.toLowerCase().includes(q))
    .sort((a, b) => a.localeCompare(b));
}

function refreshSidebar() {
  const frames = editor.getFrames();
  const selected = editor.getSelected();
  const filter = frameSearch.value;
  const names = sortedFrameNames(frames, filter);

  frameCount.textContent = String(Object.keys(frames).length);
  frameList.replaceChildren();

  for (const name of names) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = name;
    btn.className = name === selected ? "active" : "";
    btn.title = formatFrameTooltip(frames[name]);
    btn.addEventListener("click", () => editor.select(name));
    li.appendChild(btn);
    frameList.appendChild(li);
  }
}

function formatFrameTooltip(frame: Frame) {
  return `x:${frame.x} y:${frame.y} w:${frame.w} h:${frame.h}`;
}

function updateInspectorFromSelection(name = editor.getSelected()) {
  if (!name || !editor.getFrames()[name]) {
    inspectorEmpty.classList.remove("hidden");
    inspectorForm.classList.add("hidden");
    updateHandleMode(null);
    return;
  }

  inspectorEmpty.classList.add("hidden");
  inspectorForm.classList.remove("hidden");

  const frame = editor.getFrames()[name];
  suppressInspector = true;
  propName.value = name;
  propX.value = String(frame.x);
  propY.value = String(frame.y);
  propW.value = String(frame.w);
  propH.value = String(frame.h);
  suppressInspector = false;

  updateHandleMode(editor.getActiveHandle());
  drawPreview(frame);
}

function drawPreview(frame: Frame) {
  if (!imageEl) return;
  const maxW = 220;
  const scale = Math.min(1, maxW / frame.w);
  previewCanvas.width = Math.max(1, Math.round(frame.w * scale));
  previewCanvas.height = Math.max(1, Math.round(frame.h * scale));
  const ctx = previewCanvas.getContext("2d")!;
  ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    imageEl,
    frame.x,
    frame.y,
    frame.w,
    frame.h,
    0,
    0,
    previewCanvas.width,
    previewCanvas.height,
  );
}

function applyInspectorEdits() {
  if (suppressInspector) return;
  const selected = editor.getSelected();
  if (!selected) return;

  const frame: Frame = {
    x: Number(propX.value) || 0,
    y: Number(propY.value) || 0,
    w: Number(propW.value) || 1,
    h: Number(propH.value) || 1,
  };

  const newName = propName.value.trim();
  if (newName && newName !== selected) {
    if (!editor.renameFrame(selected, newName)) {
      setStatus(`Nome "${newName}" já existe`, "error");
      propName.value = selected;
      return;
    }
    editor.select(newName);
  } else {
    editor.updateFrame(selected, frame);
  }

  drawPreview(editor.getFrames()[editor.getSelected()!]);
}

[propName, propX, propY, propW, propH].forEach((input) => {
  input.addEventListener("input", applyInspectorEdits);
  input.addEventListener("change", applyInspectorEdits);
});

btnDuplicate.addEventListener("click", () => {
  const selected = editor.getSelected();
  if (!selected) return;
  editor.duplicateFrame(selected);
});

btnDelete.addEventListener("click", () => {
  const selected = editor.getSelected();
  if (!selected) return;
  if (confirm(`Excluir frame "${selected}"?`)) {
    editor.deleteFrame(selected);
  }
});

btnAdd.addEventListener("click", () => {
  const name = prompt("Nome do frame:");
  if (!name?.trim()) return;
  editor.addFrame(name.trim(), { x: 0, y: 0, w: 32, h: 32 });
});

frameSearch.addEventListener("input", refreshSidebar);

async function loadProject() {
  const imagePath = imagePathInput.value.trim();
  const atlasPath = atlasPathInput.value.trim();
  if (!imagePath || !atlasPath) {
    setStatus("Informe os caminhos da imagem e do atlas", "error");
    return;
  }

  setStatus("Carregando...");
  try {
    const atlasRaw = await readProjectFile(atlasPath);
    atlasData = JSON.parse(atlasRaw) as AtlasData;
    frameOrder = extractFrameOrder(atlasRaw, atlasData);
    atlasLineEnding = atlasRaw.includes("\r\n") ? "\r\n" : "\n";

    const img = new Image();
    img.onload = () => {
      imageEl = img;
      editor.setImage(img);
      editor.setFrames(atlasData!.frames);
      canvasEmpty.classList.add("hidden");
      btnSave.disabled = true;
      btnAdd.disabled = false;
      dirty = false;
      refreshSidebar();
      setStatus(`Carregado: ${Object.keys(atlasData!.frames).length} frames`, "success");
    };
    img.onerror = () => setStatus(`Imagem não encontrada: ${imagePath}`, "error");
    img.src = projectFileUrl(imagePath);
  } catch (err) {
    setStatus(`Erro ao carregar: ${err}`, "error");
  }
}

async function saveAtlas() {
  const atlasPath = atlasPathInput.value.trim();
  if (!atlasData || !atlasPath) return;

  syncFrameOrder();

  const output: AtlasData = {
    sheet: atlasData.sheet,
    frames: editor.getFrames(),
  };

  const json = formatAtlasJson(output, frameOrder).replace(/\n/g, atlasLineEnding);

  try {
    await writeProjectFile(atlasPath, json);
    atlasData = output;
    dirty = false;
    btnSave.disabled = true;
    setStatus(`Salvo em ${atlasPath}`, "success");
  } catch (err) {
    setStatus(`Erro ao salvar: ${err}`, "error");
  }
}

btnLoad.addEventListener("click", loadProject);
btnSave.addEventListener("click", saveAtlas);

window.addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
  }
});

loadProject();
