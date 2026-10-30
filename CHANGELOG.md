# Changelog

## 0.2.0

- Fabricate integration (optional, `fabricate` >= 1.14): when the module is active and ready, the preview offers
  "Also create the Fabricate recipe". Applying creates or reuses a "Monsters of Drakkenheim" crafting system
  (`routedByIngredients`), generic Monster Components and Workshop tools as world items, registers the magic item
  as the result, creates or updates the recipe (one named ingredient set per accepted Workshop, tag-based
  ingredients with cumulative rarities) and links the Schematic as a recipe item.
- New world settings: `fabricateEnabled`, `fabricateSystemName`, `fabricateComponentFolder`,
  `fabricateWorkshopFolder` (shown only when Fabricate is active).
- `applyRecipe` gains `createFabricate` and returns `fabricate` (sync result); API `api.fabricate` and
  `renderRecipeText`.

## 0.1.0

- Version initiale.
