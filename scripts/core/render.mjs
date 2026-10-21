/**
 * Rendering of a recipe (C9, C11, C15), English or French, always from the structured data. The HTML of the
 * "Crafting." block follows the book's format exactly; only the class on `<p>` / `<ul>` marks it as ours.
 */
import { BLOCK_CLASS } from "../constants.mjs";
import { TIERS, resolveTier } from "../rules/tiers.mjs";
import { CREATURE_TYPES, DESIGNATIONS, LABELS, VARIANTS } from "../rules/vocabulary.mjs";

const UNCOUNTABLE = ["armor", "armour", "mail", "ammunition", "oil", "dust", "ink", "leather"];
const DISTINCT = {
  en: "Each item must come from a different monster.",
  fr: "Chaque Composant doit provenir d'un monstre différent."
};

export function escapeHtml(text) {
  return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function language(lang) {
  return lang === "fr" ? "fr" : "en";
}

function startsWithVowel(word) {
  return /^[aeiouàâäéèêëïîôöùûü]/i.test(String(word ?? "").normalize("NFC"));
}

/**
 * English indefinite article of an item name: "" for a plural or uncountable head noun ("Boots of Elvenkind",
 * "Plate Armor"), "an" before a vowel sound, "a" otherwise.
 * @returns {"a"|"an"|""}
 */
export function englishArticle(name) {
  const full = String(name ?? "").trim();
  if (!full) return "";
  const head = full.split(/\s+of\s+/i)[0];
  const words = head.match(/[A-Za-z][A-Za-z'’]*/g) ?? [];
  const last = (words[words.length - 1] ?? "").toLowerCase().replace(/[’']s$/, "");
  if (last && UNCOUNTABLE.includes(last)) return "";
  if (/s$/.test(last) && !/(ss|us|is)$/.test(last)) return "";
  const lower = full.toLowerCase();
  if (/^(uni|use|one|eu|ewe)/.test(lower)) return "a";
  return startsWithVowel(full) ? "an" : "a";
}

/**
 * French "de" contraction before an item name: "Le X" -> du X, "La X" -> de la X, "Les X" -> des X, vowel or h -> d'.
 * @returns {{ particle: string, name: string }}  `name` without its leading article.
 */
export function frenchOf(name) {
  const full = String(name ?? "").trim();
  let match;
  if ((match = /^le\s+(.+)$/i.exec(full))) return { particle: "du", name: match[1] };
  if ((match = /^la\s+(.+)$/i.exec(full))) return { particle: "de la", name: match[1] };
  if ((match = /^les\s+(.+)$/i.exec(full))) return { particle: "des", name: match[1] };
  if ((match = /^l['’]\s*(.+)$/i.exec(full))) return { particle: "de l'", name: match[1] };
  if (startsWithVowel(full) || startsWithMuteH(full)) return { particle: "d'", name: full };
  return { particle: "de", name: full };
}

/** French words with a mute h (elision applies); any other leading h is treated as aspirate or foreign. */
const MUTE_H = ["habit", "harmonie", "herbe", "heure", "histoire", "hiver", "homme", "honneur", "horizon", "horloge",
  "hôtel", "hotel", "huile", "humain", "hydre", "hymne"];

function startsWithMuteH(name) {
  const word = String(name ?? "").normalize("NFC").toLowerCase().match(/^[a-zà-ÿ]+/)?.[0] ?? "";
  return MUTE_H.some((h) => word === h || word === `${h}s`);
}

function joinParticle(particle, html) {
  return particle.endsWith("'") ? `${particle}${html}` : `${particle} ${html}`;
}

/** "Schematic: X" or "Schéma : X". */
export function schematicName(name, lang) {
  return language(lang) === "fr" ? `Schéma : ${name}` : `Schematic: ${name}`;
}

export function categoryLabel(category, lang) {
  return LABELS.categories[language(lang)][category] ?? category;
}

export function rarityLabel(tier, lang, plural = false) {
  if (language(lang) === "fr") return LABELS.rarities.fr[plural ? "plural" : "singular"][tier] ?? tier;
  return LABELS.rarities.en[tier] ?? tier;
}

/** Label of a creature type entry `{ type, variant? }`. */
export function typeLabel(entry, lang) {
  const l = language(lang);
  return VARIANTS[entry?.type]?.[entry?.variant]?.[l] ?? CREATURE_TYPES[entry?.type]?.[l] ?? String(entry?.type ?? "");
}

function englishIndefinite(word) {
  return startsWithVowel(word) ? "an" : "a";
}

function frenchIndefinite(entry) {
  return (CREATURE_TYPES[entry?.type]?.gender ?? "m") === "f" ? "d'une" : "d'un";
}

function designationLabel(component, lang) {
  const def = DESIGNATIONS[component.designation];
  if (def) return def[language(lang)];
  return categoryLabel(component.category, lang);
}

/**
 * Text of one line, without the "[Category]" prefix. An edited line (`text`) is returned as is.
 * @param {object} component
 * @param {object} recipe
 * @param {"en"|"fr"} [lang]
 * @returns {string}
 */
export function renderLine(component, recipe, lang = recipe?.lang) {
  if (typeof component.text === "string") return component.text;
  const l = language(lang);
  const tier = resolveTier(component.rarity) ?? recipe?.workshop ?? "common";
  const cr = TIERS[tier]?.cr ?? recipe?.crRange ?? "";
  const rarity = rarityLabel(tier, l);
  const types = component.creatureTypes ?? [];
  const animus = component.category === "animus";
  if (l === "fr") {
    const suffix = `(${rarity}, FP ${cr})`;
    const from = types.map((t) => `${frenchIndefinite(t)} ${typeLabel(t, l)}`).join(" ou ");
    if (animus) return types.length ? `Animus ${from} ${suffix}` : `Animus quelconque ${suffix}`;
    const designation = designationLabel(component, l);
    return types.length ? `${designation} ${from} ${suffix}` : `${designation} ${suffix}`;
  }
  const suffix = `(CR ${cr})`;
  const from = `from ${englishIndefinite(rarity)} ${rarity} ${types.map((t) => typeLabel(t, l)).join(" or ")}`;
  if (animus) return types.length ? `Animus ${from} ${suffix}` : `Any ${rarity} Animus ${suffix}`;
  const designation = designationLabel(component, l);
  return types.length ? `${designation} ${from} ${suffix}` : `Any ${rarity} ${designation} ${suffix}`;
}

/** Sentence about distinct sources, or "" for a consumable. */
export function distinctSentence(recipe, lang = recipe?.lang) {
  return recipe?.distinctSources ? DISTINCT[language(lang)] : "";
}

function header(recipe, l, nameHtml) {
  const rarity = rarityLabel(recipe.workshop, l);
  const open = `<p class="${BLOCK_CLASS}">`;
  if (l === "fr") {
    const plural = rarityLabel(recipe.workshop, l, true);
    let particle;
    let name;
    if (nameHtml) {
      particle = frenchOf(recipe.itemName).particle.startsWith("d'") ? "d'" : "de";
      name = nameHtml;
    } else {
      ({ particle, name } = frenchOf(recipe.itemName));
      name = `<em>${escapeHtml(name)}</em>`;
    }
    return `${open}<em><strong>Artisanat.</strong></em> La création ${joinParticle(particle, name)} requiert un Atelier `
      + `${rarity} et les Composants ${plural} suivants :</p>`;
  }
  const article = englishArticle(recipe.itemName);
  const name = nameHtml ?? `<em>${escapeHtml(recipe.itemName)}</em>`;
  return `${open}<em><strong>Crafting.</strong></em> Creating ${article ? `${article} ` : ""}${name} requires `
    + `${englishIndefinite(rarity)} ${rarity} Workshop and the following ${rarity} Components:</p>`;
}

/**
 * The "Crafting." block: header paragraph, list, and the distinct-sources sentence for a permanent item.
 * @param {object} recipe
 * @param {object} [options]
 * @param {"en"|"fr"} [options.lang]      Defaults to `recipe.lang`.
 * @param {string} [options.nameHtml]     Replaces `<em>{name}</em>` (already safe HTML, e.g. a @UUID link).
 * @returns {string}
 */
export function renderRecipeHtml(recipe, { lang = recipe?.lang, nameHtml } = {}) {
  const l = language(lang);
  const items = (recipe.components ?? []).map((component) =>
    `<li><p><strong>[${categoryLabel(component.category, l)}]</strong> ${escapeHtml(renderLine(component, recipe, l))}</p></li>`
  ).join("");
  const distinct = recipe.distinctSources ? `<p class="${BLOCK_CLASS}">${DISTINCT[l]}</p>` : "";
  return `${header(recipe, l, nameHtml)}<ul class="${BLOCK_CLASS}">${items}</ul>${distinct}`;
}

/**
 * Default `@UUID` link to the item of a recipe (plain name if the item has no UUID). The label is HTML-escaped and
 * cannot close the enricher (`]`, `}` removed); the UUID is reduced to its legal characters.
 */
export function itemLink(recipe) {
  const uuid = String(recipe?.itemUuid ?? "").replace(/[^\w.-]/g, "");
  if (!uuid) return `<em>${escapeHtml(recipe?.itemName)}</em>`;
  const label = escapeHtml(String(recipe?.itemName ?? "").replace(/[[\]{}]/g, "")).trim();
  return `@UUID[${uuid}]{${label}}`;
}

/**
 * Description of a Schematic: the link to the item, then the block with the name replaced by the link.
 * @param {object} recipe
 * @param {object} [options]
 * @param {"en"|"fr"} [options.lang]
 * @param {string} [options.link]   `@UUID[...]{...}` text; computed from the recipe by default.
 */
export function renderSchematicHtml(recipe, { lang = recipe?.lang, link } = {}) {
  const href = link ?? itemLink(recipe);
  return `<p>${href}</p>${renderRecipeHtml(recipe, { lang, nameHtml: href })}`;
}
