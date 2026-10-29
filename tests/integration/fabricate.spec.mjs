/* global window, Item, Actor */
// Fabricate integration (C1-C13, M2-M4). Run with `--with=fabricate` (Fabricate 1.14.1 installed). Without it, the
// "absent" cases run and the Fabricate cases are skipped.
import fs from "node:fs";
import { expect, test, waitForGame } from "../../../../test-env/fixtures.mjs";
import {
  applyOn, COMP_FOLDER, fabApiPresent, FAB_BOX, fabCalls, fabricateActive, fabState, fullCleanup, installSpy, itemsInFolder,
  prepareFabricate, spyConsole, useNames, warns, WORK_FOLDER
} from "../helpers/fabricate-client.mjs";
import {
  create, dialogLocator, ID, notes, openDialogViaButton, potionData, PREFIX, spyNotifications, weaponData
} from "../helpers/client.mjs";
import { loadCorpus } from "../helpers/items.mjs";
import { expectedComponentKeys, expectedComponentName, RARITY_EN, TIERS } from "../helpers/fabricate-invariants.mjs";

const SYS = "DRT Sys";
const ROUTED = "routedByIngredients";
const RARITIES = ["common", "uncommon", "rare", "veryRare", "legendary"];
const sorted = (a) => [...a].sort();
const names = (list) => (list ?? []).map((c) => (typeof c === "string" ? c : c.name ?? c.label));

test.afterEach(async ({ foundry }) => { await fullCleanup(foundry); });

/** Fabricate-only tests: skipped when the module is not loaded, otherwise Fabricate is ready and quiet. */
const fabTest = (title, fn) => test(title, async ({ foundry, gamePage }) => {
  const active = await fabricateActive(foundry);
  test.skip(!active, "Fabricate is not loaded (run with --with=fabricate)");
  test.setTimeout(240_000);
  expect(await prepareFabricate(foundry), "game.fabricate.ready").toBe(true);
  await fn({ foundry, gamePage });
});

const makeItem = (i, rarity = RARITIES[i % 5]) => (i % 2
  ? potionData({ name: `${PREFIX}Gen ${i}`, system: { type: { value: "potion" }, rarities: [rarity], description: { value: "<p>x</p>" } } })
  : weaponData({ name: `${PREFIX}Gen ${i}`, system: { type: { value: "martialM" }, rarities: [rarity], description: { value: "<p>x</p>" } } }));

// ---------------------------------------------------------------------------------------------------- C1

test("C1 (absent): without Fabricate the preview has no Fabricate checkbox and the application is unchanged", async ({ gamePage, foundry }) => {
  test.skip(await fabricateActive(foundry), "Fabricate is loaded: covered by the Fabricate cases");
  const id = await create(foundry, weaponData());
  const dialog = await openDialogViaButton(gamePage, foundry, id);
  await expect(dialog.locator(FAB_BOX)).toHaveCount(0);
  await expect(dialog.getByRole("checkbox", { name: /Fabricate/i })).toHaveCount(0);
  await dialog.locator('[data-action="apply"]').click();
  await expect(dialog).toHaveCount(0);
  const flag = await foundry(([i, mid]) => game.items.get(i).getFlag(mid, "recipe"), [id, ID]);
  expect(flag).toBeTruthy();
  expect(await foundry(([i, mid]) => game.items.get(i).getFlag(mid, "fabricate") ?? null, [id, ID])).toBeNull();
  const api = await fabApiPresent(foundry);
  const ready = await foundry((mid) => { const a = game.modules.get(mid).api; return (a.fabricate ?? a).isFabricateReady?.() ?? false; }, ID);
  expect(ready).toBe(false);
  expect(api).toBeTruthy();
});

test("C1 (absent): applyRecipe with createFabricate: true is harmless without Fabricate", async ({ foundry }) => {
  test.skip(await fabricateActive(foundry), "Fabricate is loaded");
  const id = await create(foundry, weaponData());
  const r = await applyOn(foundry, { itemId: id, createFabricate: true });
  expect(r.itemUpdated).toBe(true);
  expect(r.schematicUuid).toBeTruthy();
  expect(r.fabricate === null || ["skipped", "unavailable"].includes(r.fabricate.status)).toBe(true);
});

fabTest("C1: with Fabricate ready the preview shows the checkbox, checked by default, unchecked when the setting is off", async ({ gamePage, foundry }) => {
  const id = await create(foundry, weaponData());
  let dialog = await openDialogViaButton(gamePage, foundry, id);
  const box = dialog.locator(FAB_BOX);
  await expect(box).toBeVisible();
  await expect(box).toBeChecked();
  await expect(dialog.getByRole("checkbox", { name: /Fabricate/i })).toBeVisible();
  await gamePage.screenshot({ path: test.info().outputPath("C1-case-fabricate-cochee.png") });
  await dialog.locator('[data-action="cancel"]').click();
  await expect(dialog).toHaveCount(0);

  await foundry((mid) => game.settings.set(mid, "fabricateEnabled", false), ID);
  dialog = await openDialogViaButton(gamePage, foundry, id);
  await expect(dialog.locator(FAB_BOX)).toBeVisible();
  await expect(dialog.locator(FAB_BOX)).not.toBeChecked();
  await gamePage.screenshot({ path: test.info().outputPath("C1-case-fabricate-decochee.png") });
});

