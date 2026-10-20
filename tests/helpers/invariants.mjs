// Independent checks of the rules C3-C6 (written from the specification, not from the module code).
export const TIER_KEYS = ["common", "uncommon", "rare", "veryRare", "legendary"];
export const CR = { common: "1/4–1/2", uncommon: "1–4", rare: "5–10", veryRare: "11–16", legendary: "17+" };
export const PRICE = { common: 5, uncommon: 50, rare: 500, veryRare: 5000, legendary: 50000 };
export const ANIMUS_TYPES = ["aberration", "celestial", "construct", "dragon", "elemental", "fey", "fiend", "giant", "monstrosity", "plant", "ooze", "undead"];
const ALL = ["aberration", "beast", "celestial", "construct", "dragon", "elemental", "fey", "fiend", "giant", "humanoid", "monstrosity", "ooze", "plant", "undead"];
const CAT_ORDER = ["bones", "dust", "fluid", "hair", "hide", "naturalWeapon", "organ"];

const without = (...x) => ALL.filter((t) => !x.includes(t));
const BONE_TYPES = ["aberration", "beast", "celestial", "dragon", "fey", "fiend", "giant", "humanoid", "monstrosity", "undead"];
const TEETH_TYPES = ["aberration", "beast", "dragon", "fiend", "monstrosity", "undead", "giant"];

// designation -> [category, compatible creature types] (design.md, "Vocabulaire")
export const DESIG = {
  skull: ["bones", BONE_TYPES], spine: ["bones", BONE_TYPES], ribs: ["bones", BONE_TYPES], bones: ["bones", BONE_TYPES],
  undeadDust: ["dust", ["undead"]], elementalDust: ["dust", ["elemental"]], feyDust: ["dust", ["fey"]],
  aberrantDust: ["dust", ["aberration"]], fiendDust: ["dust", ["fiend"]], celestialDust: ["dust", ["celestial"]],
  plantDust: ["dust", ["plant"]], dragonDust: ["dust", ["dragon"]],
  monsterBlood: ["fluid", ["aberration", "beast", "celestial", "dragon", "fey", "fiend", "giant", "humanoid", "monstrosity"]],
  ectoplasm: ["fluid", ["undead"]], sap: ["fluid", ["plant"]], mucus: ["fluid", ["ooze", "aberration", "monstrosity"]],
  venom: ["fluid", ["beast", "monstrosity", "dragon", "aberration", "plant"]], acidicBile: ["fluid", ["ooze", "dragon", "monstrosity"]],
  elementalFluid: ["fluid", ["elemental"]], contaminatedIchor: ["fluid", ["aberration", "fiend", "undead", "construct"]],
  hair: ["hair", ["humanoid", "giant", "fey", "beast", "monstrosity", "undead", "fiend"]], fur: ["hair", ["beast", "monstrosity", "fey"]],
  feathers: ["hair", ["beast", "monstrosity", "celestial"]], leaves: ["hair", ["plant", "fey"]],
  skin: ["hide", ["aberration", "beast", "celestial", "fey", "fiend", "giant", "humanoid", "monstrosity", "undead"]],
  scales: ["hide", ["dragon", "beast", "monstrosity", "fiend"]], plates: ["hide", ["construct", "monstrosity", "aberration"]],
  bark: ["hide", ["plant", "fey"]], carapace: ["hide", ["beast", "monstrosity", "aberration"]], shell: ["hide", ["beast", "monstrosity", "elemental"]],
  teeth: ["naturalWeapon", TEETH_TYPES], claws: ["naturalWeapon", TEETH_TYPES],
  horns: ["naturalWeapon", ["beast", "fiend", "monstrosity", "dragon"]], tentacles: ["naturalWeapon", ["aberration", "monstrosity", "beast"]],
  mandibles: ["naturalWeapon", ["beast", "monstrosity"]], needles: ["naturalWeapon", ["plant", "monstrosity", "beast", "construct"]],
  heart: ["organ", without("construct", "elemental", "ooze")], eye: ["organ", without("construct", "elemental", "ooze")],
  glands: ["organ", without("construct", "elemental", "ooze")], guts: ["organ", without("construct", "elemental")],
  flesh: ["organ", without("construct", "elemental")],
  brain: ["organ", ["aberration", "beast", "dragon", "giant", "humanoid", "monstrosity", "undead"]], flower: ["organ", ["plant", "fey"]]
};

