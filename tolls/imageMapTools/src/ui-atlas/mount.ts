import "./styles.css";
import { projectFileUrl, readProjectFile, writeProjectFile } from "../api";
import { extractFrameOrder, formatAtlasJson } from "./atlas-format";
import { AtlasEditor } from "./editor";
import type { AtlasData, Frame, Handle } from "./types";

export function mountUiAtlasTool(container: HTMLElement): () => void {
  container.innerHTML = `
    <div class="ui-atlas-tool">
      <header class="toolbar">
        <div class="toolbar-group">
          <label>
            Imagem
            <input id="image-path" type="text" value="front/public/assets/ui-sheet.png" spellcheck="false" />
          </label>
          <label>
            Atlas JSON
            <input id="atlas-path" type="text" value="front/src/ui/atlas.json" spellcheck="false" />
          </label>
          <button id="btn-load" type="button">Carregar</button>
          <button id="btn-save" type="button" class="primary" disabled>Salvar JSON</button>
        </div>
        <div class="toolbar-group toolbar-hints">
          <span>Cantos azuis = resize · Laterais ciano = ajuste de lado · Centro = mover</span>
          <span>Ctrl+scroll zoom · Scroll ou espaço+arraste para mover a vista</span>
        </div>
      </header>

      <main class="workspace">
        <aside class="sidebar">
          <div class="sidebar-header">
            <h2>Frames</h2>
            <span id="frame-count" class="badge">0</span>
          </div>
          <input id="frame-search" type="search" placeholder="Buscar frame..." />
          <button id="btn-add" type="button" class="ghost" disabled>+ Novo frame</button>
          <ul id="frame-list"></ul>
        </aside>

        <section class="canvas-wrap">
          <canvas id="editor-canvas"></canvas>
          <div id="canvas-empty" class="canvas-empty">
            Carregue uma imagem e um atlas JSON para começar.
          </div>
        </section>

        <aside class="inspector">
          <h2>Propriedades</h2>
          <div id="inspector-empty" class="inspector-empty">Selecione um frame</div>
          <form id="inspector-form" class="inspector-form hidden">
            <p id="handle-mode" class="handle-mode"></p>
            <label>
              Nome
              <input id="prop-name" type="text" required />
            </label>
            <div class="coord-grid">
              <label>X <input id="prop-x" type="number" min="0" step="1" /></label>
              <label>Y <input id="prop-y" type="number" min="0" step="1" /></label>
              <label>W <input id="prop-w" type="number" min="1" step="1" /></label>
              <label>H <input id="prop-h" type="number" min="1" step="1" /></label>
            </div>
            <div class="inspector-actions">
              <button id="btn-duplicate" type="button">Duplicar</button>
              <button id="btn-delete" type="button" class="danger">Excluir</button>
            </div>
            <div class="preview-wrap">
              <p>Preview</p>
              <canvas id="preview-canvas"></canvas>
            </div>
          </form>
        </aside>
      </main>

      <footer id="status" class="status">Pronto</footer>
    </div>
  `;

  const q = <T extends HTMLElement>(sel: string) => container.querySelector<T>(sel)!;

  const imagePathInput = q<HTMLInputElement>("#image-path");
  const atlasPathInput = q<HTMLInputElement>("#atlas-path");
  const btnLoad = q<HTMLButtonElement>("#btn-load");
  const btnSave = q<HTMLButtonElement>("#btn-save");
  const btnAdd = q<HTMLButtonElement>("#btn-add");
  const frameSearch = q<HTMLInputElement>("#frame-search");
  const frameList = q<HTMLUListElement>("#frame-list");
  const frameCount = q<HTMLSpanElement>("#frame-count");
  const canvasEmpty = q<HTMLDivElement>("#canvas-empty");
  const statusEl = q<HTMLElement>("#status");
  const inspectorEmpty = q<HTMLElement>("#inspector-empty");
  const inspectorForm = q<HTMLFormElement>("#inspector-form");
  const propName = q<HTMLInputElement>("#prop-name");
  const propX = q<HTMLInputElement>("#prop-x");
  const propY = q<HTMLInputElement>("#prop-y");
  const propW = q<HTMLInputElement>("#prop-w");
  const propH = q<HTMLInputElement>("#prop-h");
  const btnDuplicate = q<HTMLButtonElement>("#btn-duplicate");
  const btnDelete = q<HTMLButtonElement>("#btn-delete");
  const previewCanvas = q<HTMLCanvasElement>("#preview-canvas");
  const handleMode = q<HTMLParagraphElement>("#handle-mode");

  let atlasData: AtlasData | null = null;
  let frameOrder: string[] = [];
  let atlasLineEnding = "\n";
  let imageEl: HTMLImageElement | null = null;
  let dirty = false;
  let suppressInspector = false;

  const editor = new AtlasEditor(q<HTMLCanvasElement>("#editor-canvas"), {
    onChange: () => {
      dirty = true;
      btnSave.disabled = false;
      syncFrameOrder();
      refreshSidebar();
      updateInspectorFromSelection();
    },
    onSelect: () => {
      refreshSidebar();
      updateInspectorFromSelection();
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
    const qstr = filter.trim().toLowerCase();
    return Object.keys(frames)
      .filter((n) => !qstr || n.toLowerCase().includes(qstr))
      .sort((a, b) => a.localeCompare(b));
  }

  function refreshSidebar() {
    const frames = editor.getFrames();
    const selected = editor.getSelected();
    const names = sortedFrameNames(frames, frameSearch.value);
    frameCount.textContent = String(Object.keys(frames).length);
    frameList.replaceChildren();

    for (const name of names) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = name;
      btn.className = name === selected ? "active" : "";
      btn.title = `x:${frames[name].x} y:${frames[name].y} w:${frames[name].w} h:${frames[name].h}`;
      btn.addEventListener("click", () => editor.select(name));
      li.appendChild(btn);
      frameList.appendChild(li);
    }
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
    ctx.drawImage(imageEl, frame.x, frame.y, frame.w, frame.h, 0, 0, previewCanvas.width, previewCanvas.height);
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

    const current = editor.getSelected();
    if (current) drawPreview(editor.getFrames()[current]);
  }

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
        requestAnimationFrame(() => {
          window.dispatchEvent(new Event("resize"));
        });
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
    const output: AtlasData = { sheet: atlasData.sheet, frames: editor.getFrames() };
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

  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (dirty) e.preventDefault();
  };

  [propName, propX, propY, propW, propH].forEach((input) => {
    input.addEventListener("input", applyInspectorEdits);
    input.addEventListener("change", applyInspectorEdits);
  });

  btnDuplicate.addEventListener("click", () => {
    const selected = editor.getSelected();
    if (selected) editor.duplicateFrame(selected);
  });

  btnDelete.addEventListener("click", () => {
    const selected = editor.getSelected();
    if (selected && confirm(`Excluir frame "${selected}"?`)) {
      editor.deleteFrame(selected);
    }
  });

  btnAdd.addEventListener("click", () => {
    const name = prompt("Nome do frame:");
    if (name?.trim()) editor.addFrame(name.trim(), { x: 0, y: 0, w: 32, h: 32 });
  });

  frameSearch.addEventListener("input", refreshSidebar);
  btnLoad.addEventListener("click", () => void loadProject());
  btnSave.addEventListener("click", () => void saveAtlas());
  window.addEventListener("beforeunload", onBeforeUnload);

  void loadProject();

  return () => {
    window.removeEventListener("beforeunload", onBeforeUnload);
    editor.destroy();
    container.innerHTML = "";
  };
}
