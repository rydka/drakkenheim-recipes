/**
 * Application of a recipe (C9 to C12): description block, flag, Schematic item in its folder, then (feature
 * `fabricate`, C2) the Fabricate recipe, last, so that a Fabricate failure never undoes the rest.
 */
import { FLAG_RECIPE, MODULE_ID } from "../constants.mjs";
import { replaceRecipeBlock } from "../core/description.mjs";
import { renderRecipeHtml, schematicName } from "../core/render.mjs";
import { buildSchematicData } from "../core/schematic.mjs";
import { syncFabricateRecipe } from "./fabricate-bridge.mjs";
import { getItemFolder } from "./folders.mjs";
import { getOptions } from "./settings.mjs";

export { getItemFolder };

/**
 * Whether the current user can write the item, and why not (C12).
 * @param {Item} item
 * @returns {{ editable: boolean, reason: null|"locked"|"permission" }}
 */
export function getEditability(item) {
  if (item.pack) {
    const pack = game.packs.get(item.pack);
    if (pack?.locked) return { editable: false, reason: "locked" };
  }
  if (!item.canUserModify(game.user, "update")) return { editable: false, reason: "permission" };
  return { editable: true, reason: null };
}

/** The top-level Item folder of that name, created if missing (alias of `getItemFolder`). */
export const getSchematicFolder = getItemFolder;

/**
 * The Schematic of that item already in the folder: by item UUID first, then by name. Only items carrying the
 * module flag qualify: an item the GM made by hand under the same name is never overwritten.
 */
function findExistingSchematic(folder, recipe, lang) {
  const ours = game.items.filter((i) => i.folder?.id === folder.id && i.getFlag(MODULE_ID, FLAG_RECIPE));
  const byUuid = recipe.itemUuid
    ? ours.find((i) => i.getFlag(MODULE_ID, FLAG_RECIPE)?.itemUuid === recipe.itemUuid)
    : null;
  return byUuid ?? ours.find((i) => i.name === schematicName(recipe.itemName, lang)) ?? null;
}

/**
 * Write the recipe on the item (when possible) and create or update its Schematic.
 * @param {Item} item
 * @param {object} recipe
 * @param {object} [options]
 * @param {boolean} [options.createSchematic=true]
 * @param {boolean} [options.createFabricate=false]   Also create or update the Fabricate recipe (needs Fabricate).
 * @param {boolean} [options.notify=true]   Show the user notifications.
 * @returns {Promise<{ itemUpdated: boolean, reason: null|"locked"|"permission", schematic: Item|null,
 *   fabricate: object|null }>}   `fabricate` is the sync result (`status` created, updated, error, unavailable or
 *   skipped) when `createFabricate` was asked, else `null`.
 */
export async function applyRecipe(item, recipe, { createSchematic = true, createFabricate = false, notify = true } = {}) {
  const lang = recipe.lang === "fr" ? "fr" : "en";
  const result = { itemUpdated: false, reason: null, schematic: null, fabricate: null };
  const say = (level, key, data) => notify && ui.notifications[level](game.i18n.format(`${MODULE_ID}.Messages.${key}`, data));

  const { editable, reason } = getEditability(item);
  if (editable) {
    const html = replaceRecipeBlock(item.system?.description?.value ?? "", renderRecipeHtml(recipe, { lang }));
    await item.update({ "system.description.value": html, [`flags.${MODULE_ID}.${FLAG_RECIPE}`]: recipe });
    result.itemUpdated = true;
  } else {
    result.reason = reason;
    say("warn", reason === "locked" ? "ItemLocked" : "ItemPermission", { name: item.name });
  }

  if (createSchematic) {
    const folder = await getSchematicFolder(getOptions().folderName);
    const existing = findExistingSchematic(folder, recipe, lang);
    const data = buildSchematicData(recipe, { folderId: folder.id, lang });
    if (existing) {
      await existing.update(data);
      result.schematic = existing;
      say("info", "SchematicUpdated", { name: existing.name });
    } else {
      const Item = foundry.utils.getDocumentClass("Item");
      result.schematic = await Item.create(data);
      say("info", "SchematicCreated", { name: result.schematic?.name ?? data.name });
    }
  }

  if (result.itemUpdated) say("info", "Applied", { name: item.name });

  // Last, and never throwing: the Fabricate recipe (C2)
  if (createFabricate) {
    result.fabricate = await syncFabricateRecipe(item, recipe, {
      schematic: result.schematic, itemEditable: result.itemUpdated, notify
    });
  }
  return result;
}
