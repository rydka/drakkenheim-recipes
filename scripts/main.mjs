import { MODULE_ID } from "./constants.mjs";
import { registerApi } from "./foundry/api.mjs";
import { registerFabricateHooks } from "./foundry/fabricate-bridge.mjs";
import { registerSettings } from "./foundry/settings.mjs";
import { onGetHeaderControls, onRenderItemSheet } from "./foundry/sheet-button.mjs";

export { MODULE_ID };

Hooks.once("init", () => {
  registerSettings();
  // Only listens: no Fabricate API is called before its `fabricate.ready` hook (C13)
  registerFabricateHooks();
  Hooks.on("renderItemSheet5e", onRenderItemSheet);
  Hooks.on("getHeaderControlsItemSheet5e", onGetHeaderControls);
  globalThis.foundry?.applications?.handlebars?.loadTemplates?.([`modules/${MODULE_ID}/templates/recipe-dialog.hbs`]);
  // Synchronous, so that `game.modules.get(id).api` exists for any macro or test that runs from `ready` on.
  registerApi();
});

Hooks.once("ready", () => {
  if (game.system.id !== "dnd5e") {
    ui.notifications.error(game.i18n.localize(`${MODULE_ID}.errors.wrongSystem`));
    return;
  }
  console.log(`${MODULE_ID} | ready`);
});
