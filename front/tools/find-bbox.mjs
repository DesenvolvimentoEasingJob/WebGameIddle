/** Dado x,y aproximado, encontra bbox apertado usando a mesma máscara de fundo do build-atlas. */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const SRC = path.resolve(import.meta.dirname, "../assets/array_img.png");
const png = PNG.sync.read(fs.readFileSync(SRC));
const { width: W, height: H, data } = png;

function isBgColor(x, y) {
  const i = (y * W + x) * 4;
  const r = data[i], g = data[i + 1], b = data[i + 2];
  return (
    r > 185 && g > 185 && b > 185 &&
    Math.abs(r - g) < 14 && Math.abs(r - b) < 14 && Math.abs(g - b) < 14
  );
}

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

function vis(x, y) {
  if (x < 0 || y < 0 || x >= W || y >= H) return false;
  return !isBg[y * W + x];
}

function bbox(seedX, seedY, maxRadius = 60) {
  let sx = seedX, sy = seedY;
  if (!vis(sx, sy)) {
    for (let r = 1; r < maxRadius; r++) {
      let found = false;
      for (let dy = -r; dy <= r && !found; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (vis(seedX + dx, seedY + dy)) {
            sx = seedX + dx; sy = seedY + dy; found = true; break;
          }
        }
      }
      if (found) break;
    }
  }
  if (!vis(sx, sy)) return null;

  const st = [[sx, sy]];
  const seen = new Set([`${sx},${sy}`]);
  let minX = sx, maxX = sx, minY = sy, maxY = sy;

  while (st.length) {
    const [x, y] = st.pop();
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      const k = `${nx},${ny}`;
      if (seen.has(k) || !vis(nx, ny)) continue;
      seen.add(k);
      st.push([nx, ny]);
    }
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, px: seen.size };
}

const defaults = [
  ["panel", 100, 100],
  ["panel-square", 700, 100],
  ["divider", 100, 360],
  ["btn", 100, 420],
  ["btn-hover", 100, 480],
  ["btn-active", 100, 550],
  ["btn-disabled", 100, 610],
  ["btn-close", 1180, 530],
  ["slot-common", 720, 930],
  ["slot-uncommon", 810, 930],
  ["slot-rare", 900, 930],
  ["slot-epic", 980, 930],
  ["slot-legendary", 1060, 930],
  ["slot-empty", 550, 930],
  ["tab-active", 280, 710],
  ["tab-inactive", 380, 710],
  ["bar-hp", 140, 700],
  ["bar-mp", 370, 700],
  ["bar-xp", 600, 700],
  ["bar-hp-empty", 140, 750],
  ["checkbox", 610, 670],
  ["checkbox-checked", 685, 670],
  ["panel-tall", 850, 750],
  ["btn-sm", 610, 660],
  ["btn-sm-active", 685, 660],
  ["icon-backpack", 120, 980],
  ["icon-sword", 280, 980],
  ["icon-shield", 350, 980],
  ["portrait-frame", 550, 850],
];

for (const [name, x, y] of defaults) {
  console.log(`${name}:`, JSON.stringify(bbox(Number(x), Number(y))));
}
