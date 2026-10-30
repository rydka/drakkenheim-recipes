/** World settings (spec "Réglages") and their reading as generator options. */
import { DEFAULT_COMPONENT_FOLDER, DEFAULT_WORKSHOP_FOLDER, MODULE_ID } from "../constants.mjs";
import { DEFAULT_COUNTS } from "../rules/tiers.mjs";
import { parseCounts } from "../core/counts.mjs";
import { DEFAULT_SYSTEM_NAME } from "../core/fabricate-translate.mjs";
import { fabricateOptions, isFabricateActive } from "./fabricate-bridge.mjs";

export const DEFAULT_FOLDER = "Schematics";
export { DEFAULT_COMPONENT_FOLDER, DEFAULT_WORKSHOP_FOLDER };

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
  // Fabricate integration: shown in the settings only when Fabricate is active
  const fabricate = isFabricateActive();
  register("fabricateEnabled", { type: Boolean, default: true, config: fabricate });
  register("fabricateSystemName", { type: String, default: DEFAULT_SYSTEM_NAME, config: fabricate });
  register("fabricateComponentFolder", { type: String, default: DEFAULT_COMPONENT_FOLDER, config: fabricate });
  register("fabricateWorkshopFolder", { type: String, default: DEFAULT_WORKSHOP_FOLDER, config: fabricate });
}

/**
 * @returns {{ counts: { permanent: number[], consumable: number[] }, lang: "en"|"fr", folderName: string,
 *   createSchematic: boolean,
 *   fabricate: { enabled: boolean, systemName: string, componentFolder: string, workshopFolder: string } }}
 */
export function getOptions() {
  const get = (name) => game.settings.get(MODULE_ID, name);
  const text = (name, fallback) => String(get(name) ?? "").trim() || fallback;
  return {
    counts: {
      permanent: parseCounts(get("countsPermanent"), DEFAULT_COUNTS.permanent),
      consumable: parseCounts(get("countsConsumable"), DEFAULT_COUNTS.consumable)
    },
    lang: get("recipeLanguage") === "fr" ? "fr" : "en",
    folderName: text("schematicFolder", DEFAULT_FOLDER),
    createSchematic: Boolean(get("createSchematic")),
    fabricate: fabricateOptions()
  };
}
