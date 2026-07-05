/** Exporta recortes candidatos para validar coordenadas do atlas manualmente. */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const SRC = path.resolve(import.meta.dirname, "../assets/array_img.png");
const OUT = path.resolve(import.meta.dirname, "../tools/crops");
const png = PNG.sync.read(fs.readFileSync(SRC));
const { width: W, data } = png;

function crop(name, x, y, w, h) {
  const out = new PNG({ width: w, height: h });
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const si = ((y + dy) * W + (x + dx)) * 4;
      const di = (dy * w + dx) * 4;
      out.data[di] = data[si];
      out.data[di + 1] = data[si + 1];
      out.data[di + 2] = data[si + 2];
      out.data[di + 3] = data[si + 3];
    }
  }
  fs.writeFileSync(path.join(OUT, `${name}.png`), PNG.sync.write(out));
  console.log(`wrote ${name}.png (${x},${y} ${w}x${h})`);
}

fs.mkdirSync(OUT, { recursive: true });

const regions = [
  ["slot-common", 697, 888, 72, 72],
  ["slot-uncommon", 793, 888, 72, 72],
  ["slot-rare", 894, 888, 72, 72],
  ["slot-epic", 966, 888, 72, 72],
  ["slot-legendary", 1036, 888, 72, 72],
  ["slot-empty", 545, 888, 72, 72],
  ["tab-active", 23, 690, 205, 48],
  ["tab-inactive", 251, 690, 199, 48],
  ["tab-inactive2", 474, 690, 179, 48],
  ["bar-hp", 23, 690, 205, 48],
  ["bar-mp", 251, 690, 199, 48],
  ["bar-xp", 474, 690, 179, 48],
  ["bar-hp-track", 23, 750, 205, 48],
  ["checkbox", 609, 650, 60, 60],
  ["checkbox-checked", 682, 650, 60, 60],
  ["btn-icon", 609, 650, 60, 60],
  ["panel-tall", 806, 690, 270, 310],
  ["portrait-frame", 545, 820, 120, 120],
  ["icon-backpack", 100, 960, 64, 64],
  ["divider-gem", 17, 349, 306, 34],
  ["btn-short", 270, 395, 180, 62],
];

for (const [name, x, y, w, h] of regions) crop(name, x, y, w, h);
