/* global window, Item, Actor, Folder */
// Helpers for the Fabricate integration tests (tests/integration/fabricate.spec.mjs).
//
// Selector / API contract expected from the module (see reports/tests/drakkenheim-recipes/fabricate/plan.md):
//   - dialog checkbox:   input[name="createFabricate"]   (only when GM and Fabricate ready)
//   - API:               game.modules.get("drakkenheim-recipes").api.fabricate = { isFabricateReady, checkFabricateApi,
//                        syncFabricateRecipe, translateRecipe, componentSpecs, workshopSpecs, rarityTags, renderRecipeText }
//                        (a flat copy on `api` itself is accepted too)
//   - api.applyRecipe(item, recipe, { createSchematic, createFabricate, notify }) -> { ..., fabricate: SyncResult|null }
//   - settings: fabricateEnabled, fabricateSystemName, fabricateComponentFolder, fabricateWorkshopFolder
//   - flag:     flags.drakkenheim-recipes.fabricate = { systemId, recipeId, recipeItemId, componentId, mode, updatedAt }
// Every function passed to `foundry(fn, arg)` is serialised: it must stay self-contained.
import { cleanup as baseCleanup, ID } from "./client.mjs";

export const COMP_FOLDER = "DRT Components";
export const WORK_FOLDER = "DRT Workshops";
export const FAB_BOX = 'input[name="createFabricate"]';

/** True when the Fabricate module is active in this run (`--with=fabricate`). */
export const fabricateActive = (foundry) => foundry(() => game.modules.get("fabricate")?.active === true);

/** Wait for Fabricate, close any welcome / migration window it opened in a fresh world. */
export const prepareFabricate = (foundry) =>
  foundry(async () => {
    await game.fabricate.whenReady?.();
    const closeAll = async () => {
      const apps = [...foundry.applications.instances.values(), ...Object.values(ui.windows ?? {})];
      for (const app of apps) {
        const text = `${app.id ?? ""} ${app.constructor?.name ?? ""} ${(app.options?.classes ?? []).join(" ")} ${app.title ?? ""}`;
        if (/fabricate|welcome|migrat/i.test(text) && !/RecipeDialog/.test(text)) { try { await app.close({ force: true }); } catch { /* already closing */ } }
      }
    };
    await closeAll();
    await new Promise((r) => setTimeout(r, 500));
    await closeAll();
    return game.fabricate.ready === true;
  });

/** Point the module at test-only system / folder names. */
export const useNames = (foundry, systemName) =>
  foundry(async ([mid, name, comp, work]) => {
    await game.settings.set(mid, "fabricateSystemName", name);
    await game.settings.set(mid, "fabricateComponentFolder", comp);
    await game.settings.set(mid, "fabricateWorkshopFolder", work);
    await game.settings.set(mid, "fabricateEnabled", true);
  }, [ID, systemName, COMP_FOLDER, WORK_FOLDER]);

/**
 * Generate a recipe for an item (or reuse its stored one) and apply it. Returns plain data.
 * `a` = { itemId?, uuid?, reuse?, recipe?, seed?, createSchematic?, createFabricate?, notify?, edit? }
 */
export const applyOn = (foundry, a) =>
  foundry(async (p) => {
    const api = game.modules.get(p.mid).api;
    const item = p.itemId ? game.items.get(p.itemId) : await fromUuid(p.uuid);
    let recipe = p.recipe ?? (p.reuse ? item.getFlag(p.mid, "recipe") : null);
    if (!recipe) recipe = api.generateRecipe(Object.assign(item.toObject(), { uuid: item.uuid }), api.getOptions(), api.mulberry32(p.seed ?? 1));
    if (p.edit) recipe = foundry.utils.mergeObject(recipe, p.edit, { inplace: false, overwrite: true });
    const res = await api.applyRecipe(item, recipe, { createSchematic: p.createSchematic ?? true, createFabricate: p.createFabricate ?? true, notify: p.notify ?? false });
    return JSON.parse(JSON.stringify({
      recipe, fabricate: res?.fabricate ?? null, schematicUuid: res?.schematic?.uuid ?? null, schematicId: res?.schematic?.id ?? null,
      itemUpdated: res?.itemUpdated ?? null, itemUuid: item.uuid
    }));
  }, { mid: ID, ...a });

/** Snapshot of everything Fabricate holds for a system name (plain JSON). */
export const fabState = (foundry, systemName) =>
  foundry(async (name) => {
    const sm = game.fabricate.getCraftingSystemManager();
    const rm = game.fabricate.getRecipeManager();
    const plain = (x) => JSON.parse(JSON.stringify(x ?? null));
    const system = (await sm.getSystems()).find((s) => s.name === name) ?? null;
    if (!system) return { system: null, components: [], tools: [], recipes: [], defs: [] };
    return {
      system: plain(system),
      components: plain(await sm.getComponentsForSystem(system.id)),
      tools: plain(await sm.getToolsForSystem(system.id)),
      recipes: plain(await rm.getRecipes({ craftingSystemId: system.id })),
      defs: plain((await sm.getRecipeItemDefinitions?.(system.id)) ?? [])
    };
  }, systemName);

/** Items of the world sitting in a folder of that name. */
export const itemsInFolder = (foundry, folderName) =>
  foundry((n) => game.items.filter((i) => i.folder?.name === n).map((i) => JSON.parse(JSON.stringify({
    id: i.id, uuid: i.uuid, name: i.name, type: i.type, subtype: i.system.type?.value, weight: i.system.weight?.value,
    price: i.system.price?.value, quantity: i.system.quantity, description: i.system.description?.value, flags: i.flags
  }))), folderName);

