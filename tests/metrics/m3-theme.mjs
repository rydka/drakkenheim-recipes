// M3: thematic relevance on an annotated set. Never fails npm test.
// An object passes when, on each of 20 seeds, recipeMatches(recipe, expected) is true.
// Usage:
//   node tests/metrics/m3-theme.mjs --set=reference [--out=<file.json>]   (tests/fixtures/theme-reference.json)
//   node tests/metrics/m3-theme.mjs --set=<path to annotated json> [--out=...]
//     (the control set path is given by the tester at measurement time; it is not stored in this repository)
import fs from "node:fs";
import { createHash } from "node:crypto";
import { generateRecipe } from "../../scripts/core/generate.mjs";
import { mulberry32 } from "../../scripts/core/rng.mjs";
import { findExport } from "../helpers/load.mjs";
import { loadCorpus, OPTIONS, readFixture } from "../helpers/items.mjs";

const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const setArg = arg("set") ?? "reference";
const out = arg("out");
const sha = arg("sha"); // optional: expected SHA-256 of the annotated file, "<hash>" or path of a .sha256 file
const raw = setArg === "reference" ? null : fs.readFileSync(setArg);
const annotated = setArg === "reference" ? readFixture("theme-reference.json") : JSON.parse(raw.toString("utf8"));
let hashOk = null;
if (raw) {
  const actual = createHash("sha256").update(raw).digest("hex");
  if (sha) {
    const expected = (fs.existsSync(sha) ? fs.readFileSync(sha, "utf8") : sha).trim().split(/\s+/)[0];
    hashOk = actual === expected;
    if (!hashOk) console.error(`WARNING: control set hash ${actual} differs from the committed fingerprint`);
  }
}
const recipeMatches = await findExport("recipeMatches");
const corpus = loadCorpus();
const results = [];
for (const entry of annotated) {
  const item = corpus.find((i) => i.name === entry.name && (!entry.rarity || i.system.rarities[0] === entry.rarity));
  if (!item) { results.push({ name: entry.name, error: "not in corpus", pass: false }); continue; }
  let good = 0;
  for (let k = 0; k < 20; k++) {
    const r = generateRecipe(item, OPTIONS, mulberry32(9000 + k));
    if (recipeMatches(r, entry.expected)) good++;
  }
  results.push({ name: entry.name, matches: good, of: 20, pass: good === 20 });
}
const passed = results.filter((r) => r.pass).length;
const summary = {
  metric: "M3", set: setArg === "reference" ? "reference" : "control", objects: annotated.length, passed,
  rate: passed / annotated.length, fingerprintMatches: hashOk, failed: results.filter((r) => !r.pass)
};
console.log(`M3 ${summary.set}: ${(summary.rate * 100).toFixed(1)} % (${passed}/${annotated.length})`);
for (const f of summary.failed) console.log(`  FAIL ${f.name} ${f.matches ?? ""}/${f.of ?? ""} ${f.error ?? ""}`);
if (out) fs.writeFileSync(out, JSON.stringify({ ...summary, results }, null, 1));