fabTest("C1/C2: applying from the dialog with the box checked creates the Fabricate recipe (UI path)", async ({ gamePage, foundry }) => {
  await useNames(foundry, `${SYS} ui`);
  const id = await create(foundry, weaponData());
  const dialog = await openDialogViaButton(gamePage, foundry, id);
  await expect(dialog.locator(FAB_BOX)).toBeChecked();
  await dialog.locator('[data-action="apply"]').click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => foundry(([i, mid]) => game.items.get(i).getFlag(mid, "fabricate")?.recipeId ?? null, [id, ID]), { timeout: 60_000 }).toBeTruthy();
  const st = await fabState(foundry, `${SYS} ui`);
  expect(st.recipes.map((r) => r.name)).toEqual([`${PREFIX}Flame Blade`]);
  await gamePage.screenshot({ path: test.info().outputPath("C1-apres-application.png") });
});

fabTest("C1: with the box unchecked nothing is written in Fabricate", async ({ gamePage, foundry }) => {
  await useNames(foundry, `${SYS} off`);
  const id = await create(foundry, weaponData());
  const dialog = await openDialogViaButton(gamePage, foundry, id);
  await dialog.locator(FAB_BOX).uncheck();
  await dialog.locator('[data-action="apply"]').click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => foundry(([i, mid]) => !!game.items.get(i).getFlag(mid, "recipe"), [id, ID])).toBe(true);
  expect((await fabState(foundry, `${SYS} off`)).system).toBeNull();
  expect(await foundry(([i, mid]) => game.items.get(i).getFlag(mid, "fabricate") ?? null, [id, ID])).toBeNull();
});

// ---------------------------------------------------------------------------------------------------- C2

fabTest("C2: the Fabricate write comes after the description, the flag and the Schematic; the flag records the sync", async ({ foundry }) => {
  const name = `${SYS} order`;
  await useNames(foundry, name);
  const id = await create(foundry, weaponData());
  const spy = await installSpy(foundry, { itemId: id });
  expect(spy.sameManager, "getCraftingSystemManager()/getRecipeManager() must return singletons for the spy to see the module's calls").toBe(true);
  const r = await applyOn(foundry, { itemId: id });
  const calls = await fabCalls(foundry);
  fs.writeFileSync(test.info().outputPath("C2-appels-fabricate.json"), JSON.stringify(calls, null, 1));
  expect(calls.length).toBeGreaterThan(0);
  expect(calls[0].snap, JSON.stringify(calls[0])).toEqual({ block: true, flag: true, schematic: true });
  expect(calls.at(-1).method).toMatch(/createRecipe|updateRecipe|updateRecipeItemDefinition/);
  const flag = await foundry(([i, mid]) => game.items.get(i).getFlag(mid, "fabricate"), [id, ID]);
  const st = await fabState(foundry, name);
  expect(flag.systemId).toBe(st.system.id);
  expect(flag.recipeId).toBe(st.recipes[0].id);
  expect(flag).toHaveProperty("recipeItemId");
  expect(flag.recipeItemId).toBeTruthy();
  expect(Number.isNaN(Date.parse(flag.updatedAt))).toBe(false);
  expect(["created", "updated"]).toContain(r.fabricate.status);
});

fabTest("C2: a Fabricate failure keeps description, flag and Schematic and notifies with Fabricate's message", async ({ foundry }) => {
  const name = `${SYS} fail`;
  await useNames(foundry, name);
  const id = await create(foundry, weaponData());
  await spyNotifications(foundry);
  await installSpy(foundry, { fail: { createRecipe: "DRT boom: refused by Fabricate" } });
  const r = await applyOn(foundry, { itemId: id, notify: true });
  expect(r.itemUpdated).toBe(true);
  expect(r.schematicUuid).toBeTruthy();
  expect(r.fabricate.status).toBe("error");
  const item = await foundry(([i, mid]) => ({ desc: game.items.get(i).system.description.value, flag: game.items.get(i).getFlag(mid, "recipe") }), [id, ID]);
  expect(item.desc).toContain("Crafting.");
  expect(item.flag).toBeTruthy();
  const msgs = await notes(foundry);
  fs.writeFileSync(test.info().outputPath("C2-notifications-echec.json"), JSON.stringify(msgs, null, 1));
  expect(msgs.some((m) => m.level === "error" && m.message.includes("DRT boom: refused by Fabricate")), JSON.stringify(msgs)).toBe(true);
  expect(await foundry(([i, mid]) => game.items.get(i).getFlag(mid, "fabricate")?.recipeId ?? null, [id, ID])).toBeNull();
});

// ---------------------------------------------------------------------------------------------------- C3

