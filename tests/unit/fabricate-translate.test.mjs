// C3-C7 and the French names: pure translation Drakkenheim -> Fabricate (scripts/core/fabricate-translate.mjs).
// Expectations come from the specification and tests/helpers/fabricate-invariants.mjs, not from the module code.
import { describe, expect, it } from "vitest";
import {
  componentKey, componentSpecs, FABRICATE_DEFAULT_MODE, missingVocabulary, rarityTags, systemSpec, translateRecipe, workshopSpecs
} from "../../scripts/core/fabricate-translate.mjs";
import { renderRecipeText } from "../../scripts/core/render.mjs";
import { generateRecipe } from "../../scripts/core/generate.mjs";
import { mulberry32 } from "../../scripts/core/rng.mjs";
import { checkTranslation, expectedGroups } from "../helpers/fabricate-invariants.mjs";
import { loadCorpus, OPTIONS } from "../helpers/items.mjs";

const ROUTED = "routedByIngredients";
const comp = (category, rarity, designation = null, types = [], text = null) => ({
  category, designation, rarity, text, creatureTypes: types.map((t) => (typeof t === "string" ? { type: t } : t))
});
const recipeOf = (workshop, components, over = {}) => ({
  version: 1, lang: "en", itemName: "Test Blade", itemUuid: "Item.abc", itemType: "weapon", kind: "weapon", consumable: false,
  rarity: workshop, workshop, crRange: "5–10", distinctSources: true, theme: { damageTypes: [], creatureTypes: [] }, components, ...over
});
const ctxOf = (over = {}) => ({ lang: "en", mode: ROUTED, systemId: "sys-1", systemName: "Monsters of Drakkenheim", ...over });
const sorted = (a) => [...a].sort();

/** Flame Tongue-like recipe of the spec (scenario 1). */
const flameTongue = () => recipeOf("rare", [
  comp("animus", "rare"),
  comp("bones", "rare", "skull", ["dragon", "elemental"]),
  comp("naturalWeapon", "rare", "claws", ["monstrosity"]),
  comp("hide", "rare", "scales", ["dragon"]),
  comp("fluid", "rare", "elementalFluid", ["elemental"])
], { itemName: "Flame Tongue" });

describe("rarityTags", () => {
  it("returns the rarity and all lower ones, the rarity first", () => {
    expect(rarityTags("rare")[0]).toBe("rare");
    expect(sorted(rarityTags("rare"))).toEqual(["common", "rare", "uncommon"]);
    expect(rarityTags("common")).toEqual(["common"]);
    expect(sorted(rarityTags("veryRare"))).toEqual(["common", "rare", "uncommon", "very rare"]);
    expect(sorted(rarityTags("legendary"))).toEqual(["common", "legendary", "rare", "uncommon", "very rare"]);
  });
});

