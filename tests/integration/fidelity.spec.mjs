/* global DOMParser */
// M4: preview -> application fidelity on 50 cases (objects x repetitions x random line edits).
// Checks that (1) the lines written to the description are the lines shown in the window after editing and
// (2) renderRecipeHtml(flag) reproduces exactly the block written to the description.
import fs from "node:fs";
import { expect, test } from "../../../../test-env/fixtures.mjs";
import { blockOf, cleanup, create, ID, openDialogViaButton, SEL } from "../helpers/client.mjs";

test.afterEach(async ({ foundry }) => { await cleanup(foundry); });

function rng(seed) { // small deterministic generator for the edit choices (test side)
  let a = seed;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const DEFS = [
  ["Longsword", "weapon", { type: { value: "martialM" } }, "common"],
  ["Plate", "equipment", { type: { value: "heavy" } }, "rare"],
  ["Shield", "equipment", { type: { value: "shield" } }, "uncommon"],
  ["Boots", "equipment", { type: { value: "wondrous" } }, "veryRare"],
  ["Ring", "equipment", { type: { value: "ring" } }, "legendary"],
  ["Potion", "consumable", { type: { value: "potion" } }, "rare"],
  ["Scroll", "consumable", { type: { value: "scroll" } }, "uncommon"],
  ["Arrow", "consumable", { type: { value: "ammo" } }, "common"],
  ["Haversack", "container", {}, "veryRare"],
  ["Tools", "tool", { type: { value: "art" } }, "legendary"]
];
const WEIRD = ["Plain edit", "Ünïcode ✓ line (CR 5–10)", "With <b>tags</b> & ampersand", 'Quote "x" and \'y\'', "Eye of a <Beholder>"];

test("M4: applied text = previewed text, and the flag rebuilds the block (50 cases)", async ({ gamePage, foundry }) => {
  test.setTimeout(600_000);
  const rand = rng(2026);
  const cases = [];
  let ok = 0;
  for (let n = 0; n < 50; n++) {
    const [label, type, extra, rarity] = DEFS[n % DEFS.length];
    const id = await create(foundry, { name: `DRT ${label} ${n}`, type, system: { ...extra, rarities: [rarity], description: { value: `<p>Case ${n}.</p>` } } });
    const dialog = await openDialogViaButton(gamePage, foundry, id);
    const rows = dialog.locator(SEL.row);
    if (rand() < 0.5) await dialog.locator('[data-action="regenerate"]').click();
    const edits = [];
    const nEdits = Math.floor(rand() * 4);
    for (let k = 0; k < nEdits; k++) {
      const count = await rows.count();
      const op = rand();
      if (op < 0.55) {
        const idx = 1 + Math.floor(rand() * (count - 1));
        const text = WEIRD[Math.floor(rand() * WEIRD.length)];
        await rows.nth(idx).locator('input[type="text"]').fill(text);
        edits.push({ op: "edit", idx, text });
      } else if (op < 0.8 && count > 3) {
        const idx = 1 + Math.floor(rand() * (count - 1));
        await rows.nth(idx).locator('[data-action="deleteRow"]').click();
        edits.push({ op: "delete", idx });
      } else {
        await dialog.locator('[data-action="addRow"]').click();
        const text = WEIRD[Math.floor(rand() * WEIRD.length)];
        await rows.last().locator('input[type="text"]').fill(text);
        edits.push({ op: "add", text });
      }
      await expect(rows.first()).toBeVisible();
    }
    const preview = await rows.evaluateAll((rs) => rs.map((r) => ({
      category: r.querySelector("select")?.selectedOptions?.[0]?.textContent?.trim(),
      text: r.querySelector('input[type="text"]').value
    })));
    await dialog.locator('[data-action="apply"]').click();
    await expect(dialog).toHaveCount(0);
    const res = await foundry(([i, mid]) => {
      const it = game.items.get(i);
      return { description: it.system.description.value, flag: it.getFlag(mid, "recipe") };
    }, [id, ID]);
    const written = await foundry((h) => {
      const body = new DOMParser().parseFromString(h, "text/html").body;
      return [...body.querySelectorAll("ul.drakkenheim-recipes-recipe > li")].map((li) => li.textContent);
    }, res.description);
    const expectedLines = preview.map((p) => `[${p.category}] ${p.text}`);
    // compare in DOM-serialised form: outerHTML does not escape quotes in text nodes
    const rebuilt = await foundry(([f]) => {
      const html = game.modules.get("drakkenheim-recipes").api.renderRecipeHtml(f, { lang: "en" });
      return [...new DOMParser().parseFromString(`<body>${html}</body>`, "text/html").body.children].map((e) => e.outerHTML).join("");
    }, [res.flag]);
    const block = await blockOf(foundry, res.description);
    const sameLines = JSON.stringify(written) === JSON.stringify(expectedLines);
    const sameBlock = block === rebuilt;
    if (sameLines && sameBlock) ok++;
    cases.push({ n, item: `${label} (${rarity})`, edits, sameLines, sameBlock, ...(sameLines ? {} : { expectedLines, written }), ...(sameBlock ? {} : { block, rebuilt }) });
    await foundry((i) => game.items.get(i)?.sheet.close(), id);
  }
  const rate = ok / 50;
  fs.writeFileSync(test.info().outputPath("M4-fidelite.json"), JSON.stringify({ metric: "M4", cases: 50, ok, rate, details: cases }, null, 2));
  test.info().annotations.push({ type: "M4", description: `${(rate * 100).toFixed(0)} % (${ok}/50)` });
  expect(rate).toBe(1);
});
