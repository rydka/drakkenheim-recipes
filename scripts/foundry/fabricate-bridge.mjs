/**
 * The only file that talks to Fabricate (spec `fabricate`, C1 to C13). Detection (`fabricate.ready` hook and
 * `game.fabricate.ready`), API check, then, at the end of `applyRecipe`, creation or reuse in this order: system,
 * vocabulary, folders and generic items, components, tools, recipe item (Schematic), recipe, link, flag. Every
 * Fabricate call goes through `step`, which turns an exception into an error result: nothing is thrown to the
 * caller, nothing written before the error is undone (reapplying finishes the work, everything is idempotent).
 */
import { FLAG_FABRICATE, FLAG_GENERIC, MODULE_ID } from "../constants.mjs";
import {
  FABRICATE_DEFAULT_MODE, componentItemData, missingVocabulary, translateRecipe, vocabularyPatch, workshopItemData
} from "../core/fabricate-translate.mjs";
import { getItemFolder } from "./folders.mjs";
import { getOptions } from "./settings.mjs";

const FABRICATE_ID = "fabricate";

/** Methods the module needs, by manager (C11: a missing one means no write at all). */
export const REQUIRED_API = {
  craftingSystemManager: [
    "getSystems", "createSystem", "updateSystem", "getComponentsForSystem", "getToolsForSystem", "addItemFromUuid",
    "updateItem", "addToolFromUuid", "addRecipeItemFromUuid", "updateRecipeItemDefinition"
  ],
  recipeManager: ["getRecipe", "getRecipes", "createRecipe", "updateRecipe"]
};

let readyHookSeen = false;
let apiWarned = false;

/** Listen for Fabricate's ready hook (registered at `init`; the only Fabricate line outside this file). */
export function registerFabricateHooks() {
  readyHookSeen = false;
  Hooks.once("fabricate.ready", () => {
    readyHookSeen = true;
  });
}

/** Reset the session state (unit tests). */
export function resetFabricateState() {
  readyHookSeen = false;
  apiWarned = false;
}

/** Whether Fabricate is active and ready: its hook was seen, or its instance says so (no API call, C13). */
export function isFabricateReady() {
  if (game.modules?.get?.(FABRICATE_ID)?.active === false) return false;
  return readyHookSeen || game.fabricate?.ready === true;
}

/**
 * Check that Fabricate exposes what the module uses (C11).
 * @returns {{ ok: boolean, missing: string[] }}
 */
export function checkFabricateApi() {
  const missing = [];
  const fab = game.fabricate;
  if (!fab) return { ok: false, missing: ["game.fabricate"] };
  for (const [getter, methods] of [["getCraftingSystemManager", REQUIRED_API.craftingSystemManager], ["getRecipeManager", REQUIRED_API.recipeManager]]) {
    if (typeof fab[getter] !== "function") {
      missing.push(getter);
      continue;
    }
    const manager = fab[getter]();
    if (!manager) {
      missing.push(`${getter}()`);
      continue;
    }
    for (const method of methods) if (typeof manager[method] !== "function") missing.push(`${getter}().${method}`);
  }
  return { ok: missing.length === 0, missing };
}

class StepError extends Error {
  constructor(step, cause) {
    super(cause?.message ?? String(cause));
    this.name = "StepError";
    this.step = step;
    this.cause = cause;
  }
}

/** Run one Fabricate (or document) step; an exception becomes a `StepError` naming the step. */
async function step(name, fn) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof StepError) throw err;
    throw new StepError(name, err);
  }
}


const sourceOf = (entry) => [entry?.registeredItemUuid, entry?.originItemUuid, ...(entry?.aliasItemUuids ?? [])].filter(Boolean);

function readFlag(doc, key) {
  if (!doc) return null;
  if (typeof doc.getFlag === "function") return doc.getFlag(MODULE_ID, key) ?? null;
  return doc.flags?.[MODULE_ID]?.[key] ?? null;
}

/**
 * The generic items of a folder (components or Workshops), created when missing: by module flag first, then by
 * name (a GM-made item of the same name is reused, never duplicated).
 * @returns {Promise<{ items: Object<string, Item>, created: number }>}  Items by spec key.
 */
async function ensureGenericItems(folder, specs, kind, toData) {
  const inFolder = () => game.items.filter((i) => i.folder?.id === folder.id);
  const find = (spec) => {
    const items = inFolder();
    return items.find((i) => {
      const flag = readFlag(i, FLAG_GENERIC);
      return flag?.kind === kind && flag?.key === spec.key;
    }) ?? items.find((i) => i.name === spec.name) ?? null;
  };
  const items = {};
  const missing = [];
  for (const spec of specs) {
    const existing = find(spec);
    if (existing) items[spec.key] = existing;
    else missing.push(spec);
  }
  if (missing.length) {
    const Item = foundry.utils.getDocumentClass("Item");
    await Item.createDocuments(missing.map((spec) => toData(spec, { folderId: folder.id })));
    // The documents are not returned in the order of the list: each one is found again by its flag, then its name
    for (const spec of missing) {
      const doc = find(spec);
      if (!doc) throw new Error(`Generic item "${spec.name}" was not created`);
      items[spec.key] = doc;
    }
  }
  return { items, created: missing.length };
}

