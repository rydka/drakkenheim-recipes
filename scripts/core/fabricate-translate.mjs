/**
 * Translation of a Drakkenheim recipe into Fabricate data (spec `fabricate`, C3 to C7). Pure: no Foundry, no
 * Fabricate. Identifiers of components and tools come from the caller (`ctx`); missing ones get stable fake
 * values so that the structure can be tested without Fabricate.
 */
import { FLAG_GENERIC, MODULE_ID } from "../constants.mjs";
import { CATEGORIES } from "../rules/categories.mjs";
import { TIERS, TIER_KEYS, resolveTier, tierIndex } from "../rules/tiers.mjs";
import { CREATURE_TYPES, DESIGNATIONS, LABELS } from "../rules/vocabulary.mjs";
import { categoryLabel, rarityLabel, renderLine, renderRecipeText } from "./render.mjs";

/** Resolution mode of the system the module creates: the only one where a named set's tools are read. */
export const FABRICATE_DEFAULT_MODE = "routedByIngredients";
export const GENERIC_VERSION = 1;
export const DEFAULT_SYSTEM_NAME = "Monsters of Drakkenheim";

/** Icons of the generic items, by category, and of the Workshops (Foundry core icons). */
export const COMPONENT_ICONS = {
  animus: "icons/magic/light/orb-lightbulb-gray.webp",
  bones: "icons/commodities/bones/bone-broken-grey.webp",
  dust: "icons/commodities/materials/bowl-powder-grey.webp",
  fluid: "icons/consumables/potions/bottle-bulb-corked-green.webp",
  hair: "icons/commodities/leather/fur-brown.webp",
  hide: "icons/commodities/leather/fur-pelt-brown.webp",
  naturalWeapon: "icons/commodities/claws/claw-bear-brown.webp",
  organ: "icons/commodities/biological/organ-heart-black.webp"
};
export const WORKSHOP_ICON = "icons/tools/smithing/anvil.webp";
const FALLBACK_ICON = "icons/svg/item-bag.svg";

function language(lang) {
  return lang === "fr" ? "fr" : "en";
}

/** Tag of a category, a rarity tier or a creature type: lowercase English, spaces kept (`very rare`). */
export function categoryTag(category) {
  return (LABELS.categories.en[category] ?? String(category)).toLowerCase();
}

export function rarityTag(tier) {
  return (LABELS.rarities.en[tier] ?? String(tier)).toLowerCase();
}

/** Tags of a generic component of that rarity: the tier and every lower tier (C4, "at least R"). */
export function rarityTags(tier) {
  const index = tierIndex(tier);
  if (index < 0) return [rarityTag(tier)];
  return TIER_KEYS.slice(0, index + 1).reverse().map(rarityTag);
}

/** Stable key of a generic component: `bones|rare` or `bones|rare|giant`. */
export function componentKey({ category, rarity, type = null }) {
  return [category, rarity, ...(type ? [type] : [])].join("|");
}

/** Rarity tier of a component line (its own, or the Workshop's). */
function lineTier(component, recipe) {
  return resolveTier(component.rarity) ?? recipe?.workshop ?? "common";
}

/**
 * Creature types of a line, as tags: none for a GM-edited line (free text), else the creature types (variant
 * ignored), else the type bound to the designation (Undead Dust, Ectoplasm...). Deduplicated, sorted.
 * @returns {string[]}
 */
export function lineTypes(component) {
  if (typeof component.text === "string") return [];
  const types = (component.creatureTypes ?? []).map((t) => t?.type).filter(Boolean);
  if (!types.length) {
    const bound = DESIGNATIONS[component.designation]?.bound;
    if (bound) types.push(bound);
  }
  return [...new Set(types)].sort();
}

function typeLabelOf(type, l) {
  return CREATURE_TYPES[type]?.[l] ?? String(type);
}

/** Display name of a generic component: "Rare Bones (Giant)" / "Os Rare (Géant)". */
export function componentName({ category, rarity, type = null }, lang) {
  const l = language(lang);
  const base = l === "fr"
    ? `${categoryLabel(category, l)} ${rarityLabel(rarity, l)}`
    : `${rarityLabel(rarity, l)} ${categoryLabel(category, l)}`;
  return type ? `${base} (${typeLabelOf(type, l)})` : base;
}