fabTest("C3: a missing system is created in routedByIngredients with the 8 categories, 5 recipe categories and the tags", async ({ foundry }) => {
  const name = `${SYS} create`;
  await useNames(foundry, name);
  expect((await fabState(foundry, name)).system).toBeNull();
  const id = await create(foundry, weaponData());
  await applyOn(foundry, { itemId: id });
  const { system, recipes } = await fabState(foundry, name);
  fs.writeFileSync(test.info().outputPath("C3-systeme-cree.json"), JSON.stringify(system, null, 1));
  expect(system.name).toBe(name);
  expect(system.resolutionMode).toBe(ROUTED);
  expect(names(system.componentCategories)).toEqual(expect.arrayContaining(["Animus", "Bones", "Dust", "Fluid", "Hair", "Hide", "Natural Weapon", "Organ"]));
  expect(names(system.categories)).toEqual(expect.arrayContaining(["Common", "Uncommon", "Rare", "Very Rare", "Legendary"]));
  expect(system.itemTags).toEqual(expect.arrayContaining(["animus", "bones", "natural weapon", "rare", "very rare", "giant", "undead"]));
  expect(recipes).toHaveLength(1);
});

fabTest("C3: an existing system of that name is reused untouched, only missing tags are added (simple mode -> one set)", async ({ foundry }) => {
  const name = `${SYS} existing`;
  await useNames(foundry, name);
  const before = await foundry(async (n) => {
    const sm = game.fabricate.getCraftingSystemManager();
    const sys = await sm.createSystem({ name: n, description: "DRT keep me", resolutionMode: "simple" }, { notify: false });
    return JSON.parse(JSON.stringify(sys));
  }, name);
  const id = await create(foundry, weaponData());
  await applyOn(foundry, { itemId: id });
  const st = await fabState(foundry, name);
  fs.writeFileSync(test.info().outputPath("C3-systeme-existant.json"), JSON.stringify({ before, after: st.system }, null, 1));
  expect(st.system.id).toBe(before.id);
  expect(st.system.resolutionMode).toBe("simple");
  expect(st.system.description).toBe("DRT keep me");
  expect(st.system.itemTags).toEqual(expect.arrayContaining(["bones", "rare", "animus"]));
  const all = await foundry(async (n) => (await game.fabricate.getCraftingSystemManager().getSystems()).filter((s) => s.name === n).length, name);
  expect(all).toBe(1);
  // C7 fallback: a single set, the recipe requires the exact workshop
  const recipe = st.recipes[0];
  expect(recipe.ingredientSets).toHaveLength(1);
  expect(recipe.toolIds).toHaveLength(1);
  const tool = st.tools.find((t) => t.id === recipe.toolIds[0]);
  expect(tool, "tool library entry").toBeTruthy();
});

// ---------------------------------------------------------------------------------------------------- C4 / C5

fabTest("C4: generic components exist in the folder as loot/material, 1 lb, registered with category and cumulative tags", async ({ gamePage, foundry }) => {
  const name = `${SYS} generics`;
  await useNames(foundry, name);
  const id = await create(foundry, weaponData());
  const { recipe } = await applyOn(foundry, { itemId: id });
  const expectedNames = expectedComponentKeys(recipe).map(expectedComponentName);
  const folder = await itemsInFolder(foundry, COMP_FOLDER);
  const st = await fabState(foundry, name);
  const rows = [];
  for (const key of expectedComponentKeys(recipe)) {
    const n = expectedComponentName(key);
    const item = folder.find((i) => i.name === n);
    expect(item, `item ${n}`).toBeTruthy();
    expect(item.type).toBe("loot");
    expect(item.subtype).toBe("material");
    expect(item.weight).toBe(1);
    expect(item.price).toBe(0);
    expect(item.description).toMatch(new RegExp(RARITY_EN[key.rarity]));
    const comp = st.components.find((c) => (c.registeredItemUuid ?? c.originItemUuid) === item.uuid);
    expect(comp, `component ${n}`).toBeTruthy();
    expect(comp.category).toBe(({ naturalWeapon: "Natural Weapon" })[key.category] ?? key.category[0].toUpperCase() + key.category.slice(1));
    const tags = sorted([key.category === "naturalWeapon" ? "natural weapon" : key.category, ...(key.type ? [key.type] : []), ...TIERS.slice(0, TIERS.indexOf(key.rarity) + 1).map((t) => (t === "veryRare" ? "very rare" : t))]);
    expect(sorted(comp.tags)).toEqual(tags);
    rows.push({ name: n, category: comp.category, tags: comp.tags });
  }
  expect(folder.filter((i) => !i.name.endsWith("Workshop")).map((i) => i.name).sort()).toEqual(sorted(expectedNames));
  fs.writeFileSync(test.info().outputPath("C4-composants-generiques.json"), JSON.stringify(rows, null, 1));
  await gamePage.screenshot({ path: test.info().outputPath("C4-monde.png") });
});

fabTest("C4: an existing item of the same name in the folder is reused, never duplicated; reapplying creates nothing", async ({ foundry }) => {
  const name = `${SYS} reuse`;
  await useNames(foundry, name);
  const folderId = await foundry(async (n) => (await foundry.utils.getDocumentClass("Folder").create({ name: n, type: "Item" })).id, COMP_FOLDER);
  const pre = await foundry(async (f) => (await Item.implementation.create({ name: "Rare Animus", type: "loot", folder: f })).uuid, folderId);
  const id = await create(foundry, weaponData());
  await applyOn(foundry, { itemId: id, seed: 3 });
  const first = await itemsInFolder(foundry, COMP_FOLDER);
  expect(first.filter((i) => i.name === "Rare Animus")).toHaveLength(1);
  expect(first.find((i) => i.name === "Rare Animus").uuid).toBe(pre);
  const st = await fabState(foundry, name);
  expect(st.components.some((c) => (c.registeredItemUuid ?? c.originItemUuid) === pre)).toBe(true);
  await applyOn(foundry, { itemId: id, reuse: true });
  expect((await itemsInFolder(foundry, COMP_FOLDER)).length).toBe(first.length);
  expect((await fabState(foundry, name)).components.length).toBe(st.components.length);
});

