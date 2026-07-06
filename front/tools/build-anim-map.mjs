/**
 * Gera ou atualiza um `.anim.json` a partir de uma grade regular na sprite sheet.
 *
 * Uso:
 *   node tools/build-anim-map.mjs --id f1-slime --sheet mobs/f1-slime.png
 *   node tools/build-anim-map.mjs --id elf-mage --sheet players/elf-mage.png --fps-idle 8
 *
 * Flags:
 *   --id          Identificador da entidade (nome do arquivo)
 *   --sheet       Caminho relativo em assets/ (ex.: mobs/f1-slime.png)
 *   --cols        Colunas da grade (padrão: 6)
 *   --rows        Linhas da grade (padrão: 3)
 *   --frame       Tamanho do frame quadrado (padrão: 296)
 *   --fps-idle    FPS do idle (padrão: 7)
 *   --fps-attack  FPS do attack (padrão: 12)
 *   --fps-critical FPS do critical (padrão: 12)
 *   --frames-idle Número de frames no idle (padrão: cols)
 *   --frames-attack
 *   --frames-critical
 *   --merge       Mescla com JSON existente preservando frames/animações editados manualmente
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const MAPS_DIR = path.join(ROOT, "src", "animation", "maps");

const DEFAULT_ROW_NAMES = ["idle", "attack", "critical"];

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[name] = true;
    } else {
      args[name] = next;
      i++;
    }
  }
  return args;
}

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function buildGridFrames(cols, rows, frameSize, rowNames) {
  const frames = {};
  for (let row = 0; row < rows; row++) {
    const prefix = rowNames[row] ?? `row${row}`;
    for (let col = 0; col < cols; col++) {
      frames[`${prefix}-${col}`] = {
        x: col * frameSize,
        y: row * frameSize,
        w: frameSize,
        h: frameSize,
      };
    }
  }
  return frames;
}

function buildDefaultAnimations(cols, rowNames, frameCounts, fps) {
  const animations = {};
  for (let row = 0; row < rowNames.length; row++) {
    const name = rowNames[row];
    const count = frameCounts[row] ?? cols;
    const frames = Array.from({ length: count }, (_, i) => `${name}-${i}`);
    animations[name] = {
      frames,
      fps: fps[name] ?? 10,
      loop: name === "idle",
      ...(name !== "idle" ? { next: "idle" } : {}),
    };
  }
  return animations;
}

function mergeMaps(existing, generated) {
  const merged = { ...generated, frames: { ...generated.frames }, animations: { ...generated.animations } };

  for (const [id, rect] of Object.entries(existing.frames ?? {})) {
    merged.frames[id] = rect;
  }

  for (const [name, anim] of Object.entries(existing.animations ?? {})) {
    merged.animations[name] = anim;
  }

  return merged;
}

const args = parseArgs(process.argv);

if (!args.id || !args.sheet) {
  console.error(`Uso: node tools/build-anim-map.mjs --id <id> --sheet <assets/path.png>`);
  process.exit(1);
}

const cols = num(args.cols, 6);
const rows = num(args.rows, 3);
const frameSize = num(args.frame, 296);
const rowNames = DEFAULT_ROW_NAMES.slice(0, rows);

const frameCounts = [
  num(args["frames-idle"], cols),
  num(args["frames-attack"], cols),
  num(args["frames-critical"], cols),
];

const fps = {
  idle: num(args["fps-idle"], 7),
  attack: num(args["fps-attack"], 12),
  critical: num(args["fps-critical"], 12),
};

const generated = {
  id: args.id,
  sheet: args.sheet,
  viewportWidth: frameSize,
  viewportHeight: frameSize,
  frames: buildGridFrames(cols, rows, frameSize, rowNames),
  animations: buildDefaultAnimations(cols, rowNames, frameCounts, fps),
};

fs.mkdirSync(MAPS_DIR, { recursive: true });
const outPath = path.join(MAPS_DIR, `${args.id}.anim.json`);

let output = generated;
if (args.merge && fs.existsSync(outPath)) {
  const existing = JSON.parse(fs.readFileSync(outPath, "utf8"));
  output = mergeMaps(existing, generated);
  console.log(`merge: preservando frames/animações editados em ${outPath}`);
}

fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`anim map: ${outPath}`);
console.log(`  frames: ${Object.keys(output.frames).length}`);
console.log(`  animations: ${Object.keys(output.animations).join(", ")}`);
