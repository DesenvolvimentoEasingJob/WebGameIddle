/**
 * Varre faixas horizontais do array_img e reporta blocos visíveis (apoio ao mapeamento manual).
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const SRC = path.resolve(import.meta.dirname, "../assets/array_img.png");
const png = PNG.sync.read(fs.readFileSync(SRC));
const { width: W, height: H, data } = png;

function isBg(r, g, b) {
  return (
    r > 185 && g > 185 && b > 185 &&
    Math.abs(r - g) < 14 && Math.abs(r - b) < 14 && Math.abs(g - b) < 14
  );
}

function visible(x, y) {
  const i = (y * W + x) * 4;
  const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
  return a > 0 && !isBg(r, g, b);
}

// Scan row for contiguous visible spans
function scanRow(y) {
  const spans = [];
  let start = null;
  for (let x = 0; x < W; x++) {
    if (visible(x, y)) {
      if (start === null) start = x;
    } else if (start !== null) {
      spans.push({ x: start, w: x - start });
      start = null;
    }
  }
  if (start !== null) spans.push({ x: start, w: W - start });
  return spans.filter((s) => s.w > 20);
}

// Find rows with content in y range
const yFrom = Number(process.argv[2] ?? 850);
const yTo = Number(process.argv[3] ?? 1100);

for (let y = yFrom; y <= yTo; y += 2) {
  const spans = scanRow(y);
  if (spans.length > 0) {
    console.log(`y=${y}: ${spans.map((s) => `x${s.x}+${s.w}`).join(" | ")}`);
  }
}