fabTest("C5: workshops of the recipe rarity up to legendary are in the folder and in the tool library, reused", async ({ foundry }) => {
  const name = `${SYS} tools`;
  await useNames(foundry, name);
  const id = await create(foundry, weaponData()); // rare
  await applyOn(foundry, { itemId: id });
  const want = ["Rare Workshop", "Very Rare Workshop", "Legendary Workshop"];
  const items = await itemsInFolder(foundry, WORK_FOLDER);
  expect(sorted(items.map((i) => i.name))).toEqual(sorted(want));
  const st = await fabState(foundry, name);
  for (const i of items) expect(st.tools.some((t) => (t.registeredItemUuid ?? t.originItemUuid) === i.uuid), i.name).toBe(true);
  expect(st.tools).toHaveLength(3);
  const id2 = await create(foundry, weaponData({ name: `${PREFIX}Second`, system: { type: { value: "martialM" }, rarities: ["veryRare"], description: { value: "<p>x</p>" } } }));
  await applyOn(foundry, { itemId: id2 });
  expect((await itemsInFolder(foundry, WORK_FOLDER)).map((i) => i.name).sort()).toEqual(sorted(want));
  expect((await fabState(foundry, name)).tools).toHaveLength(3);
});

// ---------------------------------------------------------------------------------------------------- C6 / C7

fabTest("C6/C7: the recipe has the item's name, rarity category, text description, result and one set per workshop", async ({ foundry }) => {
  const name = `${SYS} recipe`;
  await useNames(foundry, name);
  const id = await create(foundry, weaponData());
  const base = await foundry((mid) => { const a = game.modules.get(mid).api; return a.generateRecipe({ name: "x", type: "weapon", uuid: "Item.x", system: { type: { value: "martialM" }, rarities: ["rare"] } }, a.getOptions(), a.mulberry32(5)); }, ID);
  const components = base.components.map((c, i) => (i === 1 ? { category: "bones", designation: null, creatureTypes: [], rarity: "rare", text: "DRT odd bone from a hag" } : c));
  const r = await applyOn(foundry, { itemId: id, recipe: { ...base, itemName: `${PREFIX}Flame Blade`, itemUuid: await foundry((i) => game.items.get(i).uuid, id), components } });
  const st = await fabState(foundry, name);
  const recipe = st.recipes[0];
  fs.writeFileSync(test.info().outputPath("C6-recette-fabricate.json"), JSON.stringify(recipe, null, 1));
  expect(recipe.name).toBe(`${PREFIX}Flame Blade`);
  expect(recipe.category).toBe("Rare");
  expect(recipe.craftingSystemId).toBe(st.system.id);
  expect(recipe.description).toContain("Crafting");
  expect(recipe.description).toContain("different monster");
  expect(recipe.description).toContain("DRT odd bone from a hag");
  expect(recipe.description).not.toMatch(/<\/?(p|ul|li|em)>/);
  const result = recipe.resultGroups[0].results[0];
  expect(result.kind).toBe("component");
  expect(result.quantity).toBe(1);
  const comp = st.components.find((c) => c.id === result.componentId);
  expect(comp, "result component").toBeTruthy();
  expect((comp.registeredItemUuid ?? comp.originItemUuid)).toBe(await foundry((i) => game.items.get(i).uuid, id));
  // C7
  expect(recipe.ingredientSets.map((s) => s.name)).toHaveLength(3);
  expect(recipe.ingredientSets.every((s) => s.name && s.ingredientGroups.length > 0 && s.ingredientGroups.length <= components.length)).toBe(true);
  const hag = recipe.ingredientSets[0].ingredientGroups.find((g) => g.name === "DRT odd bone from a hag");
  expect(hag, "edited line -> category + rarity option").toBeTruthy();
  expect(sorted(hag.options[0].match.tags)).toEqual(["bones", "rare"]);
  for (const s of recipe.ingredientSets) {
    expect(s.toolIds).toHaveLength(1);
    for (const g of s.ingredientGroups) for (const o of g.options) { expect(o.match.type).toBe("tags"); expect(o.match.tagMatch).toBe("all"); }
  }
  expect(new Set(recipe.ingredientSets.map((s) => s.toolIds[0])).size).toBe(3);
  expect(r.fabricate.recipeId).toBe(recipe.id);
  expect(recipe.linkedRecipeItemUuid ?? null).toBe(r.schematicUuid);
});

// ---------------------------------------------------------------------------------------------------- C8 / C9

