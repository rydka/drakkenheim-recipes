// C9: locate / replace the recipe block in an item description.
import { describe, expect, it } from "vitest";
import { findRecipeBlock, replaceRecipeBlock, stripRecipeBlock } from "../../scripts/core/description.mjs";
import { renderRecipeHtml } from "../../scripts/core/render.mjs";
import { generateRecipe } from "../../scripts/core/generate.mjs";
import { mulberry32 } from "../../scripts/core/rng.mjs";
import { makeItem, OPTIONS, readFixture } from "../helpers/items.mjs";

const fixture = readFixture("book-like.json");
const make = (name, type, subtype, seed) =>
  renderRecipeHtml(generateRecipe(makeItem({ name, type, subtype, rarities: ["rare"] }), OPTIONS, mulberry32(seed)), { lang: "en" });
const BLOCK = make("Longsword +1", "weapon", "martialM", 1); // permanent: p + ul + "different monster" p
const BLOCK2 = make("Potion of Healing", "consumable", "potion", 2); // consumable: p + ul only
const count = (s, sub) => s.split(sub).length - 1;

describe("C9 findRecipeBlock", () => {
  it.each(fixture.cases)("finds the book recipe ($id) as source `book`, without the trailing content", (c) => {
    const html = c.before + c.book + c.after;
    const found = findRecipeBlock(html);
    expect(found?.source).toBe("book");
    expect(html.slice(found.start, found.end)).toBe(c.book);
  });

  it("finds a module block (p + ul + p) as source `module`", () => {
    const html = `<p>Intro.</p>${BLOCK}<p>Outro.</p>`;
    const found = findRecipeBlock(html);
    expect(found?.source).toBe("module");
    expect(html.slice(found.start, found.end)).toBe(BLOCK);
  });

  it.each(fixture.noRecipe.map((h, i) => [i, h]))("returns null when there is no recipe (#%i)", (_i, html) => {
    expect(findRecipeBlock(html)).toBeNull();
  });
});

describe("C9 replaceRecipeBlock", () => {
  it.each(fixture.cases)("replaces the book recipe in place ($id), the rest is byte-identical", (c) => {
    const out = replaceRecipeBlock(c.before + c.book + c.after, BLOCK);
    expect(out).toBe(c.before + BLOCK + c.after);
    expect(count(out, "Crafting.")).toBe(1);
    expect(out).not.toContain("Test Hammer");
  });

  it("replaces a module block in place, including its `different monster` paragraph", () => {
    const html = `<p>Intro.</p>${BLOCK}<p>Outro.</p>`;
    const out = replaceRecipeBlock(html, BLOCK2);
    expect(out).toBe(`<p>Intro.</p>${BLOCK2}<p>Outro.</p>`);
    expect(out).not.toContain("different monster");
  });

  it("appends at the end when there is no recipe, leaving the description intact", () => {
    for (const html of fixture.noRecipe) {
      const out = replaceRecipeBlock(html, BLOCK);
      expect(out.startsWith(html)).toBe(true);
      expect(out.endsWith(BLOCK)).toBe(true);
      expect(out.slice(html.length).trim()).toBe(BLOCK);
    }
  });

  it("never duplicates: repeated application is idempotent", () => {
    const once = replaceRecipeBlock("<p>Text.</p>", BLOCK);
    expect(replaceRecipeBlock(once, BLOCK)).toBe(once);
    const swapped = replaceRecipeBlock(once, BLOCK2);
    expect(count(swapped, "Crafting.")).toBe(1);
    expect(replaceRecipeBlock(swapped, BLOCK)).toBe(once);
  });

  it("handles a missing description", () => {
    expect(replaceRecipeBlock("", BLOCK)).toBe(BLOCK);
    expect(replaceRecipeBlock(undefined, BLOCK)).toBe(BLOCK);
  });

  it("replaces a French book recipe by an English module block and vice versa", () => {
    const fr = renderRecipeHtml(generateRecipe(makeItem({ name: "Marteau" }), { ...OPTIONS, lang: "fr" }, mulberry32(4)), { lang: "fr" });
    const out = replaceRecipeBlock(`<p>x</p>${fr}`, BLOCK);
    expect(out).toBe(`<p>x</p>${BLOCK}`);
    expect(replaceRecipeBlock(out, fr)).toBe(`<p>x</p>${fr}`);
  });
});

describe("stripRecipeBlock", () => {
  it("removes the module block and nothing else", () => {
    const html = "<p>Intro.</p>";
    const out = stripRecipeBlock(replaceRecipeBlock(html, BLOCK));
    expect(out.trim()).toBe(html);
  });
  it("leaves a description without block untouched", () => {
    expect(stripRecipeBlock("<p>Plain.</p>")).toBe("<p>Plain.</p>");
  });
});
