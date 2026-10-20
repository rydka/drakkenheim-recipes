/** World settings (spec "Réglages") and their reading as generator options. */
import { MODULE_ID } from "../constants.mjs";
import { DEFAULT_COUNTS } from "../rules/tiers.mjs";
import { parseCounts } from "../core/counts.mjs";

export const DEFAULT_FOLDER = "Schematics";

export function registerSettings() {
  const key = (name, field) => `${MODULE_ID}.settings.${name}.${field}`;
  const register = (name, data) => game.settings.register(MODULE_ID, name, {
    name: key(name, "name"), hint: key(name, "hint"), scope: "world", config: true, ...data
  });
  register("countsPermanent", { type: String, default: DEFAULT_COUNTS.permanent.join("/") });
  register("countsConsumable", { type: String, default: DEFAULT_COUNTS.consumable.join("/") });
  register("schematicFolder", { type: String, default: DEFAULT_FOLDER });
  register("createSchematic", { type: Boolean, default: true });
  register("recipeLanguage", {
    type: String, default: "en",
    choices: { en: `${MODULE_ID}.settings.recipeLanguage.en`, fr: `${MODULE_ID}.settings.recipeLanguage.fr` }
  });
}

/**
 * @returns {{ counts: { permanent: number[], consumable: number[] }, lang: "en"|"fr", folderName: string,
 *   createSchematic: boolean }}
 */
export function getOptions() {
  const get = (name) => game.settings.get(MODULE_ID, name);
  const folder = String(get("schematicFolder") ?? "").trim();
  return {
    counts: {
      permanent: parseCounts(get("countsPermanent"), DEFAULT_COUNTS.permanent),
      consumable: parseCounts(get("countsConsumable"), DEFAULT_COUNTS.consumable)
    },
    lang: get("recipeLanguage") === "fr" ? "fr" : "en",
    folderName: folder || DEFAULT_FOLDER,
    createSchematic: Boolean(get("createSchematic"))
  };
}