fabTest("C8: reapplying updates the same recipe; a recipe deleted in Fabricate is recreated and the flag follows", async ({ foundry }) => {
  const name = `${SYS} idem`;
  await useNames(foundry, name);
  const id = await create(foundry, weaponData());
  await applyOn(foundry, { itemId: id, seed: 1 });
  const flag1 = await foundry(([i, mid]) => game.items.get(i).getFlag(mid, "fabricate"), [id, ID]);
  const second = await applyOn(foundry, { itemId: id, seed: 77 });
  const st2 = await fabState(foundry, name);
  expect(st2.recipes).toHaveLength(1);
  expect(st2.recipes[0].id).toBe(flag1.recipeId);
  expect(second.fabricate.status).toBe("updated");
  expect(st2.recipes[0].description).toBe(await foundry(([r]) => { const a = game.modules.get("drakkenheim-recipes").api; return (a.fabricate ?? a).renderRecipeText(r, { lang: "en" }); }, [second.recipe]));
  await foundry(async ([rid]) => game.fabricate.getRecipeManager().deleteRecipe(rid), [flag1.recipeId]);
  expect((await fabState(foundry, name)).recipes).toHaveLength(0);
  const third = await applyOn(foundry, { itemId: id, reuse: true });
  const st3 = await fabState(foundry, name);
  const flag3 = await foundry(([i, mid]) => game.items.get(i).getFlag(mid, "fabricate"), [id, ID]);
  expect(st3.recipes).toHaveLength(1);
  expect(third.fabricate.status).toBe("created");
  expect(flag3.recipeId).toBe(st3.recipes[0].id);
  expect(flag3.recipeId).not.toBe(flag1.recipeId);
});

fabTest("C9: the Schematic is a recipe item linked to the recipe, no duplicate after two applications; unchecked -> no link", async ({ foundry }) => {
  const name = `${SYS} schem`;
  await useNames(foundry, name);
  const id = await create(foundry, weaponData());
  const a = await applyOn(foundry, { itemId: id });
  await applyOn(foundry, { itemId: id, reuse: true });
  const found = await foundry(async ([n, schem]) => {
    const sm = game.fabricate.getCraftingSystemManager();
    const sys = (await sm.getSystems()).find((s) => s.name === n);
    const recipe = (await game.fabricate.getRecipeManager().getRecipes({ craftingSystemId: sys.id }))[0];
    const defs = await sm.getRecipeItemDefinitionsContaining(sys.id, recipe.id);
    return JSON.parse(JSON.stringify({ defs, recipe, schem }));
  }, [name, a.schematicUuid]);
  fs.writeFileSync(test.info().outputPath("C9-objet-de-recette.json"), JSON.stringify(found, null, 1));
  expect(found.defs).toHaveLength(1);
  expect(JSON.stringify(found.defs[0])).toContain(a.schematicUuid);
  expect(found.recipe.linkedRecipeItemUuid).toBe(a.schematicUuid);
  // Schematic unchecked
  await applyOn(foundry, { itemId: id, reuse: true, createSchematic: false });
  const after = await foundry(async (n) => {
    const sm = game.fabricate.getCraftingSystemManager();
    const sys = (await sm.getSystems()).find((s) => s.name === n);
    const recipe = (await game.fabricate.getRecipeManager().getRecipes({ craftingSystemId: sys.id }))[0];
    return JSON.parse(JSON.stringify({ link: recipe.linkedRecipeItemUuid ?? null, itemId: recipe.recipeItemId ?? null, defs: await sm.getRecipeItemDefinitionsContaining(sys.id, recipe.id) }));
  }, name);
  expect(after.link).toBeNull();
  expect(after.itemId).toBeNull();
  expect(after.defs).toHaveLength(0);
  // fresh item, Schematic unchecked from the start
  const id2 = await create(foundry, weaponData({ name: `${PREFIX}No Schematic` }));
  await applyOn(foundry, { itemId: id2, createSchematic: false });
  const st = await fabState(foundry, name);
  const rec = st.recipes.find((r) => r.name === `${PREFIX}No Schematic`);
  expect(rec.linkedRecipeItemUuid ?? null).toBeNull();
  expect(rec.recipeItemId ?? null).toBeNull();
});

// ---------------------------------------------------------------------------------------------------- C10

fabTest("C10: an item from a locked compendium gets its Fabricate recipe, the trace lives on the Schematic", async ({ foundry }) => {
  const name = `${SYS} locked`;
  await useNames(foundry, name);
  const info = await foundry(() => {
    for (const key of ["dnd5e.items", "dnd5e.equipment24", "dnd5e.equipment"]) {
      const pack = game.packs.get(key);
      const entry = pack?.index.find((e) => e.name === "Cloak of Elvenkind");
      if (entry) return { uuid: entry.uuid, locked: pack.locked };
    }
    return null;
  });
  expect(info, "Cloak of Elvenkind in the dnd5e packs").not.toBeNull();
  expect(info.locked).toBe(true);
  const r = await applyOn(foundry, { uuid: info.uuid });
  expect(r.itemUpdated).toBe(false);
  expect(r.schematicUuid).toBeTruthy();
  const st = await fabState(foundry, name);
  expect(st.recipes).toHaveLength(1);
  const result = st.recipes[0].resultGroups[0].results[0];
  const comp = st.components.find((c) => c.id === result.componentId);
  expect(comp.registeredItemUuid ?? comp.originItemUuid).toBe(info.uuid);
  const flag = await foundry(([u, mid]) => fromUuid(u).then((d) => d.getFlag(mid, "fabricate")), [r.schematicUuid, ID]);
  fs.writeFileSync(test.info().outputPath("C10-trace-schematic.json"), JSON.stringify(flag, null, 1));
  expect(flag.recipeId).toBe(st.recipes[0].id);
  expect(flag.systemId).toBe(st.system.id);
});