describe("C3: system data", () => {
  it("defaults to routedByIngredients", () => {
    expect(FABRICATE_DEFAULT_MODE).toBe(ROUTED);
  });

  it("systemSpec: name, mode, 8 component categories, 5 recipe categories, full tag vocabulary", () => {
    const s = systemSpec({ name: "Monsters of Drakkenheim", lang: "en" });
    const names = (list) => list.map((c) => (typeof c === "string" ? c : c.name ?? c.label));
    expect(s.name).toBe("Monsters of Drakkenheim");
    expect(s.resolutionMode).toBe(ROUTED);
    expect(sorted(names(s.componentCategories))).toEqual(
      sorted(["Animus", "Bones", "Dust", "Fluid", "Hair", "Hide", "Natural Weapon", "Organ"])
    );
    expect(sorted(names(s.categories))).toEqual(sorted(["Common", "Uncommon", "Rare", "Very Rare", "Legendary"]));
    for (const tag of ["animus", "bones", "natural weapon", "organ", "common", "very rare", "legendary", "giant", "undead", "ooze", "humanoid", "beast"]) {
      expect(s.itemTags, tag).toContain(tag);
    }
    expect(s.itemTags.every((t) => t === t.toLowerCase())).toBe(true);
  });

  it("translateRecipe returns the system spec with the mode of the context", () => {
    expect(translateRecipe(flameTongue(), ctxOf()).system.resolutionMode).toBe(ROUTED);
  });

  it("missingVocabulary: null when complete, only the missing entries otherwise", () => {
    const spec = systemSpec({ name: "X", lang: "en" });
    expect(missingVocabulary({ itemTags: [...spec.itemTags], componentCategories: [...spec.componentCategories], categories: [...spec.categories] }, spec)).toBeNull();
    const partial = {
      itemTags: spec.itemTags.filter((t) => t !== "giant"),
      componentCategories: spec.componentCategories.filter((c) => (typeof c === "string" ? c : c.name) !== "Bones"),
      categories: [...spec.categories]
    };
    const miss = missingVocabulary(partial, spec);
    expect(miss.itemTags).toContain("giant");
    expect(miss.itemTags).not.toContain("bones");
    expect(JSON.stringify(miss.componentCategories)).toContain("Bones");
    expect(miss.categories ?? []).toHaveLength(0);
  });

  it("missingVocabulary: a system with an empty vocabulary lacks everything", () => {
    const spec = systemSpec({ name: "X", lang: "en" });
    const miss = missingVocabulary({ itemTags: [], componentCategories: [], categories: [] }, spec);
    expect(miss.itemTags.length).toBe(spec.itemTags.length);
  });
});

describe("C4: generic component specs", () => {
  it("componentKey joins category, type and rarity as in the design example", () => {
    expect(componentKey({ category: "bones", rarity: "rare", type: "giant" })).toBe("bones|rare|giant");
  });

  it("names, categories and tags of the Flame Tongue example (English)", () => {
    const specs = componentSpecs(flameTongue(), { lang: "en" });
    const byName = Object.fromEntries(specs.map((s) => [s.name, s]));
    expect(Object.keys(byName).sort()).toEqual([
      "Rare Animus", "Rare Bones (Dragon)", "Rare Bones (Elemental)", "Rare Fluid (Elemental)", "Rare Hide (Dragon)",
      "Rare Natural Weapon (Monstrosity)"
    ]);
    expect(byName["Rare Bones (Dragon)"].categoryLabel).toBe("Bones");
    expect(sorted(byName["Rare Bones (Dragon)"].tags)).toEqual(["bones", "common", "dragon", "rare", "uncommon"]);
    expect(sorted(byName["Rare Animus"].tags)).toEqual(["animus", "common", "rare", "uncommon"]);
    expect(sorted(byName["Rare Natural Weapon (Monstrosity)"].tags)).toEqual(["common", "monstrosity", "natural weapon", "rare", "uncommon"]);
  });

  it("a very rare part also carries the lower rarities, and a common part only itself", () => {
    const specs = componentSpecs(recipeOf("veryRare", [comp("hair", "veryRare", "fur", ["beast"])]), { lang: "en" });
    expect(specs).toHaveLength(1);
    expect(specs[0].name).toBe("Very Rare Hair (Beast)");
    expect(sorted(specs[0].tags)).toEqual(["beast", "common", "hair", "rare", "uncommon", "very rare"]);
    const common = componentSpecs(recipeOf("common", [comp("organ", "common", "heart", ["beast"])]), { lang: "en" });
    expect(sorted(common[0].tags)).toEqual(["beast", "common", "organ"]);
  });

  it("the creature variant is ignored by the name and the tags", () => {
    const specs = componentSpecs(recipeOf("rare", [comp("naturalWeapon", "rare", "claws", [{ type: "dragon", variant: "red" }])]), { lang: "en" });
    expect(specs.map((s) => s.name)).toEqual(["Rare Natural Weapon (Dragon)"]);
    expect(specs[0].tags).not.toContain("red");
  });

  it("a bound designation gives its type: Undead Dust, Ectoplasm, Sap", () => {
    const r = recipeOf("rare", [comp("dust", "rare", "undeadDust"), comp("fluid", "rare", "ectoplasm"), comp("fluid", "rare", "sap")]);
    expect(componentSpecs(r, { lang: "en" }).map((s) => s.name).sort()).toEqual(
      ["Rare Dust (Undead)", "Rare Fluid (Plant)", "Rare Fluid (Undead)"]
    );
  });

  it("a part used by two lines is specified once", () => {
    const r = recipeOf("rare", [comp("bones", "rare", "skull", ["giant"]), comp("bones", "rare", "ribs", ["giant"])]);
    expect(componentSpecs(r, { lang: "en" })).toHaveLength(1);
  });

  it("a GM-edited line gives a category + rarity component without creature type", () => {
    const r = recipeOf("rare", [comp("bones", "rare", null, [], "Anything gross from a hag")]);
    const specs = componentSpecs(r, { lang: "en" });
    expect(specs.map((s) => s.name)).toEqual(["Rare Bones"]);
    expect(sorted(specs[0].tags)).toEqual(["bones", "common", "rare", "uncommon"]);
  });

  it("the description recalls the category, the rarity and the CR range", () => {
    const [spec] = componentSpecs(recipeOf("rare", [comp("bones", "rare", "skull", ["giant"])]), { lang: "en" });
    expect(spec.description).toMatch(/Bones/);
    expect(spec.description).toMatch(/Rare/);
    expect(spec.description).toContain("5–10");
  });
});

