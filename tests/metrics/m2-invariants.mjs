// M2: rule invariants (C3-C6) on the SRD corpus, 20 generations per object. Never fails npm test.
// Usage: node tests/metrics/m2-invariants.mjs [--out=<file.json>]
import fs from "node:fs";
import { generateRecipe } from "../../scripts/core/generate.mjs";
import { mulberry32 } from "../../scripts/core/rng.mjs";
import { loadCorpus, OPTIONS } from "../helpers/items.mjs";
import { checkRecipe } from "../helpers/invariants.mjs";

const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6);
const corpus = loadCorpus();
let total = 0, ok = 0, plausibilityOk = 0;
const failures = [], plaus = {};
corpus.forEach((item, idx) => {
  for (let k = 0; k < 20; k++) {
    total++;
    let res;
    try {
      res = checkRecipe(item, generateRecipe(item, OPTIONS, mulberry32(idx * 20 + k)), OPTIONS.counts);
    } catch (e) { res = { hard: [`exception ${e.message}`], plausibility: [] }; }
    if (!res.hard.length) ok++; else if (failures.length < 100) failures.push({ item: item.name, seed: idx * 20 + k, hard: res.hard });
    if (!res.plausibility.length) plausibilityOk++;
    for (const p of res.plausibility) plaus[p] = (plaus[p] ?? 0) + 1;
  }
});
const result = {
  metric: "M2", objects: corpus.length, generations: total, invariantsOk: ok, rate: ok / total,
  plausibilityRate: plausibilityOk / total, plausibilityViolations: plaus, failures
};
console.log(`M2: ${(result.rate * 100).toFixed(2)} % (${ok}/${total}) on ${corpus.length} objects; plausibility ${(result.plausibilityRate * 100).toFixed(2)} %`);
if (out) fs.writeFileSync(out, JSON.stringify(result, null, 1));