// ---------------------------------------------------------------------------------------------------- C11 / C12

fabTest("C11: a missing Fabricate method -> nothing written, one console warning with the module prefix, a notification", async ({ foundry }) => {
  const name = `${SYS} api`;
  await useNames(foundry, name);
  await spyConsole(foundry);
  await spyNotifications(foundry);
  const id = await create(foundry, weaponData());
  const id2 = await create(foundry, weaponData({ name: `${PREFIX}Second` }));
  await installSpy(foundry, { absent: ["addToolFromUuid"] });
  const r1 = await applyOn(foundry, { itemId: id, notify: true });
  const r2 = await applyOn(foundry, { itemId: id2, notify: true });
  expect(r1.fabricate.status).toBe("unavailable");
  expect(r2.fabricate.status).toBe("unavailable");
  expect(r1.itemUpdated).toBe(true);
  expect(await fabCalls(foundry)).toEqual([]);
  expect((await fabState(foundry, name)).system).toBeNull();
  const w = (await warns(foundry)).filter((x) => /drakkenheim-recipes/.test(x.text));
  fs.writeFileSync(test.info().outputPath("C11-console-et-notifications.json"), JSON.stringify({ warns: w, notes: await notes(foundry) }, null, 1));
  expect(w).toHaveLength(1);
  expect((await notes(foundry)).some((n) => n.level !== "info" && /fabricate/i.test(n.message))).toBe(true);
});

fabTest("C11: an exception at any Fabricate step is caught: status error, no exception to the caller", async ({ foundry }) => {
  for (const method of ["addItemFromUuid", "addToolFromUuid", "addRecipeItemFromUuid", "createRecipe"]) {
    await useNames(foundry, `${SYS} throw ${method}`); // a new system each time so that every step has work to do
    await installSpy(foundry, { fail: { [method]: `DRT ${method} failed` } });
    const id = await create(foundry, weaponData({ name: `${PREFIX}Throw ${method}` }));
    const r = await applyOn(foundry, { itemId: id });
    expect(r.fabricate.status, method).toBe("error");
    expect(r.fabricate.message ?? "", method).toContain(`DRT ${method} failed`);
    await foundry(() => { for (const fn of window.__fabRestore ?? []) fn(); window.__fabRestore = []; })
  }
});

fabTest("C12: a non-GM user triggers no Fabricate write and sees no checkbox", async ({ gamePage, foundry }) => {
  const name = `${SYS} player`;
  await useNames(foundry, name);
  const id = await create(foundry, weaponData());
  await installSpy(foundry, { itemId: id });
  await foundry(() => Object.defineProperty(game.user, "isGM", { get: () => false, configurable: true }));
  await foundry(async ([i, mid]) => { await game.modules.get(mid).api.openDialog(game.items.get(i)); }, [id, ID]);
  const dialog = dialogLocator(gamePage);
  await dialog.waitFor({ state: "visible" });
  await expect(dialog.locator(FAB_BOX)).toHaveCount(0);
  await dialog.locator('[data-action="cancel"]').click();
  const synced = await foundry(async ([i, mid]) => {
    const api = game.modules.get(mid).api;
    const f = api.fabricate ?? api;
    const item = game.items.get(i);
    const recipe = api.generateRecipe(Object.assign(item.toObject(), { uuid: item.uuid }), api.getOptions(), api.mulberry32(1));
    try { return JSON.parse(JSON.stringify(await f.syncFabricateRecipe(item, recipe, { schematic: null, itemEditable: true, notify: false }) ?? null)); } catch (e) { return { thrown: String(e) }; }
  }, [id, ID]);
  fs.writeFileSync(test.info().outputPath("C12-appel-non-mj.json"), JSON.stringify({ synced, calls: await fabCalls(foundry) }, null, 1));
  expect(synced?.thrown).toBeUndefined();
  expect(await fabCalls(foundry)).toEqual([]);
  await foundry(() => { delete game.user.isGM; });
  expect((await fabState(foundry, name)).system).toBeNull();
});

// ---------------------------------------------------------------------------------------------------- C13

