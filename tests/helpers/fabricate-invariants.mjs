// Independent checks of the Drakkenheim -> Fabricate translation (C4, C5, C6, C7), written from the
// specification (spec.md "Correspondance", C4-C7) and not from the module code. No import from scripts/.
export const TIERS = ["common", "uncommon", "rare", "veryRare", "legendary"];
export const CAT_TAG = { animus: "animus", bones: "bones", dust: "dust", fluid: "fluid", hair: "hair", hide: "hide", naturalWeapon: "natural weapon", organ: "organ" };
export const CAT_EN = { animus: "Animus", bones: "Bones", dust: "Dust", fluid: "Fluid", hair: "Hair", hide: "Hide", naturalWeapon: "Natural Weapon", organ: "Organ" };
export const RARITY_TAG = { common: "common", uncommon: "uncommon", rare: "rare", veryRare: "very rare", legendary: "legendary" };
export const RARITY_EN = { common: "Common", uncommon: "Uncommon", rare: "Rare", veryRare: "Very Rare", legendary: "Legendary" };
export const TYPE_EN = (t) => t.charAt(0).toUpperCase() + t.slice(1);
/** Designations that already name their creature type (spec C7: "Undead Dust", "Ectoplasm", "Sap"). */
export const BOUND = {
  undeadDust: "undead", elementalDust: "elemental", feyDust: "fey", aberrantDust: "aberration", fiendDust: "fiend",
  celestialDust: "celestial", plantDust: "plant", dragonDust: "dragon", ectoplasm: "undead", sap: "plant", elementalFluid: "elemental"
};

export const tierIdx = (t) => TIERS.indexOf(t);
/** Tags a generic component of rarity R carries: R and every lower rarity. */
export const rarityTagsOf = (tier) => TIERS.slice(0, tierIdx(tier) + 1).map((t) => RARITY_TAG[t]);

/** Creature types of one recipe line, as a sorted unique list (the variant is ignored). */
export function lineTypes(c) {
  if (typeof c.text === "string") return [];
  const types = [...new Set((c.creatureTypes ?? []).map((t) => t.type))];
  if (!types.length && BOUND[c.designation]) return [BOUND[c.designation]];
  return types.sort();
}
const lineRarity = (c, recipe) => c.rarity ?? recipe.workshop;

/** Expected groups: one per distinct (category, rarity, type set), with the count of merged lines. */
export function expectedGroups(recipe) {
  const map = new Map();
  for (const c of recipe.components ?? []) {
    const types = lineTypes(c);
    const rarity = lineRarity(c, recipe);
    const key = `${c.category}|${rarity}|${types.join(",")}`;
    if (!map.has(key)) map.set(key, { category: c.category, rarity, types, qty: 0 });
    map.get(key).qty++;
  }
  return [...map.values()];
}
const optTags = (category, rarity, type) => [CAT_TAG[category], ...(type ? [type] : []), RARITY_TAG[rarity]].sort();
export const groupSignature = (g) => JSON.stringify({
  qty: g.qty,
  opts: (g.types.length ? g.types : [null]).map((t) => optTags(g.category, g.rarity, t).join("|")).sort()
});

/** Expected generic components: distinct (category, rarity, type) over every option. */
export function expectedComponentKeys(recipe) {
  const keys = new Map();
  for (const g of expectedGroups(recipe)) {
    for (const t of (g.types.length ? g.types : [null])) {
      keys.set(`${g.category}|${g.rarity}|${t ?? ""}`, { category: g.category, rarity: g.rarity, type: t });
    }
  }
  return [...keys.values()];
}
export const expectedComponentName = (k) => `${RARITY_EN[k.rarity]} ${CAT_EN[k.category]}${k.type ? ` (${TYPE_EN(k.type)})` : ""}`;

const sameSet = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

/**
 * Violations of C4-C7 for one translation (`out` = translateRecipe result, English).
 * `ctx` = { mode, systemId, resultComponentId, toolIds, schematicUuid } as given to translateRecipe.
 */
