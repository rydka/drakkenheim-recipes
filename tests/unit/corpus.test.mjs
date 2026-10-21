// M2 support: the SRD corpus is large and varied, and C3-C6 hold on it (one generation per object here;
// the 20-generation measure is tests/metrics/m2-invariants.mjs and never fails npm test).
import { describe, expect, it } from "vitest";
import { generateRecipe } from "../../scripts/core/generate.mjs";
import { isEligible, classifyItem } from "../../scripts/core/classify.mjs";
import { mulberry32 } from "../../scripts/core/rng.mjs";
import { loadCorpus, OPTIONS } from "../helpers/items.mjs";
import { checkRecipe, definiteKind, rarityOf, TIER_KEYS } from "../helpers/invariants.mjs";

const corpus = loadCorpus();

describe("SRD corpus", () => {
  it("has at least 150 magic items covering every rarity and item type", () => {
    expect(corpus.length).toBeGreaterThanOrEqual(150);
    const rarities = new Set(corpus.map(rarityOf));
    for (const t of TIER_KEYS) expect(rarities.has(t), t).toBe(true);
    expect(new Set(corpus.map((i) => i.type))).toEqual(new Set(["weapon", "equipment", "consumable", "container"]));
    const kinds = new Set(corpus.map(definiteKind).filter(Boolean));
    for (const k of ["weapon", "armor", "shield", "worn", "jewelry", "potion", "scroll", "ammo", "other"]) expect(kinds.has(k), k).toBe(true);
  });

  it("every object is eligible (C1 code part)", () => {
    expect(corpus.filter((i) => !isEligible(i)).map((i) => i.name)).toEqual([]);
  });

  it("classifyItem agrees with the unambiguous kinds", () => {
    const bad = corpus.filter((i) => { const k = definiteKind(i); return k && classifyItem(i).kind !== k; }).map((i) => i.name);
    expect(bad).toEqual([]);
  });

  it("C3-C6 hold on every object (1 generation each)", () => {
    const failures = [];
    corpus.forEach((item, idx) => {
      const r = generateRecipe(item, OPTIONS, mulberry32(idx * 20));
      const { hard } = checkRecipe(item, r, OPTIONS.counts);
      if (hard.length) failures.push(`${item.name}: ${hard.join("; ")}`);
    });
    expect(failures.slice(0, 20)).toEqual([]);
  });
});
