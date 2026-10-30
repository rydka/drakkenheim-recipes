/* global Folder, DOMParser, Item */
// C9-C12, C14, C15: applying the recipe to the item and creating the Schematic.
import fs from "node:fs";
import { expect, test } from "../../../../test-env/fixtures.mjs";
import {
  blockOf, cleanup, create, dialogLocator, ID, notes, openDialogViaButton, potionData, PREFIX, SEL, spyNotifications, weaponData
} from "../helpers/client.mjs";
import { CR, PRICE } from "../helpers/invariants.mjs";

test.afterEach(async ({ foundry }) => { await cleanup(foundry); });

// Synthetic description with the structure of a book recipe (see tests/fixtures/book-like.json).
const BEFORE = "<p>A plain hammer wrapped in grey cloth.</p>";
const BOOK = '<p><em><strong>Crafting.</strong></em> Creating a <em>Test Hammer</em> requires an Uncommon Workshop and the following Uncommon Components:</p><ul><li><p><strong>[Animus]</strong> Any</p></li><li><p><strong>[Bones]</strong> Skull from an Uncommon Humanoid</p></li></ul>';
const AFTER = "<p>@Embed[Compendium.example.guide.JournalEntry.AAAA.JournalEntryPage.BBBB inline]</p>";

const apply = async (dialog) => {
  await dialog.locator('[data-action="apply"]').click();
  await expect(dialog).toHaveCount(0);
};
const read = (foundry, id) => foundry(([i, mid]) => {
  const it = game.items.get(i);
  return { description: it.system.description.value, flag: it.getFlag(mid, "recipe") ?? null };
}, [id, ID]);
const schematics = (foundry) => foundry((mid) => game.items.filter((i) => i.type === "loot" && i.getFlag(mid, "recipe")).map((i) => ({
  id: i.id, name: i.name, type: i.type, subtype: i.system.type?.value, rarities: [...(i.system.rarities ?? [])],
  price: i.system.price, weight: i.system.weight?.value, description: i.system.description.value, flag: i.getFlag(mid, "recipe"),
  folder: i.folder?.name ?? null, folderType: i.folder?.type ?? null, ownership: i.ownership.default
})), ID);

test("C9: apply appends the Crafting block at the end, the rest of the description is intact", async ({ gamePage, foundry }) => {
  const id = await create(foundry, weaponData());
  const dialog = await openDialogViaButton(gamePage, foundry, id);
  await apply(dialog);
  const { description, flag } = await read(foundry, id);
  expect(description.startsWith("<p>A blade wreathed in flame.</p>")).toBe(true);
  const block = await foundry(([f]) => game.modules.get("drakkenheim-recipes").api.renderRecipeHtml(f, { lang: "en" }), [flag]);
  expect(description.trimEnd().endsWith(block)).toBe(true);
  expect(description.split("Crafting.").length - 1).toBe(1);
  expect(description).toContain("Each item must come from a different monster.");
  expect(description).toMatch(/Creating (a|an) <em>DRT Flame Blade<\/em> requires a Rare Workshop and the following Rare Components:/);
  fs.writeFileSync(test.info().outputPath("C9-description-appliquee.html"), description);
});

test("C9: a book recipe is replaced in place, never duplicated; surrounding text and @Embed are kept", async ({ gamePage, foundry }) => {
  const id = await create(foundry, weaponData({ system: { type: { value: "martialM" }, rarities: ["uncommon"], description: { value: BEFORE + BOOK + AFTER } } }));
  const dialog = await openDialogViaButton(gamePage, foundry, id);
  await expect(dialog).toContainText(/already|existing|replace|existe|remplac/i); // scenario 3 warning
  await gamePage.screenshot({ path: test.info().outputPath("C9-avertissement-recette-existante.png") });
  await apply(dialog);
  const first = await read(foundry, id);
  const block = await foundry(([f]) => game.modules.get("drakkenheim-recipes").api.renderRecipeHtml(f, { lang: "en" }), [first.flag]);
  expect(first.description).toBe(BEFORE + block + AFTER);
  expect(first.description.split("Crafting.").length - 1).toBe(1);
  expect(first.description).not.toContain("Test Hammer");

  // second application: replaced again, still a single block
  const dialog2 = await openDialogViaButton(gamePage, foundry, id);
  await apply(dialog2);
  const second = await read(foundry, id);
  const block2 = await foundry(([f]) => game.modules.get("drakkenheim-recipes").api.renderRecipeHtml(f, { lang: "en" }), [second.flag]);
  expect(second.description).toBe(BEFORE + block2 + AFTER);
  expect(second.description.split("Crafting.").length - 1).toBe(1);
  fs.writeFileSync(test.info().outputPath("C9-remplacement.json"), JSON.stringify({ before: BEFORE + BOOK + AFTER, afterFirst: first.description, afterSecond: second.description }, null, 2));
});