/**
 * Wrap the write methods of both managers to record calls (and optionally a snapshot of the item at the time).
 * `fail` = { method: "message" } makes that method throw; `absent` = [methods] shadows them with undefined.
 */
export const installSpy = (foundry, opts = {}) =>
  foundry(({ mid, itemId, fail = {}, absent = [] }) => {
    window.__fabCalls = [];
    window.__fabRestore ??= [];
    const sm = game.fabricate.getCraftingSystemManager();
    const rm = game.fabricate.getRecipeManager();
    const writes = {
      sm: ["createSystem", "updateSystem", "deleteSystem", "addItemFromUuid", "updateItem", "addToolFromUuid", "addRecipeItemFromUuid", "updateRecipeItemDefinition"],
      rm: ["createRecipe", "updateRecipe", "deleteRecipe"]
    };
    const snap = () => {
      const item = itemId ? game.items.get(itemId) : null;
      if (!item) return null;
      return {
        block: (item.system.description.value ?? "").includes("Crafting"),
        flag: !!item.getFlag(mid, "recipe"),
        schematic: game.items.some((i) => i.id !== itemId && i.getFlag(mid, "recipe"))
      };
    };
    for (const [obj, names] of [[sm, writes.sm], [rm, writes.rm]]) {
      for (const n of names) {
        const had = Object.prototype.hasOwnProperty.call(obj, n);
        const orig = obj[n];
        if (absent.includes(n)) {
          obj[n] = undefined;
          window.__fabRestore.push(() => { if (had) obj[n] = orig; else delete obj[n]; });
          continue;
        }
        if (typeof orig !== "function") continue;
        obj[n] = function (...args) {
          window.__fabCalls.push({ method: n, snap: snap() });
          if (fail[n]) throw new Error(fail[n]);
          return orig.apply(this, args);
        };
        window.__fabRestore.push(() => { if (had) obj[n] = orig; else delete obj[n]; });
      }
    }
    return { sameManager: sm === game.fabricate.getCraftingSystemManager() && rm === game.fabricate.getRecipeManager() };
  }, { mid: ID, ...opts });
export const fabCalls = (foundry) => foundry(() => window.__fabCalls ?? []);

/** Record console warnings that carry the module prefix. */
export const spyConsole = (foundry) =>
  foundry(() => {
    window.__warns = [];
    for (const k of ["warn", "error"]) {
      const orig = console[k];
      console[k] = function (...a) { window.__warns.push({ level: k, text: a.map(String).join(" ") }); return orig.apply(this, a); };
      window.__fabRestore ??= [];
      window.__fabRestore.push(() => { console[k] = orig; });
    }
  });
export const warns = (foundry) => foundry(() => window.__warns ?? []);

/** Undo every spy / override, delete test data (items, actors, folders, test systems), reset settings. */
export const fabCleanup = (foundry) =>
  foundry(async ({ mid, comp, work }) => {
    for (const fn of window.__fabRestore ?? []) { try { fn(); } catch { /* ignore */ } }
    window.__fabRestore = [];
    delete game.user.isGM; // own override of the getter, if a test set one
    for (const app of foundry.applications.instances.values()) {
      if (app.constructor.name === "RecipeDialog") await app.close();
    }
    const actors = game.actors.filter((a) => a.name.startsWith("DRT "));
    if (actors.length) await Actor.implementation.deleteDocuments(actors.map((a) => a.id));
    const fab = game.fabricate;
    if (fab?.ready) {
      try {
        const sm = fab.getCraftingSystemManager();
        const rm = fab.getRecipeManager();
        for (const s of await sm.getSystems()) {
          if (!s.name.startsWith("DRT ")) continue;
          for (const r of await rm.getRecipes({ craftingSystemId: s.id })) { try { await rm.deleteRecipe(r.id); } catch { /* ignore */ } }
          try { await sm.deleteSystem?.(s.id); } catch { /* ignore */ }
        }
      } catch { /* Fabricate not usable: nothing to clean */ }
    }
    const generic = game.items.filter((i) => [comp, work].includes(i.folder?.name) || i.getFlag(mid, "generic"));
    if (generic.length) await Item.implementation.deleteDocuments(generic.map((i) => i.id));
    const folders = game.folders.filter((f) => f.type === "Item" && [comp, work].includes(f.name));
    if (folders.length) await Folder.implementation.deleteDocuments(folders.map((f) => f.id));
    await game.settings.set(mid, "fabricateEnabled", true);
    await game.settings.set(mid, "fabricateSystemName", "Monsters of Drakkenheim");
    await game.settings.set(mid, "fabricateComponentFolder", "Monster Components");
    await game.settings.set(mid, "fabricateWorkshopFolder", "Workshops");
  }, { mid: ID, comp: COMP_FOLDER, work: WORK_FOLDER });

/** Cleanup that also works without Fabricate (settings may not exist then). */
export async function fullCleanup(foundry) {
  const hasFab = await fabricateActive(foundry);
  if (hasFab) await fabCleanup(foundry);
  await baseCleanup(foundry);
}

/** Module API accessor evaluated in the client: `api.fabricate` or the flat API. */
export const fabApiPresent = (foundry) =>
  foundry((mid) => {
    const api = game.modules.get(mid).api;
    const f = api.fabricate ?? api;
    return { namespaced: !!api.fabricate, keys: Object.keys(f).filter((k) => /fabricate|translate|componentSpecs|workshopSpecs|rarityTags|renderRecipeText/i.test(k)) };
  }, ID);