describe("French names (recipe language)", () => {
  it("components: category, rarity (singular), type", () => {
    const r = recipeOf("rare", [comp("bones", "rare", "skull", ["giant"]), comp("animus", "rare")], { lang: "fr" });
    const names = componentSpecs(r, { lang: "fr" }).map((s) => s.name).sort();
    expect(names).toEqual(["Animus Rare", "Os Rare (Géant)"]);
  });

  it("a multi-word French rarity and the workshop names", () => {
    const r = recipeOf("veryRare", [comp("naturalWeapon", "veryRare", "claws", ["dragon"])], { lang: "fr" });
    expect(componentSpecs(r, { lang: "fr" })[0].name).toBe("Arme naturelle Très rare (Dragon)");
    const tools = workshopSpecs(r, { lang: "fr" }).map((w) => w.name);
    expect(tools).toEqual(["Atelier Très rare", "Atelier Légendaire"]);
  });

  it("tags stay the English lowercase keys whatever the language", () => {
    const r = recipeOf("rare", [comp("naturalWeapon", "rare", "claws", ["giant"])], { lang: "fr" });
    expect(sorted(componentSpecs(r, { lang: "fr" })[0].tags)).toEqual(["common", "giant", "natural weapon", "rare", "uncommon"]);
  });

  it("the recipe category is the French rarity label", () => {
    const r = recipeOf("veryRare", [comp("animus", "veryRare")], { lang: "fr", itemName: "Épée" });
    expect(translateRecipe(r, ctxOf({ lang: "fr" })).recipeData.category).toBe("Très rare");
  });
});

describe("C5: workshop specs", () => {
  it("one tool per accepted workshop, from the recipe rarity up to legendary", () => {
    const w = workshopSpecs(flameTongue(), { lang: "en" });
    expect(w.map((x) => x.name)).toEqual(["Rare Workshop", "Very Rare Workshop", "Legendary Workshop"]);
    expect(w.map((x) => x.tier)).toEqual(["rare", "veryRare", "legendary"]);
    expect(w.every((x) => typeof x.description === "string")).toBe(true);
  });

  it("a legendary recipe needs the legendary workshop only; a common one all five", () => {
    expect(workshopSpecs(recipeOf("legendary", [comp("animus", "legendary")]), { lang: "en" }).map((x) => x.name)).toEqual(["Legendary Workshop"]);
    expect(workshopSpecs(recipeOf("common", [comp("animus", "common")]), { lang: "en" })).toHaveLength(5);
  });

  it("translateRecipe lists the same tools when routed and at least the exact one when simple", () => {
    expect(translateRecipe(flameTongue(), ctxOf()).tools.map((t) => t.name)).toEqual(["Rare Workshop", "Very Rare Workshop", "Legendary Workshop"]);
    expect(translateRecipe(flameTongue(), ctxOf({ mode: "simple" })).tools.map((t) => t.name)).toContain("Rare Workshop");
  });
});