test("C13: no Fabricate API call from the module before fabricate.ready, none at load without an application", async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => {
    const log = { early: [], writes: [], readyAt: null, patched: false };
    window.__c13 = log;
    const record = (kind, name) => {
      const stack = new Error().stack ?? "";
      if (!/drakkenheim-recipes/.test(stack)) return;
      if (kind === "writes" && !/.(create|update|delete|add|import|set|register|save|remove)/i.test(name)) return;
      log[kind].push({ name, ready: globalThis.game?.fabricate?.ready === true, readyHookSeen: log.readyAt !== null });
    };
    const patch = () => {
      const fab = globalThis.game?.fabricate;
      if (!fab || log.patched || typeof fab.getCraftingSystemManager !== "function") return;
      log.patched = true;
      for (const getter of ["getCraftingSystemManager", "getRecipeManager"]) {
        const orig = fab[getter].bind(fab);
        fab[getter] = () => {
          record("early", getter);
          const mgr = orig();
          return new Proxy(mgr, {
            get(target, prop) {
              const v = target[prop];
              if (typeof v !== "function") return v;
              return (...a) => { record("writes", `${getter}.${String(prop)}`); return v.apply(target, a); };
            }
          });
        };
      }
      globalThis.Hooks?.once("fabricate.ready", () => { log.readyAt = performance.now(); });
    };
    const timer = setInterval(() => { patch(); if (log.patched) clearInterval(timer); }, 2);
    let current;
    Object.defineProperty(globalThis, "game", { configurable: true, get: () => current, set: (v) => { current = v; patch(); } });
  });
  await page.goto("/game");
  await waitForGame(page);
  const active = await page.evaluate(() => game.modules.get("fabricate")?.active === true);
  test.skip(!active, "Fabricate is not loaded (run with --with=fabricate)");
  await page.evaluate(() => game.fabricate.whenReady?.());
  await page.waitForTimeout(3000);
  const log = await page.evaluate(() => window.__c13);
  fs.writeFileSync(test.info().outputPath("C13-appels-au-chargement.json"), JSON.stringify(log, null, 1));
  expect(log.patched, "spy installed on game.fabricate before the module's init").toBe(true);
  expect(log.early.filter((c) => !c.ready), "manager access before game.fabricate.ready").toEqual([]);
  expect(log.writes, "writes into Fabricate at load, without any application").toEqual([]);
});

fabTest("C13: world data of Fabricate is unchanged by a reload without any application", async ({ gamePage, foundry }) => {
  const name = `${SYS} reload`;
  await useNames(foundry, name);
  const id = await create(foundry, weaponData());
  await applyOn(foundry, { itemId: id });
  const before = await fabState(foundry, name);
  await gamePage.reload();
  await waitForGame(gamePage);
  await prepareFabricate(foundry);
  const after = await fabState(foundry, name);
  expect(after.recipes.length).toBe(before.recipes.length);
  expect(after.components.length).toBe(before.components.length);
  expect(after.tools.length).toBe(before.tools.length);
});

// ---------------------------------------------------------------------------------------------------- M2 / M3 / M4

fabTest("M2 (integration): 30 corpus items -> Fabricate accepts the recipes and they validate", async ({ foundry }) => {
  test.setTimeout(900_000);
  const name = `${SYS} m2`;
  await useNames(foundry, name);
  const corpus = loadCorpus();
  const step = Math.floor(corpus.length / 30);
  const sample = Array.from({ length: 30 }, (_, k) => corpus[k * step]);
  const rows = [];
  for (const [k, it] of sample.entries()) {
    const data = { ...it, name: `${PREFIX}${it.name}` };
    delete data.uuid; delete data._id;
    let row = { name: it.name, created: false, valid: null, status: null, message: null };
    try {
      const id = await foundry(async (d) => (await Item.implementation.create(d)).id, data);
      const r = await applyOn(foundry, { itemId: id, seed: k });
      row.status = r.fabricate?.status; row.message = r.fabricate?.message ?? null;
      row.created = ["created", "updated"].includes(row.status);
      row.valid = await foundry(async ([n, rname]) => {
        const sm = game.fabricate.getCraftingSystemManager();
        const sys = (await sm.getSystems()).find((s) => s.name === n);
        const rec = (await game.fabricate.getRecipeManager().getRecipes({ craftingSystemId: sys.id })).find((x) => x.name === rname);
        const v = new game.fabricate.api.Recipe(JSON.parse(JSON.stringify(rec))).validate?.();
        return v === undefined ? null : (v.valid ?? (Array.isArray(v) ? v.length === 0 : !!v));
      }, [name, `${PREFIX}${it.name}`]);
    } catch (e) { row.message = String(e); }
    rows.push(row);
  }
  const accepted = rows.filter((r) => r.created && r.valid !== false).length;
  fs.writeFileSync(test.info().outputPath("M2-echantillon-fabricate.json"), JSON.stringify({ accepted, total: rows.length, rows }, null, 1));
  test.info().annotations.push({ type: "metric M2 (integration)", description: `${accepted}/${rows.length}` });
  expect(rows).toHaveLength(30);
});

fabTest("M3: applying twice on 20 items creates no extra document and no extra Fabricate entry", async ({ foundry }) => {
  test.setTimeout(900_000);
  const name = `${SYS} m3`;
  await useNames(foundry, name);
  const ids = [];
  for (let i = 0; i < 20; i++) ids.push(await create(foundry, makeItem(i)));
  for (const [i, id] of ids.entries()) await applyOn(foundry, { itemId: id, seed: 100 + i });
  const count = async () => {
    const st = await fabState(foundry, name);
    const world = await foundry(() => ({ items: game.items.size, folders: game.folders.size }));
    return { ...world, components: st.components.length, tools: st.tools.length, recipes: st.recipes.length, defs: st.defs.length };
  };
  const first = await count();
  for (const id of ids) await applyOn(foundry, { itemId: id, reuse: true });
  const second = await count();
  fs.writeFileSync(test.info().outputPath("M3-comptes.json"), JSON.stringify({ first, second }, null, 1));
  expect(first.recipes).toBe(20);
  expect(second).toEqual(first);
});

