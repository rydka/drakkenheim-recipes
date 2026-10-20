/** Eligibility (C1) and kind of an item (C5, C6). Works on `item.toObject()` or on an Item document. */
import { TIER_KEYS, resolveTier } from "../rules/tiers.mjs";

export const ELIGIBLE_TYPES = ["weapon", "equipment", "consumable", "tool", "container"];

const WORN = ["boots", "boot", "cloak", "cape", "gloves", "glove", "gauntlets", "gauntlet", "bracers", "belt", "helm",
  "helmet", "hat", "robe", "robes", "mantle", "sandals", "slippers", "cowl", "hood", "vest", "girdle",
  "bottes", "botte", "gants", "gant", "gantelets", "ceinture", "heaume", "casque", "chapeau", "manteau",
  "bracelets", "capuche", "sandales"];
const JEWELRY = ["ring", "amulet", "necklace", "periapt", "pendant", "circlet", "crown", "brooch", "medallion",
  "talisman", "anneau", "bague", "amulette", "collier", "diademe", "couronne", "broche", "medaillon", "pendentif"];
const WAND = ["wand", "staff", "rod", "baguette", "baton", "sceptre"];

/** Lower case without diacritics. */
export function normalizeText(text) {
  return String(text ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function hasWord(text, words) {
  const norm = normalizeText(text);
  return words.some((w) => new RegExp(`(?<![a-z])${w}(?![a-z])`).test(norm));
}

/**
 * Rarity keys of the item, lowest first (`system.rarities`, else legacy `system.rarity`). Accepts a Set or an array.
 * @returns {string[]}
 */
export function getRarities(itemData) {
  const system = itemData?.system ?? {};
  let list = system.rarities;
  if (list instanceof Set) list = [...list];
  if (!Array.isArray(list)) list = [];
  list = list.filter((r) => typeof r === "string" && r);
  if (!list.length && typeof system.rarity === "string" && system.rarity) list = [system.rarity];
  const rank = (r) => (r === "artifact" ? TIER_KEYS.length : TIER_KEYS.indexOf(r));
  return [...new Set(list)].sort((a, b) => rank(a) - rank(b));
}

/** Lowest rarity of the item, or null. */
export function lowestRarity(itemData) {
  return getRarities(itemData)[0] ?? null;
}

/** C1: a physical item of a known rarity. */
export function isEligible(itemData) {
  if (!itemData || !ELIGIBLE_TYPES.includes(itemData.type)) return false;
  return resolveTier(lowestRarity(itemData)) !== null;
}

function kindFromName(name) {
  if (hasWord(name, WAND)) return "wand";
  if (hasWord(name, JEWELRY)) return "jewelry";
  if (hasWord(name, WORN)) return "worn";
  return "other";
}

/**
 * @param {object} itemData
 * @returns {{ kind: string, consumable: boolean }}  `kind` is a key of `CATEGORY_PLANS`.
 */
export function classifyItem(itemData) {
  const type = itemData?.type;
  const subtype = itemData?.system?.type?.value ?? "";
  const name = itemData?.name ?? "";
  if (type === "consumable") {
    const map = { potion: "potion", poison: "potion", scroll: "scroll", ammo: "ammo", wand: "wand", rod: "wand" };
    return { kind: map[subtype] ?? "other", consumable: true };
  }
  if (type === "weapon") {
    return { kind: hasWord(name, ["staff", "baton", "quarterstaff"]) ? "wand" : "weapon", consumable: false };
  }
  if (type === "equipment") {
    const map = { light: "armor", medium: "armor", heavy: "armor", natural: "armor", shield: "shield",
      clothing: "worn", ring: "jewelry", wand: "wand", rod: "wand" };
    if (map[subtype]) return { kind: map[subtype], consumable: false };
    return { kind: kindFromName(name), consumable: false };
  }
  return { kind: "other", consumable: false };
}
