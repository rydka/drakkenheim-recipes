// C1 (eligibility, code part), classification used by C5 and C6.
import { describe, expect, it } from "vitest";
import { isEligible, classifyItem } from "../../scripts/core/classify.mjs";
import { makeItem } from "../helpers/items.mjs";

describe("C1 isEligible", () => {
  const types = ["weapon", "equipment", "consumable", "tool", "container"];
  const rarities = ["common", "uncommon", "rare", "veryRare", "legendary", "artifact"];

  for (const type of types) {
    it.each(rarities)(`${type} with rarity %s is eligible`, (r) => {
      expect(isEligible(makeItem({ type, rarities: [r] }))).toBe(true);
    });
    it(`${type} without rarity is not eligible`, () => {
      expect(isEligible(makeItem({ type, rarities: [] }))).toBe(false);
      expect(isEligible(makeItem({ type, rarities: [""] }))).toBe(false);
    });
  }

  it.each(["spell", "feat", "class", "subclass", "background", "race", "loot"])("type %s is never eligible", (type) => {
    expect(isEligible(makeItem({ type, rarities: ["rare"] }))).toBe(false);
  });

  it("an unknown rarity key is not eligible", () => {
    expect(isEligible(makeItem({ rarities: ["mythic"] }))).toBe(false);
  });

  it("reads the legacy single `rarity` field when `rarities` is missing", () => {
    const it0 = makeItem({});
    delete it0.system.rarities;
    it0.system.rarity = "rare";
    expect(isEligible(it0)).toBe(true);
  });
});

describe("classifyItem (C5 consumable flag, C6 kind)", () => {
  const c = (o) => classifyItem(makeItem(o));

  it.each([
    ["potion", "potion"], ["scroll", "scroll"], ["ammo", "ammo"], ["wand", "wand"], ["rod", "wand"],
    ["poison", "potion"], ["food", "other"], ["trinket", "other"], ["wondrous", "other"]
  ])("consumable/%s -> kind %s, consumable", (subtype, kind) => {
    expect(c({ type: "consumable", subtype, name: "Some Thing" })).toEqual({ kind, consumable: true });
  });

  it("weapons are weapons, except staffs which are wands", () => {
    expect(c({ type: "weapon", subtype: "martialM", name: "Flame Tongue" })).toEqual({ kind: "weapon", consumable: false });
    expect(c({ type: "weapon", name: "Staff of Fire" })).toEqual({ kind: "wand", consumable: false });
    expect(c({ type: "weapon", name: "Bâton de feu" })).toEqual({ kind: "wand", consumable: false });
  });

  it.each([
    ["light", "armor"], ["medium", "armor"], ["heavy", "armor"], ["natural", "armor"], ["shield", "shield"],
    ["clothing", "worn"], ["ring", "jewelry"], ["wand", "wand"], ["rod", "wand"]
  ])("equipment/%s -> %s", (subtype, kind) => {
    expect(c({ type: "equipment", subtype, name: "Some Thing" })).toEqual({ kind, consumable: false });
  });

  it.each([
    ["Boots of Speed", "worn"], ["Cloak of Protection", "worn"], ["Gauntlets of Ogre Power", "worn"], ["Belt of Dwarvenkind", "worn"],
    ["Helm of Telepathy", "worn"], ["Bottes de vitesse", "worn"], ["Gants de force", "worn"],
    ["Amulet of Health", "jewelry"], ["Circlet of Blasting", "jewelry"], ["Necklace of Fireballs", "jewelry"], ["Anneau de protection", "jewelry"],
    ["Wand of Web", "wand"], ["Rod of Alertness", "wand"], ["Baguette de feu", "wand"], ["Sceptre royal", "wand"],
    ["Bag of Holding", "other"], ["Crystal Ball", "other"]
  ])("wondrous equipment named %s -> %s", (name, kind) => {
    expect(c({ type: "equipment", subtype: "wondrous", name }).kind).toBe(kind);
    expect(c({ type: "equipment", subtype: "trinket", name }).kind).toBe(kind);
    expect(c({ type: "equipment", subtype: "", name }).kind).toBe(kind);
  });

  it.each(["tool", "container"])("%s -> other, not consumable", (type) => {
    expect(c({ type, name: "Handy Haversack" })).toEqual({ kind: "other", consumable: false });
  });
});
