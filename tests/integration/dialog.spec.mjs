// C2 (preview window), C8 (regenerate in the window), C13 (cancel / close change nothing).
import fs from "node:fs";
import { expect, test } from "../../../../test-env/fixtures.mjs";
import {
  cleanup, create, dialogLocator, openDialogViaButton, openSheet, potionData, PREFIX, SEL, snapshotWorld, weaponData
} from "../helpers/client.mjs";

test.afterEach(async ({ foundry }) => { await cleanup(foundry); });

const rowTexts = (dialog) => dialog.locator(SEL.row).evaluateAll((rows) => rows.map((r) => ({
  category: r.querySelector("select")?.selectedOptions?.[0]?.textContent?.trim() ?? r.querySelector("select")?.value,
  text: r.querySelector('input[type="text"]')?.value
})));

test("C2: the window shows workshop, CR range, components, sentence, Schematic checkbox and buttons", async ({ gamePage, foundry }) => {
  const id = await create(foundry, weaponData());
  const dialog = await openDialogViaButton(gamePage, foundry, id);
  await expect(dialog).toContainText("Rare");
  await expect(dialog).toContainText("5–10");
  await expect(dialog).toContainText("Each item must come from a different monster.");
  await expect(dialog.locator(SEL.row)).toHaveCount(5); // rare permanent: 5 components
  const rows = await rowTexts(dialog);
  expect(rows[0].category).toMatch(/Animus/i);
  expect(rows[0].text).toMatch(/Animus/);
  for (const r of rows) expect(r.text).toMatch(/\(CR 5–10\)$/);
  await expect(dialog.locator('input[name="createSchematic"]')).toBeChecked();
  for (const name of [/Regenerate|Regénérer/i, /Apply|Appliquer/i, /Cancel|Annuler/i]) {
    await expect(dialog.getByRole("button", { name }).first()).toBeVisible();
  }
  await gamePage.screenshot({ path: test.info().outputPath("C2-fenetre-apercu.png") });
  fs.writeFileSync(test.info().outputPath("C2-lignes-proposees.json"), JSON.stringify(rows, null, 2));
});

test("C2: a consumable shows no `different monster` sentence and 4 components when very rare", async ({ gamePage, foundry }) => {
  const id = await create(foundry, potionData());
  const dialog = await openDialogViaButton(gamePage, foundry, id);
  await expect(dialog).toContainText("Very Rare");
  await expect(dialog).toContainText("11–16");
  await expect(dialog).not.toContainText("different monster");
  await expect(dialog.locator(SEL.row)).toHaveCount(4);
  const rows = await rowTexts(dialog);
  const cats = rows.map((r) => r.category.toLowerCase());
  expect(cats.some((c) => c.includes("fluid"))).toBe(true);
  expect(cats.some((c) => c.includes("organ"))).toBe(true);
  await gamePage.screenshot({ path: test.info().outputPath("C2-potion-tres-rare.png") });
});

test("C2: several rarities -> drop-down with the lowest preselected; changing it updates the CR range", async ({ gamePage, foundry }) => {
  const id = await create(foundry, weaponData({ system: { type: { value: "martialM" }, rarities: ["rare", "uncommon"] } }));
  const dialog = await openDialogViaButton(gamePage, foundry, id);
  const select = dialog.locator(SEL.rarity);
  await expect(select).toBeVisible();
  expect(await select.locator("option").count()).toBe(2);
  await expect(select).toHaveValue("uncommon");
  await expect(dialog).toContainText("1–4");
  await select.selectOption("rare");
  await expect(dialog).toContainText("5–10");
  await expect(dialog.locator(SEL.row)).toHaveCount(5);
});

test("C2: lines can be edited, removed and added", async ({ gamePage, foundry }) => {
  const id = await create(foundry, weaponData());
  const dialog = await openDialogViaButton(gamePage, foundry, id);
  const rows = dialog.locator(SEL.row);
  await rows.nth(1).locator('input[type="text"]').fill("Skull from a Rare Giant (CR 5–10)");
  expect((await rowTexts(dialog))[1].text).toBe("Skull from a Rare Giant (CR 5–10)");
  await rows.nth(2).locator('[data-action="deleteRow"]').click();
  await expect(rows).toHaveCount(4);
  await dialog.locator('[data-action="addRow"]').click();
  await expect(rows).toHaveCount(5);
  await rows.last().locator('input[type="text"]').fill("Custom line");
  expect((await rowTexts(dialog)).at(-1).text).toBe("Custom line");
  await gamePage.screenshot({ path: test.info().outputPath("C2-edition-lignes.png") });
});