/** Display name of a Workshop: "Rare Workshop" / "Atelier Rare". */
export function workshopName(tier, lang) {
  const l = language(lang);
  return l === "fr" ? `Atelier ${rarityLabel(tier, l)}` : `${rarityLabel(tier, l)} Workshop`;
}

function componentDescription({ category, rarity, type }, lang) {
  const l = language(lang);
  const cr = TIERS[rarity]?.cr ?? "";
  const cat = categoryLabel(category, l);
  const rar = rarityLabel(rarity, l);
  if (l === "fr") {
    const from = type ? ` prélevé sur une créature de type ${typeLabelOf(type, l)}` : "";
    return `<p>Composant de monstre (${cat}, ${rar})${from}, issu d'un monstre de FP ${cr}. `
      + "Un Composant pèse au plus 1 livre. Règles d'artisanat de Monsters of Drakkenheim.</p>";
  }
  const label = type ? typeLabelOf(type, l) : "";
  const from = type ? ` harvested from ${/^[aeiou]/i.test(label) ? "an" : "a"} ${label}` : "";
  return `<p>Monster Component (${cat}, ${rar})${from}, taken from a monster of CR ${cr}. `
    + "A Component weighs at most 1 pound. Monsters of Drakkenheim crafting rules.</p>";
}

function workshopDescription(tier, lang) {
  const l = language(lang);
  const rar = rarityLabel(tier, l);
  if (l === "fr") {
    return `<p>Atelier ${rar} : nécessaire pour créer les objets magiques de rareté ${rar.toLowerCase()} `
      + "ou inférieure (règles d'artisanat de Monsters of Drakkenheim).</p>";
  }
  return `<p>${rar} Workshop: required to craft magic items of ${rar.toLowerCase()} rarity or lower `
    + "(Monsters of Drakkenheim crafting rules).</p>";
}

/**
 * Ingredient groups of a recipe (C7): one per line, lines of the same category, rarity and creature types merged
 * into one group of higher quantity; one option per creature type (OR), or a single untyped option.
 * @param {object} recipe
 * @param {object} [options]
 * @param {"en"|"fr"} [options.lang]
 * @returns {{ key: string, category: string, rarity: string, types: string[], name: string, quantity: number,
 *   options: { tags: string[] }[] }[]}
 */
export function buildGroups(recipe, { lang = recipe?.lang } = {}) {
  const l = language(lang);
  const groups = [];
  for (const component of recipe.components ?? []) {
    const category = component.category;
    const rarity = lineTier(component, recipe);
    const types = lineTypes(component);
    const key = `${category}|${rarity}|${types.join(",")}`;
    const name = renderLine(component, recipe, l);
    const existing = groups.find((g) => g.key === key);
    if (existing) {
      existing.quantity += 1;
      if (!existing.names.includes(name)) existing.names.push(name);
      continue;
    }
    const options = (types.length ? types : [null]).map((type) => ({
      tags: [categoryTag(category), ...(type ? [type] : []), rarityTag(rarity)]
    }));
    groups.push({ key, category, rarity, types, names: [name], quantity: 1, options });
  }
  return groups.map(({ names, ...group }) => ({ ...group, name: names.join("; ") }));
}

/**
 * Generic components the recipe needs (C4), one per (category, rarity, type), in recipe order.
 * @returns {{ key: string, category: string, rarity: string, type: string|null, name: string,
 *   categoryLabel: string, tags: string[], description: string }[]}
 */
export function componentSpecs(recipe, { lang = recipe?.lang } = {}) {
  const l = language(lang);
  const specs = [];
  for (const group of buildGroups(recipe, { lang: l })) {
    for (const type of group.types.length ? group.types : [null]) {
      const spec = { category: group.category, rarity: group.rarity, type };
      const key = componentKey(spec);
      if (specs.some((s) => s.key === key)) continue;
      specs.push({
        key,
        ...spec,
        name: componentName(spec, l),
        categoryLabel: categoryLabel(group.category, l),
        tags: [categoryTag(group.category), ...(type ? [type] : []), ...rarityTags(group.rarity)],
        description: componentDescription(spec, l)
      });
    }
  }
  return specs;
}

