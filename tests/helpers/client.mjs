/* global Item, Folder, window, DOMParser */
// Helpers for the Playwright integration tests (drakkenheim-recipes).
// Selector contract with the dialog template (templates/recipe-dialog.hbs):
//   - actions: data-action = regenerate | apply | cancel | addRow | deleteRow
//   - one `.recipe-row` per component, holding a <select> (category) and a text <input> (line text)
//   - `select[name="rarity"]` for the workshop rarity; one checkbox (create Schematic)
export const ID = "drakkenheim-recipes";
export const PREFIX = "DRT ";
export const OPTS = { counts: { permanent: [4, 4, 5, 6, 7], consumable: [3, 3, 3, 4, 4] }, lang: "en" };

export const SEL = {
  open: ".drakkenheim-recipes-open",
  dialog: '.application:has([data-action="regenerate"])',
  row: ".recipe-row",
  rarity: 'select[name="rarity"]'
};

export const weaponData = (over = {}) => ({
  name: `${PREFIX}Flame Blade`, type: "weapon",
  system: { type: { value: "martialM" }, rarities: ["rare"], description: { value: "<p>A blade wreathed in flame.</p>" } }, ...over
});
export const potionData = (over = {}) => ({
  name: `${PREFIX}Potion of Test`, type: "consumable",
  system: { type: { value: "potion" }, rarities: ["veryRare"], description: { value: "<p>Drink it.</p>" } }, ...over
});

export const create = (foundry, data) =>
  foundry(async (d) => (await Item.implementation.create(d)).id, data);

/** Delete everything the tests may have created in the world. */
export const cleanup = (foundry) =>
  foundry(async (id) => {
    for (const app of foundry.applications.instances.values()) {
      if (app.constructor.name === "RecipeDialog" || app.document?.name?.startsWith("DRT ")) await app.close();
    }
    const doomed = game.items.filter((i) => i.name.startsWith("DRT ") || i.name.startsWith("Schematic: DRT ") || i.name.startsWith("Schéma : DRT ") || i.getFlag(id, "recipe"));
    if (doomed.length) await Item.implementation.deleteDocuments(doomed.map((i) => i.id));
    const folders = game.folders.filter((f) => f.type === "Item" && ["Schematics", "DRT Plans", "Schémas"].includes(f.name));
    if (folders.length) await Folder.implementation.deleteDocuments(folders.map((f) => f.id));
    await game.settings.set(id, "recipeLanguage", "en");
    await game.settings.set(id, "schematicFolder", "Schematics");
    await game.settings.set(id, "createSchematic", true);
  }, ID);

export const sheetLocator = (page, itemId) => page.locator(`[id$="-Item-${itemId}"]`);
export const dialogLocator = (page) => page.locator(SEL.dialog).last();

export async function openSheet(page, foundry, itemId) {
  await foundry((i) => game.items.get(i).sheet.render({ force: true }), itemId);
  const sheet = sheetLocator(page, itemId);
  await sheet.waitFor({ state: "visible" });
  return sheet;
}

/** Open the sheet and click the header button; returns the dialog locator. */
export async function openDialogViaButton(page, foundry, itemId) {
  const sheet = await openSheet(page, foundry, itemId);
  await sheet.locator(SEL.open).click();
  const dialog = dialogLocator(page);
  await dialog.waitFor({ state: "visible" });
  return dialog;
}

/** Record notifications into window.__notes. */
export const spyNotifications = (foundry) =>
  foundry(() => {
    window.__notes = [];
    window.__notesOrig ??= {};
    for (const k of ["info", "warn", "error"]) {
      window.__notesOrig[k] ??= ui.notifications[k];
      ui.notifications[k] = function (m, ...r) { window.__notes.push({ level: k, message: String(m) }); return window.__notesOrig[k].call(this, m, ...r); };
    }
  });
export const notes = (foundry) => foundry(() => window.__notes ?? []);

/** Extract the module block (elements carrying the module class) from a description. */
export const blockOf = (foundry, html) =>
  foundry((h) => {
    const doc = new DOMParser().parseFromString(`<body>${h}</body>`, "text/html");
    return [...doc.body.querySelectorAll(".drakkenheim-recipes-recipe")].map((e) => e.outerHTML).join("");
  }, html);

export const snapshotWorld = (foundry) =>
  foundry(() => ({ items: game.items.size, folders: game.folders.size, docs: game.items.map((i) => JSON.stringify(i.toObject())).sort() }));