describe("C6: recipe data", () => {
  it("name, category, description, system, result and Schematic link", () => {
    const r = flameTongue();
    const out = translateRecipe(r, ctxOf({ resultComponentId: "res-1", schematicUuid: "Item.schem", recipeItemId: "def-1" }));
    const d = out.recipeData;
    expect(d.name).toBe("Flame Tongue");
    expect(d.category).toBe("Rare");
    expect(d.craftingSystemId).toBe("sys-1");
    expect(d.description).toBe(renderRecipeText(r, { lang: "en" }));
    expect(d.resultGroups).toHaveLength(1);
    expect(d.resultGroups[0].results).toEqual([expect.objectContaining({ kind: "component", componentId: "res-1", quantity: 1 })]);
    expect(d.linkedRecipeItemUuid).toBe("Item.schem");
    expect(d.recipeItemId).toBe("def-1");
  });

  it("no Schematic -> no link", () => {
    const d = translateRecipe(flameTongue(), ctxOf()).recipeData;
    expect(d.linkedRecipeItemUuid ?? null).toBeNull();
    expect(d.recipeItemId ?? null).toBeNull();
  });

  it("missing ids get stable placeholders so the structure is testable", () => {
    const a = translateRecipe(flameTongue(), ctxOf()).recipeData;
    const b = translateRecipe(flameTongue(), ctxOf()).recipeData;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.resultGroups[0].results[0].componentId).toBeTruthy();
  });

  it("the description carries the `different monster` sentence and the edited lines, not for a consumable", () => {
    const edited = recipeOf("rare", [comp("animus", "rare"), comp("bones", "rare", null, [], "A hag's tooth, freshly pulled")]);
    const text = translateRecipe(edited, ctxOf()).recipeData.description;
    expect(text).toContain("Each item must come from a different monster.");
    expect(text).toContain("A hag's tooth, freshly pulled");
    expect(text).not.toMatch(/<[a-z]/i);
    const potion = recipeOf("rare", [comp("animus", "rare"), comp("fluid", "rare", "venom", ["beast"])], { consumable: true, distinctSources: false });
    expect(translateRecipe(potion, ctxOf()).recipeData.description).not.toContain("different monster");
  });
});

describe("renderRecipeText", () => {
  it("is plain text: header, one `- ` line per component, distinct sentence", () => {
    const r = flameTongue();
    const text = renderRecipeText(r, { lang: "en" });
    expect(text).toContain("Crafting");
    expect(text).toContain("Flame Tongue");
    expect(text.split("\n").filter((l) => l.startsWith("- "))).toHaveLength(5);
    expect(text).toContain("Each item must come from a different monster.");
    expect(text).not.toMatch(/<\/?(p|ul|li|em|strong)>/);
  });

  it("French text", () => {
    const text = renderRecipeText({ ...flameTongue(), lang: "fr" }, { lang: "fr" });
    expect(text).toContain("Artisanat");
    expect(text).toContain("Chaque Composant doit provenir d'un monstre différent.");
  });
});

