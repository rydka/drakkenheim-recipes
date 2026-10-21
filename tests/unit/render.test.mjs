// C9 (exact book format), C10 (rebuildable from the flag), C15 (French rendering), C11 (Schematic data).
import { describe, expect, it } from "vitest";
import {
  englishArticle, frenchOf, renderLine, renderRecipeHtml, renderSchematicHtml, schematicName
} from "../../scripts/core/render.mjs";
import { buildSchematicData } from "../../scripts/core/schematic.mjs";
import { generateRecipe } from "../../scripts/core/generate.mjs";
import { mulberry32 } from "../../scripts/core/rng.mjs";
import { makeItem, OPTIONS } from "../helpers/items.mjs";
import { CR, PRICE, TIER_KEYS } from "../helpers/invariants.mjs";

const C = "drakkenheim-recipes-recipe";
const comp = (category, designation, creatureTypes, rarity, text = null) => ({ category, designation, creatureTypes, rarity, text });
const base = (over) => ({
  version: 1, lang: "en", itemName: "Dazing Hammer", itemUuid: "Item.abc", itemType: "weapon", kind: "weapon", consumable: false,
  rarity: "uncommon", workshop: "uncommon", crRange: "1–4", distinctSources: true, theme: { damageTypes: [], creatureTypes: [] },
  components: [], generatedAt: "2026-10-20T12:00:00.000Z", ...over
});

const G1 = base({
  components: [
    comp("animus", null, [], "uncommon"),
    comp("bones", "skull", [{ type: "giant" }], "uncommon"),
    comp("hide", "scales", [{ type: "dragon", variant: "red" }], "uncommon"),
    comp("naturalWeapon", "teeth", [{ type: "monstrosity" }], "uncommon")
  ]
});
const G1_HTML =
  `<p class="${C}"><em><strong>Crafting.</strong></em> Creating a <em>Dazing Hammer</em> requires an Uncommon Workshop and the following Uncommon Components:</p>` +
  `<ul class="${C}"><li><p><strong>[Animus]</strong> Any Uncommon Animus (CR 1–4)</p></li>` +
  `<li><p><strong>[Bones]</strong> Skull from an Uncommon Giant (CR 1–4)</p></li>` +
  `<li><p><strong>[Hide]</strong> Scales from an Uncommon Red Dragon (CR 1–4)</p></li>` +
  `<li><p><strong>[Natural Weapon]</strong> Teeth from an Uncommon Monstrosity (CR 1–4)</p></li></ul>` +
  `<p class="${C}">Each item must come from a different monster.</p>`;

const G2 = base({
  itemName: "Potion of Invisibility", itemType: "consumable", kind: "potion", consumable: true, rarity: "veryRare", workshop: "veryRare",
  crRange: "11–16", distinctSources: false,
  components: [
    comp("animus", null, [{ type: "aberration" }], "veryRare"),
    comp("fluid", "monsterBlood", [{ type: "fey" }, { type: "celestial" }], "veryRare"),
    comp("organ", "brain", [{ type: "undead" }], "veryRare"),
    comp("organ", null, [], "veryRare", "Eye of a <Beholder> & friends")
  ]
});
const G2_HTML =
  `<p class="${C}"><em><strong>Crafting.</strong></em> Creating a <em>Potion of Invisibility</em> requires a Very Rare Workshop and the following Very Rare Components:</p>` +
  `<ul class="${C}"><li><p><strong>[Animus]</strong> Animus from a Very Rare Aberration (CR 11–16)</p></li>` +
  `<li><p><strong>[Fluid]</strong> Monster Blood from a Very Rare Fey or Celestial (CR 11–16)</p></li>` +
  `<li><p><strong>[Organ]</strong> Brain from a Very Rare Undead (CR 11–16)</p></li>` +
  `<li><p><strong>[Organ]</strong> Eye of a &lt;Beholder&gt; &amp; friends</p></li></ul>`;

const G3 = base({
  itemName: "Boots of Speed", rarity: "legendary", workshop: "legendary", crRange: "17+",
  components: [comp("animus", null, [], "legendary"), comp("hide", "skin", [], "legendary")]
});
const G3_HTML =
  `<p class="${C}"><em><strong>Crafting.</strong></em> Creating <em>Boots of Speed</em> requires a Legendary Workshop and the following Legendary Components:</p>` +
  `<ul class="${C}"><li><p><strong>[Animus]</strong> Any Legendary Animus (CR 17+)</p></li>` +
  `<li><p><strong>[Hide]</strong> Any Legendary Skin (CR 17+)</p></li></ul>` +
  `<p class="${C}">Each item must come from a different monster.</p>`;

