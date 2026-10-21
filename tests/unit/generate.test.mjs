// C3-C6, C8, C10 (data schema): the generator, with fixed seeds.
import { describe, expect, it } from "vitest";
import { generateRecipe, regenerateRecipe } from "../../scripts/core/generate.mjs";
import { renderLine } from "../../scripts/core/render.mjs";
import { mulberry32 } from "../../scripts/core/rng.mjs";
import { makeItem, OPTIONS } from "../helpers/items.mjs";
import { ANIMUS_TYPES, checkRecipe, CR, TIER_KEYS } from "../helpers/invariants.mjs";

const SEEDS = Array.from({ length: 20 }, (_, i) => 1000 + i);
const gen = (item, seed, opts = {}) => generateRecipe(item, { ...OPTIONS, ...opts }, mulberry32(seed));

const SAMPLES = [
  makeItem({ name: "Longsword +1", type: "weapon", subtype: "martialM" }),
  makeItem({ name: "Plate Armor +1", type: "equipment", subtype: "heavy" }),
  makeItem({ name: "Shield +1", type: "equipment", subtype: "shield" }),
  makeItem({ name: "Boots of Speed", type: "equipment", subtype: "wondrous" }),
  makeItem({ name: "Ring of Protection", type: "equipment", subtype: "ring" }),
  makeItem({ name: "Wand of Web", type: "equipment", subtype: "wand" }),
  makeItem({ name: "Potion of Healing", type: "consumable", subtype: "potion" }),
  makeItem({ name: "Spell Scroll", type: "consumable", subtype: "scroll" }),
  makeItem({ name: "Arrow +1", type: "consumable", subtype: "ammo" }),
  makeItem({ name: "Bag of Holding", type: "container" }),
  makeItem({ name: "Thieves' Tools", type: "tool" })
];

describe("determinism", () => {
  it("same seed -> identical recipe; seeds differ somewhere", () => {
    const item = SAMPLES[0];
    expect(gen(item, 5)).toEqual(gen(item, 5));
    const distinct = new Set(SEEDS.map((s) => JSON.stringify(gen(item, s).components)));
    expect(distinct.size).toBeGreaterThan(5);
  });
});

describe("C3 rarity and CR range", () => {
  it.each(TIER_KEYS)("tier %s: workshop, crRange and every component", (tier) => {
    for (const item of SAMPLES) {
      const it2 = { ...item, system: { ...item.system, rarities: [tier] } };
      for (const seed of SEEDS.slice(0, 5)) {
        const r = gen(it2, seed);
        expect(r.workshop).toBe(tier);
        expect(r.crRange).toBe(CR[tier]);
        expect(r.rarity).toBe(tier);
        for (const c of r.components) expect(c.rarity).toBe(tier);
      }
    }
  });

  it("artifact is treated as legendary (CR 17+) and the object rarity is kept", () => {
    const r = gen(makeItem({ rarities: ["artifact"] }), 1);
    expect(r.workshop).toBe("legendary");
    expect(r.crRange).toBe("17+");
    expect(r.rarity).toBe("artifact");
  });

  it("every rendered line carries the matching (CR ...) suffix", () => {
    for (const tier of TIER_KEYS) {
      const r = gen(makeItem({ rarities: [tier] }), 3);
      for (const c of r.components) expect(renderLine(c, r, "en").endsWith(`(CR ${CR[tier]})`)).toBe(true);
    }
  });

  it("with several rarities, the first (lowest) is the default; options.rarity overrides it", () => {
    const item = makeItem({ rarities: ["uncommon", "rare"] });
    expect(gen(item, 1).workshop).toBe("uncommon");
    const r = gen(item, 1, { rarity: "rare" });
    expect(r.workshop).toBe("rare");
    expect(r.components.every((c) => c.rarity === "rare")).toBe(true);
  });

  it("throws for an item without rarity", () => {
    expect(() => gen(makeItem({ rarities: [] }), 1)).toThrow();
  });
});

