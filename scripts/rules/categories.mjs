/** Component categories of Appendix D and the categories favoured by each kind of item (C6). */

export const CATEGORIES = ["animus", "bones", "dust", "fluid", "hair", "hide", "naturalWeapon", "organ"];

/** Order of the non-Animus components in a recipe: alphabetical in English, as in the book. */
export const CATEGORY_ORDER = ["bones", "dust", "fluid", "hair", "hide", "naturalWeapon", "organ"];

/**
 * Categories drawn for each kind of item: the primaries first, in order, then the secondaries, then a weighted
 * draw (plan categories twice as likely). The `other` plan draws uniformly among all categories.
 */
export const CATEGORY_PLANS = {
  weapon: { primary: ["bones", "naturalWeapon", "hide"], secondary: ["fluid", "dust"] },
  armor: { primary: ["bones", "hide", "hair"], secondary: ["naturalWeapon", "fluid"] },
  shield: { primary: ["bones", "naturalWeapon", "hide"], secondary: [] },
  worn: { primary: ["hide", "hair"], secondary: ["organ", "dust"] },
  jewelry: { primary: ["organ", "dust", "bones"], secondary: [] },
  wand: { primary: ["bones", "dust", "fluid"], secondary: [] },
  potion: { primary: ["fluid", "organ"], secondary: ["dust"] },
  scroll: { primary: ["fluid", "hide"], secondary: [] },
  ammo: { primary: ["naturalWeapon", "bones"], secondary: [] },
  other: { primary: [], secondary: [] }
};

/** Maximum number of components of the same category in a recipe. */
export const MAX_PER_CATEGORY = 2;
