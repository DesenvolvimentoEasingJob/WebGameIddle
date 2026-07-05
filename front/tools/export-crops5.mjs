import fs from "node:fs"; import path from "node:path"; import { PNG } from "pngjs";
const SRC = path.resolve(import.meta.dirname, "../assets/array_img.png");
const png = PNG.sync.read(fs.readFileSync(SRC)); const { width: W, data } = png;
function crop(name, x, y, w, h) {
  const out = new PNG({ width: w, height: h });
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
    const si = ((y + dy) * W + (x + dx)) * 4, di = (dy * w + dx) * 4;
    out.data[di]=data[si]; out.data[di+1]=data[si+1]; out.data[di+2]=data[si+2]; out.data[di+3]=data[si+3];
  }
  fs.writeFileSync(path.join(OUT, `${name}.png`), PNG.sync.write(out));
}
const OUT = path.resolve(import.meta.dirname, "../tools/crops");
crop("row-bars", 22, 1134, 420, 56);
crop("row-bars2", 940, 1134, 280, 56);
console.log("ok");
