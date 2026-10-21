/**
 * Vocabulary of the book (Appendix D): component designations, creature types and labels, in English and French.
 * The generated text never depends on the client language: it is rendered from these tables in the recipe language.
 */

/** Creature types that possess an Animus (never beast nor humanoid), C4. */
export const ANIMUS_TYPES = [
  "aberration", "celestial", "construct", "dragon", "elemental", "fey", "fiend", "giant", "monstrosity", "plant",
  "ooze", "undead"
];

/** All creature types, with labels and French grammatical gender. */
export const CREATURE_TYPES = {
  aberration: { en: "Aberration", fr: "Aberration", gender: "f" },
  beast: { en: "Beast", fr: "Bête", gender: "f" },
  celestial: { en: "Celestial", fr: "Céleste", gender: "m" },
  construct: { en: "Construct", fr: "Artificiel", gender: "m" },
  dragon: { en: "Dragon", fr: "Dragon", gender: "m" },
  elemental: { en: "Elemental", fr: "Élémentaire", gender: "m" },
  fey: { en: "Fey", fr: "Fée", gender: "f" },
  fiend: { en: "Fiend", fr: "Fiélon", gender: "m" },
  giant: { en: "Giant", fr: "Géant", gender: "m" },
  humanoid: { en: "Humanoid", fr: "Humanoïde", gender: "m" },
  monstrosity: { en: "Monstrosity", fr: "Monstruosité", gender: "f" },
  ooze: { en: "Ooze", fr: "Vase", gender: "f" },
  plant: { en: "Plant", fr: "Plante", gender: "f" },
  undead: { en: "Undead", fr: "Mort-vivant", gender: "m" }
};

/** Named variants of a creature type (`VARIANTS[type][variant]`), used by the damage themes. */
export const VARIANTS = {
  dragon: {
    red: { en: "Red Dragon", fr: "Dragon rouge" },
    white: { en: "White Dragon", fr: "Dragon blanc" },
    blue: { en: "Blue Dragon", fr: "Dragon bleu" },
    black: { en: "Black Dragon", fr: "Dragon noir" },
    green: { en: "Green Dragon", fr: "Dragon vert" }
  },
  elemental: {
    fire: { en: "Fire Elemental", fr: "Élémentaire du feu" },
    water: { en: "Water Elemental", fr: "Élémentaire de l'eau" },
    air: { en: "Air Elemental", fr: "Élémentaire de l'air" },
    earth: { en: "Earth Elemental", fr: "Élémentaire de la terre" }
  }
};

const FLESHY = ["aberration", "beast", "celestial", "dragon", "fey", "fiend", "giant", "humanoid", "monstrosity", "undead"];
const ORGAN_TYPES = [...FLESHY, "plant"];

/**
 * Designations: `{ category, en, fr, types, bound? }`. `types` lists the creature types a part can plausibly come
 * from; `bound` marks a designation that already names its creature type (dusts, ectoplasm, sap...): the line then
 * carries no creature type unless the theme gives a variant of the bound type.
 */
