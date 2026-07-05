import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
const SRC = path.resolve(import.meta.dirname, "../assets/array_img.png");
const OUT = path.resolve(import.meta.dirname, "../tools/crops");
const png = PNG.sync.read(fs.readFileSync(SRC));
const { width: W, data } = png;
function crop(name, x, y, w, h) {
  const out = new PNG({ width: w, height: h });
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
    const si = ((y + dy) * W + (x + dx)) * 4, di = (dy * w + dx) * 4;
    out.data[di]=data[si]; out.data[di+1]=data[si+1]; out.data[di+2]=data[si+2]; out.data[di+3]=data[si+3];
  }
  fs.writeFileSync(path.join(OUT, `${name}.png`), PNG.sync.write(out));
}
crop("slot-common2", 703, 810, 74, 72);
crop("stat-hp2", 22, 1138, 280, 48);
crop("stat-mp2", 22, 1138, 280, 48);
crop("tab-nav", 808, 728, 90, 34);
crop("tab-nav-active", 900, 728, 90, 34);
console.log("ok");
