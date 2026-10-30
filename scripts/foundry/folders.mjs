/** Top-level Item folders of the module (Schematics, Monster Components, Workshops). */

/** The top-level Item folder of that name, created if missing. */
export async function getItemFolder(name) {
  const existing = game.folders.find((f) => f.type === "Item" && f.name === name && !f.folder);
  if (existing) return existing;
  const Folder = foundry.utils.getDocumentClass("Folder");
  return Folder.create({ name, type: "Item" });
}
