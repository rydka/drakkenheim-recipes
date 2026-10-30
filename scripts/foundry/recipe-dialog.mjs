/**
 * Preview window (C2, C8, C13): the proposal is kept in memory as a structured recipe; the GM edits lines, removes
 * or adds some, regenerates, then applies. Nothing is written before "Apply".
 */
import { MODULE_ID } from "../constants.mjs";
import { CATEGORY_ORDER } from "../rules/categories.mjs";
import { getRarities } from "../core/classify.mjs";
import { findRecipeBlock } from "../core/description.mjs";
import { generateRecipe, regenerateRecipe } from "../core/generate.mjs";
import { categoryLabel, distinctSentence, rarityLabel, renderLine } from "../core/render.mjs";
import { applyRecipe } from "./apply.mjs";
import { isFabricateReady } from "./fabricate-bridge.mjs";
import { getOptions } from "./settings.mjs";

// Resolved lazily so that importing this file outside Foundry (unit tests) does not throw.
const api = globalThis.foundry?.applications?.api ?? {};
const Base = api.HandlebarsApplicationMixin && api.ApplicationV2 ? api.HandlebarsApplicationMixin(api.ApplicationV2) : class {};

export class RecipeDialog extends Base {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-dialog-{id}`,
    classes: [MODULE_ID, "recipe-dialog"],
    tag: "div",
    window: { title: `${MODULE_ID}.Dialog.Title`, icon: "fa-solid fa-hammer", resizable: true },
    position: { width: 620, height: "auto" },
    actions: {
      regenerate: RecipeDialog.#onRegenerate,
      apply: RecipeDialog.#onApply,
      cancel: RecipeDialog.#onCancel,
      addRow: RecipeDialog.#onAddRow,
      deleteRow: RecipeDialog.#onDeleteRow
    }
  };

  static PARTS = { body: { template: `modules/${MODULE_ID}/templates/recipe-dialog.hbs`, scrollable: [".components"] } };

  #item;
  #itemData;
  #options;
  #rarities;
  #rarity;
  #recipe;
  /** The last generated proposal, untouched by the GM: regeneration starts from its categories, not from the edits. */
  #generated;
  #createSchematic;
  /** Also create the Fabricate recipe (feature `fabricate`, C1); offered only to a GM when Fabricate is ready. */
  #createFabricate;
  /** The GM edited, removed or added a line since the last generation. */
  #edited = false;
  /** Edits were discarded by the last regeneration: said once. */
  #lost = false;
  /** The description already carries a recipe (module or book). */
  #existing;
  #busy = false;

  /**
   * @param {object} config
   * @param {Item} config.item
   */
  constructor({ item, ...options } = {}) {
    super(options);
    this.#item = item;
    this.#itemData = { ...item.toObject(), uuid: item.uuid };
    this.#options = getOptions();
    this.#rarities = getRarities(this.#itemData);
    this.#rarity = this.#rarities[0];
    this.#createSchematic = this.#options.createSchematic;
    this.#createFabricate = Boolean(this.#options.fabricate?.enabled);
    this.#existing = findRecipeBlock(this.#itemData.system?.description?.value ?? "");
    this.#propose(generateRecipe(this.#itemData, { ...this.#options, rarity: this.#rarity }));
  }

  /** Take a fresh proposal as the working recipe. */
  #propose(recipe) {
    this.#generated = foundry.utils.deepClone(recipe);
    this.#recipe = recipe;
  }

  /** Open the preview of an item. */
  static open(item) {
    const dialog = new RecipeDialog({ item });
    dialog.render({ force: true });
    return dialog;
  }

  /** @override */
  get title() {
    return game.i18n.format(`${MODULE_ID}.Dialog.Heading`, { name: this.#item.name });
  }

  /** The current proposal (read-only copy). */
  get recipe() {
    return foundry.utils.deepClone(this.#recipe);
  }

  /** Whether the Fabricate box is offered: GM only (C12) and Fabricate ready (C1). */
  get fabricateOffered() {
    return Boolean(game.user?.isGM) && isFabricateReady();
  }

  /** @override */
  async _prepareContext() {
    const recipe = this.#recipe;
    const lang = recipe.lang;
    const rarities = CONFIG.DND5E?.itemRarity ?? {};
    const categories = CATEGORY_ORDER.map((key) => ({ key, label: categoryLabel(key, lang) }));
    const lost = this.#lost;
    this.#lost = false;
    return {
      workshop: rarityLabel(recipe.workshop, lang),
      crRange: recipe.crRange,
      rarities: this.#rarities.length > 1
        ? this.#rarities.map((key) => ({ key, label: rarities[key] ?? key, selected: key === this.#rarity }))
        : null,
      rows: recipe.components.map((component, index) => ({
        index,
        animus: component.category === "animus",
        text: renderLine(component, recipe, lang),
        categories: component.category === "animus"
          ? [{ key: "animus", label: categoryLabel("animus", lang), selected: true }]
          : categories.map((c) => ({ ...c, selected: c.key === component.category }))
      })),
      distinct: distinctSentence(recipe, lang),
      createSchematic: this.#createSchematic,
      fabricate: this.fabricateOffered ? { checked: this.#createFabricate } : null,
      existing: Boolean(this.#existing),
      edited: this.#edited,
      lost
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element;
    for (const input of root.querySelectorAll(".recipe-row input[type=text]")) {
      input.addEventListener("input", () => this.#editLine(Number(input.dataset.index), input.value));
    }
    for (const select of root.querySelectorAll(".recipe-row select")) {
      select.addEventListener("change", () => this.#changeCategory(Number(select.dataset.index), select.value));
    }
    root.querySelector('select[name="rarity"]')?.addEventListener("change", (event) => this.#changeRarity(event.currentTarget.value));
    root.querySelector('input[name="createSchematic"]')?.addEventListener("change", (event) => {
      this.#createSchematic = event.currentTarget.checked;
    });
    root.querySelector('input[name="createFabricate"]')?.addEventListener("change", (event) => {
      this.#createFabricate = event.currentTarget.checked;
    });
  }

  #editLine(index, value) {
    const component = this.#recipe.components[index];
    if (!component) return;
    component.text = value;
    component.designation = null;
    component.creatureTypes = [];
    this.#markEdited();
  }

  #changeCategory(index, category) {
    const component = this.#recipe.components[index];
    if (!component || component.category === "animus" || !CATEGORY_ORDER.includes(category)) return;
    // The line keeps its text; a generated line becomes an edited one so that it still reads as before
    if (component.text === null) this.#editLine(index, renderLine(component, this.#recipe, this.#recipe.lang));
    component.category = category;
    this.#markEdited();
  }

  #markEdited() {
    if (this.#edited) return;
    this.#edited = true;
    this.element?.querySelector(".edited-hint")?.classList.remove("hidden");
  }

  #changeRarity(rarity) {
    if (!this.#rarities.includes(rarity) || this.#busy) return;
    this.#rarity = rarity;
    this.#lost = this.#edited;
    this.#edited = false;
    this.#propose(generateRecipe(this.#itemData, { ...this.#options, rarity }));
    this.render();
  }

  static #onRegenerate() {
    if (this.#busy) return;
    this.#lost = this.#edited;
    this.#edited = false;
    this.#propose(regenerateRecipe(this.#itemData, this.#generated, { ...this.#options, rarity: this.#rarity }));
    this.render();
  }

  static #onAddRow() {
    if (this.#busy) return;
    this.#recipe.components.push({
      category: "bones", designation: null, creatureTypes: [], rarity: this.#recipe.workshop, text: ""
    });
    this.#markEdited();
    this.render();
  }

  static #onDeleteRow(event, target) {
    if (this.#busy) return;
    const index = Number(target.dataset.index);
    const component = this.#recipe.components[index];
    if (!component || component.category === "animus") return;
    this.#recipe.components.splice(index, 1);
    this.#markEdited();
    this.render();
  }

  static async #onApply() {
    if (this.#busy) return;
    this.#busy = true;
    for (const control of this.element.querySelectorAll("button, input, select")) control.disabled = true;
    try {
      const recipe = foundry.utils.deepClone(this.#recipe);
      // Added lines left empty are dropped
      recipe.components = recipe.components.filter((c) => c.designation || c.category === "animus" || (c.text ?? "").trim());
      await applyRecipe(this.#item, recipe, {
        createSchematic: this.#createSchematic, createFabricate: this.fabricateOffered && this.#createFabricate
      });
      await this.close();
    } catch (err) {
      console.error(`${MODULE_ID} | apply failed`, err);
      ui.notifications.error(game.i18n.format(`${MODULE_ID}.Messages.ApplyFailed`, { error: err.message }));
      for (const control of this.element.querySelectorAll("button, input, select")) control.disabled = false;
    } finally {
      this.#busy = false;
    }
  }

  static async #onCancel() {
    await this.close();
  }
}