export function checkTranslation(recipe, out, ctx) {
  const bad = [];
  const data = out?.recipeData;
  if (!data) return ["no recipeData"];
  const routed = ctx.mode === "routedByIngredients";
  // C6
  if (data.name !== recipe.itemName) bad.push(`C6 name ${data.name}`);
  if (data.category !== RARITY_EN[recipe.workshop]) bad.push(`C6 category ${data.category}`);
  if (data.craftingSystemId !== ctx.systemId) bad.push("C6 craftingSystemId");
  if (typeof data.description !== "string" || !data.description.includes("Crafting")) bad.push("C6 description");
  if (recipe.distinctSources && !/different monster/.test(data.description ?? "")) bad.push("C6 distinct sentence missing");
  if (!recipe.distinctSources && /different monster/.test(data.description ?? "")) bad.push("C6 distinct sentence on a consumable");
  const rg = data.resultGroups ?? [];
  if (rg.length !== 1 || rg[0].results?.length !== 1) bad.push("C6 result groups");
  else {
    const r = rg[0].results[0];
    if (r.kind !== "component" || r.quantity !== 1) bad.push(`C6 result ${r.kind} x${r.quantity}`);
    if (ctx.resultComponentId && r.componentId !== ctx.resultComponentId) bad.push("C6 result componentId");
  }
  if ((data.linkedRecipeItemUuid ?? null) !== (ctx.schematicUuid ?? null)) bad.push("C6 linkedRecipeItemUuid");
  // C7
  const sets = data.ingredientSets ?? [];
  const wi = tierIdx(recipe.workshop);
  const wantSets = routed ? TIERS.length - wi : 1;
  if (sets.length !== wantSets) bad.push(`C7 sets ${sets.length} != ${wantSets}`);
  const wantSig = expectedGroups(recipe).map(groupSignature).sort();
  for (const [i, s] of sets.entries()) {
    if (!s.name) bad.push(`C7 set ${i} unnamed`);
    const sig = (s.ingredientGroups ?? []).map((g) => JSON.stringify({
      qty: g.options?.[0]?.quantity,
      opts: (g.options ?? []).map((o) => (o.match?.tags ?? []).slice().sort().join("|")).sort()
    })).sort();
    if (JSON.stringify(sig) !== JSON.stringify(wantSig)) bad.push(`C7 set ${i} groups differ`);
    for (const g of s.ingredientGroups ?? []) {
      if (new Set((g.options ?? []).map((o) => o.quantity)).size !== 1) bad.push("C7 mixed option quantities");
      for (const o of g.options ?? []) {
        if (o.match?.type !== "tags" || o.match?.tagMatch !== "all") bad.push("C7 option match");
        if ((o.match?.tags ?? []).some((t) => t !== t.toLowerCase())) bad.push("C7 uppercase tag");
      }
    }
    const total = (s.ingredientGroups ?? []).reduce((n, g) => n + (g.options?.[0]?.quantity ?? 0), 0);
    if (total !== (recipe.components ?? []).length) bad.push(`C7 quantity sum ${total}`);
    if (routed) {
      const tier = TIERS[wi + i];
      if (s.id !== `ds-${tier}`) bad.push(`C7 set id ${s.id}`);
      const wantTool = ctx.toolIds?.[tier] ?? `tool:${tier}`;
      if (JSON.stringify(s.toolIds ?? []) !== JSON.stringify([wantTool])) bad.push(`C7 set ${i} toolIds ${JSON.stringify(s.toolIds)}`);
    }
  }
  if (routed && (data.toolIds ?? []).length) bad.push("C7 recipe.toolIds should be empty when routed");
  if (!routed) {
    const want = ctx.toolIds?.[recipe.workshop] ?? `tool:${recipe.workshop}`;
    if (JSON.stringify(data.toolIds ?? []) !== JSON.stringify([want])) bad.push(`C7 simple toolIds ${JSON.stringify(data.toolIds)}`);
  }
  if (new Set(sets.map((s) => s.resultGroupId ?? rg[0]?.id)).size > 1) bad.push("C7 sets lead to different result groups");
  // C4 / C5
  const keys = expectedComponentKeys(recipe);
  const specs = out.components ?? [];
  if (specs.length !== keys.length) bad.push(`C4 spec count ${specs.length} != ${keys.length}`);
  for (const k of keys) {
    const s = specs.find((x) => x.name === expectedComponentName(k));
    if (!s) { bad.push(`C4 missing ${expectedComponentName(k)}`); continue; }
    const want = [CAT_TAG[k.category], ...(k.type ? [k.type] : []), ...rarityTagsOf(k.rarity)];
    if (!sameSet(s.tags, want)) bad.push(`C4 tags of ${s.name}: ${s.tags}`);
  }
  const wantTools = routed ? TIERS.slice(wi).map((t) => `${RARITY_EN[t]} Workshop`) : [`${RARITY_EN[recipe.workshop]} Workshop`];
  const toolNames = (out.tools ?? []).map((t) => t.name);
  for (const n of wantTools) if (!toolNames.includes(n)) bad.push(`C5 missing tool ${n}`);
  return bad;
}
