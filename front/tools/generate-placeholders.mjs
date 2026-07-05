/**
 * Gera PNGs placeholder substituiveis:
 *   assets/backgrounds/login-bg.png
 *   assets/branding/game-title.png
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const BG_PATH = path.join(ROOT, "assets", "backgrounds", "login-bg.png");
const TITLE_PATH = path.join(ROOT, "assets", "branding", "game-title.png");

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mix(c1, c2, t) {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t)),
  ];
}

function setPx(data, w, x, y, rgb, a = 255) {
  const i = (y * w + x) * 4;
  data[i] = rgb[0];
  data[i + 1] = rgb[1];
  data[i + 2] = rgb[2];
  data[i + 3] = a;
}

function addGlow(data, w, h, cx, cy, radius, color, strength = 1) {
  const r2 = radius * radius;
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(h - 1, Math.ceil(cy + radius));
  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(w - 1, Math.ceil(cx + radius));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const t = 1 - Math.sqrt(d2) / radius;
      const i = (y * w + x) * 4;
      const blend = t * t * strength;
      data[i] = Math.min(255, data[i] + color[0] * blend);
      data[i + 1] = Math.min(255, data[i + 1] + color[1] * blend);
      data[i + 2] = Math.min(255, data[i + 2] + color[2] * blend);
    }
  }
}

function writePng(filePath, png) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, PNG.sync.write(png));
  console.log(`created ${filePath} (${png.width}x${png.height})`);
}

// --- Background 1920x1080 ---
function createLoginBg() {
  const W = 1920;
  const H = 1080;
  const png = new PNG({ width: W, height: H });
  const top = [13, 19, 48];
  const bottom = [7, 11, 26];

  for (let y = 0; y < H; y++) {
    const t = y / (H - 1);
    const base = mix(top, bottom, t);
    for (let x = 0; x < W; x++) {
      setPx(png.data, W, x, y, base);
    }
  }

  addGlow(png.data, W, H, W * 0.5, H * 0.05, 520, [44, 63, 120], 0.55);
  addGlow(png.data, W, H, W * 0.15, H * 0.85, 420, [26, 42, 85], 0.45);
  addGlow(png.data, W, H, W * 0.85, H * 0.88, 380, [36, 26, 77], 0.4);

  // Faixa sutil indicando placeholder
  for (let x = 0; x < W; x++) {
    for (let y = H - 36; y < H - 8; y++) {
      const i = (y * W + x) * 4;
      png.data[i] = Math.min(255, png.data[i] + 8);
      png.data[i + 1] = Math.min(255, png.data[i + 1] + 8);
      png.data[i + 2] = Math.min(255, png.data[i + 2] + 12);
    }
  }

  writePng(BG_PATH, png);
}

// --- Titulo 800x220 com fundo transparente ---
function createGameTitle() {
  const W = 800;
  const H = 220;
  const png = new PNG({ width: W, height: H });
  png.data.fill(0); // transparente

  // "SkySpire" simplificado em blocos dourados (pixel-art placeholder)
  const gold = [240, 208, 128];
  const goldDark = [201, 150, 47];
  const shadow = [0, 0, 0];

  function fillRect(x, y, rw, rh, rgb, alpha = 255) {
    for (let py = y; py < y + rh; py++) {
      for (let px = x; px < x + rw; px++) {
        if (px < 0 || py < 0 || px >= W || py >= H) continue;
        setPx(png.data, W, px, py, rgb, alpha);
      }
    }
  }

  // Sombra geral
  fillRect(198, 58, 404, 72, shadow, 90);

  // Barra principal do titulo (placeholder visual)
  fillRect(200, 56, 400, 68, goldDark);
  fillRect(204, 60, 392, 28, gold);
  fillRect(204, 92, 392, 24, [255, 230, 170]);

  // Tagline placeholder
  fillRect(250, 148, 300, 3, goldDark);
  fillRect(270, 156, 260, 2, gold, 180);
  fillRect(290, 164, 220, 2, gold, 120);

  // Diamantes nos cantos (ornamento fake)
  const gems = [
    [180, 52], [620, 52], [180, 120], [620, 120],
  ];
  for (const [gx, gy] of gems) {
    fillRect(gx, gy, 8, 8, [80, 160, 255], 200);
    fillRect(gx + 2, gy + 2, 4, 4, [180, 220, 255], 220);
  }

  writePng(TITLE_PATH, png);
}

createLoginBg();
createGameTitle();

console.log("");
console.log("Substitua pelos seus assets finais (mesmo nome/caminho):");
console.log(`  ${TITLE_PATH}`);
console.log(`  ${BG_PATH}`);
