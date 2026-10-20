/** Application of a recipe (C9 to C12): description block, flag, and Schematic item in its folder. */
import { FLAG_RECIPE, MODULE_ID } from "../constants.mjs";
import { replaceRecipeBlock } from "../core/description.mjs";
import { renderRecipeHtml, schematicName } from "../core/render.mjs";
import { buildSchematicData } from "../core/schematic.mjs";
import { getOptions } from "./settings.mjs";

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

/** The top-level Item folder of that name, created if missing. */
export async function getSchematicFolder(name) {
  const existing = game.folders.find((f) => f.type === "Item" && f.name === name && !f.folder);
  if (existing) return existing;
  const Folder = foundry.utils.getDocumentClass("Folder");
  return Folder.create({ name, type: "Item" });
}

/** The Schematic of that item already in the folder: by item UUID first, then by name. */
function findExistingSchematic(folder, recipe, lang) {
  const inFolder = game.items.filter((i) => i.folder?.id === folder.id);
  const byUuid = recipe.itemUuid
    ? inFolder.find((i) => i.getFlag(MODULE_ID, FLAG_RECIPE)?.itemUuid === recipe.itemUuid)
    : null;
  return byUuid ?? inFolder.find((i) => i.name === schematicName(recipe.itemName, lang)) ?? null;
}

/**
 * Write the recipe on the item (when possible) and create or update its Schematic.
 * @param {Item} item
 * @param {object} recipe
 * @param {object} [options]
 * @param {boolean} [options.createSchematic=true]
 * @param {boolean} [options.notify=true]   Show the user notifications.
 * @returns {Promise<{ itemUpdated: boolean, reason: null|"locked"|"permission", schematic: Item|null }>}
 */
export async function applyRecipe(item, recipe, { createSchematic = true, notify = true } = {}) {
  const lang = recipe.lang === "fr" ? "fr" : "en";
  const result = { itemUpdated: false, reason: null, schematic: null };
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
  return result;
}
