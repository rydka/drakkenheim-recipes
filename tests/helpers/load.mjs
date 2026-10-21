// Resolves exports whose home file is not fixed by the design (recipeMatches).
const CANDIDATES = [
  "../../scripts/core/generate.mjs", "../../scripts/core/theme.mjs", "../../scripts/core/match.mjs",
  "../../scripts/core/recipe.mjs", "../../scripts/core/render.mjs"
];

export async function findExport(name) {
  for (const file of CANDIDATES) {
    try {
      const mod = await import(file);
      if (typeof mod[name] === "function") return mod[name];
    } catch { /* file missing or not importable yet */ }
  }
  throw new Error(`Export "${name}" not found in ${CANDIDATES.join(", ")}`);
}