describe("C9 exact book format (golden cases)", () => {
  it("permanent item, uncommon, variants, distinct-source sentence", () => {
    expect(renderRecipeHtml(G1, { lang: "en" })).toBe(G1_HTML);
  });
  it("consumable, very rare, two types, edited line escaped, no distinct-source sentence", () => {
    expect(renderRecipeHtml(G2, { lang: "en" })).toBe(G2_HTML);
  });
  it("plural item name: no article; untyped designation line", () => {
    expect(renderRecipeHtml(G3, { lang: "en" })).toBe(G3_HTML);
  });
  it("escapes HTML in the item name", () => {
    const html = renderRecipeHtml(base({ itemName: "Rod <of> Tom & \"Jerry\"", components: [comp("animus", null, [], "uncommon")] }), { lang: "en" });
    expect(html).toContain("<em>Rod &lt;of&gt; Tom &amp; &quot;Jerry&quot;</em>");
    expect(html).not.toContain("<of>");
  });
  it("nameHtml overrides the italic name (used by the Schematic link)", () => {
    const html = renderRecipeHtml(G1, { lang: "en", nameHtml: "@UUID[Item.abc]{Dazing Hammer}" });
    expect(html).toContain("@UUID[Item.abc]{Dazing Hammer}");
  });
  it("the preview line equals the text between the category and the end of the list item", () => {
    const line = renderLine(G1.components[1], G1, "en");
    expect(line).toBe("Skull from an Uncommon Giant (CR 1–4)");
    expect(G1_HTML).toContain(`<strong>[Bones]</strong> ${line}</p>`);
  });
  it("the text between tags carries the book's category labels", () => {
    for (const cat of [["bones", "Bones"], ["dust", "Dust"], ["fluid", "Fluid"], ["hair", "Hair"], ["hide", "Hide"], ["naturalWeapon", "Natural Weapon"], ["organ", "Organ"]]) {
      const html = renderRecipeHtml(base({ components: [comp("animus", null, [], "uncommon"), comp(cat[0], null, [], "uncommon", "x")] }), { lang: "en" });
      expect(html).toContain(`<strong>[${cat[1]}]</strong> x`);
    }
  });
});

describe("C10 the paragraph is rebuilt exactly from the stored data", () => {
  it("renderRecipeHtml(JSON round-trip of the flag) equals the block, for generated recipes", () => {
    for (const lang of ["en", "fr"]) for (const tier of TIER_KEYS) for (let s = 0; s < 5; s++) {
      const item = makeItem({ name: s % 2 ? "Potion of Speed" : "Flame Tongue", type: s % 2 ? "consumable" : "weapon", subtype: s % 2 ? "potion" : "martialM", rarities: [tier], activityTypes: ["fire"] });
      const r = generateRecipe(item, { ...OPTIONS, lang }, mulberry32(s + 40));
      const html = renderRecipeHtml(r, { lang });
      expect(renderRecipeHtml(JSON.parse(JSON.stringify(r)), { lang })).toBe(html);
    }
  });
  it("is pure: same data, same output", () => {
    expect(renderRecipeHtml(G2, { lang: "en" })).toBe(renderRecipeHtml(G2, { lang: "en" }));
  });
});

describe("englishArticle", () => {
  it.each([
    ["Flame Tongue", "a"], ["Dazing Hammer", "a"], ["Ring of Fire", "a"], ["Potion of Healing", "a"], ["Moss Glass", "a"], ["Cactus Rod", "a"],
    ["Amulet of Health", "an"], ["Ioun Stone", "an"], ["Elixir of Health", "an"],
    ["Unicorn Horn", "a"], ["Use Wand", "a"], ["One Ring", "a"],
    ["Boots of Speed", ""], ["Gauntlets of Ogre Power", ""], ["Plate Armor", ""], ["Mithral Chain Mail", ""], ["Oil of Sharpness", ""],
    ["Dust of Disappearance", ""]
  ])("%s -> %j", (name, art) => {
    expect(englishArticle(name).trim()).toBe(art);
  });
});