/** Workshops accepted by the recipe (C5): the recipe's tier and every higher one. */
export function acceptedWorkshops(recipe) {
  const index = tierIndex(recipe?.workshop);
  return index < 0 ? [TIER_KEYS[0]] : TIER_KEYS.slice(index);
}

/**
 * @returns {{ key: string, tier: string, name: string, description: string }[]}   `key` (= tier) is the
 *   `generic.key` flag of the Workshop item.
 */
export function workshopSpecs(recipe, { lang = recipe?.lang } = {}) {
  const l = language(lang);
  return acceptedWorkshops(recipe).map((tier) => ({
    key: tier, tier, name: workshopName(tier, l), description: workshopDescription(tier, l)
  }));
}

/** Every tag the module may use: 8 categories, 5 rarities, 14 creature types. */
export function vocabularyTags() {
  return [...CATEGORIES.map(categoryTag), ...TIER_KEYS.map(rarityTag), ...Object.keys(CREATURE_TYPES)];
}

/**
 * Data of the crafting system the module creates (C3).
 * @returns {{ name: string, description: string, resolutionMode: string, componentCategories: string[],
 *   categories: string[], itemTags: string[] }}
 */
export function systemSpec({ name = DEFAULT_SYSTEM_NAME, lang = "en" } = {}) {
  const l = language(lang);
  return {
    name,
    description: l === "fr"
      ? "Recettes d'artisanat de Monsters of Drakkenheim, générées par le module Drakkenheim Recipe Generator."
      : "Monsters of Drakkenheim crafting recipes, generated by the Drakkenheim Recipe Generator module.",
    resolutionMode: FABRICATE_DEFAULT_MODE,
    componentCategories: CATEGORIES.map((c) => categoryLabel(c, l)),
    categories: TIER_KEYS.map((t) => rarityLabel(t, l)),
    itemTags: vocabularyTags()
  };
}

const nameOf = (entry) => String((entry && typeof entry === "object" ? entry.name ?? entry.label : entry) ?? "").trim();

/**
 * What an existing system's vocabulary lacks of ours (C3): the missing entries of each list (`itemTags`,
 * `componentCategories`, `categories`), only for the lists that miss something; `null` when nothing is missing.
 * `vocabularyPatch` turns it into the full lists `updateSystem` expects.
 */
export function missingVocabulary(system, spec) {
  const result = {};
  const add = (field, known, wanted) => {
    const have = new Set(known.map(nameOf).filter(Boolean));
    const missing = wanted.filter((v) => !have.has(v));
    if (missing.length) result[field] = missing;
  };
  add("itemTags", [...(system?.itemTags ?? []), ...(system?.tags ?? [])], spec.itemTags);
  add("componentCategories", system?.componentCategories ?? [], spec.componentCategories);
  add("categories", system?.categories ?? [], spec.categories);
  return Object.keys(result).length ? result : null;
}

/** `updateSystem` patch adding the missing vocabulary to the system's lists (nothing else is touched). */
export function vocabularyPatch(system, missing) {
  const patch = {};
  for (const [field, entries] of Object.entries(missing ?? {})) {
    patch[field] = [...(Array.isArray(system?.[field]) ? system[field] : []), ...entries];
  }
  return patch;
}

/** Source data of a generic component item (loot / material, 1 lb, no price, no player ownership). */
export function componentItemData(spec, { folderId = null } = {}) {
  return {
    name: spec.name,
    type: "loot",
    img: COMPONENT_ICONS[spec.category] ?? FALLBACK_ICON,
    folder: folderId,
    system: {
      type: { value: "material" },
      rarities: [spec.rarity],
      weight: { value: 1 },
      price: { value: 0, denomination: "gp" },
      quantity: 1,
      description: { value: spec.description }
    },
    flags: { [MODULE_ID]: { [FLAG_GENERIC]: { kind: "component", key: spec.key, version: GENERIC_VERSION } } }
  };
}

