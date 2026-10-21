/** Reproducible random numbers (tests) and small drawing helpers. `rng` is any `() => number` in [0, 1). */

/**
 * Mulberry32 generator.
 * @param {number} seed
 * @returns {() => number}
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One element of a non-empty list (undefined if empty). */
export function pick(rng, list) {
  if (!list?.length) return undefined;
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

/**
 * One entry's value, with probability proportional to its weight.
 * @param {() => number} rng
 * @param {{ value: *, weight: number }[]} entries
 */
export function weightedPick(rng, entries) {
  const valid = (entries ?? []).filter((e) => e.weight > 0);
  if (!valid.length) return undefined;
  const total = valid.reduce((sum, e) => sum + e.weight, 0);
  let roll = rng() * total;
  for (const entry of valid) {
    roll -= entry.weight;
    if (roll < 0) return entry.value;
  }
  return valid[valid.length - 1].value;
}

/** A shuffled copy (Fisher-Yates). */
export function shuffle(rng, list) {
  const out = [...(list ?? [])];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