describe("C7: ingredient sets and groups", () => {
  it("routed: one named set per accepted workshop, same groups, each requiring its workshop tool", () => {
    const toolIds = { rare: "T-r", veryRare: "T-v", legendary: "T-l" };
    const d = translateRecipe(flameTongue(), ctxOf({ toolIds })).recipeData;
    expect(d.ingredientSets.map((s) => s.id)).toEqual(["ds-rare", "ds-veryRare", "ds-legendary"]);
    expect(d.ingredientSets.map((s) => s.toolIds)).toEqual([["T-r"], ["T-v"], ["T-l"]]);
    expect(d.ingredientSets.every((s) => s.name)).toBe(true);
    expect(new Set(d.ingredientSets.map((s) => s.name)).size).toBe(3);
    expect(d.toolIds ?? []).toEqual([]);
    for (const s of d.ingredientSets) expect(s.ingredientGroups).toHaveLength(5);
  });

  it("routed: a legendary recipe has a single set", () => {
    expect(translateRecipe(recipeOf("legendary", [comp("animus", "legendary")]), ctxOf()).recipeData.ingredientSets).toHaveLength(1);
  });

  it("a multi-type line gives one option per type (OR), tags all-match, quantity 1", () => {
    const d = translateRecipe(recipeOf("rare", [comp("bones", "rare", "skull", ["dragon", "elemental"])]), ctxOf()).recipeData;
    const [group] = d.ingredientSets[0].ingredientGroups;
    expect(group.options).toHaveLength(2);
    expect(group.options.map((o) => sorted(o.match.tags).join(","))).toEqual(
      expect.arrayContaining(["bones,dragon,rare", "bones,elemental,rare"])
    );
    for (const o of group.options) {
      expect(o.match.type).toBe("tags");
      expect(o.match.tagMatch).toBe("all");
      expect(o.quantity).toBe(1);
    }
  });

  it("variants of the same type collapse into one option", () => {
    const r = recipeOf("rare", [comp("hide", "rare", "scales", [{ type: "dragon", variant: "red" }, { type: "dragon", variant: "blue" }])]);
    const [group] = translateRecipe(r, ctxOf()).recipeData.ingredientSets[0].ingredientGroups;
    expect(group.options).toHaveLength(1);
    expect(sorted(group.options[0].match.tags)).toEqual(["dragon", "hide", "rare"]);
  });

  it("a line without type has a single option (category + rarity)", () => {
    const [group] = translateRecipe(recipeOf("veryRare", [comp("animus", "veryRare")]), ctxOf()).recipeData.ingredientSets[0].ingredientGroups;
    expect(group.options).toHaveLength(1);
    expect(sorted(group.options[0].match.tags)).toEqual(["animus", "very rare"]);
  });

  it("two identical lines (different designations) give one group of quantity 2", () => {
    const r = recipeOf("rare", [comp("bones", "rare", "skull", ["giant"]), comp("bones", "rare", "ribs", ["giant"]), comp("hair", "rare", "fur", ["beast"])]);
    const groups = translateRecipe(r, ctxOf()).recipeData.ingredientSets[0].ingredientGroups;
    expect(groups).toHaveLength(2);
    const bones = groups.find((g) => g.options[0].match.tags.includes("bones"));
    expect(bones.options.every((o) => o.quantity === 2)).toBe(true);
    expect(groups.find((g) => g.options[0].match.tags.includes("hair")).options[0].quantity).toBe(1);
  });

  it("same category and rarity but different type sets stay separate", () => {
    const r = recipeOf("rare", [comp("bones", "rare", "skull", ["giant"]), comp("bones", "rare", "ribs", ["dragon"])]);
    expect(translateRecipe(r, ctxOf()).recipeData.ingredientSets[0].ingredientGroups).toHaveLength(2);
  });

  it("a bound designation takes its type as tag (Rare Dust (Undead))", () => {
    const r = recipeOf("rare", [comp("dust", "rare", "undeadDust"), comp("fluid", "rare", "sap")]);
    const groups = translateRecipe(r, ctxOf()).recipeData.ingredientSets[0].ingredientGroups;
    expect(groups.map((g) => sorted(g.options[0].match.tags).join(",")).sort()).toEqual(["dust,rare,undead", "fluid,plant,rare"]);
  });

  it("a GM-edited line becomes a category + rarity option and keeps its text as group name", () => {
    const text = "Something pulled from a hag";
    const r = recipeOf("rare", [comp("bones", "rare", null, [], text)]);
    const [group] = translateRecipe(r, ctxOf()).recipeData.ingredientSets[0].ingredientGroups;
    expect(group.name).toBe(text);
    expect(group.options).toHaveLength(1);
    expect(sorted(group.options[0].match.tags)).toEqual(["bones", "rare"]);
  });

  it("tags are lowercase English with spaces, whatever the recipe language", () => {
    const r = recipeOf("veryRare", [comp("naturalWeapon", "veryRare", "claws", ["monstrosity"])], { lang: "fr" });
    const d = translateRecipe(r, ctxOf({ lang: "fr" })).recipeData;
    expect(sorted(d.ingredientSets[0].ingredientGroups[0].options[0].match.tags)).toEqual(["monstrosity", "natural weapon", "very rare"]);
  });

  it("simple mode: a single set, the recipe requires the exact workshop only", () => {
    const d = translateRecipe(flameTongue(), ctxOf({ mode: "simple", toolIds: { rare: "T-r", veryRare: "T-v" } })).recipeData;
    expect(d.ingredientSets).toHaveLength(1);
    expect(d.toolIds).toEqual(["T-r"]);
    expect(d.ingredientSets[0].ingredientGroups).toHaveLength(5);
  });

  it("a rare Flame Tongue passes the independent checker in both modes", () => {
    for (const mode of [ROUTED, "simple"]) {
      const ctx = ctxOf({ mode });
      expect(checkTranslation(flameTongue(), translateRecipe(flameTongue(), ctx), ctx), mode).toEqual([]);
    }
  });
});