/** Source data of a Workshop item (loot / gear, no weight, no price). */
export function workshopItemData(spec, { folderId = null } = {}) {
  return {
    name: spec.name,
    type: "loot",
    img: WORKSHOP_ICON,
    folder: folderId,
    system: {
      type: { value: "gear" },
      rarities: [spec.tier],
      weight: { value: 0 },
      price: { value: 0, denomination: "gp" },
      quantity: 1,
      description: { value: spec.description }
    },
    flags: { [MODULE_ID]: { [FLAG_GENERIC]: { kind: "workshop", key: spec.tier, version: GENERIC_VERSION } } }
  };
}

function ingredientGroups(groups, prefix) {
  return groups.map((group, index) => ({
    id: `${prefix}-g${index + 1}`,
    name: group.name,
    options: group.options.map((option) => ({
      quantity: group.quantity,
      match: { type: "tags", tags: [...option.tags], tagMatch: "all" }
    }))
  }));
}

/**
 * Full translation (C6, C7).
 * @param {object} recipe   The structured recipe (`flags.drakkenheim-recipes.recipe`).
 * @param {object} [ctx]
 * @param {"en"|"fr"} [ctx.lang]
 * @param {string} [ctx.mode]                 Resolution mode of the target system (default: routed).
 * @param {string} [ctx.systemName]
 * @param {string} [ctx.systemId]
 * @param {Object<string,string>} [ctx.componentIds]   Fabricate component id by component key.
 * @param {Object<string,string>} [ctx.toolIds]        Fabricate tool id by Workshop tier.
 * @param {string} [ctx.resultComponentId]    Fabricate component id of the magic item.
 * @param {string|null} [ctx.recipeItemId]    Fabricate recipe item definition id (Schematic).
 * @param {string|null} [ctx.schematicUuid]
 * @returns {{ system: object, components: object[], tools: object[], groups: object[], recipeData: object }}
 */
export function translateRecipe(recipe, ctx = {}) {
  const lang = language(ctx.lang ?? recipe?.lang);
  const mode = ctx.mode ?? FABRICATE_DEFAULT_MODE;
  const routed = mode === FABRICATE_DEFAULT_MODE;
  const components = componentSpecs(recipe, { lang });
  const tools = workshopSpecs(recipe, { lang });
  const groups = buildGroups(recipe, { lang });
  const componentId = (key) => ctx.componentIds?.[key] ?? `cmp:${key}`;
  const toolId = (tier) => ctx.toolIds?.[tier] ?? `tool:${tier}`;
  const workshop = recipe.workshop;

  const sets = routed
    ? tools.map((tool) => ({
      id: `ds-${tool.tier}`,
      name: tool.name,
      ingredientGroups: ingredientGroups(groups, `ds-${tool.tier}`),
      toolIds: [toolId(tool.tier)]
    }))
    : [{ id: `ds-${workshop}`, name: workshopName(workshop, lang), ingredientGroups: ingredientGroups(groups, `ds-${workshop}`), toolIds: [] }];

  const recipeData = {
    name: recipe.itemName,
    category: rarityLabel(workshop, lang),
    description: renderRecipeText(recipe, { lang }),
    craftingSystemId: ctx.systemId ?? "system",
    enabled: true,
    ingredientSets: sets,
    resultGroups: [{
      id: "dr-result",
      name: recipe.itemName,
      results: [{ id: "dr-result-1", kind: "component", componentId: ctx.resultComponentId ?? "result", quantity: 1 }]
    }],
    toolIds: routed ? [] : [toolId(workshop)],
    recipeItemId: ctx.recipeItemId ?? null,
    linkedRecipeItemUuid: ctx.schematicUuid ?? null
  };
  // Keys referenced by the recipe, for the caller to resolve
  return {
    system: systemSpec({ name: ctx.systemName, lang }),
    components: components.map((spec) => ({ ...spec, id: componentId(spec.key) })),
    tools: tools.map((spec) => ({ ...spec, id: toolId(spec.tier) })),
    groups,
    recipeData
  };
}
