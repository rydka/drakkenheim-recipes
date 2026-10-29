// M2 (fabricate): translation validity on the SRD corpus, 702 objects x 5 draws, both resolution modes.
// Independent invariants: tests/helpers/fabricate-invariants.mjs. Never fails npm test.
// Usage: node tests/metrics/m2-fabricate.mjs [--out=<file.json>]
import fs from "node:fs";
import { translateRecipe } from "../../scripts/core/fabricate-translate.mjs";
import { generateRecipe } from "../../scripts/core/generate.mjs";
import { mulberry32 } from "../../scripts/core/rng.mjs";
import { checkTranslation } from "../helpers/fabricate-invariants.mjs";
import { loadCorpus, OPTIONS } from "../helpers/items.mjs";

const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6);
const corpus = loadCorpus();
const DRAWS = 5;
let total = 0, ok = 0;
const failures = [];
corpus.forEach((item, idx) => {
  for (let k = 0; k < DRAWS; k++) {
    for (const mode of ["routedByIngredients", "simple"]) {
      total++;
      const ctx = { lang: "en", mode, systemId: "sys-1" };
      let bad;
      try {
        const recipe = generateRecipe(item, OPTIONS, mulberry32(idx * DRAWS + k));
        bad = checkTranslation(recipe, translateRecipe(recipe, ctx), ctx);
      } catch (e) { bad = [`exception ${e.message}`]; }
      if (!bad.length) ok++;
      else if (failures.length < 100) failures.push({ item: item.name, seed: idx * DRAWS + k, mode, bad });
    }
  }
});
const result = { metric: "M2-fabricate", objects: corpus.length, draws: DRAWS, translations: total, valid: ok, rate: ok / total, failures };
console.log(`M2 (Fabricate translation): ${(result.rate * 100).toFixed(2)} % (${ok}/${total}) on ${corpus.length} objects x ${DRAWS} draws x 2 modes`);
if (out) fs.writeFileSync(out, JSON.stringify(result, null, 1));