describe("C4 exactly one Animus, first, valid type", () => {
  it("holds for every sample, tier and seed", () => {
    for (const item of SAMPLES) for (const tier of TIER_KEYS) for (const seed of SEEDS.slice(0, 4)) {
      const r = gen({ ...item, system: { ...item.system, rarities: [tier] } }, seed);
      expect(r.components.filter((c) => c.category === "animus")).toHaveLength(1);
      expect(r.components[0].category).toBe("animus");
      for (const t of r.components[0].creatureTypes) {
        expect(ANIMUS_TYPES).toContain(t.type);
        expect(["beast", "humanoid"]).not.toContain(t.type);
      }
    }
  });
});

describe("C5 number of components", () => {
  const permanent = makeItem({ name: "Longsword +1", type: "weapon", subtype: "martialM" });
  const consumable = makeItem({ name: "Potion of Healing", type: "consumable", subtype: "potion" });
  const wantPerm = [4, 4, 5, 6, 7], wantCons = [3, 3, 3, 4, 4];

  it.each(TIER_KEYS.map((t, i) => [t, i]))("default counts at %s", (tier, i) => {
    for (const seed of SEEDS.slice(0, 5)) {
      expect(gen({ ...permanent, system: { ...permanent.system, rarities: [tier] } }, seed).components).toHaveLength(wantPerm[i]);
      expect(gen({ ...consumable, system: { ...consumable.system, rarities: [tier] } }, seed).components).toHaveLength(wantCons[i]);
    }
  });

  it("every consumable subtype counts as consumable", () => {
    for (const subtype of ["potion", "scroll", "ammo", "poison", "food", "wand", "rod", "trinket"]) {
      expect(gen(makeItem({ type: "consumable", subtype, rarities: ["rare"] }), 2).components).toHaveLength(3);
      expect(gen(makeItem({ type: "consumable", subtype, rarities: ["veryRare"] }), 2).components).toHaveLength(4);
    }
  });

  it("custom counts are honoured", () => {
    const counts = { permanent: [2, 3, 8, 9, 10], consumable: [2, 5, 6, 7, 8] };
    expect(gen({ ...permanent, system: { ...permanent.system, rarities: ["rare"] } }, 1, { counts }).components).toHaveLength(8);
    expect(gen({ ...consumable, system: { ...consumable.system, rarities: ["uncommon"] } }, 1, { counts }).components).toHaveLength(5);
  });

  it("the result is always clamped between 2 and 10", () => {
    const counts = { permanent: [0, 1, 11, 99, -4], consumable: [0, 1, 11, 99, -4] };
    for (const [i, tier] of TIER_KEYS.entries()) {
      const n = gen(makeItem({ rarities: [tier] }), 1, { counts }).components.length;
      expect(n, tier).toBe([2, 2, 10, 10, 2][i]);
    }
  });
});