/** Fabricate's default component category ("general") or none. */
const unsetCategory = (category) => {
  const value = String(category ?? "").trim();
  return !value || value.toLowerCase() === "general";
};

/**
 * Register an item as a component of the system (reused when already registered), then complete it: our category
 * when it has none, our tags added to those already there (the GM's own edits are kept).
 */
async function ensureComponent(manager, systemId, item, spec, created) {
  const uuid = item.uuid;
  let component = manager.getComponentsForSystem(systemId).find((c) => sourceOf(c).includes(uuid)) ?? null;
  if (!component) {
    const res = await step("addItemFromUuid", () => manager.addItemFromUuid(systemId, uuid));
    component = res?.item ?? res;
    if (res?.action === "added") created.components += 1;
  }
  if (spec) {
    const current = Array.isArray(component.tags) ? component.tags : [];
    const category = unsetCategory(component.category) ? spec.categoryLabel : component.category;
    const tags = [...new Set([...current, ...spec.tags])];
    if (category !== component.category || tags.length !== current.length) {
      const updated = await step("updateItem", () => manager.updateItem(systemId, component.id, { category, tags }));
      component = updated?.item ?? updated ?? component;
    }
  }
  return component;
}

/** The recipe to update (C8): the one of the flag if it still exists in that system, else one of the same name and result. */
function findExistingRecipe(recipes, systemId, flag, name, resultComponentId) {
  if (flag?.recipeId) {
    const byFlag = recipes.getRecipe(flag.recipeId);
    if (byFlag && byFlag.craftingSystemId === systemId) return byFlag;
  }
  const candidates = recipes.getRecipes({ craftingSystemId: systemId }) ?? [];
  return candidates.find((r) => r.name === name && (r.resultGroups ?? [])
    .some((g) => (g.results ?? []).some((res) => res.componentId === resultComponentId))) ?? null;
}

function notifyError(notify, key, data) {
  if (notify) ui.notifications.error(game.i18n.format(`${MODULE_ID}.Messages.${key}`, data));
}

/**
 * Create or update the Fabricate recipe of an item (C2 to C12). Never throws.
 * @param {Item} item                       The magic item (world or compendium).
 * @param {object} recipe                   The structured recipe just applied.
 * @param {object} [options]
 * @param {Item|null} [options.schematic]   The Schematic created or updated by `applyRecipe`, if any.
 * @param {boolean} [options.itemEditable]  Whether the item could be written (else the trace goes on the Schematic).
 * @param {boolean} [options.notify]
 * @returns {Promise<{ status: "created"|"updated"|"error"|"unavailable"|"skipped", systemId?: string,
 *   recipeId?: string, recipeItemId?: string|null, created?: object, step?: string, message?: string }>}
 */
