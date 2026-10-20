/** Source data of a Schematic item (C11): a `loot` / `gear` item carrying the recipe and its rendering. */
import { FLAG_RECIPE, MODULE_ID } from "../constants.mjs";
import { TIERS } from "../rules/tiers.mjs";
import { renderSchematicHtml, schematicName } from "./render.mjs";

export const SCHEMATIC_ICON = "icons/sundries/documents/blueprint-recipe-alchemical.webp";

/**
 * @param {object} recipe
 * @param {object} [options]
 * @param {string|null} [options.folderId]
 * @param {"en"|"fr"} [options.lang]   Defaults to `recipe.lang`.
 * @param {string} [options.link]      `@UUID` link text to the item (computed from the recipe by default).
 * @returns {object}  Item source data (no `ownership`: players get the default, none).
 */
export function buildSchematicData(recipe, { folderId = null, lang = recipe?.lang, link } = {}) {
  const tier = recipe.workshop;
  return {
    name: schematicName(recipe.itemName, lang),
    type: "loot",
    img: SCHEMATIC_ICON,
    folder: folderId,
    system: {
      type: { value: "gear" },
      rarities: [recipe.rarity],
      price: { value: TIERS[tier]?.price ?? 0, denomination: "gp" },
      weight: { value: 0 },
      quantity: 1,
      description: { value: renderSchematicHtml(recipe, { lang, link }) }
    },
    flags: { [MODULE_ID]: { [FLAG_RECIPE]: recipe } }
  };
}
