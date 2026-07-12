#!/usr/bin/env node
/**
 * Simula distribuição de raridades com os pesos de rarities.json
 * Uso: node tools/simulate-drops.mjs [iterations]
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const iterations = Number(process.argv[2] ?? 1_000_000);
const __dirname = dirname(fileURLToPath(import.meta.url));
const raritiesPath = join(__dirname, "../backend/SkySpire.Api/GameData/loot/rarities.json");
const data = JSON.parse(readFileSync(raritiesPath, "utf8"));

const entries = Object.entries(data.rarities)
  .map(([id, r]) => ({ id, label: r.label, order: r.order, weight: r.dropWeight }))
  .sort((a, b) => a.order - b.order);

const total = entries.reduce((s, e) => s + e.weight, 0);
const counts = Object.fromEntries(entries.map((e) => [e.id, 0]));

for (let i = 0; i < iterations; i++) {
  let roll = Math.random() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) {
      counts[entry.id]++;
      break;
    }
  }
}

console.log(`Simulação: ${iterations.toLocaleString()} drops\n`);
for (const entry of entries.filter((e) => counts[e.id] > 0).slice(0, 15)) {
  const pct = ((counts[entry.id] / iterations) * 100).toFixed(4);
  console.log(`${entry.label.padEnd(22)} ${pct}%`);
}
console.log("…");
const top = entries[entries.length - 1];
const topPct = ((counts[top.id] / iterations) * 100);
console.log(`${top.label.padEnd(22)} ${topPct.toFixed(10)}% (≈ 1 in ${Math.round(iterations / Math.max(1, counts[top.id])).toLocaleString()})`);
