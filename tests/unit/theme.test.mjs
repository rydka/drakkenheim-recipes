// C7: theme detection and its effect on the generated recipe; recipeMatches (M3 definition).
import { beforeAll, describe, expect, it } from "vitest";
import { detectTheme, plainText } from "../../scripts/core/theme.mjs";
import { generateRecipe } from "../../scripts/core/generate.mjs";
import { renderRecipeHtml } from "../../scripts/core/render.mjs";
import { mulberry32 } from "../../scripts/core/rng.mjs";
import { findExport } from "../helpers/load.mjs";
import { makeItem, OPTIONS } from "../helpers/items.mjs";

const SEEDS = Array.from({ length: 20 }, (_, i) => 3000 + i);
const gen = (item, seed) => generateRecipe(item, OPTIONS, mulberry32(seed));
const types = (theme) => theme.creatureTypes.map((t) => t.type);

// Own implementation of "at least one non-Animus component conforms".
function ownMatches(recipe, { creatureTypes = [], designations = [] }) {
  return recipe.components.slice(1).some((c) =>
    c.creatureTypes.some((t) => creatureTypes.includes(t.type)) || designations.includes(c.designation));
}

describe("C7 detectTheme", () => {
  it("returns an empty theme for an item without any clue", () => {
    const t = detectTheme(makeItem({ name: "Bag of Holding", type: "container", description: "<p>This bag has an interior space.</p>" }));
    expect(t.damageTypes).toEqual([]);
    expect(t.creatureTypes).toEqual([]);
    expect(t.designations).toEqual([]);
    expect(t.animal).toBe(false);
  });

  it("ignores physical damage types", () => {
    const t = detectTheme(makeItem({ name: "Longsword +1", damage: ["slashing"], activityTypes: ["piercing", "bludgeoning"] }));
    expect(t.damageTypes).toEqual([]);
  });

  it("reads damage types from activities", () => {
    expect(detectTheme(makeItem({ name: "Sword", activityTypes: ["fire"] })).damageTypes).toContain("fire");
  });

  it("reads damage types from system.damage.base", () => {
    expect(detectTheme(makeItem({ name: "Sword", damage: ["cold"] })).damageTypes).toContain("cold");
  });

  it.each([
    ["acid", "Acid Spitter"], ["necrotic", "Blade of Necrotic Doom"], ["radiant", "Radiant Mace"],
    ["psychic", "Psychic Helm"], ["force", "Force Cloak"], ["poison", "Poison Dagger"]
  ])("reads %s from the activity data", (dmg, name) => {
    expect(detectTheme(makeItem({ name, activityTypes: [dmg] })).damageTypes).toContain(dmg);
  });

  it.each([
    ["Frost Brand Dagger", "cold"], ["Flame Mace", "fire"], ["Lightning Cloak", "lightning"], ["Thunder Hammer", "thunder"],
    ["Venom Fang", "poison"], ["Sun Blade", "radiant"]
  ])("reads the damage theme from the name: %s", (name, dmg) => {
    expect(detectTheme(makeItem({ name })).damageTypes).toContain(dmg);
  });

  it("reads the damage theme from the description (whole words, bloc de recette ignored)", () => {
    const d = "<p>On a hit it deals an extra 1d6 fire damage.</p>";
    expect(detectTheme(makeItem({ name: "Odd Blade", description: d })).damageTypes).toContain("fire");
    const d2 = "<p>You have resistance to necrotic damage.</p>";
    expect(detectTheme(makeItem({ name: "Odd Ring", description: d2 })).damageTypes).toContain("necrotic");
  });

  it("does not match keywords inside longer words", () => {
    const t = detectTheme(makeItem({ name: "Odd Charm", description: "<p>A dragonfly and a fiendishly clever trick; undeadline.</p>" }));
    expect(types(t)).not.toContain("dragon");
  });

  it.each([
    ["Undead Bane", "undead"], ["Vampire Cloak", "undead"], ["Dragon Slayer", "dragon"], ["Fey Lantern", "fey"], ["Elven Boots", "fey"],
    ["Fiend Tongue", "fiend"], ["Demon Armor", "fiend"], ["Devil Horn", "fiend"], ["Giant Slayer", "giant"], ["Elemental Gem", "elemental"],
    ["Celestial Orb", "celestial"], ["Angel Wing", "celestial"], ["Aberration Eye", "aberration"], ["Construct Core", "construct"],
    ["Golem Heart", "construct"], ["Ooze Flask", "ooze"], ["Plant Seed", "plant"], ["Tree Staff", "plant"]
  ])("reads the creature type from the name: %s -> %s", (name, type) => {
    expect(types(detectTheme(makeItem({ name })))).toContain(type);
  });

  it.each([
    ["Anneau du mort-vivant", "undead"], ["Épée du dragon", "dragon"], ["Cape de fée", "fey"], ["Heaume du géant", "giant"],
    ["Cœur de golem", "construct"], ["Arbre ancien", "plant"], ["Lame de démon", "fiend"]
  ])("understands French names: %s", (name, type) => {
    expect(types(detectTheme(makeItem({ name })))).toContain(type);
  });

  it.each([["Épée de flamme", "fire"], ["Anneau de givre", "cold"], ["Marteau de foudre", "lightning"], ["Dague d'acide", "acid"]])(
    "understands French damage words: %s", (name, dmg) => {
      expect(detectTheme(makeItem({ name })).damageTypes).toContain(dmg);
    });

  it.each([["Cloak of the Wolf"], ["Ring of the Ram"], ["Slippers of Spider Climbing"], ["Staff of the Serpent"], ["Cloak of the Bat"]])(
    "flags animals: %s", (name) => {
      expect(detectTheme(makeItem({ name })).animal).toBe(true);
    });

  it("keeps at most 2 damage types and 2 creature types (distinct base types, variants aside)", () => {
    const dmg = detectTheme(makeItem({ name: "Odd Blade", activityTypes: ["fire", "cold", "acid", "poison"] }));
    expect(dmg.damageTypes.length).toBeLessThanOrEqual(2);
    const cre = detectTheme(makeItem({ name: "Dragon Giant Undead Fey Blade" }));
    expect(new Set(types(cre)).size).toBeLessThanOrEqual(2);
  });

  it("is deterministic", () => {
    const item = makeItem({ name: "Frost Brand", damage: ["cold"], description: "<p>fire damage</p>" });
    expect(detectTheme(item)).toEqual(detectTheme(item));
  });
});

