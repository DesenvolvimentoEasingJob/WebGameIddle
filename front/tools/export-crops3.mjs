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
}

// 5-slot row from probe y=814
const slots = [
  ["slot-common", 703, 803, 76, 76],
  ["slot-uncommon", 785, 803, 72, 76],
  ["slot-rare", 867, 803, 72, 76],
  ["slot-epic", 948, 803, 72, 76],
  ["slot-legendary", 1028, 803, 76, 76],
];

for (const r of slots) crop(...r);

// bars from panel-tall top
crop("bar-fill", 808, 692, 268, 32);
crop("bar-track", 808, 728, 268, 32);

// tabs right side y~730
crop("tab-1", 808, 728, 88, 32);
crop("tab-2", 900, 728, 88, 32);
crop("tab-3", 992, 728, 88, 32);

// portrait frame
crop("portrait", 545, 830, 118, 118);

// checkbox row
crop("check-off", 609, 652, 58, 58);
crop("check-on", 682, 652, 58, 58);

// left status bars - try lower positions
crop("stat-hp", 40, 1150, 220, 36);
crop("stat-mp", 40, 1190, 220, 36);
crop("stat-xp", 280, 1150, 220, 36);

// empty slot grey
crop("slot-empty", 545, 888, 72, 72);

console.log("ok");
