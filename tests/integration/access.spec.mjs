// C1: the "Recette Drakkenheim" button in the item sheet header (GM only, eligible items only).
import fs from "node:fs";
import { expect, test } from "../../../../test-env/fixtures.mjs";
import { cleanup, create, ID, openSheet, PREFIX, SEL } from "../helpers/client.mjs";

test.afterEach(async ({ foundry }) => { await cleanup(foundry); });

const ELIGIBLE = [
  ["weapon", { type: { value: "martialM" } }],
  ["equipment", { type: { value: "heavy" } }],
  ["consumable", { type: { value: "potion" } }],
  ["tool", { type: { value: "art" } }],
  ["container", {}]
];

test("C1: the button is shown to the GM on weapon, equipment, consumable, tool and container with a rarity", async ({ gamePage, foundry }) => {
  const evidence = {};
  for (const [type, extra] of ELIGIBLE) {
    const id = await create(foundry, { name: `${PREFIX}${type}`, type, system: { ...extra, rarities: ["rare"] } });
    const sheet = await openSheet(gamePage, foundry, id);
    await expect(sheet.locator(SEL.open), type).toBeVisible();
    // also offered in the "..." header menu (entry added through the getHeaderControls hook)
    const inMenu = await foundry((i) => [...game.items.get(i).sheet._headerControlButtons()].some((c) => /drakkenheim/i.test(c.action ?? "")), id);
    evidence[type] = { button: true, menuEntry: inMenu };
    expect(inMenu, `${type} menu entry`).toBe(true);
    if (type === "weapon") await gamePage.screenshot({ path: test.info().outputPath("C1-bouton-recette.png") });
    await foundry((i) => game.items.get(i).sheet.close(), id);
  }
  fs.writeFileSync(test.info().outputPath("C1-eligible-types.json"), JSON.stringify(evidence, null, 2));
});

test("C1: the button is shown for every rarity, artifact included", async ({ gamePage, foundry }) => {
  for (const rarity of ["common", "uncommon", "rare", "veryRare", "legendary", "artifact"]) {
    const id = await create(foundry, { name: `${PREFIX}${rarity}`, type: "weapon", system: { type: { value: "martialM" }, rarities: [rarity] } });
    const sheet = await openSheet(gamePage, foundry, id);
    await expect(sheet.locator(SEL.open), rarity).toBeVisible();
    await foundry((i) => game.items.get(i).sheet.close(), id);
  }
});

test("C1: no button without rarity or on other item types", async ({ gamePage, foundry }) => {
  const cases = [
    ["weapon without rarity", { name: `${PREFIX}plain`, type: "weapon", system: { type: { value: "martialM" }, rarities: [] } }],
    ["potion without rarity", { name: `${PREFIX}plain potion`, type: "consumable", system: { type: { value: "potion" }, rarities: [] } }],
    ["spell", { name: `${PREFIX}spell`, type: "spell", system: { level: 1 } }],
    ["feat", { name: `${PREFIX}feat`, type: "feat", system: {} }],
    ["loot", { name: `${PREFIX}loot`, type: "loot", system: { rarities: ["rare"] } }]
  ];
  const evidence = {};
  for (const [label, data] of cases) {
    const id = await create(foundry, data);
    const sheet = await openSheet(gamePage, foundry, id);
    await expect(sheet.locator(SEL.open), label).toHaveCount(0);
    const inMenu = await foundry((i) => [...game.items.get(i).sheet._headerControlButtons()].some((c) => /drakkenheim/i.test(c.action ?? "")), id);
    expect(inMenu, `${label} menu entry`).toBe(false);
    evidence[label] = { button: false, menuEntry: inMenu };
    if (label === "spell") await gamePage.screenshot({ path: test.info().outputPath("C1-pas-de-bouton-sort.png") });
    await foundry((i) => game.items.get(i).sheet.close(), id);
  }
  fs.writeFileSync(test.info().outputPath("C1-ineligible.json"), JSON.stringify(evidence, null, 2));
});

test("C1: no button for a non-GM user", async ({ gamePage, foundry }) => {
  const id = await create(foundry, { name: `${PREFIX}player view`, type: "weapon", system: { type: { value: "martialM" }, rarities: ["rare"] } });
  // The test world has a single GM session: make the sheet code see a player.
  await foundry(() => Object.defineProperty(game.user, "isGM", { get: () => false, configurable: true }));
  try {
    const sheet = await openSheet(gamePage, foundry, id);
    await expect(sheet.locator(SEL.open)).toHaveCount(0);
    const inMenu = await foundry((i) => [...game.items.get(i).sheet._headerControlButtons()].some((c) => /drakkenheim/i.test(c.action ?? "")), id);
    expect(inMenu).toBe(false);
    await gamePage.screenshot({ path: test.info().outputPath("C1-pas-de-bouton-joueur.png") });
    await foundry((i) => game.items.get(i).sheet.close(), id);
  } finally {
    await foundry(() => { delete game.user.isGM; });
  }
  expect(await foundry(() => game.user.isGM)).toBe(true);
});

test("C1/C14: the module exposes its API and registers its settings", async ({ foundry }) => {
  const state = await foundry((id) => {
    const m = game.modules.get(id);
    return {
      active: m.active,
      api: Object.keys(m.api ?? {}).sort(),
      settings: ["countsPermanent", "countsConsumable", "schematicFolder", "createSchematic", "recipeLanguage"].map((k) => game.settings.settings.has(`${id}.${k}`))
    };
  }, ID);
  expect(state.active).toBe(true);
  expect(state.api).toEqual(expect.arrayContaining(["applyRecipe", "generateRecipe", "mulberry32", "openDialog", "renderRecipeHtml"]));
  expect(state.settings).toEqual([true, true, true, true, true]);
});