describe("plainText", () => {
  it("strips tags and entities of tags", () => {
    expect(plainText("<p>Hello <em>big</em> world</p>")).toMatch(/^\s*Hello big world\s*$/);
  });
  it("removes the module recipe block", () => {
    const html = '<p>Intro.</p><p class="drakkenheim-recipes-recipe"><em><strong>Crafting.</strong></em> Creating a <em>X</em> requires a Rare Workshop and the following Rare Components:</p><ul class="drakkenheim-recipes-recipe"><li><p><strong>[Bones]</strong> Skull</p></li></ul>';
    const t = plainText(html);
    expect(t).toContain("Intro.");
    expect(t).not.toContain("Crafting");
    expect(t).not.toContain("Skull");
  });
});

describe("C7 generation reflects the theme", () => {
  const FIRE = { creatureTypes: ["elemental", "dragon"], designations: ["elementalFluid", "elementalDust"] };

  it("a fire weapon always has a conforming non-Animus component, and a typed Animus is of the theme", () => {
    const item = makeItem({ name: "Flame Tongue", subtype: "martialM", activityTypes: ["fire"], rarities: ["rare"] });
    for (const seed of SEEDS) {
      const r = gen(item, seed);
      expect(ownMatches(r, FIRE), `seed ${seed}`).toBe(true);
      const a = r.components[0].creatureTypes.map((t) => t.type);
      for (const t of a) expect(FIRE.creatureTypes).toContain(t);
    }
  });

  it("at least half of the non-Animus components follow the theme when the theme has creature types", () => {
    const item = makeItem({ name: "Flame Tongue", subtype: "martialM", activityTypes: ["fire"], rarities: ["legendary"] });
    for (const seed of SEEDS) {
      const rest = gen(item, seed).components.slice(1);
      const ok = rest.filter((c) => c.creatureTypes.some((t) => FIRE.creatureTypes.includes(t.type)) || FIRE.designations.includes(c.designation));
      expect(ok.length, `seed ${seed}`).toBeGreaterThanOrEqual(Math.ceil(rest.length / 2));
    }
  });

  it("a necrotic potion gets undead-ish parts; never `Undead Dust` for a fire sword", () => {
    const potion = makeItem({ name: "Potion of Necrotic Resistance", type: "consumable", subtype: "potion", rarities: ["rare"], description: "<p>resistance to necrotic damage</p>" });
    for (const seed of SEEDS) {
      expect(ownMatches(gen(potion, seed), { creatureTypes: ["undead", "fiend"], designations: ["undeadDust", "ectoplasm"] }), `seed ${seed}`).toBe(true);
    }
    const sword = makeItem({ name: "Flame Tongue", subtype: "martialM", activityTypes: ["fire"], rarities: ["rare"] });
    for (const seed of SEEDS) {
      const ds = gen(sword, seed).components.map((c) => c.designation);
      expect(ds).not.toContain("undeadDust");
      expect(ds).not.toContain("ectoplasm");
    }
  });

  it("a giant-themed item has a giant component", () => {
    const item = makeItem({ name: "Giant Slayer Axe", subtype: "martialM", rarities: ["rare"] });
    for (const seed of SEEDS) expect(ownMatches(gen(item, seed), { creatureTypes: ["giant"] }), `seed ${seed}`).toBe(true);
  });

  it("an animal-named item has beast or monstrosity parts", () => {
    const item = makeItem({ name: "Cloak of the Wolf", type: "equipment", subtype: "clothing", rarities: ["rare"] });
    for (const seed of SEEDS) expect(ownMatches(gen(item, seed), { creatureTypes: ["beast", "monstrosity"] }), `seed ${seed}`).toBe(true);
  });

  it("without a theme the Animus is `Any` and types come from animus-capable types", () => {
    const item = makeItem({ name: "Bag of Holding", type: "container", description: "<p>An interior space.</p>", rarities: ["rare"] });
    for (const seed of SEEDS) {
      const r = gen(item, seed);
      expect(r.components[0].creatureTypes).toEqual([]);
    }
  });

  it("an `Any` Animus renders as `Any <Rarity> Animus`", () => {
    const item = makeItem({ name: "Bag of Holding", type: "container", rarities: ["rare"] });
    const html = renderRecipeHtml(gen(item, 1), { lang: "en" });
    expect(html).toContain("<strong>[Animus]</strong> Any Rare Animus (CR 5–10)");
  });

  it("the recipe records the detected theme (informative field)", () => {
    const r = gen(makeItem({ name: "Flame Tongue", activityTypes: ["fire"] }), 1);
    expect(r.theme.damageTypes).toContain("fire");
  });
});

describe("recipeMatches", () => {
  let recipeMatches;
  beforeAll(async () => { recipeMatches = await findExport("recipeMatches"); });

  const comp = (category, designation, ...cts) => ({ category, designation, creatureTypes: cts.map((type) => ({ type })), rarity: "rare", text: null });
  const recipe = { components: [comp("animus", null, "dragon"), comp("bones", "skull", "giant"), comp("fluid", "elementalFluid")] };

  it("matches on a creature type of a non-Animus component", () => {
    expect(recipeMatches(recipe, { creatureTypes: ["giant"] })).toBe(true);
  });
  it("matches on a designation", () => {
    expect(recipeMatches(recipe, { designations: ["elementalFluid"] })).toBe(true);
  });
  it("ignores the Animus", () => {
    expect(recipeMatches(recipe, { creatureTypes: ["dragon"] })).toBe(false);
  });
  it("is false when nothing conforms", () => {
    expect(recipeMatches(recipe, { creatureTypes: ["undead"], designations: ["brain"] })).toBe(false);
  });
});
