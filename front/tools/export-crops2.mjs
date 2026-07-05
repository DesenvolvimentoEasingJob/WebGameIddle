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

fs.mkdirSync(OUT, { recursive: true });

const regions = [
  // rarity slots (from panel-tall analysis)
  ["slot-uncommon", 812, 768, 62, 62],
  ["slot-rare", 877, 768, 62, 62],
  ["slot-epic", 942, 768, 62, 62],
  ["slot-legendary", 1007, 768, 62, 62],
  ["slot-common", 747, 768, 62, 62],
  // bars in same panel column
  ["bar-fill", 808, 692, 268, 36],
  ["bar-track", 808, 732, 268, 36],
  // tabs top-right area
  ["tab-active", 808, 692, 88, 36],
  ["tab-star", 900, 692, 88, 36],
  ["tab-dark", 992, 692, 88, 36],
  // checkboxes left of tabs
  ["radio-empty", 609, 652, 58, 58],
  ["radio-filled", 682, 652, 58, 58],
  // portrait / compass
  ["portrait", 545, 830, 110, 110],
  // chest slot + banners row
  ["slot-chest", 808, 848, 62, 62],
  ["banner-blue", 877, 848, 62, 82],
  // icon buttons sword/shield
  ["icon-btn-sword", 609, 652, 58, 58],
  ["icon-btn-shield", 682, 652, 58, 58],
  // HP bars left column
  ["bar-hp-fill", 23, 692, 205, 44],
  ["bar-hp-track", 23, 742, 205, 44],
  ["bar-mp-fill", 251, 692, 199, 44],
  ["bar-xp-fill", 474, 692, 179, 44],
  // nav tabs middle
  ["nav-tab-a", 808, 730, 90, 34],
  ["nav-tab-b", 902, 730, 90, 34],
  ["nav-tab-c", 996, 730, 90, 34],
  // grey slot row bottom
  ["grey-slot-a", 697, 900, 66, 66],
  ["grey-slot-b", 770, 900, 66, 66],
  ["grey-slot-c", 843, 900, 66, 66],
  ["grey-slot-d", 916, 900, 66, 66],
  ["grey-slot-e", 989, 900, 66, 66],
];

for (const [name, x, y, w, h] of regions) crop(name, x, y, w, h);
console.log("done", regions.length);
