/** Public API (`game.modules.get("drakkenheim-recipes").api`) for integration tests and macros. */
import { MODULE_ID } from "../constants.mjs";
import { isEligible } from "../core/classify.mjs";
import { findRecipeBlock, replaceRecipeBlock } from "../core/description.mjs";
import {
  FABRICATE_DEFAULT_MODE, buildGroups, componentSpecs, missingVocabulary, rarityTags, systemSpec, translateRecipe,
  workshopSpecs
} from "../core/fabricate-translate.mjs";
import { generateRecipe, recipeMatches, regenerateRecipe } from "../core/generate.mjs";
import { renderLine, renderRecipeHtml, renderRecipeText, renderSchematicHtml } from "../core/render.mjs";
import { mulberry32 } from "../core/rng.mjs";
import { buildSchematicData } from "../core/schematic.mjs";
import { detectTheme } from "../core/theme.mjs";
import { applyRecipe, getEditability } from "./apply.mjs";
import { checkFabricateApi, isFabricateReady, syncFabricateRecipe } from "./fabricate-bridge.mjs";
import { RecipeDialog } from "./recipe-dialog.mjs";
import { getOptions } from "./settings.mjs";

/** Fabricate integration (feature `fabricate`), also copied flat on the API. */
const fabricate = {
  FABRICATE_DEFAULT_MODE,
  isFabricateReady,
  checkFabricateApi,
  syncFabricateRecipe,
  translateRecipe,
  componentSpecs,
  workshopSpecs,
  buildGroups,
  systemSpec,
  missingVocabulary,
  rarityTags,
  renderRecipeText
};

export function registerApi() {
  const module = game.modules.get(MODULE_ID);
  if (!module) return;
  module.api = {
    ...fabricate,
    fabricate,
    generateRecipe,
    regenerateRecipe,
    recipeMatches,
    detectTheme,
    isEligible,
    renderRecipeHtml,
    renderSchematicHtml,
    renderLine,
    findRecipeBlock,
    replaceRecipeBlock,
    buildSchematicData,
    applyRecipe,
    getEditability,
    getOptions,
    openDialog: (item) => RecipeDialog.open(item),
    mulberry32
  };
}