export const DESIGNATIONS = {
  // Bones
  skull: { category: "bones", en: "Skull", fr: "Crâne", types: FLESHY },
  spine: { category: "bones", en: "Spine", fr: "Colonne vertébrale", types: FLESHY },
  ribs: { category: "bones", en: "Ribs", fr: "Côtes", types: FLESHY },
  bones: { category: "bones", en: "Bones", fr: "Os", types: FLESHY },
  // Dust (bound to a type)
  undeadDust: { category: "dust", en: "Undead Dust", fr: "Poussière de mort-vivant", types: ["undead"], bound: "undead" },
  elementalDust: { category: "dust", en: "Elemental Dust", fr: "Poussière élémentaire", types: ["elemental"], bound: "elemental" },
  feyDust: { category: "dust", en: "Fey Dust", fr: "Poussière féerique", types: ["fey"], bound: "fey" },
  aberrantDust: { category: "dust", en: "Aberrant Dust", fr: "Poussière aberrante", types: ["aberration"], bound: "aberration" },
  fiendDust: { category: "dust", en: "Fiend Dust", fr: "Poussière fiélone", types: ["fiend"], bound: "fiend" },
  celestialDust: { category: "dust", en: "Celestial Dust", fr: "Poussière céleste", types: ["celestial"], bound: "celestial" },
  plantDust: { category: "dust", en: "Plant Dust", fr: "Poussière végétale", types: ["plant"], bound: "plant" },
  dragonDust: { category: "dust", en: "Dragon Dust", fr: "Poussière de dragon", types: ["dragon"], bound: "dragon" },
  // Fluid
  monsterBlood: { category: "fluid", en: "Monster Blood", fr: "Sang de monstre",
    types: ["aberration", "beast", "celestial", "dragon", "fey", "fiend", "giant", "humanoid", "monstrosity"] },
  ectoplasm: { category: "fluid", en: "Ectoplasm", fr: "Ectoplasme", types: ["undead"], bound: "undead" },
  sap: { category: "fluid", en: "Sap", fr: "Sève", types: ["plant"], bound: "plant" },
  mucus: { category: "fluid", en: "Mucus", fr: "Mucus", types: ["ooze", "aberration", "monstrosity"] },
  venom: { category: "fluid", en: "Venom", fr: "Venin", types: ["beast", "monstrosity", "dragon", "aberration", "plant"] },
  acidicBile: { category: "fluid", en: "Acidic Bile", fr: "Bile acide", types: ["ooze", "dragon", "monstrosity"] },
  elementalFluid: { category: "fluid", en: "Elemental Fluid", fr: "Fluide élémentaire", types: ["elemental"], bound: "elemental" },
  contaminatedIchor: { category: "fluid", en: "Contaminated Ichor", fr: "Ichor contaminé",
    types: ["aberration", "fiend", "undead", "construct"] },
  // Hair
  hair: { category: "hair", en: "Hair", fr: "Cheveux", types: ["humanoid", "giant", "fey", "beast", "monstrosity", "undead", "fiend"] },
  fur: { category: "hair", en: "Fur", fr: "Fourrure", types: ["beast", "monstrosity", "fey"] },
  feathers: { category: "hair", en: "Feathers", fr: "Plumes", types: ["beast", "monstrosity", "celestial"] },
  leaves: { category: "hair", en: "Leaves", fr: "Feuilles", types: ["plant", "fey"] },
  // Hide
  skin: { category: "hide", en: "Skin", fr: "Peau", types: FLESHY },
  scales: { category: "hide", en: "Scales", fr: "Écailles", types: ["dragon", "beast", "monstrosity", "fiend"] },
  plates: { category: "hide", en: "Plates", fr: "Plaques", types: ["construct", "monstrosity", "aberration"] },
  bark: { category: "hide", en: "Bark", fr: "Écorce", types: ["plant", "fey"] },
  carapace: { category: "hide", en: "Carapace", fr: "Carapace", types: ["beast", "monstrosity", "aberration"] },
  shell: { category: "hide", en: "Shell", fr: "Coquille", types: ["beast", "monstrosity", "elemental"] },
  // Natural Weapon
  teeth: { category: "naturalWeapon", en: "Teeth", fr: "Dents", types: ["aberration", "beast", "dragon", "fiend", "monstrosity", "undead", "giant"] },
  claws: { category: "naturalWeapon", en: "Claws", fr: "Griffes", types: ["aberration", "beast", "dragon", "fiend", "monstrosity", "undead", "giant"] },
  horns: { category: "naturalWeapon", en: "Horns", fr: "Cornes", types: ["beast", "fiend", "monstrosity", "dragon"] },
  tentacles: { category: "naturalWeapon", en: "Tentacles", fr: "Tentacules", types: ["aberration", "monstrosity", "beast"] },
  mandibles: { category: "naturalWeapon", en: "Mandibles", fr: "Mandibules", types: ["beast", "monstrosity"] },
  needles: { category: "naturalWeapon", en: "Needles", fr: "Aiguilles", types: ["plant", "monstrosity", "beast", "construct"] },
  // Organ
  heart: { category: "organ", en: "Heart", fr: "Cœur", types: ORGAN_TYPES },
  brain: { category: "organ", en: "Brain", fr: "Cerveau", types: ["aberration", "beast", "dragon", "giant", "humanoid", "monstrosity", "undead"] },
  eye: { category: "organ", en: "Eye", fr: "Œil", types: ORGAN_TYPES },
  glands: { category: "organ", en: "Glands", fr: "Glandes", types: ORGAN_TYPES },
  guts: { category: "organ", en: "Guts", fr: "Entrailles", types: [...ORGAN_TYPES, "ooze"] },
  flesh: { category: "organ", en: "Flesh", fr: "Chair", types: [...ORGAN_TYPES, "ooze"] },
  flower: { category: "organ", en: "Flower", fr: "Fleur", types: ["plant", "fey"] }
};

/** Labels of categories and rarities. French rarities exist in singular and plural (Components). */
export const LABELS = {
  categories: {
    en: { animus: "Animus", bones: "Bones", dust: "Dust", fluid: "Fluid", hair: "Hair", hide: "Hide",
      naturalWeapon: "Natural Weapon", organ: "Organ" },
    fr: { animus: "Animus", bones: "Os", dust: "Poussière", fluid: "Fluide", hair: "Poils", hide: "Peau",
      naturalWeapon: "Arme naturelle", organ: "Organe" }
  },
  rarities: {
    en: { common: "Common", uncommon: "Uncommon", rare: "Rare", veryRare: "Very Rare", legendary: "Legendary" },
    fr: {
      singular: { common: "Commun", uncommon: "Peu commun", rare: "Rare", veryRare: "Très rare", legendary: "Légendaire" },
      plural: { common: "Communs", uncommon: "Peu communs", rare: "Rares", veryRare: "Très rares", legendary: "Légendaires" }
    }
  }
};

/** Designation keys of a category. */
export function designationsOf(category) {
  return Object.keys(DESIGNATIONS).filter((key) => DESIGNATIONS[key].category === category);
}
