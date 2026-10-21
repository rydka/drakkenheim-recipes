// C3 (tiers), C5 (counts), supporting rule tables and the seeded RNG.
import { describe, expect, it } from "vitest";
import { TIERS, DEFAULT_COUNTS, resolveTier } from "../../scripts/rules/tiers.mjs";
import { parseCounts } from "../../scripts/core/counts.mjs";
import { mulberry32, pick, shuffle, weightedPick } from "../../scripts/core/rng.mjs";
import { CR, PRICE, TIER_KEYS } from "../helpers/invariants.mjs";

const keyOf = (t) => (typeof t === "string" ? t : t == null ? null : (t.key ?? t.id ?? Object.keys(TIERS).find((k) => TIERS[k] === t)));

describe("C3 tiers table", () => {
  it("has the five tiers with the book CR ranges and the Appendix D prices", () => {
    expect(Object.keys(TIERS)).toEqual(TIER_KEYS);
    for (const k of TIER_KEYS) {
      expect(TIERS[k].cr, k).toBe(CR[k]);
      expect(TIERS[k].price, k).toBe(PRICE[k]);
    }
  });

  it("uses a half-width en dash (U+2013) in the ranges", () => {
    expect(TIERS.rare.cr).toContain("–");
    expect(TIERS.rare.cr).not.toContain("-");
  });

  it.each(TIER_KEYS)("resolveTier(%s) returns that tier", (k) => {
    expect(keyOf(resolveTier(k))).toBe(k);
  });

  it("treats artifact as legendary", () => {
    expect(keyOf(resolveTier("artifact"))).toBe("legendary");
  });

  it.each(["", undefined, null, "mythic"])("resolveTier(%j) is null", (v) => {
    expect(resolveTier(v)).toBeNull();
  });
});

describe("C5 default counts and parseCounts", () => {
  it("defaults are 4/4/5/6/7 (permanent) and 3/3/3/4/4 (consumable)", () => {
    expect(DEFAULT_COUNTS).toEqual({ permanent: [4, 4, 5, 6, 7], consumable: [3, 3, 3, 4, 4] });
  });

  it("parses a valid setting string", () => {
    expect(parseCounts("4/4/5/6/7", [1, 1, 1, 1, 1])).toEqual([4, 4, 5, 6, 7]);
    expect(parseCounts("2/3/4/5/10", [1, 1, 1, 1, 1])).toEqual([2, 3, 4, 5, 10]);
  });

  it("clamps values to 2..10", () => {
    expect(parseCounts("1/20/5/6/7", [9, 9, 9, 9, 9])).toEqual([2, 10, 5, 6, 7]);
  });

  it.each(["", "abc", "4/5", "4/4/5/6/7/8", "a/b/c/d/e", undefined, null])("falls back to the default for %j", (v) => {
    const fb = [3, 3, 3, 4, 4];
    expect(parseCounts(v, fb)).toEqual(fb);
  });
});

describe("mulberry32 and helpers", () => {
  it("is reproducible and within [0, 1)", () => {
    const a = mulberry32(42), b = mulberry32(42);
    const seqA = Array.from({ length: 50 }, () => a());
    const seqB = Array.from({ length: 50 }, () => b());
    expect(seqA).toEqual(seqB);
    for (const v of seqA) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });

  it("different seeds give different sequences", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it("pick returns members, shuffle keeps the multiset, weightedPick respects zero weights", () => {
    const rng = mulberry32(7);
    const list = ["a", "b", "c", "d"];
    for (let i = 0; i < 30; i++) expect(list).toContain(pick(rng, list));
    expect([...shuffle(rng, list)].sort()).toEqual(list);
    expect(list).toEqual(["a", "b", "c", "d"]);
    // entries format is not fixed by the design: accept { value, weight } or [value, weight]
    const w = weightedPick(rng, [{ value: "x", weight: 0 }, { value: "y", weight: 5 }])
      ?? weightedPick(rng, [["x", 0], ["y", 5]]);
    expect(w?.value ?? w).toBe("y");
  });
});