test("C9: the applied text equals what was shown after the GM edited a line", async ({ gamePage, foundry }) => {
  const id = await create(foundry, weaponData());
  const dialog = await openDialogViaButton(gamePage, foundry, id);
  await dialog.locator(SEL.row).nth(1).locator('input[type="text"]').fill("Skull from a Rare Giant (CR 5–10)");
  await apply(dialog);
  const { description } = await read(foundry, id);
  expect(description).toContain("<strong>[Bones]</strong> Skull from a Rare Giant (CR 5–10)</p>");
});

test("C10: the flag has the documented data and rebuilds the paragraph exactly", async ({ gamePage, foundry }) => {
  const id = await create(foundry, weaponData());
  const dialog = await openDialogViaButton(gamePage, foundry, id);
  await apply(dialog);
  const { description, flag } = await read(foundry, id);
  expect(flag).toMatchObject({
    version: 1, itemName: `${PREFIX}Flame Blade`, rarity: "rare", workshop: "rare", crRange: "5–10", distinctSources: true, lang: "en"
  });
  expect(typeof flag.generatedAt).toBe("string");
  expect(Number.isNaN(Date.parse(flag.generatedAt))).toBe(false);
  expect(flag.components).toHaveLength(5);
  expect(flag.components[0].category).toBe("animus");
  for (const c of flag.components) {
    expect(c).toHaveProperty("category");
    expect(c).toHaveProperty("designation");
    expect(Array.isArray(c.creatureTypes)).toBe(true);
    expect(c.rarity).toBe("rare");
  }
  const rebuilt = await foundry(([f]) => game.modules.get("drakkenheim-recipes").api.renderRecipeHtml(f, { lang: "en" }), [flag]);
  expect(await blockOf(foundry, description)).toBe(rebuilt);
  fs.writeFileSync(test.info().outputPath("C10-flag.json"), JSON.stringify(flag, null, 2));
});

test("C11: the Schematic is created in the Schematics folder with the right data", async ({ gamePage, foundry }) => {
  const id = await create(foundry, weaponData());
  const dialog = await openDialogViaButton(gamePage, foundry, id);
  await apply(dialog);
  const { flag } = await read(foundry, id);
  const list = await schematics(foundry);
  expect(list).toHaveLength(1);
  const s = list[0];
  expect(s.name).toBe(`Schematic: ${PREFIX}Flame Blade`);
  expect(s.type).toBe("loot");
  expect(s.subtype).toBe("gear");
  expect(s.folder).toBe("Schematics");
  expect(s.folderType).toBe("Item");
  expect(s.rarities).toEqual(["rare"]);
  expect(s.price).toMatchObject({ value: 500, denomination: "gp" });
  expect(s.weight).toBe(0);
  const uuid = `Item.${id}`;
  expect(s.description).toContain(`@UUID[${uuid}]`);
  expect(s.description).toContain("Rare Workshop");
  const lis = await foundry(([f]) => {
    const html = game.modules.get("drakkenheim-recipes").api.renderRecipeHtml(f, { lang: "en" });
    return [...new DOMParser().parseFromString(html, "text/html").querySelectorAll("li")].map((li) => li.textContent);
  }, [flag]);
  expect(lis).toHaveLength(5);
  const plain = await foundry((h) => new DOMParser().parseFromString(h, "text/html").body.textContent, s.description);
  for (const t of lis) expect(plain).toContain(t);
  expect(s.flag).toEqual(flag);
  expect(s.ownership).toBe(0); // players have no default right
  await gamePage.screenshot({ path: test.info().outputPath("C11-schematic-cree.png") });
  fs.writeFileSync(test.info().outputPath("C11-schematic.json"), JSON.stringify(s, null, 2));
});

test("C11: Schematic price follows Appendix D (very rare potion: 4 components, 5000 gp)", async ({ gamePage, foundry }) => {
  const id = await create(foundry, potionData());
  const dialog = await openDialogViaButton(gamePage, foundry, id);
  await apply(dialog);
  const [s] = await schematics(foundry);
  expect(s.price.value).toBe(PRICE.veryRare);
  expect(s.rarities).toEqual(["veryRare"]);
  expect(s.flag.components).toHaveLength(4);
  expect(s.flag.crRange).toBe(CR.veryRare);
  expect(s.flag.distinctSources).toBe(false);
});

test("C11: a second application updates the Schematic instead of duplicating it and reuses the folder", async ({ gamePage, foundry }) => {
  const id = await create(foundry, weaponData());
  await apply(await openDialogViaButton(gamePage, foundry, id));
  const [first] = await schematics(foundry);
  await apply(await openDialogViaButton(gamePage, foundry, id));
  const list = await schematics(foundry);
  expect(list).toHaveLength(1);
  expect(list[0].id).toBe(first.id);
  const { flag } = await read(foundry, id);
  expect(list[0].flag).toEqual(flag);
  const folders = await foundry(() => game.folders.filter((f) => f.type === "Item" && f.name === "Schematics").length);
  expect(folders).toBe(1);
});

