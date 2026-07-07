import "./styles.css";

import type { AnimMapSource } from "@front/animation/anim-map-types";
import { bindAnimMap, validateAnimMap } from "@front/animation/anim-map";
import { createSpriteAnimator, type SpriteAnimator } from "@front/animation/SpriteAnimator";
import {
  checkAiEnv,
  generateSpriteSheet,
  listAnimMapIds,
  loadAnimMapSource,
  readProjectFile,
  writeBinaryFile,
  writeProjectFile,
} from "../api";
import {
  buildDefaultAnimMap,
  buildEditPrompt,
  cloneAnimMapWithNewId,
  defaultReferenceId,
  inferGridFromAnimMap,
  isDefault296Grid,
  normalizeSheetToTargetSize,
} from "./reference-grid";

const ANIM_MAP_DIR = "front/src/animation/maps";
const MOB_DATA_DIR = "backend/SkySpire.Api/GameData/mobs";
const SPRITE_REGISTRY_PATH = "front/src/animation/sprite-registry.ts";

let rootEl: HTMLElement | null = null;
let previewAnimator: SpriteAnimator | null = null;
let generatedBase64: string | null = null;
let generatedAnimMap: AnimMapSource | null = null;

function q<T extends HTMLElement>(sel: string): T | null {
  return rootEl?.querySelector<T>(sel) ?? null;
}

function log(message: string, isError = false): void {
  const logEl = q<HTMLElement>("#ai-sprite-log");
  if (!logEl) return;
  const line = document.createElement("div");
  line.className = isError ? "ai-sprite-log__line ai-sprite-log__line--error" : "ai-sprite-log__line";
  line.textContent = `${new Date().toLocaleTimeString("pt-BR")} — ${message}`;
  logEl.prepend(line);
}

function assetSheetPath(kind: string, id: string): string {
  return `${kind === "mob" ? "mobs" : "players"}/${id}.png`;
}

function assetFilePath(kind: string, id: string): string {
  return `front/assets/${assetSheetPath(kind, id)}`;
}

function syncPreview(): void {
  if (!generatedAnimMap || !generatedBase64) return;
  const previewEl = q<HTMLElement>("#ai-sprite-preview");
  if (!previewEl) return;

  previewAnimator?.destroy();
  const sheetUrl = `data:image/png;base64,${generatedBase64}`;
  const resolved = bindAnimMap(generatedAnimMap, sheetUrl);
  previewAnimator = createSpriteAnimator(previewEl, resolved, { normalize: false });
  void previewAnimator?.whenReady().then(() => previewAnimator?.play("idle"));
}

function showSheetImage(): void {
  const img = q<HTMLImageElement>("#ai-sprite-sheet-img");
  if (!img || !generatedBase64) return;
  img.src = `data:image/png;base64,${generatedBase64}`;
  img.hidden = false;
}

async function refreshEnvStatus(): Promise<void> {
  const status = await checkAiEnv();
  const el = q<HTMLElement>("#ai-sprite-env-status");
  if (!el) return;

  if (status.configured) {
    el.className = "ai-sprite-env ai-sprite-env--ok";
    const editHint = status.supportsEdit
      ? " · referência visual via edit"
      : " · referência requer gpt-image-1";
    el.innerHTML = `API configurada · <strong>${status.model}</strong> · ${status.size}${editHint}`;
  } else {
    el.className = "ai-sprite-env ai-sprite-env--warn";
    el.innerHTML =
      "Configure <code>OPENAI_API_KEY</code> em <code>tolls/imageMapTools/.env</code> (copie de <code>.env.example</code>)";
  }
}

async function updateReferencePreview(mapId: string): Promise<void> {
  const img = q<HTMLImageElement>("#ai-sprite-ref-preview");
  if (!img) return;

  if (!mapId) {
    img.hidden = true;
    img.removeAttribute("src");
    return;
  }

  try {
    const source = await loadAnimMapSource(mapId);
    img.src = `/project/front/assets/${source.sheet.split("/").map(encodeURIComponent).join("/")}`;
    img.hidden = false;
  } catch {
    img.hidden = true;
  }
}