export const PLANS = {
  weapon: ["bones", "naturalWeapon", "hide", "fluid", "dust"], armor: ["bones", "hide", "hair", "naturalWeapon", "fluid"],
  shield: ["bones", "naturalWeapon", "hide"], worn: ["hide", "hair", "organ", "dust"], jewelry: ["organ", "dust", "bones"],
  wand: ["bones", "dust", "fluid"], potion: ["fluid", "organ", "dust"], scroll: ["fluid", "hide"], ammo: ["naturalWeapon", "bones"]
};

export const rarityOf = (item) => {
  const r = item.system.rarities?.[0] ?? item.system.rarity;
  return r === "artifact" ? "legendary" : r;
};

/** Kind only when it is unambiguous from type data; null otherwise. */
export function definiteKind(item) {
  const t = item.system.type?.value ?? "";
  if (item.type === "weapon") return /staff|bâton/i.test(item.name) ? null : "weapon";
  if (item.type === "equipment") {
    if (["light", "medium", "heavy", "natural"].includes(t)) return "armor";
    if (t === "shield") return "shield";
    if (t === "clothing") return "worn";
    if (t === "ring") return "jewelry";
    return null;
  }
  if (item.type === "consumable") {
    if (t === "potion" || t === "poison") return "potion";
    if (t === "scroll") return "scroll";
    if (t === "ammo") return "ammo";
    return null;
  }
  return "other";
}

export function expectedCount(item, counts, tier) {
  const row = counts[item.type === "consumable" ? "consumable" : "permanent"];
  return Math.min(10, Math.max(2, row[TIER_KEYS.indexOf(tier)]));
}

/**
 * Returns { hard: string[], plausibility: string[] }. `hard` = C3-C6 violations; `plausibility`
 * = designation / creature-type compatibility (design table, Q2).
 */
export function checkRecipe(item, recipe, counts) {
  const hard = [], plausibility = [];
  const tier = rarityOf(item);
  const comps = recipe.components ?? [];
  if (recipe.workshop !== tier) hard.push(`C3 workshop ${recipe.workshop} != ${tier}`);
  if (recipe.crRange !== CR[tier]) hard.push(`C3 crRange ${recipe.crRange}`);
  for (const c of comps) if (c.rarity !== tier) hard.push(`C3 component rarity ${c.rarity}`);
  const animus = comps.filter((c) => c.category === "animus");
  if (animus.length !== 1 || comps[0]?.category !== "animus") hard.push("C4 animus count/position");
  for (const t of comps[0]?.creatureTypes ?? []) if (!ANIMUS_TYPES.includes(t.type)) hard.push(`C4 animus type ${t.type}`);
  const n = expectedCount(item, counts, tier);
  if (comps.length !== n) hard.push(`C5 count ${comps.length} != ${n}`);
  if (recipe.distinctSources !== (item.type !== "consumable")) hard.push("C9 distinctSources");
  const rest = comps.slice(1);
  const seen = {};
  for (const c of rest) seen[c.category] = (seen[c.category] ?? 0) + 1;
  for (const [cat, k] of Object.entries(seen)) if (k > 2) hard.push(`C6 ${cat} x${k}`);
  for (const c of rest) {
    if (!CAT_ORDER.includes(c.category)) { hard.push(`C6 unknown category ${c.category}`); continue; }
    if (c.designation == null) { hard.push("C6 missing designation"); continue; }
    const d = DESIG[c.designation];
    if (!d) { hard.push(`C6 unknown designation ${c.designation}`); continue; }
    if (d[0] !== c.category) hard.push(`C6 ${c.designation} not in ${c.category}`);
    for (const t of c.creatureTypes ?? []) if (!d[1].includes(t.type)) plausibility.push(`${c.designation} with ${t.type}`);
  }
  const idx = rest.map((c) => CAT_ORDER.indexOf(c.category));
  if (idx.some((v, i) => i && v < idx[i - 1])) hard.push("C6 order not alphabetical");
  const kind = definiteKind(item);
  if (kind && recipe.kind !== kind) hard.push(`C6 kind ${recipe.kind} != ${kind}`);
  if (kind && PLANS[kind]) {
    const want = PLANS[kind].slice(0, Math.min(n - 1, PLANS[kind].length));
    const have = { ...seen };
    for (const cat of want) {
      if (!have[cat]) hard.push(`C6 plan category ${cat} missing (${kind})`);
      else have[cat]--;
    }
  }
  return { hard, plausibility };
}
