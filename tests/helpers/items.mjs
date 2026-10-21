import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const readFixture = (name) => JSON.parse(fs.readFileSync(path.join(here, "../fixtures", name), "utf8"));

/** SRD magic items (reduced), each shaped like item.toObject() plus a uuid. */
export function loadCorpus() {
  return readFixture("srd-magic-items.json").map((it, i) => ({ ...it, uuid: `Item.srd${i}` }));
}

/** Build a minimal item data object. */
export function makeItem({ name = "Test Item", type = "weapon", subtype = "", rarities = ["rare"], description = "", damage, activityTypes, baseItem = "" } = {}) {
  const system = { type: { value: subtype, baseItem }, rarities, description: { value: description } };
  if (damage) system.damage = { base: { types: damage } };
  if (activityTypes) system.activities = { a: { damage: { parts: [{ types: activityTypes }] } } };
  return { name, type, uuid: "Item.test0000", system };
}

export const OPTIONS = {
  counts: { permanent: [4, 4, 5, 6, 7], consumable: [3, 3, 3, 4, 4] },
  lang: "en",
  now: () => "2026-10-20T12:00:00.000Z"
};
