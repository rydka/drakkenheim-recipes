/**
 * Recipe generator (C3 to C8). Pure: the draw is injectable (`rng`), the clock too (`options.now`).
 * The result is the structured recipe stored in `flags.drakkenheim-recipes.recipe`; the text is rendered from it.
 */
import { RECIPE_VERSION } from "../constants.mjs";
import { DEFAULT_COUNTS, TIERS, resolveTier, tierIndex } from "../rules/tiers.mjs";
import { CATEGORY_ORDER, CATEGORY_PLANS, MAX_PER_CATEGORY } from "../rules/categories.mjs";
import { ANIMUS_TYPES, DESIGNATIONS, designationsOf } from "../rules/vocabulary.mjs";
import { classifyItem, lowestRarity } from "./classify.mjs";
import { clampCount } from "./counts.mjs";
import { detectTheme, recipeMatches } from "./theme.mjs";
import { pick, shuffle, weightedPick } from "./rng.mjs";

export { recipeMatches };

const ANIMUS_PROBABILITY = 0.7;
const EXTRA_THEME_PROBABILITY = 0.5;
const TWO_TYPES_PROBABILITY = 0.4;
const ANIMAL_TYPES = ["beast", "monstrosity"];

/**
 * Non-Animus categories of a recipe (C6): primaries of the plan in order, then secondaries, then a weighted draw
 * (plan categories twice as likely), never more than `MAX_PER_CATEGORY` of each.
 * @param {string} kind
 * @param {number} count
 * @param {() => number} rng
 * @returns {string[]}
 */
export function chooseCategories(kind, count, rng) {
  const plan = CATEGORY_PLANS[kind] ?? CATEGORY_PLANS.other;
  const tally = {};
  const result = [];
  const canAdd = (c) => (tally[c] ?? 0) < MAX_PER_CATEGORY;
  const add = (c) => {
    result.push(c);
    tally[c] = (tally[c] ?? 0) + 1;
  };
  for (const c of plan.primary) if (result.length < count && canAdd(c)) add(c);
  for (const c of plan.secondary) if (result.length < count && canAdd(c)) add(c);
  const planned = new Set([...plan.primary, ...plan.secondary]);
  while (result.length < count) {
    const entries = CATEGORY_ORDER.filter(canAdd).map((c) => ({ value: c, weight: planned.has(c) ? 2 : 1 }));
    if (!entries.length) break;
    add(weightedPick(rng, entries));
  }
  return result;
}

function sortTypes(types) {
  return [...types].sort((a, b) => a.type.localeCompare(b.type) || (a.variant ?? "").localeCompare(b.variant ?? ""));
}

/** Creature types usable by the non-Animus parts of a themed recipe. */
function partTypes(theme) {
  const types = [...theme.creatureTypes];
  if (theme.animal) for (const type of ANIMAL_TYPES) types.push({ type });
  return types;
}

/** Options `{ designation, creatureTypes, weight }` of a themed component of a category. */
function themedOptions(category, theme, types) {
  const options = [];
  for (const key of designationsOf(category)) {
    const def = DESIGNATIONS[key];
    if (theme.designations.includes(key)) {
      const compatible = def.bound
        ? types.filter((t) => t.type === def.bound && t.variant)
        : types.filter((t) => def.types.includes(t.type));
      for (const t of compatible) options.push({ designation: key, creatureTypes: [t], weight: 3 });
      if (!compatible.length) options.push({ designation: key, creatureTypes: [], weight: 3 });
      continue;
    }
    for (const t of types) {
      if (!def.types.includes(t.type)) continue;
      if (def.bound && def.bound !== t.type) continue;
      options.push({ designation: key, creatureTypes: def.bound && !t.variant ? [] : [t], weight: 1 });
    }
  }
  return options;
}

/** A component that reflects the theme, preferring the `preferred` creature type; null when nothing fits. */
function themedComponent(category, theme, types, preferred, rng) {
  const options = themedOptions(category, theme, types);
  if (!options.length) return null;
  const focused = preferred
    ? options.filter((o) => o.creatureTypes[0]?.type === preferred.type || theme.designations.includes(o.designation))
    : [];
  const chosen = weightedPick(rng, (focused.length ? focused : options).map((o) => ({ value: o, weight: o.weight })));
  return { designation: chosen.designation, creatureTypes: sortTypes(chosen.creatureTypes) };
}

/** A component without theme: a designation of the category and one or two creature types that fit it. */
function plainComponent(category, theme, types, rng) {
  let keys = designationsOf(category);
  if (!theme.empty) {
    const themed = new Set(types.map((t) => t.type));
    const filtered = keys.filter((k) => !DESIGNATIONS[k].bound || themed.has(DESIGNATIONS[k].bound));
    if (filtered.length) keys = filtered;
  }
  const key = weightedPick(rng, keys.map((k) => ({ value: k, weight: DESIGNATIONS[k].bound ? 1 : 2 })));
  const def = DESIGNATIONS[key];
  if (def.bound) return { designation: key, creatureTypes: [] };
  let pool = def.types.filter((t) => ANIMUS_TYPES.includes(t));
  if (theme.animal) {
    const animal = def.types.filter((t) => ANIMAL_TYPES.includes(t));
    if (animal.length) pool = animal;
  }
  if (!pool.length) pool = def.types;
  const count = pool.length > 1 && rng() < TWO_TYPES_PROBABILITY ? 2 : 1;
  return { designation: key, creatureTypes: sortTypes(shuffle(rng, pool).slice(0, count).map((type) => ({ type }))) };
}