describe("C15 French rendering", () => {
  const FR1 = { ...G1, lang: "fr", itemName: "Marteau étourdissant" };

  it("header, list and sentence in French with the same structure", () => {
    const html = renderRecipeHtml(FR1, { lang: "fr" });
    expect(html).toMatch(new RegExp(`^<p class="${C}"><em><strong>Artisanat\\.</strong></em> La création (de |d'|du |de la |des )?<em>.*Marteau étourdissant</em> requiert un Atelier Peu commun et les Composants Peu communs suivants :</p>`));
    expect(html).toContain(`<ul class="${C}">`);
    expect(html).toContain("<strong>[Animus]</strong> Animus quelconque (Peu commun, FP 1–4)</p>");
    expect(html).toContain("<strong>[Os]</strong> ");
    expect(html).toContain("<strong>[Arme naturelle]</strong> ");
    expect(html).toContain("<strong>[Peau]</strong> ");
    expect(html).toContain(`<p class="${C}">Chaque Composant doit provenir d'un monstre différent.</p>`);
    expect(html).not.toContain("Crafting");
    expect(html).not.toContain("(CR ");
  });

  it("typed lines use `d'un/d'une <Type>` and `(Rareté, FP x)`", () => {
    const line = renderLine(FR1.components[1], FR1, "fr"); // giant (masculine)
    expect(line).toMatch(/ d'un /);
    expect(line).toMatch(/Géant/i);
    expect(line.endsWith("(Peu commun, FP 1–4)")).toBe(true);
    const fey = renderLine(comp("bones", "skull", [{ type: "fey" }], "rare"), { ...FR1, workshop: "rare", crRange: "5–10" }, "fr");
    expect(fey).toMatch(/ d'une /);
    expect(fey.endsWith("(Rare, FP 5–10)")).toBe(true);
    const two = renderLine(comp("bones", "skull", [{ type: "giant" }, { type: "fey" }], "rare"), { ...FR1, workshop: "rare", crRange: "5–10" }, "fr");
    expect(two).toMatch(/ d'un .* ou d'une /);
  });

  it("uses the French rarity names with plural agreement", () => {
    const names = { common: ["Commun", "Communs"], uncommon: ["Peu commun", "Peu communs"], rare: ["Rare", "Rares"], veryRare: ["Très rare", "Très rares"], legendary: ["Légendaire", "Légendaires"] };
    for (const t of TIER_KEYS) {
      const html = renderRecipeHtml({ ...FR1, workshop: t, rarity: t, crRange: CR[t], components: [comp("animus", null, [], t)] }, { lang: "fr" });
      expect(html).toContain(`requiert un Atelier ${names[t][0]} et les Composants ${names[t][1]} suivants :`);
    }
  });

  it("variants are translated (Dragon rouge / Élémentaire du feu)", () => {
    const l = renderLine(comp("hide", "scales", [{ type: "dragon", variant: "red" }], "rare"), { ...FR1, workshop: "rare", crRange: "5–10" }, "fr");
    expect(l).toContain("Dragon rouge");
    const e = renderLine(comp("fluid", "elementalFluid", [{ type: "elemental", variant: "fire" }], "rare"), { ...FR1, workshop: "rare", crRange: "5–10" }, "fr");
    expect(e).toMatch(/Élémentaire du feu/);
  });

  it.each([
    ["Le Marteau", /^du /], ["La Lame", /^de la /], ["Les Bottes", /^des /], ["Épée longue", /^d'/], ["Bâton", /^de /]
  ])("frenchOf(%s) agrees the preposition", (name, re) => {
    const out = frenchOf(name);
    const text = typeof out === "string" ? out : `${out.particle}${out.particle.endsWith("'") ? "" : " "}${out.name}`;
    expect(text).toMatch(re);
  });

  it("an `Any` Animus in French", () => {
    const l = renderLine(comp("animus", null, [], "rare"), { ...FR1, workshop: "rare", crRange: "5–10" }, "fr");
    expect(l).toBe("Animus quelconque (Rare, FP 5–10)");
  });

  it("English text is unaffected by the client language: lang is explicit", () => {
    expect(renderRecipeHtml(G1, { lang: "en" })).toBe(G1_HTML);
  });
});

describe("C11/C15 Schematic name and data", () => {
  it("schematicName", () => {
    expect(schematicName("Flame Tongue", "en")).toBe("Schematic: Flame Tongue");
    expect(schematicName("Langue de feu", "fr")).toBe("Schéma : Langue de feu");
  });

  const link = "@UUID[Item.abc]{Dazing Hammer}";
  const data = (r, lang = "en", folderId = "FOLDER1") => buildSchematicData(r, { folderId, lang, link });

  it("has the documented shape", () => {
    const d = data(G1);
    expect(d.name).toBe("Schematic: Dazing Hammer");
    expect(d.type).toBe("loot");
    expect(d.folder).toBe("FOLDER1");
    expect(d.system.type.value).toBe("gear");
    expect(d.system.rarities).toEqual(["uncommon"]);
    expect(d.system.price).toEqual({ value: 50, denomination: "gp" });
    expect(d.system.weight.value).toBe(0);
    expect(d.system.quantity).toBe(1);
    expect(typeof d.img).toBe("string");
    expect(d.ownership).toBeUndefined();
  });

  it("description links to the item, names the workshop and lists every component", () => {
    const html = data(G1).system.description.value;
    expect(html).toContain(link);
    expect(html).toContain("Uncommon Workshop");
    for (const c of G1.components) expect(html).toContain(renderLine(c, G1, "en"));
  });

  it("carries the identical recipe in its flag", () => {
    expect(data(G1).flags["drakkenheim-recipes"].recipe).toEqual(G1);
  });

  it("renderSchematicHtml agrees with the description", () => {
    expect(data(G1).system.description.value).toBe(renderSchematicHtml(G1, { lang: "en", link }));
  });

  it.each(TIER_KEYS)("price follows the Appendix D scale (%s)", (t) => {
    const r = base({ rarity: t, workshop: t, crRange: CR[t], components: [comp("animus", null, [], t)] });
    expect(data(r).system.price).toEqual({ value: PRICE[t], denomination: "gp" });
  });

  it("an artifact keeps its rarity key but is priced as legendary", () => {
    const r = base({ rarity: "artifact", workshop: "legendary", crRange: "17+", components: [comp("animus", null, [], "legendary")] });
    const d = data(r);
    expect(d.system.price.value).toBe(50000);
    expect(d.system.rarities).toEqual(["artifact"]);
  });

  it("French Schematic name", () => {
    expect(data({ ...G1, lang: "fr", itemName: "Marteau" }, "fr").name).toBe("Schéma : Marteau");
  });
});
