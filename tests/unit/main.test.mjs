import { describe, expect, it } from "vitest";

const load = () => import("../../scripts/main.mjs");

describe("main", () => {
  it("registers its settings on init", async () => {
    await load();
    Hooks.callAll("init");
    const keys = game.settings.register.mock.calls.map((c) => `${c[0]}.${c[1]}`);
    for (const k of ["countsPermanent", "countsConsumable", "schematicFolder", "createSchematic", "recipeLanguage"]) {
      expect(keys).toContain(`drakkenheim-recipes.${k}`);
    }
    expect(keys).not.toContain("drakkenheim-recipes.enabled");
  });

  it("reports an error when the system is not dnd5e", async () => {
    game.system.id = "pf2e";
    await load();
    Hooks.callAll("init");
    Hooks.callAll("ready");
    expect(ui.notifications.error).toHaveBeenCalledOnce();
  });
});
