/**
 * Rarity tiers of Monsters of Drakkenheim (Appendix D): the Workshop and the Components share the rarity of the
 * item, the challenge rating range of the monsters follows, as does the price of a Schematic.
 */

/** Tier keys in ascending order (same keys as `CONFIG.DND5E.itemRarity`, artifact excluded). */
export const TIER_KEYS = ["common", "uncommon", "rare", "veryRare", "legendary"];

/** `cr` uses an en dash (U+2013), as in the book. */
export const TIERS = {
  common: { cr: "1/4\u20131/2", price: 5 },
  uncommon: { cr: "1\u20134", price: 50 },
  rare: { cr: "5\u201310", price: 500 },
  veryRare: { cr: "11\u201316", price: 5000 },
  legendary: { cr: "17+", price: 50000 }
};

/** Default number of Components per tier (index = `TIER_KEYS` order), permanent items and consumables. */
export const DEFAULT_COUNTS = { permanent: [4, 4, 5, 6, 7], consumable: [3, 3, 3, 4, 4] };

/**
 * Tier of a dnd5e rarity key. Artifacts are treated as legendary; unknown or empty rarity gives null.
 * @param {string|null|undefined} rarityKey
 * @returns {string|null}
 */
export function resolveTier(rarityKey) {
  if (!rarityKey) return null;
  if (rarityKey === "artifact") return "legendary";
  return TIER_KEYS.includes(rarityKey) ? rarityKey : null;
}

/** Index of a tier in `TIER_KEYS` (-1 if unknown). */
export function tierIndex(tier) {
  return TIER_KEYS.indexOf(tier);
}