describe("C6 categories and designations", () => {
  it("respects the plan of each kind (independent check), at most two per category", () => {
    for (const item of SAMPLES) for (const tier of TIER_KEYS) for (const seed of SEEDS) {
      const it2 = { ...item, system: { ...item.system, rarities: [tier] } };
      const { hard } = checkRecipe(it2, gen(it2, seed), OPTIONS.counts);
      expect(hard, `${item.name} ${tier} seed ${seed}`).toEqual([]);
    }
  });

  it("the primary categories of the weapon plan are always present (rare: 4 non-animus)", () => {
    const item = makeItem({ name: "Longsword +1", type: "weapon", subtype: "martialM", rarities: ["rare"] });
    for (const seed of SEEDS) {
      const cats = gen(item, seed).components.slice(1).map((c) => c.category);
      expect(cats).toEqual(expect.arrayContaining(["bones", "naturalWeapon", "hide", "fluid"]));
    }
  });

  it("potions get Fluid and Organ; scrolls Fluid and Hide; ammunition Natural Weapon and Bones", () => {
    const cats = (o, s) => gen(makeItem(o), s).components.slice(1).map((c) => c.category);
    for (const seed of SEEDS) {
      expect(cats({ type: "consumable", subtype: "potion" }, seed)).toEqual(expect.arrayContaining(["fluid", "organ"]));
      expect(cats({ type: "consumable", subtype: "poison" }, seed)).toEqual(expect.arrayContaining(["fluid", "organ"]));
      expect(cats({ type: "consumable", subtype: "scroll" }, seed)).toEqual(expect.arrayContaining(["fluid", "hide"]));
      expect(cats({ type: "consumable", subtype: "ammo" }, seed)).toEqual(expect.arrayContaining(["naturalWeapon", "bones"]));
    }
  });

  it("non-animus components are listed in alphabetical category order", () => {
    const order = ["bones", "dust", "fluid", "hair", "hide", "naturalWeapon", "organ"];
    for (const seed of SEEDS) {
      const idx = gen(makeItem({ rarities: ["legendary"] }), seed).components.slice(1).map((c) => order.indexOf(c.category));
      expect(idx).toEqual([...idx].sort((a, b) => a - b));
    }
  });

  it("the `other` plan draws from many categories across seeds", () => {
    const item = makeItem({ name: "Bag of Holding", type: "container", rarities: ["legendary"] });
    const seen = new Set();
    for (const seed of SEEDS) for (const c of gen(item, seed).components.slice(1)) seen.add(c.category);
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });

  it("custom `categories` are imposed (regeneration support)", () => {
    const item = makeItem({ name: "Longsword +1", type: "weapon", rarities: ["rare"] });
    const r = gen(item, 1, { categories: ["organ", "organ", "dust", "fluid"] });
    expect(r.components.slice(1).map((c) => c.category).sort()).toEqual(["dust", "fluid", "organ", "organ"]);
  });
});

describe("C10 data schema of the recipe (flag)", () => {
  it("has every documented field with the documented type", () => {
    const item = makeItem({ name: "Flame Tongue", rarities: ["rare"], subtype: "martialM" });
    const r = gen(item, 9);
    expect(r).toMatchObject({
      version: 1, lang: "en", itemName: "Flame Tongue", itemUuid: "Item.test0000", itemType: "weapon", kind: "weapon",
      consumable: false, rarity: "rare", workshop: "rare", crRange: "5–10", distinctSources: true,
      generatedAt: "2026-10-20T12:00:00.000Z"
    });
    expect(typeof r.theme).toBe("object");
    for (const c of r.components) {
      expect(typeof c.category).toBe("string");
      expect(c.designation === null || typeof c.designation === "string").toBe(true);
      expect(Array.isArray(c.creatureTypes)).toBe(true);
      expect(typeof c.rarity).toBe("string");
      expect(c.text).toBeNull();
    }
    expect(r.components[0]).toMatchObject({ category: "animus", designation: null });
  });

  it("is JSON-serialisable without loss (it is stored in a flag)", () => {
    const r = gen(makeItem({ name: "Frost Brand", damage: ["cold"] }), 11);
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });

  it("consumables have distinctSources false", () => {
    expect(gen(makeItem({ type: "consumable", subtype: "potion" }), 1).distinctSources).toBe(false);
  });
});

describe("C8 regenerateRecipe", () => {
  const items = SAMPLES.filter((i) => i.type !== "tool");

  it("keeps the categories, still satisfies C3-C6, and differs on at least one line", () => {
    for (const item of items) {
      let prev = gen(item, 77);
      for (let k = 0; k < 10; k++) {
        const next = regenerateRecipe(item, prev, OPTIONS, mulberry32(500 + k));
        expect(next.components.map((c) => c.category), item.name).toEqual(prev.components.map((c) => c.category));
        expect(checkRecipe(item, next, OPTIONS.counts).hard, item.name).toEqual([]);
        const sig = (r) => r.components.map((c) => `${c.category}|${c.designation}|${JSON.stringify(c.creatureTypes)}`).join(";");
        expect(sig(next), `${item.name} #${k}`).not.toBe(sig(prev));
        prev = next;
      }
    }
  });

  it("works with a themed item too", () => {
    const item = makeItem({ name: "Flame Tongue", damage: ["fire"] });
    const prev = gen(item, 1);
    const next = regenerateRecipe(item, prev, OPTIONS, mulberry32(2));
    expect(next.components.map((c) => c.category)).toEqual(prev.components.map((c) => c.category));
  });
});
