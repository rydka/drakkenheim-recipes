/**
 * Theme detection (C7): damage types of the activities, keywords of the name, phrases of the description.
 * Scores: activities and name 3, description 1. At most two damage types and two explicit creature types are kept.
 */
import { normalizeText } from "./classify.mjs";
import { stripRecipeBlock } from "./description.mjs";
import {
  BEAST_KEYWORDS, CREATURE_KEYWORDS, DAMAGE_KEYWORDS, DAMAGE_THEMES, DESCRIPTION_DAMAGE_WORDS, IGNORED_DAMAGE
} from "../rules/themes.mjs";
import { CREATURE_TYPES, DESIGNATIONS } from "../rules/vocabulary.mjs";

const WEIGHT_DATA = 3;
const WEIGHT_NAME = 3;
const WEIGHT_DESCRIPTION = 1;
const MAX_DAMAGE = 2;
const MAX_CREATURE = 2;

/** Text of a description without tags, entities, enrichers and the recipe block. */
export function plainText(html) {
  let text = stripRecipeBlock(html);
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"").replace(/&#39;/g, "'");
  // @UUID[...]{label} -> label ; &Reference[...] -> nothing
  text = text.replace(/@\w+\[[^\]]*\](?:\{([^}]*)\})?/g, "$1").replace(/&\w+\[[^\]]*\]/g, " ");
  return text.replace(/\s+/g, " ").trim();
}