async function handleGenerate(): Promise<void> {
  const id =
    (q<HTMLSelectElement>("#ai-sprite-regen")?.value.trim() ?? "") ||
    q<HTMLInputElement>("#ai-sprite-id")?.value.trim();
  const description = q<HTMLTextAreaElement>("#ai-sprite-desc")?.value.trim();
  const style = q<HTMLInputElement>("#ai-sprite-style")?.value.trim();
  const kind = q<HTMLSelectElement>("#ai-sprite-kind")?.value ?? "mob";
  let referenceId = q<HTMLSelectElement>("#ai-sprite-reference")?.value.trim() ?? "";
  const generateBtn = q<HTMLButtonElement>("#ai-sprite-generate");

  if (!id || !description) {
    log("Preencha ID e descrição do personagem/monstro", true);
    return;
  }

  if (!referenceId) referenceId = defaultReferenceId(kind as "mob" | "player");

  const referenceMap = await loadAnimMapSource(referenceId);
  const referenceAssetPath = `front/assets/${referenceMap.sheet}`;
  const prompt = buildEditPrompt({
    kind: kind as "mob" | "player",
    description,
    style,
    referenceId,
  });

  const promptEl = q<HTMLTextAreaElement>("#ai-sprite-prompt");
  if (promptEl) promptEl.value = prompt;

  generateBtn?.setAttribute("disabled", "true");
  log(`Gerando com referência ${referenceId}…`);

  try {
    const result = await generateSpriteSheet(prompt, referenceAssetPath);
    const normalized = await normalizeSheetToTargetSize(result.base64);
    generatedBase64 = normalized.base64;

    if (result.mode === "edit" && isDefault296Grid(referenceMap)) {
      generatedAnimMap = cloneAnimMapWithNewId(referenceMap, id, assetSheetPath(kind, id));
    } else {
      const inferredGrid = inferGridFromAnimMap(referenceMap);
      generatedAnimMap = buildDefaultAnimMap({
        id,
        sheet: assetSheetPath(kind, id),
        grid: inferredGrid ?? normalized.grid,
      });
    }

    showSheetImage();
    syncPreview();
    const actions = q<HTMLElement>("#ai-sprite-actions");
    if (actions) actions.hidden = false;

    const modeLabel = result.mode === "edit" ? "edit (referência)" : "generate";
    const gridLabel = isDefault296Grid(referenceMap) ? "padrão 296×296" : "derivado da referência";
    log(`OK via ${modeLabel} · anim-map ${gridLabel}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`Erro na geração: ${message}`, true);
  } finally {
    generateBtn?.removeAttribute("disabled");
  }
}

function toPascalImportSuffix(id: string, suffix: string): string {
  return id.replace(/-([a-z0-9])/g, (_, ch: string) => ch.toUpperCase()) + suffix;
}

function insertIntoRegistryBlock(content: string, blockName: string, entry: string): string {
  const blockIdx = content.indexOf(blockName);
  if (blockIdx < 0) return content;

  const openBrace = content.indexOf("{", blockIdx);
  const closeBrace = content.indexOf("};", openBrace);
  if (closeBrace < 0) return content;

  const idMatch = entry.match(/"([^"]+)"/);
  if (idMatch && content.slice(openBrace, closeBrace).includes(`"${idMatch[1]}"`)) {
    return content;
  }

  return content.slice(0, closeBrace) + `\n${entry}` + content.slice(closeBrace);
}

async function registerInSpriteRegistry(id: string, kind: string): Promise<void> {
  const sheetPath = assetSheetPath(kind, id);
  const mapImport = toPascalImportSuffix(id, "Map");
  const urlImport = toPascalImportSuffix(id, "Url");

  let content = await readProjectFile(SPRITE_REGISTRY_PATH);
  if (content.includes(`"${id}":`)) {
    log("Já registrado em sprite-registry.ts");
    return;
  }

  const mapLine = `import ${mapImport} from "./maps/${id}.anim.json";`;
  const urlLine = `import ${urlImport} from "../../assets/${sheetPath}";`;

  if (!content.includes(mapLine)) {
    const lastMapImport = content.lastIndexOf('from "./maps/');
    const lineEnd = content.indexOf("\n", lastMapImport);
    content = content.slice(0, lineEnd + 1) + mapLine + "\n" + content.slice(lineEnd + 1);
  }

  if (!content.includes(urlLine)) {
    const lastAssetImport = content.lastIndexOf('from "../../assets/');
    const lineEnd = content.indexOf("\n", lastAssetImport);
    content = content.slice(0, lineEnd + 1) + urlLine + "\n" + content.slice(lineEnd + 1);
  }

  const registryName = kind === "mob" ? "MOB_ANIM_MAPS" : "PLAYER_ANIM_MAPS";
  const entry = `  "${id}": bindAnimMap(${mapImport} as AnimMapSource, ${urlImport}),`;
  content = insertIntoRegistryBlock(content, `const ${registryName}`, entry);

  await writeProjectFile(SPRITE_REGISTRY_PATH, content);
  log(`Registrado em sprite-registry.ts (${registryName})`);
}

async function handleApply(): Promise<void> {
  if (!generatedBase64 || !generatedAnimMap) {
    log("Gere uma sheet antes de aplicar", true);
    return;
  }

  const id = generatedAnimMap.id;
  const kind = q<HTMLSelectElement>("#ai-sprite-kind")?.value ?? "mob";
  const mobName = q<HTMLInputElement>("#ai-sprite-name")?.value.trim() || id;
  const createMob = q<HTMLInputElement>("#ai-sprite-create-mob")?.checked ?? false;
  const register = q<HTMLInputElement>("#ai-sprite-register")?.checked ?? true;

  const errors = validateAnimMap(generatedAnimMap);
  if (errors.length) {
    log(`Anim map inválido: ${errors.join("; ")}`, true);
    return;
  }

  const applyBtn = q<HTMLButtonElement>("#ai-sprite-apply");
  applyBtn?.setAttribute("disabled", "true");

  try {
    await writeBinaryFile(assetFilePath(kind, id), generatedBase64);
    log(`PNG salvo em ${assetFilePath(kind, id)}`);

    await writeProjectFile(`${ANIM_MAP_DIR}/${id}.anim.json`, `${JSON.stringify(generatedAnimMap, null, 2)}\n`);
    log(`Anim map salvo em ${ANIM_MAP_DIR}/${id}.anim.json`);

    if (createMob && kind === "mob") {
      const mob = {
        id,
        name: mobName,
        level: Number(q<HTMLInputElement>("#ai-sprite-level")?.value) || 1,
        hp: Number(q<HTMLInputElement>("#ai-sprite-hp")?.value) || 300,
        attack: Number(q<HTMLInputElement>("#ai-sprite-attack")?.value) || 12,
        defense: Number(q<HTMLInputElement>("#ai-sprite-defense")?.value) || 2,
        xp: Number(q<HTMLInputElement>("#ai-sprite-xp")?.value) || 15,
        gold: Number(q<HTMLInputElement>("#ai-sprite-gold")?.value) || 5,
        assets: {
          sprite: assetSheetPath(kind, id),
          icon: assetSheetPath(kind, id).replace(".png", "-icon.png"),
        },
      };
      await writeProjectFile(`${MOB_DATA_DIR}/${id}.json`, `${JSON.stringify(mob, null, 2)}\n`);
      log(`Mob JSON criado em ${MOB_DATA_DIR}/${id}.json`);
    }

    if (register) await registerInSpriteRegistry(id, kind);
    log("Pronto! Abra o menu Animações para ajustar frames se necessário.");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`Falha ao aplicar: ${message}`, true);
  } finally {
    applyBtn?.removeAttribute("disabled");
  }
}

function bindMapLists(mapIds: string[]): void {
  const kind = q<HTMLSelectElement>("#ai-sprite-kind")?.value ?? "mob";
  const defaultRef = defaultReferenceId(kind as "mob" | "player");

  const referenceSelect = q<HTMLSelectElement>("#ai-sprite-reference");
  if (referenceSelect) {
    referenceSelect.innerHTML = mapIds
      .map((id) => `<option value="${id}" ${id === defaultRef ? "selected" : ""}>${id}${id === defaultRef ? " (padrão)" : ""}</option>`)
      .join("");
    void updateReferencePreview(referenceSelect.value);
  }

  const regenSelect = q<HTMLSelectElement>("#ai-sprite-regen");
  if (regenSelect) {
    regenSelect.innerHTML =
      '<option value="">— nova entidade</option>' +
      mapIds.map((id) => `<option value="${id}">${id}</option>`).join("");
  }

  const mapList = q<HTMLUListElement>("#ai-sprite-map-list");
  if (mapList) {
    mapList.innerHTML = mapIds.map((id) => `<li><code>${id}</code></li>`).join("") || "<li>Nenhum</li>";
  }
}

export function mountAiSpriteTool(container: HTMLElement): () => void {
  rootEl = container;

  container.innerHTML = `
    <main class="ai-sprite-page">
      <header class="ai-sprite-header">
        <div>
          <h1>Gerador IA</h1>
          <p>Sprite sheet 6×3 (idle / attack / critical) pronta para o SkySpire</p>
        </div>
        <div id="ai-sprite-env-status" class="ai-sprite-env ai-sprite-env--warn">Verificando API…</div>
      </header>

      <div class="ai-sprite-layout">
        <section class="ai-sprite-form">
          <h2>Entidade</h2>
          <label>ID <input id="ai-sprite-id" type="text" placeholder="f1-wolf" spellcheck="false"></label>
          <label>Nome (mob JSON) <input id="ai-sprite-name" type="text" placeholder="Lobo das Sombras"></label>
          <label>Tipo
            <select id="ai-sprite-kind">
              <option value="mob">Monstro (mobs/)</option>
              <option value="player">Personagem (players/)</option>
            </select>
          </label>

          <h2>Referência visual</h2>
          <p class="ai-sprite-hint-block">Use uma sheet existente como template de layout (recomendado). Requer <code>gpt-image-1</code>.</p>
          <label>Sheet de referência
            <select id="ai-sprite-reference"></select>
          </label>
          <img id="ai-sprite-ref-preview" class="ai-sprite-ref-preview" alt="Preview da referência" hidden>
          <label>Regenerar entidade existente
            <select id="ai-sprite-regen">
              <option value="">— nova entidade</option>
            </select>
          </label>

          <h2>Descrição para a IA</h2>
          <label>Personagem / monstro
            <textarea id="ai-sprite-desc" rows="3" placeholder="Morcego roxo pequeno com asas membranosas, olhos amarelos brilhantes, estilo sombrio"></textarea>
          </label>
          <label>Estilo visual (opcional)
            <input id="ai-sprite-style" type="text" placeholder="pixel art 16-bit retro RPG…">
          </label>

          <h2>Mob (opcional)</h2>
          <label class="ai-sprite-check"><input id="ai-sprite-create-mob" type="checkbox" checked> Criar mob JSON no backend</label>
          <div class="ai-sprite-stats">
            <label>Level <input id="ai-sprite-level" type="number" value="1" min="1"></label>
            <label>HP <input id="ai-sprite-hp" type="number" value="300" min="1"></label>
            <label>ATK <input id="ai-sprite-attack" type="number" value="12" min="0"></label>
            <label>DEF <input id="ai-sprite-defense" type="number" value="2" min="0"></label>
            <label>XP <input id="ai-sprite-xp" type="number" value="15" min="0"></label>
            <label>Gold <input id="ai-sprite-gold" type="number" value="5" min="0"></label>
          </div>

          <label class="ai-sprite-check"><input id="ai-sprite-register" type="checkbox" checked> Registrar em sprite-registry.ts</label>

          <button type="button" id="ai-sprite-generate" class="ai-sprite-btn ai-sprite-btn--primary">Gerar com referência</button>

          <h2>Prompt enviado</h2>
          <textarea id="ai-sprite-prompt" class="ai-sprite-prompt" rows="10" readonly placeholder="O prompt completo aparece aqui antes de gerar…"></textarea>
        </section>

        <section class="ai-sprite-output">
          <div class="ai-sprite-preview-row">
            <div class="ai-sprite-preview-box">
              <h3>Preview animado</h3>
              <div id="ai-sprite-preview" class="ai-sprite-preview-stage"></div>
              <div class="ai-sprite-preview-btns">
                <button type="button" data-play="idle">idle</button>
                <button type="button" data-play="attack">attack</button>
                <button type="button" data-play="critical">critical</button>
              </div>
            </div>
            <div class="ai-sprite-sheet-box">
              <h3>Sprite sheet</h3>
              <div class="ai-sprite-sheet-wrap">
                <img id="ai-sprite-sheet-img" alt="Sprite sheet gerada" hidden>
              </div>
            </div>
          </div>

          <div id="ai-sprite-actions" class="ai-sprite-actions" hidden>
            <button type="button" id="ai-sprite-apply" class="ai-sprite-btn ai-sprite-btn--primary">
              Salvar PNG + anim.json + mob + registry
            </button>
            <p class="ai-sprite-hint">Depois de salvar, use o menu <strong>Animações</strong> para fine-tuning dos frames.</p>
          </div>

          <div class="ai-sprite-existing">
            <h3>Mapas existentes</h3>
            <ul id="ai-sprite-map-list"></ul>
          </div>
        </section>
      </div>

      <footer class="ai-sprite-log" id="ai-sprite-log" aria-live="polite"></footer>
    </main>
  `;

  void refreshEnvStatus();
  void listAnimMapIds().then(bindMapLists);

  q<HTMLSelectElement>("#ai-sprite-reference")?.addEventListener("change", (e) => {
    void updateReferencePreview((e.target as HTMLSelectElement).value);
  });

  q<HTMLSelectElement>("#ai-sprite-kind")?.addEventListener("change", (e) => {
    const kind = (e.target as HTMLSelectElement).value as "mob" | "player";
    const referenceSelect = q<HTMLSelectElement>("#ai-sprite-reference");
    if (referenceSelect) {
      referenceSelect.value = defaultReferenceId(kind);
      void updateReferencePreview(referenceSelect.value);
    }
  });

  q<HTMLSelectElement>("#ai-sprite-regen")?.addEventListener("change", (e) => {
    const regenId = (e.target as HTMLSelectElement).value;
    const idInput = q<HTMLInputElement>("#ai-sprite-id");
    if (!idInput) return;
    if (regenId) {
      idInput.value = regenId;
      idInput.readOnly = true;
    } else {
      idInput.readOnly = false;
    }
  });

  q<HTMLButtonElement>("#ai-sprite-generate")?.addEventListener("click", () => void handleGenerate());
  q<HTMLButtonElement>("#ai-sprite-apply")?.addEventListener("click", () => void handleApply());

  container.querySelectorAll<HTMLButtonElement>("[data-play]").forEach((btn) => {
    btn.addEventListener("click", () => previewAnimator?.play(btn.dataset.play!));
  });

  return () => {
    previewAnimator?.destroy();
    previewAnimator = null;
    generatedBase64 = null;
    generatedAnimMap = null;
    rootEl = null;
    container.innerHTML = "";
  };
}
