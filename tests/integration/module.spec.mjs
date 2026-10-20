import { expect, test } from "../../../../test-env/fixtures.mjs";

const MODULE_ID = "drakkenheim-recipes";

test("module is active and registers its settings", async ({ foundry }) => {
  const state = await foundry((id) => ({
    active: game.modules.get(id)?.active ?? false,
    recipeLanguage: game.settings.get(id, "recipeLanguage"),
    countsPermanent: game.settings.get(id, "countsPermanent"),
    countsConsumable: game.settings.get(id, "countsConsumable"),
    schematicFolder: game.settings.get(id, "schematicFolder"),
    createSchematic: game.settings.get(id, "createSchematic")
  }), MODULE_ID);
  expect(state).toEqual({
    active: true, recipeLanguage: "en", countsPermanent: "4/4/5/6/7", countsConsumable: "3/3/3/4/4",
    schematicFolder: "Schematics", createSchematic: true
  });
});

test("no errors are logged while the world loads", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => msg.type() === "error" && errors.push(msg.text()));
  await page.goto("/game");
  await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 120_000 });
  expect(errors.filter((e) => e.includes(MODULE_ID))).toEqual([]);
});