fabTest("M4: canCraft with generic components, then without one component (10 recipes)", async ({ foundry }) => {
  test.setTimeout(600_000);
  const name = `${SYS} m4`;
  await useNames(foundry, name);
  const ids = [];
  for (let i = 0; i < 10; i++) ids.push(await create(foundry, makeItem(i, RARITIES[i % 5])));
  for (const [i, id] of ids.entries()) await applyOn(foundry, { itemId: id, seed: 200 + i });
  const rows = await foundry(async ([n, mid]) => {
    const sm = game.fabricate.getCraftingSystemManager();
    const rm = game.fabricate.getRecipeManager();
    const sys = (await sm.getSystems()).find((s) => s.name === n);
    const comps = await sm.getComponentsForSystem(sys.id);
    const tools = await sm.getToolsForSystem(sys.id);
    const recipes = await rm.getRecipes({ craftingSystemId: sys.id });
    const out = [];
    const tierOfSet = (s) => s.id.replace(/^ds-/, "");
    const pickComponent = (tags) => comps
      .filter((c) => tags.every((t) => (c.tags ?? []).includes(t)) && (c.registeredItemUuid ?? "").length && game.items.get(foundry.utils.parseUuid(c.registeredItemUuid).id)?.getFlag(mid, "generic"))
      .sort((a, b) => a.tags.length - b.tags.length)[0];
    const giveCopies = async (actor, uuid, qty) => {
      const src = await fromUuid(uuid);
      const docs = Array.from({ length: qty }, () => { const d = src.toObject(); delete d._id; return d; });
      return (await actor.createEmbeddedDocuments("Item", docs)).map((d) => d.id);
    };
    for (const recipe of recipes.filter((r) => r.name.startsWith("DRT "))) {
      const row = { recipe: recipe.name, tier: null, ok: null, missingRemoved: null, extra: {} };
      const set = recipe.ingredientSets[0];
      row.tier = tierOfSet(set);
      const actor = await Actor.implementation.create({ name: `DRT Crafter ${recipe.name}`, type: "character" });
      try {
        const toolUuid = (id) => tools.find((t) => t.id === id)?.registeredItemUuid;
        await giveCopies(actor, toolUuid(set.toolIds[0]), 1);
        const owned = [];
        for (const g of set.ingredientGroups) {
          const comp = pickComponent(g.options[0].match.tags);
          owned.push({ group: g, uuid: comp?.registeredItemUuid ?? null, ids: comp ? await giveCopies(actor, comp.registeredItemUuid, g.options[0].quantity) : [] });
        }
        const r1 = await rm.canCraft([actor], recipe, { craftingActor: actor });
        row.ok = r1.canCraft;
        row.r1 = JSON.parse(JSON.stringify(r1.missing ?? null));
        // most specific group removed first (its part cannot be replaced by a more generic one)
        const victim = [...owned].sort((a, b) => b.group.options[0].match.tags.length - a.group.options[0].match.tags.length)[0];
        await actor.deleteEmbeddedDocuments("Item", victim.ids);
        const r2 = await rm.canCraft([actor], recipe, { craftingActor: actor });
        const miss = JSON.stringify(r2.missing?.ingredients ?? []);
        row.missingRemoved = { canCraft: r2.canCraft, count: (r2.missing?.ingredients ?? []).length, names: victim.group.name, namesMatch: miss.includes(victim.group.id) || miss.includes(victim.group.name), raw: JSON.parse(JSON.stringify(r2.missing ?? null)) };
        // extras: legendary workshop alone, lower workshop alone
        if (row.tier !== "legendary") {
          const legSet = recipe.ingredientSets.at(-1);
          const legTool = (await fromUuid(toolUuid(legSet.toolIds[0])));
          const toolDocs = actor.items.filter((i) => i.name.endsWith("Workshop")).map((i) => i.id);
          await actor.deleteEmbeddedDocuments("Item", toolDocs);
          await giveCopies(actor, legTool.uuid, 1);
          if (victim.uuid) await giveCopies(actor, victim.uuid, victim.group.options[0].quantity);
          const r3 = await rm.canCraft([actor], recipe, { craftingActor: actor });
          row.extra.legendaryToolAlone = r3.canCraft;
        }
      } finally { await actor.delete(); }
      out.push(row);
    }
    return out;
  }, [name, ID]);
  fs.writeFileSync(test.info().outputPath("M4-canCraft.json"), JSON.stringify(rows, null, 1));
  expect(rows).toHaveLength(10);
  const passed = rows.filter((r) => r.ok === true && r.missingRemoved?.canCraft === false && r.missingRemoved.count >= 1).length;
  test.info().annotations.push({ type: "metric M4", description: `${passed}/10` });
  for (const r of rows) {
    expect.soft(r.ok, `${r.recipe}: craftable with generic components`).toBe(true);
    expect.soft(r.missingRemoved?.canCraft, `${r.recipe}: not craftable without one component`).toBe(false);
    expect.soft(r.missingRemoved?.namesMatch, `${r.recipe}: missing ingredient identifies the removed group`).toBe(true);
    if ("legendaryToolAlone" in r.extra) expect.soft(r.extra.legendaryToolAlone, `${r.recipe}: higher workshop accepted`).toBe(true);
  }
});
