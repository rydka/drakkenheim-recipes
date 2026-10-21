/** Reading of the "number of Components per rarity" settings (C5): five integers, each clamped to 2..10. */

export const MIN_COUNT = 2;
export const MAX_COUNT = 10;

export function clampCount(value) {
  return Math.min(MAX_COUNT, Math.max(MIN_COUNT, value));
}

/**
 * Parse "4/4/5/6/7" (separators: slash, comma, semicolon, spaces). Anything but five integers gives a copy of the
 * fallback; each value is clamped to 2..10.
 * @param {string} text
 * @param {number[]} fallback
 * @returns {number[]}
 */
export function parseCounts(text, fallback) {
  const safe = Array.isArray(fallback) && fallback.length === 5 ? fallback.map(clampCount) : [4, 4, 5, 6, 7];
  if (typeof text !== "string") return [...safe];
  const parts = text.trim().split(/[\s/,;]+/).filter((p) => p !== "");
  if (parts.length !== 5 || !parts.every((p) => /^\d+$/.test(p))) return [...safe];
  return parts.map((p) => clampCount(Number(p)));
}