test("C2: the Schematic checkbox follows the createSchematic setting", async ({ gamePage, foundry }) => {
  await foundry((id) => game.settings.set(id, "createSchematic", false), "drakkenheim-recipes");
  const id = await create(foundry, weaponData());
  const dialog = await openDialogViaButton(gamePage, foundry, id);
  await expect(dialog.locator('input[name="createSchematic"]')).not.toBeChecked();
});

test("C8: Regenerate keeps the window open, keeps the categories and changes at least one line", async ({ gamePage, foundry }) => {
  const id = await create(foundry, weaponData());
  const dialog = await openDialogViaButton(gamePage, foundry, id);
  const evidence = [];
  let prev = await rowTexts(dialog);
  for (let k = 0; k < 5; k++) {
    await dialog.locator('[data-action="regenerate"]').click();
    await expect(dialogLocator(gamePage)).toBeVisible();
    await gamePage.waitForTimeout(150);
    const next = await rowTexts(dialog);
    expect(next.map((r) => r.category)).toEqual(prev.map((r) => r.category));
    expect(JSON.stringify(next)).not.toBe(JSON.stringify(prev));
    for (const r of next) expect(r.text).toMatch(/\(CR 5–10\)$|^Any /);
    evidence.push(next);
    prev = next;
  }
  fs.writeFileSync(test.info().outputPath("C8-regenerations.json"), JSON.stringify(evidence, null, 2));
});

test("C8: hand edits are lost on Regenerate and the window says so", async ({ gamePage, foundry }) => {
  const id = await create(foundry, weaponData());
  const dialog = await openDialogViaButton(gamePage, foundry, id);
  await dialog.locator(SEL.row).nth(1).locator('input[type="text"]').fill("HAND EDITED LINE");
  await dialog.locator('[data-action="regenerate"]').click();
  await gamePage.waitForTimeout(200);
  expect((await rowTexts(dialog)).map((r) => r.text)).not.toContain("HAND EDITED LINE");
  await expect(dialog).toContainText(/lost|perdu|discard|replaced/i);
  await gamePage.screenshot({ path: test.info().outputPath("C8-avertissement-modifications.png") });
});

test("C13: Cancel changes and creates nothing", async ({ gamePage, foundry }) => {
  const id = await create(foundry, weaponData());
  const before = await snapshotWorld(foundry);
  const dialog = await openDialogViaButton(gamePage, foundry, id);
  await dialog.locator(SEL.row).nth(1).locator('input[type="text"]').fill("edited but cancelled");
  await dialog.locator('[data-action="cancel"]').click();
  await expect(dialog).toHaveCount(0);
  expect(await snapshotWorld(foundry)).toEqual(before);
  const flag = await foundry((i) => game.items.get(i).getFlag("drakkenheim-recipes", "recipe") ?? null, id);
  expect(flag).toBeNull();
});

test("C13: closing the window with its close button changes and creates nothing", async ({ gamePage, foundry }) => {
  const id = await create(foundry, weaponData());
  const before = await snapshotWorld(foundry);
  const dialog = await openDialogViaButton(gamePage, foundry, id);
  await dialog.locator('[data-action="close"]').click();
  await expect(dialog).toHaveCount(0);
  expect(await snapshotWorld(foundry)).toEqual(before);
});

test("C13: opening and closing the sheet alone writes nothing", async ({ gamePage, foundry }) => {
  const id = await create(foundry, { name: `${PREFIX}untouched`, type: "equipment", system: { type: { value: "heavy" }, rarities: ["uncommon"] } });
  const before = await snapshotWorld(foundry);
  await openSheet(gamePage, foundry, id);
  await foundry((i) => game.items.get(i).sheet.close(), id);
  expect(await snapshotWorld(foundry)).toEqual(before);
});