function component(category, tier, fields) {
  return { category, designation: fields.designation ?? null, creatureTypes: fields.creatureTypes ?? [], rarity: tier, text: null };
}

function buildAnimus(theme, tier, rng) {
  const candidates = theme.creatureTypes.filter((t) => ANIMUS_TYPES.includes(t.type));
  const typed = candidates.length && rng() < ANIMUS_PROBABILITY;
  return component("animus", tier, { creatureTypes: typed ? [pick(rng, candidates)] : [] });
}

function readCounts(options, consumable) {
  const table = options.counts?.[consumable ? "consumable" : "permanent"];
  return Array.isArray(table) && table.length === 5 ? table : DEFAULT_COUNTS[consumable ? "consumable" : "permanent"];
}

/**
 * @param {object} itemData   `item.toObject()` (plus `uuid`), or any plain object with `name`, `type`, `system`.
 * @param {object} [options]
 * @param {{ permanent: number[], consumable: number[] }} [options.counts]
 * @param {"en"|"fr"} [options.lang]
 * @param {string} [options.rarity]        Rarity chosen by the GM when the item has several.
 * @param {string[]} [options.categories]  Imposed non-Animus categories (regeneration).
 * @param {() => string} [options.now]     ISO date, injectable.
 * @param {() => number} [rng]
 * @returns {object}  The recipe (see the design, "Flag").
 */
export function generateRecipe(itemData, options = {}, rng = Math.random) {
  const rarity = options.rarity ?? lowestRarity(itemData);
  const tier = resolveTier(rarity);
  if (!tier) throw new Error(`drakkenheim-recipes: no rarity tier for "${rarity}"`);
  const { kind, consumable } = classifyItem(itemData);
  const lang = options.lang === "fr" ? "fr" : "en";

  let categories;
  if (Array.isArray(options.categories) && options.categories.length) {
    categories = options.categories.filter((c) => CATEGORY_ORDER.includes(c));
  }
  if (!categories?.length) {
    const n = clampCount(readCounts(options, consumable)[tierIndex(tier)]);
    categories = chooseCategories(kind, n - 1, rng);
  }

  const theme = detectTheme(itemData);
  const types = partTypes(theme);
  const parts = new Array(categories.length);
  if (theme.empty) {
    categories.forEach((category, i) => (parts[i] = plainComponent(category, theme, types, rng)));
  } else {
    const required = Math.min(categories.length, Math.max(1, Math.ceil(categories.length / 2)));
    const rotation = shuffle(rng, types);
    let themed = 0;
    let cursor = 0;
    for (const i of shuffle(rng, categories.map((_, idx) => idx))) {
      const wanted = themed < required || rng() < EXTRA_THEME_PROBABILITY;
      const preferred = rotation.length ? rotation[cursor % rotation.length] : null;
      const fields = wanted ? themedComponent(categories[i], theme, types, preferred, rng) : null;
      if (fields) {
        themed++;
        cursor++;
      }
      parts[i] = fields ?? plainComponent(categories[i], theme, types, rng);
    }
  }

  const components = parts.map((fields, i) => component(categories[i], tier, fields))
    .map((c, i) => ({ c, i }))
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.c.category) - CATEGORY_ORDER.indexOf(b.c.category) || a.i - b.i)
    .map(({ c }) => c);

  return {
    version: RECIPE_VERSION,
    lang,
    itemName: itemData?.name ?? "",
    itemUuid: itemData?.uuid ?? null,
    itemType: itemData?.type ?? null,
    kind,
    consumable,
    rarity,
    workshop: tier,
    crRange: TIERS[tier].cr,
    distinctSources: !consumable,
    theme: { damageTypes: theme.damageTypes, creatureTypes: theme.creatureTypes },
    components: [buildAnimus(theme, tier, rng), ...components],
    generatedAt: options.now ? options.now() : new Date().toISOString()
  };
}

function lineKey(component) {
  return JSON.stringify([component.category, component.designation, component.creatureTypes, component.text]);
}

/** Whether two recipes differ on at least one line. */
export function recipesDiffer(a, b) {
  const la = (a?.components ?? []).map(lineKey);
  const lb = (b?.components ?? []).map(lineKey);
  return la.length !== lb.length || la.some((line, i) => line !== lb[i]);
}

/**
 * A new proposal with the same categories (C8): up to 20 draws to differ from `previous` on at least one line.
 * @param {object} itemData
 * @param {object} previous
 * @param {object} [options]   As `generateRecipe`; `rarity` defaults to the previous one.
 * @param {() => number} [rng]
 */
export function regenerateRecipe(itemData, previous, options = {}, rng = Math.random) {
  const categories = (previous?.components ?? []).filter((c) => c.category !== "animus").map((c) => c.category);
  const next = { ...options, rarity: options.rarity ?? previous?.rarity, categories };
  let recipe = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    recipe = generateRecipe(itemData, next, rng);
    if (recipesDiffer(recipe, previous)) return recipe;
  }
  return recipe;
}
