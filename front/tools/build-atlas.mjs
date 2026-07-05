/**
 * Pipeline do atlas de UI:
 * 1. Le assets/array_img.png (24bpp, fundo xadrez de transparencia "fake")
 * 2. Remove o fundo via flood-fill partindo das bordas (preserva pixels claros internos dos sprites)
 * 3. Salva public/assets/ui-sheet.png (com alpha real)
 * 4. Detecta componentes conexos e salva tools/components.json (apoio para mapear frames do atlas)
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "assets", "array_img.png");
const OUT_SHEET = path.join(ROOT, "public", "assets", "ui-sheet.png");
const OUT_COMPONENTS = path.join(ROOT, "tools", "components.json");

const png = PNG.sync.read(fs.readFileSync(SRC));
const { width: W, height: H, data } = png;

const idx = (x, y) => (y * W + x) * 4;

// Pixel candidato a fundo: cinza claro/branco do xadrez
function isBgColor(x, y) {
  const i = idx(x, y);
  const r = data[i], g = data[i + 1], b = data[i + 2];
  return (
    r > 185 && g > 185 && b > 185 &&
    Math.abs(r - g) < 14 && Math.abs(r - b) < 14 && Math.abs(g - b) < 14
  );
}

// Flood fill a partir das bordas marcando fundo
const isBg = new Uint8Array(W * H);
const stack = [];
for (let x = 0; x < W; x++) { stack.push(x, 0, x, H - 1); }
for (let y = 0; y < H; y++) { stack.push(0, y, W - 1, y); }
while (stack.length) {
  const y = stack.pop();
  const x = stack.pop();
  if (x < 0 || y < 0 || x >= W || y >= H) continue;
  const p = y * W + x;
  if (isBg[p] || !isBgColor(x, y)) continue;
  isBg[p] = 1;
  stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
}

// Aplica alpha
for (let p = 0; p < W * H; p++) {
  if (isBg[p]) data[p * 4 + 3] = 0;
}

// Suaviza serrilhado da borda: pixels de fundo-cor adjacentes a fundo real ja foram
// tratados pelo flood fill; nada extra necessario para pixel-art.

fs.mkdirSync(path.dirname(OUT_SHEET), { recursive: true });
fs.writeFileSync(OUT_SHEET, PNG.sync.write(png));
console.log(`sheet: ${OUT_SHEET} (${W}x${H})`);

// Componentes conexos (8-conn) dos pixels visiveis, com merge de caixas proximas
const seen = new Uint8Array(W * H);
const boxes = [];
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const p = y * W + x;
    if (seen[p] || isBg[p] || data[p * 4 + 3] === 0) continue;
    let minX = x, maxX = x, minY = y, maxY = y, count = 0;
    const st = [x, y];
    seen[p] = 1;
    while (st.length) {
      const cy = st.pop(), cx = st.pop();
      count++;
      if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const np = ny * W + nx;
          if (seen[np] || isBg[np]) continue;
          seen[np] = 1;
          st.push(nx, ny);
        }
      }
    }
    if (count > 30) boxes.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, px: count });
  }
}

// Merge de caixas que se sobrepoem ou estao a <=4px (partes soltas do mesmo sprite)
function near(a, b, gap) {
  return !(a.x - gap > b.x + b.w || b.x - gap > a.x + a.w || a.y - gap > b.y + b.h || b.y - gap > a.y + a.h);
}
let merged = true;
while (merged) {
  merged = false;
  outer: for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (near(boxes[i], boxes[j], 4)) {
        const a = boxes[i], b = boxes[j];
        const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
        boxes[i] = {
          x, y,
          w: Math.max(a.x + a.w, b.x + b.w) - x,
          h: Math.max(a.y + a.h, b.y + b.h) - y,
          px: a.px + b.px,
        };
        boxes.splice(j, 1);
        merged = true;
        break outer;
      }
    }
  }
}

boxes.sort((a, b) => (a.y - b.y) || (a.x - b.x));
fs.writeFileSync(OUT_COMPONENTS, JSON.stringify(boxes, null, 2));
console.log(`components: ${boxes.length} -> ${OUT_COMPONENTS}`);