function wordRegex(keyword) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-z])${escaped}(?:e?s)?(?![a-z])`, "g");
}

function countWord(text, keyword) {
  return (text.match(wordRegex(keyword)) ?? []).length;
}

function toArray(value) {
  if (!value) return [];
  if (value instanceof Set || value instanceof Map) return [...value.values()];
  if (Array.isArray(value)) return value;
  if (typeof value === "object") return Object.values(value);
  return [];
}

/** Damage types declared in the item data (activities and base damage), physical and healing excluded. */
function dataDamageTypes(itemData) {
  const system = itemData?.system ?? {};
  const types = [];
  const addPart = (part) => {
    for (const type of toArray(part?.types)) if (typeof type === "string" && !IGNORED_DAMAGE.includes(type)) types.push(type);
  };
  addPart(system.damage?.base);
  for (const activity of toArray(system.activities)) {
    for (const part of toArray(activity?.damage?.parts)) addPart(part);
  }
  return types;
}

/** Rank of a clue: the name of the item first, then the damage data, then the description. */
const RANK_NAME = 0;
const RANK_DAMAGE = 1;
const RANK_DESCRIPTION = 2;

class Scores {
  /** damage type -> { score, strong } (strong: from the data or the name) */
  damage = new Map();
  /** creature type -> { score, name } (name: found in the item name) */
  creature = new Map();
  animal = 0;
  sources = [];

  add(map, key, weight, source, strong) {
    if (!key) return;
    const entry = map.get(key) ?? { score: 0, strong: false };
    entry.score += weight;
    entry.strong ||= strong;
    map.set(key, entry);
    this.sources.push(source);
  }

  top(map, order, max) {
    const rank = (key) => (order.includes(key) ? order.indexOf(key) : order.length);
    return [...map.entries()]
      .sort((a, b) => Number(b[1].strong) - Number(a[1].strong) || b[1].score - a[1].score || rank(a[0]) - rank(b[0]))
      .slice(0, max)
      .map(([key]) => key);
  }
}

function scanName(name, scores) {
  const text = normalizeText(name);
  if (!text) return;
  for (const [keyword, type] of Object.entries(DAMAGE_KEYWORDS)) {
    if (countWord(text, keyword)) scores.add(scores.damage, type, WEIGHT_NAME, `name:${keyword}`, true);
  }
  for (const [keyword, type] of Object.entries(CREATURE_KEYWORDS)) {
    if (countWord(text, keyword)) scores.add(scores.creature, type, WEIGHT_NAME, `name:${keyword}`, true);
  }
  for (const keyword of BEAST_KEYWORDS) {
    if (countWord(text, keyword)) {
      scores.animal += WEIGHT_NAME;
      scores.sources.push(`name:${keyword}`);
    }
  }
}

const DESCRIPTION_PATTERNS = [
  /(?<![a-z])([a-z]+) damage(?![a-z])/g,
  /(?<![a-z])resistan(?:ce|t) to ([a-z]+)(?![a-z])/g,
  /(?<![a-z])immun(?:e|ity) to ([a-z]+)(?![a-z])/g,
  /(?<![a-z])degats? (?:de |d')([a-z]+)(?![a-z])/g,
  /(?<![a-z])resistan(?:ce|t) aux degats (?:de |d')([a-z]+)(?![a-z])/g
];

function scanDescription(html, scores) {
  const text = normalizeText(plainText(html));
  if (!text) return;
  for (const pattern of DESCRIPTION_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    let hits = 0;
    while ((match = pattern.exec(text)) && hits < 3) {
      const type = DESCRIPTION_DAMAGE_WORDS[match[1]];
      if (!type) continue;
      hits++;
      scores.add(scores.damage, type, WEIGHT_DESCRIPTION, `description:${match[1]}`, false);
    }
  }
  for (const [keyword, type] of Object.entries(CREATURE_KEYWORDS)) {
    const n = Math.min(3, countWord(text, keyword));
    if (n) scores.add(scores.creature, type, WEIGHT_DESCRIPTION * n, `description:${keyword}`, false);
  }
}

/**
 * @typedef {object} Theme
 * @property {string[]} damageTypes                       At most two.
 * @property {{ type: string, variant?: string }[]} creatureTypes  By priority: types named in the item name, then
 *   those of the damage themes, then those found in the description. A named type takes the variant of a damage
 *   theme when they agree ("Elemental" + fire -> Fire Elemental).
 * @property {{ type: string, variant?: string }[]} partTypes  `creatureTypes` plus Beast and Monstrosity (first) for
 *   an animal name: the types usable by the non-Animus parts, in priority order.
 * @property {string[]} designations                      Designation keys suggested by the damage themes.
 * @property {boolean} animal                             An animal name: non-Animus parts from a Beast or Monstrosity.
 * @property {string[]} sources                           Where the clues came from (informative).
 * @property {boolean} empty                              No theme at all.
 */

/**
 * @param {object} itemData
 * @returns {Theme}
 */
export function detectTheme(itemData) {
  const scores = new Scores();
  for (const type of dataDamageTypes(itemData)) scores.add(scores.damage, type, WEIGHT_DATA, `data:${type}`, true);
  scanName(itemData?.name, scores);
  scanDescription(itemData?.system?.description?.value, scores);

  const damageTypes = scores.top(scores.damage, Object.keys(DAMAGE_THEMES), MAX_DAMAGE)
    .filter((type) => DAMAGE_THEMES[type]);
  const explicit = scores.top(scores.creature, Object.keys(CREATURE_TYPES), MAX_CREATURE);

  // Candidate entries with their rank, then merged: a named type absorbs the variant of a damage theme
  const candidates = explicit.map((type) => ({
    type, rank: scores.creature.get(type).strong ? RANK_NAME : RANK_DESCRIPTION
  }));
  for (const damage of damageTypes) {
    const rank = scores.damage.get(damage).strong ? RANK_DAMAGE : RANK_DESCRIPTION;
    for (const entry of DAMAGE_THEMES[damage].creatureTypes) {
      const named = candidates.find((c) => c.type === entry.type && !c.variant && c.rank !== RANK_DAMAGE);
      if (named && entry.variant) named.variant = entry.variant;
      else candidates.push({ type: entry.type, variant: entry.variant, rank });
    }
  }
  candidates.sort((a, b) => a.rank - b.rank);

  const seen = new Set();
  const creatureTypes = [];
  for (const entry of candidates) {
    const key = `${entry.type}:${entry.variant ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    creatureTypes.push(entry.variant ? { type: entry.type, variant: entry.variant } : { type: entry.type });
  }

  const designations = [...new Set(damageTypes.flatMap((damage) => DAMAGE_THEMES[damage].designations))];
  const animal = scores.animal > 0;
  const partTypes = animal ? [{ type: "beast" }, { type: "monstrosity" }, ...creatureTypes] : [...creatureTypes];
  return {
    damageTypes,
    creatureTypes,
    partTypes,
    designations,
    animal,
    sources: scores.sources,
    empty: !damageTypes.length && !creatureTypes.length && !animal
  };
}

/**
 * Operational definition of M3: at least one non-Animus component carries one of the expected creature types or
 * designations. A designation bound to a type ("Undead Dust", "Ectoplasm") counts as that type. With no expectation
 * at all, the recipe trivially matches.
 * @param {object} recipe
 * @param {{ creatureTypes?: string[], designations?: string[] }} expected
 * @returns {boolean}
 */
export function recipeMatches(recipe, expected = {}) {
  const types = expected.creatureTypes ?? [];
  const designations = expected.designations ?? [];
  if (!types.length && !designations.length) return true;
  return (recipe?.components ?? []).some((component) => {
    if (component.category === "animus") return false;
    if (component.designation && designations.includes(component.designation)) return true;
    const bound = DESIGNATIONS[component.designation]?.bound;
    if (bound && types.includes(bound)) return true;
    return (component.creatureTypes ?? []).some((entry) => types.includes(entry.type));
  });
}