export async function syncFabricateRecipe(item, recipe, { schematic = null, itemEditable = true, notify = true } = {}) {
  if (!game.user?.isGM) return { status: "skipped", reason: "notGM" };
  if (!isFabricateReady()) return { status: "unavailable", reason: "notReady" };
  const check = checkFabricateApi();
  if (!check.ok) {
    if (!apiWarned) {
      apiWarned = true;
      console.warn(`${MODULE_ID} | Fabricate API mismatch, nothing written. Missing: ${check.missing.join(", ")}`);
    }
    notifyError(notify, "FabricateApi", { missing: check.missing.join(", ") });
    return { status: "unavailable", reason: "api", missing: check.missing };
  }

  const options = getOptions().fabricate;
  const lang = recipe.lang === "fr" ? "fr" : "en";
  const systems = game.fabricate.getCraftingSystemManager();
  const recipes = game.fabricate.getRecipeManager();
  const created = { system: false, components: 0, tools: 0, items: 0 };
  const previous = readFlag(item, FLAG_FABRICATE) ?? readFlag(schematic, FLAG_FABRICATE);

  try {
    // 1. Existing system (read only) and its mode
    let system = await step("getSystems", () => systems.getSystems().find((s) => s.name === options.systemName) ?? null);
    const mode = system?.resolutionMode ?? FABRICATE_DEFAULT_MODE;
    const baseCtx = { lang, mode, systemName: options.systemName };

    // 2. Structure check with placeholder ids, before any write
    const draft = translateRecipe(recipe, { ...baseCtx, systemId: system?.id ?? "system" });
    const Recipe = game.fabricate.api?.Recipe;
    if (typeof Recipe === "function") {
      await step("validate", () => {
        const verdict = new Recipe(draft.recipeData).validateStructure?.();
        if (verdict && verdict.valid === false) throw new Error((verdict.errors ?? []).join("; ") || "invalid recipe");
      });
    }

    // 3. System: created, or completed with the missing vocabulary only
    if (!system) {
      system = await step("createSystem", () => systems.createSystem(draft.system, { notify: false }));
      created.system = true;
    } else {
      const missing = missingVocabulary(system, draft.system);
      if (missing) system = await step("updateSystem", () => systems.updateSystem(system.id, vocabularyPatch(system, missing)));
    }
    const systemId = system.id;

    // 4. Folders, generic items and Workshops of the world
    const componentFolder = await step("componentFolder", () => getItemFolder(options.componentFolder));
    const workshopFolder = await step("workshopFolder", () => getItemFolder(options.workshopFolder));
    const generic = await step("createItems", () => ensureGenericItems(componentFolder, draft.components, "component", componentItemData));
    const workshops = await step("createItems", () => ensureGenericItems(workshopFolder, draft.tools, "workshop", workshopItemData));
    created.items = generic.created + workshops.created;

    // 5. Components: generic parts, then the magic item itself as the result
    const componentIds = {};
    for (const spec of draft.components) {
      componentIds[spec.key] = (await ensureComponent(systems, systemId, generic.items[spec.key], spec, created)).id;
    }
    const resultComponentId = (await ensureComponent(systems, systemId, item, null, created)).id;

    // 6. Tools
    const toolIds = {};
    for (const spec of draft.tools) {
      const tool = workshops.items[spec.tier];
      let entry = systems.getToolsForSystem(systemId).find((t) => sourceOf(t).includes(tool.uuid)) ?? null;
      if (!entry) {
        const res = await step("addToolFromUuid", () => systems.addToolFromUuid(systemId, tool.uuid));
        entry = res?.item ?? res;
        if (res?.action === "added") created.tools += 1;
      }
      toolIds[spec.tier] = entry.id;
    }

    // 7. Recipe item (Schematic)
    let definition = null;
    if (schematic) {
      const res = await step("addRecipeItemFromUuid", () => systems.addRecipeItemFromUuid(systemId, schematic.uuid));
      definition = res?.item ?? res;
    }

    // 8. Recipe, with the real ids
    const final = translateRecipe(recipe, {
      ...baseCtx, systemId, componentIds, toolIds, resultComponentId,
      recipeItemId: definition?.id ?? null, schematicUuid: schematic?.uuid ?? null
    });
    const existing = findExistingRecipe(recipes, systemId, previous, final.recipeData.name, resultComponentId);
    let fabricateRecipe;
    let status;
    if (existing) {
      // The GM's choice to disable the recipe is kept: `enabled` is only set at creation
      const patch = { ...final.recipeData };
      delete patch.enabled;
      fabricateRecipe = await step("updateRecipe", () => recipes.updateRecipe(existing.id, patch, { notify: false }));
      status = "updated";
    } else {
      fabricateRecipe = await step("createRecipe", () => recipes.createRecipe(final.recipeData, { notify: false }));
      status = "created";
    }
    const recipeId = fabricateRecipe?.id ?? existing?.id;

    // 9. Link between the recipe item and the recipe (membership by `recipeIds`); the definition noted at the
    //    previous application loses the link when the Schematic is off or has changed
    if (definition) {
      const ids = definition.recipeIds ?? [];
      if (!ids.includes(recipeId)) {
        await step("updateRecipeItemDefinition", () =>
          systems.updateRecipeItemDefinition(systemId, definition.id, { recipeIds: [...ids, recipeId] }));
      }
    }
    const previousDefinitionId = previous?.recipeItemId ?? null;
    if (previousDefinitionId && previousDefinitionId !== (definition?.id ?? null) && typeof systems.getRecipeItemDefinition === "function") {
      const old = systems.getRecipeItemDefinition(systemId, previousDefinitionId);
      if (old?.recipeIds?.includes(recipeId)) {
        await step("updateRecipeItemDefinition", () =>
          systems.updateRecipeItemDefinition(systemId, old.id, { recipeIds: old.recipeIds.filter((id) => id !== recipeId) }));
      }
    }

    // 10. Trace on the item, or on the Schematic when the item cannot be written (C10)
    const trace = {
      systemId, recipeId, recipeItemId: definition?.id ?? null, componentId: resultComponentId, mode,
      updatedAt: new Date().toISOString()
    };
    const carrier = itemEditable ? item : schematic;
    if (carrier) await step("writeFlag", () => carrier.update({ [`flags.${MODULE_ID}.${FLAG_FABRICATE}`]: trace }));

    // 11. One summary
    if (notify) {
      ui.notifications.info(game.i18n.format(`${MODULE_ID}.Messages.${status === "created" ? "FabricateCreated" : "FabricateUpdated"}`, {
        name: final.recipeData.name, system: system.name, components: created.components, tools: created.tools, items: created.items
      }));
    }
    return { status, systemId, recipeId, recipeItemId: trace.recipeItemId, componentId: resultComponentId, mode, created };
  } catch (err) {
    const stepName = err instanceof StepError ? err.step : "unknown";
    const message = err?.message ?? String(err);
    console.error(`${MODULE_ID} | Fabricate sync failed at step ${stepName}`, err?.cause ?? err);
    notifyError(notify, "FabricateFailed", { step: stepName, error: message });
    return { status: "error", step: stepName, message, created };
  }
}