describe("independent checker is sensitive (guards the M2 measure)", () => {
  const ctx = ctxOf();
  const fresh = () => translateRecipe(flameTongue(), ctx);
  it("flags a dropped set, a wrong tag, a wrong tagMatch, a lost group, a wrong result quantity", () => {
    let o = fresh(); o.recipeData.ingredientSets.pop();
    expect(checkTranslation(flameTongue(), o, ctx).length).toBeGreaterThan(0);
    o = fresh(); o.recipeData.ingredientSets[0].ingredientGroups[0].options[0].match.tags = ["animus"];
    expect(checkTranslation(flameTongue(), o, ctx).length).toBeGreaterThan(0);
    o = fresh(); o.recipeData.ingredientSets[1].ingredientGroups[1].options[0].match.tagMatch = "any";
    expect(checkTranslation(flameTongue(), o, ctx).length).toBeGreaterThan(0);
    o = fresh(); o.recipeData.ingredientSets[2].ingredientGroups.pop();
    expect(checkTranslation(flameTongue(), o, ctx).length).toBeGreaterThan(0);
    o = fresh(); o.recipeData.resultGroups[0].results[0].quantity = 2;
    expect(checkTranslation(flameTongue(), o, ctx).length).toBeGreaterThan(0);
    o = fresh(); o.components = o.components.slice(1);
    expect(checkTranslation(flameTongue(), o, ctx).length).toBeGreaterThan(0);
  });
});

describe("C6-C7 on the SRD corpus (702 objects, one draw each; M2 measures 5 draws in tests/metrics/m2-fabricate.mjs)", () => {
  it("every translation satisfies the invariants in routed and simple modes", () => {
    const corpus = loadCorpus();
    expect(corpus.length).toBeGreaterThanOrEqual(700);
    const failures = [];
    corpus.forEach((item, idx) => {
      const recipe = generateRecipe(item, OPTIONS, mulberry32(idx * 5));
      for (const mode of [ROUTED, "simple"]) {
        const ctx = ctxOf({ mode });
        const bad = checkTranslation(recipe, translateRecipe(recipe, ctx), ctx);
        if (bad.length) failures.push({ item: item.name, mode, bad });
      }
    });
    expect(failures.slice(0, 5)).toEqual([]);
  });

  it("group count equals the number of distinct lines (independent count)", () => {
    const corpus = loadCorpus().slice(0, 100);
    for (const [idx, item] of corpus.entries()) {
      const recipe = generateRecipe(item, OPTIONS, mulberry32(idx));
      const groups = translateRecipe(recipe, ctxOf()).recipeData.ingredientSets[0].ingredientGroups;
      expect(groups.length, item.name).toBe(expectedGroups(recipe).length);
    }
  });
});
