import { MODULE_ID } from "./constants.mjs";
import { registerSettings } from "./foundry/settings.mjs";
import { onGetHeaderControls, onRenderItemSheet } from "./foundry/sheet-button.mjs";

export { MODULE_ID };

Hooks.once("init", () => {
  registerSettings();
  Hooks.on("renderItemSheet5e", onRenderItemSheet);
  Hooks.on("getHeaderControlsItemSheet5e", onGetHeaderControls);
  globalThis.foundry?.applications?.handlebars?.loadTemplates?.([`modules/${MODULE_ID}/templates/recipe-dialog.hbs`]);
});

Hooks.once("ready", async () => {
  if (game.system.id !== "dnd5e") {
    ui.notifications.error(game.i18n.localize(`${MODULE_ID}.errors.wrongSystem`));
    return;
  }
  // The window extends ApplicationV2: loaded once Foundry is ready, so that this file stays importable elsewhere.
  const { registerApi } = await import("./foundry/api.mjs");
  registerApi();
  console.log(`${MODULE_ID} | ready`);
});
