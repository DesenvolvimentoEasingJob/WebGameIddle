#!/usr/bin/env node
/**
 * Gera backend/SkySpire.Api/GameData/loot/rarities.json a partir de rarity-tiers.json
 * Uso: node tools/generate-rarities.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const tiersPath = join(root, "backend/SkySpire.Api/GameData/loot/rarity-tiers.json");
const outPath = join(root, "backend/SkySpire.Api/GameData/loot/rarities.json");

const tiers = JSON.parse(readFileSync(tiersPath, "utf8"));

const DROP_START = 2_112_000_000;
const DROP_RATIO = 0.736;
const TOP_WEIGHT = 1;

function buildDropWeights(count) {
  const weights = [];
  let w = DROP_START;
  for (let i = 0; i < count - 1; i++) {
    weights.push(Math.max(1, Math.floor(w)));
    w *= DROP_RATIO;
  }
  weights.push(TOP_WEIGHT);
  return weights;
}

const dropWeights = buildDropWeights(tiers.length);

function statMultiplier(order) {
  if (order <= 0) return 1;
  const mult = 1 + order * 0.02 + Math.floor(order / 10) * 0.05 + Math.floor(order / 25) * 0.1;
  return Math.min(mult, 50);
}

function dropWeight(order) {
  return dropWeights[order];
}

function affixRolls(order) {
  if (order <= 0) return [0, 0];
  const min = Math.max(1, Math.floor((order + 1) / 2) - 1);
  const max = Math.min(12, Math.max(min, Math.floor((order + 1) / 2)));
  return [min, max];
}

const rarities = {};
for (let i = 0; i < tiers.length; i++) {
  const tier = tiers[i];
  const [affixMin, affixMax] = affixRolls(i);
  rarities[tier.id] = {
    order: i,
    label: tier.label,
    baseStatMultiplier: Math.round(statMultiplier(i) * 1000) / 1000,
    dropWeight: dropWeight(i),
    affixRolls: [affixMin, affixMax],
  };
}

const output = { rarities };
writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n", "utf8");

const weights = dropWeights;
const total = weights.reduce((a, b) => a + b, 0);
const top = weights[weights.length - 1];
console.log(`Generated ${tiers.length} rarities → ${outPath}`);
console.log(`Top tier weight: ${top} / ${total} ≈ 1 in ${Math.round(total / top).toLocaleString()}`);