test("C11: an existing `Schematics` folder is reused; the folder name is a setting", async ({ gamePage, foundry }) => {
  await foundry(() => Folder.implementation.create({ name: "Schematics", type: "Item" }));
  const id = await create(foundry, weaponData());
  await apply(await openDialogViaButton(gamePage, foundry, id));
  expect(await foundry(() => game.folders.filter((f) => f.type === "Item" && f.name === "Schematics").length)).toBe(1);
  expect((await schematics(foundry))[0].folder).toBe("Schematics");

  await foundry((mid) => game.settings.set(mid, "schematicFolder", "DRT Plans"), ID);
  const id2 = await create(foundry, weaponData({ name: `${PREFIX}Other Blade` }));
  await apply(await openDialogViaButton(gamePage, foundry, id2));
  const other = (await schematics(foundry)).find((s) => s.name.includes("Other Blade"));
  expect(other.folder).toBe("DRT Plans");
});

test("C11: with the checkbox cleared, no Schematic and no folder are created but the item is updated", async ({ gamePage, foundry }) => {
  const id = await create(foundry, weaponData());
  const dialog = await openDialogViaButton(gamePage, foundry, id);
  await dialog.locator('input[name="createSchematic"]').uncheck();
  await apply(dialog);
  expect(await schematics(foundry)).toHaveLength(0);
  expect(await foundry(() => game.folders.filter((f) => f.type === "Item" && f.name === "Schematics").length)).toBe(0);
  expect((await read(foundry, id)).flag).not.toBeNull();
});

test("C12: item from a locked compendium is not modified, the Schematic is created and a notification explains", async ({ gamePage, foundry }) => {
  const info = await foundry(async () => {
    for (const key of ["dnd5e.items", "dnd5e.equipment24"]) {
      const pack = game.packs.get(key);
      if (!pack) continue;
      const entry = pack.index.find((e) => e.name === "Cloak of Elvenkind");
      if (entry) return { uuid: entry.uuid, locked: pack.locked, pack: key };
    }
    return null;
  });
  expect(info, "Cloak of Elvenkind not found in the dnd5e packs").not.toBeNull();
  expect(info.locked).toBe(true);
  await spyNotifications(foundry);
  const before = await foundry(async (uuid) => JSON.stringify((await fromUuid(uuid)).toObject()), info.uuid);
  await foundry(async (uuid) => (await fromUuid(uuid)).sheet.render({ force: true }), info.uuid);
  const sheet = gamePage.locator(`[id$="${info.uuid.replace(/\./g, "-")}"]`).first();
  await sheet.waitFor({ state: "visible" });
  await sheet.locator(SEL.open).click();
  const dialog = dialogLocator(gamePage);
  await dialog.waitFor({ state: "visible" });
  await expect(dialog.locator(SEL.row).first()).toBeVisible(); // the preview works on a locked item
  await dialog.locator('[data-action="apply"]').click();
  await expect(dialog).toHaveCount(0);
  const after = await foundry(async (uuid) => JSON.stringify((await fromUuid(uuid)).toObject()), info.uuid);
  expect(after).toBe(before);
  const list = await schematics(foundry);
  expect(list).toHaveLength(1);
  expect(list[0].name).toBe("Schematic: Cloak of Elvenkind");
  expect(list[0].description).toContain(`@UUID[${info.uuid}]`);
  const messages = await notes(foundry);
  expect(messages.some((m) => /locked|verrouill|compendium/i.test(m.message)), JSON.stringify(messages)).toBe(true);
  await gamePage.screenshot({ path: test.info().outputPath("C12-compendium-verrouille.png") });
  fs.writeFileSync(test.info().outputPath("C12-notifications.json"), JSON.stringify(messages, null, 2));
  await foundry((uuid) => fromUuid(uuid).then((d) => d.sheet.close()), info.uuid);
});

test("C12: an item the user may not modify is left untouched, the Schematic is still created", async ({ foundry }) => {
  const id = await create(foundry, weaponData());
  const result = await foundry(async ([i, mid]) => {
    const item = game.items.get(i);
    const before = JSON.stringify(item.toObject());
    const api = game.modules.get(mid).api;
    const recipe = api.generateRecipe(item.toObject(), { counts: { permanent: [4, 4, 5, 6, 7], consumable: [3, 3, 3, 4, 4] }, lang: "en" }, api.mulberry32(5));
    item.canUserModify = () => false; // simulates a missing permission
    const res = await api.applyRecipe(item, recipe, { createSchematic: true });
    delete item.canUserModify;
    return { res: { itemUpdated: res.itemUpdated, reason: res.reason ?? null, hasSchematic: !!res.schematic }, same: JSON.stringify(item.toObject()) === before };
  }, [id, ID]);
  expect(result.same).toBe(true);
  expect(result.res.itemUpdated).toBe(false);
  expect(result.res.reason).toBe("permission");
  expect(result.res.hasSchematic).toBe(true);
  expect(await schematics(foundry)).toHaveLength(1);
});

