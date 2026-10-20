// Extracts the SRD magic items (rarity set) from the installed dnd5e compendiums
// into a reduced JSON fixture. The AppData packs are never opened in place:
// each pack folder is copied (without LOCK) into a scratch folder first.
// Usage: node tests/tools/extract-srd-items.mjs <scratchDir>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP = "C:/Users/Shadow/AppData/Local/Programs/Foundry Virtual Tabletop/resources/app";
const PACKS = "C:/Users/Shadow/AppData/Local/FoundryVTT/Data/systems/dnd5e/packs";
const { ClassicLevel } = await import(`file:///${APP}/node_modules/classic-level/index.js`);

const scratch = path.resolve(process.argv[2] ?? "scratch");
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures/srd-magic-items.json");
const TYPES = new Set(["weapon", "equipment", "consumable", "tool", "container"]);
const RARITIES = new Set(["common", "uncommon", "rare", "veryRare", "legendary", "artifact"]);

function reduceDamage(d) {
  const types = [...(d?.base?.types ?? [])];
  return types.length ? { base: { types } } : undefined;
}

const items = [];
const seen = new Set();
for (const pack of ["items", "equipment24"]) {
  const dest = path.join(scratch, "packs", pack);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const f of fs.readdirSync(path.join(PACKS, pack))) {
    if (f === "LOCK") continue;
    fs.copyFileSync(path.join(PACKS, pack, f), path.join(dest, f));
  }
  const db = new ClassicLevel(dest, { keyEncoding: "utf8", valueEncoding: "json" });
  await db.open();
  for await (const [key, doc] of db.iterator()) {
    if (!key.startsWith("!items!")) continue;
    if (!TYPES.has(doc.type)) continue;
    const s = doc.system ?? {};
    const rar = s.rarities ?? (s.rarity ? [s.rarity] : []);
    const rarities = [...rar].filter((r) => RARITIES.has(r));
    if (!rarities.length) continue;
    const id = `${doc.name}|${rarities.join(",")}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const damage = [];
    for (const a of Object.values(s.activities ?? {})) {
      for (const p of a.damage?.parts ?? []) if (p.types?.length) damage.push({ types: [...p.types] });
    }
    items.push({
      name: doc.name,
      type: doc.type,
      pack,
      system: {
        type: { value: s.type?.value ?? "", baseItem: s.type?.baseItem ?? "" },
        rarities,
        damage: reduceDamage(s.damage) ?? undefined,
        activities: damage.length ? { a: { damage: { parts: damage } } } : undefined,
        description: { value: (s.description?.value ?? "").slice(0, 1200) }
      }
    });
  }
  await db.close();
}
items.sort((a, b) => a.name.localeCompare(b.name));
fs.writeFileSync(out, JSON.stringify(items, null, 1));
const byType = {}, byRar = {};
for (const i of items) {
  byType[`${i.type}/${i.system.type.value}`] = (byType[`${i.type}/${i.system.type.value}`] ?? 0) + 1;
  byRar[i.system.rarities[0]] = (byRar[i.system.rarities[0]] ?? 0) + 1;
}
console.log(items.length, "items", byRar);
console.log(byType);