test("C14: scenario 3 on a real Drakkenheim item (only when drakkenheim-monsters is loaded)", async ({ gamePage, foundry }) => {
  const found = await foundry(() => {
    if (!game.modules.get("drakkenheim-monsters")?.active) return null;
    for (const pack of game.packs) {
      if (pack.metadata.packageName !== "drakkenheim-monsters" || pack.documentName !== "Item") continue;
      const e = pack.index.find((x) => x.name === "Dazing Hammer");
      if (e) return e.uuid;
    }
    return null;
  });
  test.skip(!found, "drakkenheim-monsters not loaded: run with --with=drakkenheim-monsters");
  const id = await foundry(async (uuid) => {
    const src = await fromUuid(uuid);
    return (await Item.implementation.create({ ...src.toObject(), name: "DRT Dazing Hammer" })).id;
  }, found);
  const before = await foundry((i) => game.items.get(i).system.description.value, id);
  expect(before).toContain("Crafting.");
  const dialog = await openDialogViaButton(gamePage, foundry, id);
  await expect(dialog).toContainText(/already|existing|replace|existe|remplac/i);
  // Cancel first: nothing changes
  await dialog.locator('[data-action="cancel"]').click();
  expect(await foundry((i) => game.items.get(i).system.description.value, id)).toBe(before);
  await apply(await openDialogViaButton(gamePage, foundry, id));
  const after = await foundry((i) => game.items.get(i).system.description.value, id);
  expect(after.split("Crafting.").length - 1).toBe(1);
  const embed = before.match(/@Embed\[[^\]]*\]/)?.[0];
  if (embed) expect(after).toContain(embed);
  await gamePage.screenshot({ path: test.info().outputPath("C14-dazing-hammer.png") });
  fs.writeFileSync(test.info().outputPath("C14-dazing-hammer.json"), JSON.stringify({ before, after }, null, 2));
});

test("C15: with `recipeLanguage` = fr the generated text and the Schematic name are French", async ({ gamePage, foundry }) => {
  await foundry((mid) => game.settings.set(mid, "recipeLanguage", "fr"), ID);
  const id = await create(foundry, weaponData({ name: `${PREFIX}Lame de feu` }));
  await apply(await openDialogViaButton(gamePage, foundry, id));
  const { description, flag } = await read(foundry, id);
  expect(description).toContain("Artisanat.");
  expect(description).toMatch(/La création (de |d'|du |de la |des )?<em>DRT Lame de feu<\/em> requiert un Atelier Rare et les Composants Rares suivants :/);
  expect(description).toContain("Chaque Composant doit provenir d'un monstre différent.");
  expect(description).not.toContain("Crafting.");
  expect(description).toContain("FP 5–10");
  expect(flag.lang).toBe("fr");
  const [s] = await schematics(foundry);
  expect(s.name).toBe(`Schéma : ${PREFIX}Lame de feu`);
  fs.writeFileSync(test.info().outputPath("C15-description-fr.html"), description);
});

test("C15: English is the default recipe language whatever the client language", async ({ gamePage, foundry }) => {
  expect(await foundry((mid) => game.settings.get(mid, "recipeLanguage"), ID)).toBe("en");
  const id = await create(foundry, weaponData());
  await apply(await openDialogViaButton(gamePage, foundry, id));
  expect((await read(foundry, id)).description).toContain("Crafting.");
});

test("C15: the French interface file mirrors the English keys", async ({ gamePage }) => {
  const result = await gamePage.evaluate(async (mid) => {
    const get = async (l) => (await fetch(`modules/${mid}/lang/${l}.json`)).json();
    const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
    const en = Object.fromEntries(flat(await get("en"))), fr = Object.fromEntries(flat(await get("fr")));
    const missing = Object.keys(en).filter((k) => !(k in fr));
    const untranslated = Object.keys(en).filter((k) => fr[k] === en[k] && /[a-z]{4,}/i.test(en[k]));
    return { keys: Object.keys(en).length, missing, untranslated, extra: Object.keys(fr).filter((k) => !(k in en)) };
  }, ID);
  fs.writeFileSync(test.info().outputPath("C15-lang-parite.json"), JSON.stringify(result, null, 2));
  expect(result.keys).toBeGreaterThan(5);
  expect(result.missing).toEqual([]);
  expect(result.extra).toEqual([]);
});
