# Drakkenheim Recipe Generator (`drakkenheim-recipes`)

Module Foundry VTT de l'atelier (voir le `CLAUDE.md` de l'atelier, deux niveaux au-dessus, pour les règles communes). Ce fichier fait foi pour ce module.

## Objectif

Generate Monsters of Drakkenheim crafting recipes (workshop and monster components) for any magic item, with schematics.

## Cibles

Foundry v14, dnd5e 6.x. Toute API utilisée doit exister dans ces versions. Consulter les sources en lecture seule :
- Foundry : `C:/Users/Shadow/AppData/Local/Programs/Foundry Virtual Tabletop/resources/app`
- dnd5e : `C:/Users/Shadow/AppData/Local/FoundryVTT/Data/systems/dnd5e`

## Structure

| Chemin | Contenu |
|---|---|
| `module.json` | Manifeste. `version` est réécrite par le workflow de release. |
| `scripts/main.mjs` | Point d'entrée : hooks `init` (réglages, hooks de fiche, templates) et `ready` (contrôle du système, API) |
| `scripts/constants.mjs` | `MODULE_ID`, clé de flag `recipe`, classe du bloc `drakkenheim-recipes-recipe`, version du format |
| `scripts/rules/` | Tables pures : paliers de rareté et prix (`tiers`), catégories et plans par genre d'objet (`categories`), vocabulaire EN/FR et types compatibles (`vocabulary`), mots-clés de thème (`themes`) |
| `scripts/core/` | Code pur, sans Foundry : `classify` (éligibilité, genre), `theme` (détection), `generate` (générateur, tirage injectable), `render` (HTML EN/FR du bloc « Crafting. », et `renderRecipeText` en texte), `description` (repérage et remplacement du bloc), `schematic` (données du Schematic), `fabricate-translate` (traduction d'une recette en données Fabricate : composants génériques, ateliers, jeux d'ingrédients, système ; identifiants fictifs stables sans Fabricate), `counts`, `rng` |
| `scripts/foundry/` | Couche Foundry : `settings`, `sheet-button` (icône et entrée « ⋮ »), `recipe-dialog` (aperçu ApplicationV2), `apply` (description, flag, Schematic, puis Fabricate), `folders` (dossiers d'objets du module), `fabricate-bridge` (**seul fichier qui touche `game.fabricate`** : détection, contrôle de l'API, création ou réutilisation dans Fabricate), `api` |
| `styles/drakkenheim-recipes.css` | Styles, tous sous la classe `.drakkenheim-recipes` |
| `lang/` | Traductions `en` et `fr` de l'interface, clés sous `drakkenheim-recipes.*` (le texte généré vient de `scripts/rules/vocabulary.mjs`) |
| `templates/` | Templates Handlebars (`recipe-dialog.hbs`) |
| `tests/unit/` | Tests Vitest avec les faux globaux Foundry de `tests/setup/` |
| `tests/integration/` | Tests dans un vrai Foundry, servent de preuve de fonctionnement |

## Conventions

- Tout ce que le module ajoute est préfixé par l'identifiant `drakkenheim-recipes` : réglages, flags, sockets, clés de traduction, classes CSS, hooks personnalisés (`drakkenheim-recipes.<nom>`).
- Pas de modification directe des prototypes de Foundry ou de dnd5e. Préférer les hooks et l'API publique. Si c'est impossible, le documenter ici dans « Points de contact avec d'autres modules ».
- Toute logique testable est exportée depuis un fichier sans effet de bord à l'import (sauf l'enregistrement de hooks dans `main.mjs`).

## Commandes

```
npm install
npm test
npm run test:coverage   # couverture de scripts/core/** et scripts/rules/** (cible M5 : 90 %)
npm run lint
```

## Données

- Flag `flags.drakkenheim-recipes.recipe` (objet et Schematic) : recette structurée (`version`, `lang`, `itemName`, `itemUuid`, `rarity`, `workshop`, `crRange`, `distinctSources`, `theme`, `components[]`, `generatedAt`). Tout texte (aperçu, description, Schematic) est rendu depuis cette donnée par `scripts/core/render.mjs`.
- Bloc dans la description : `<p>` et `<ul>` portant la classe `drakkenheim-recipes-recipe` (pas de `<div>`, ProseMirror le supprimerait). Une recette du livre (`Crafting.` / `Artisanat.` + `<ul>`) est reconnue et remplacée en place.
- Schematic : objet `loot` / `gear` du monde, dans le dossier réglable (« Schematics »), prix du barème de l'Appendice D, lien `@UUID` vers l'objet, aucun droit joueur.

### Intégration Fabricate (module tiers `fabricate` ≥ 1.14, facultatif, `relationships.recommends`)

- Déclenchement : case « Créer aussi la recette Fabricate » de l'aperçu, offerte seulement à un MJ quand Fabricate est prêt (`isFabricateReady()` : hook `fabricate.ready` reçu ou `game.fabricate.ready === true`). Aucune API Fabricate n'est appelée avant, ni hors de l'application d'une recette. `applyRecipe(item, recipe, { createFabricate })` appelle `syncFabricateRecipe` en dernier : un échec Fabricate ne défait ni la description, ni le flag, ni le Schematic.
- Ordre de `syncFabricateRecipe` : gardes (MJ, prêt, `checkFabricateApi` : liste fermée de méthodes, un seul `console.warn` par session si l'une manque) → prévalidation `game.fabricate.api.Recipe(...).validateStructure()` → système (créé en `routedByIngredients`, sinon réutilisé tel quel avec ajout des étiquettes et catégories manquantes) → dossiers et objets génériques (`Item.createDocuments`, chaque document retrouvé ensuite par son flag `generic`, jamais par index : l'ordre de retour n'est pas garanti) → composants (`addItemFromUuid`, puis `updateItem` seulement pour poser notre catégorie si elle est vide ou `general` et **ajouter** nos étiquettes aux existantes : les retouches du MJ sont conservées) → objet magique comme composant résultat (uuid de compendium accepté) → outils (`addToolFromUuid` ; en mode non routé, seul l'atelier exact) → Schematic (`addRecipeItemFromUuid`) → `updateRecipe` ou `createRecipe` (`notify: false`) → lien `recipeIds` (`updateRecipeItemDefinition` ; l'ancienne définition notée dans le flag perd le lien si le Schematic a changé ou est décoché) → flag. Chaque étape passe par `step()` : exception → `{ status: "error", step, message }`. Les `updateItem` sont séquentiels (une sauvegarde de système chacun, à la première application seulement) : `applyBulkEditToComponents` de Fabricate applique une même catégorie et un même jeu d'étiquettes à tous les ids, inutilisable ici où chaque composant a les siens.
- Flags : `flags.drakkenheim-recipes.fabricate` (`systemId`, `recipeId`, `recipeItemId`, `componentId`, `mode`, `updatedAt`) sur l'objet, ou sur le Schematic si l'objet n'est pas modifiable ; `flags.drakkenheim-recipes.generic` (`kind: component|workshop`, `key`, `version`) sur les objets génériques et les ateliers créés par le module (clé de réutilisation, puis le nom).
- Étiquettes Fabricate : clés anglaises en minuscules avec espaces (`bones`, `very rare`, `natural weapon`, `giant`) ; un composant générique porte sa rareté et toutes les inférieures. Les étiquettes sont sensibles à la casse côté Fabricate.
- Mode de résolution : les `toolIds` d'un jeu d'ingrédients ne sont lus par Fabricate 1.14.1 qu'en `routedByIngredients` et pour un jeu **nommé** ; en mode `simple` (système existant), la recette a un seul jeu et `recipe.toolIds = [atelier exact]`.
- Réglages : `fabricateEnabled`, `fabricateSystemName`, `fabricateComponentFolder`, `fabricateWorkshopFolder` (monde ; visibles seulement si Fabricate est actif, condition `isFabricateActive()` et lecture `fabricateOptions()` fournies par le pont, `settings.mjs` ne nomme pas Fabricate). API : `api.fabricate` (`isFabricateReady`, `checkFabricateApi`, `syncFabricateRecipe`, `translateRecipe`, `componentSpecs`, `workshopSpecs`, `rarityTags`, `renderRecipeText`…), aussi copiée à plat sur `api`.

## Points de contact avec d'autres modules

Liste maintenue par le développeur et lue par le vérificateur : hooks écoutés, méthodes remplacées, sélecteurs CSS globaux, modules tiers détectés ou adaptés.

- Hook `renderItemSheet5e` (`scripts/foundry/sheet-button.mjs`) : ajoute un bouton `.drakkenheim-recipes-open` dans la barre de titre de la fiche d'objet dnd5e (et du conteneur, qui en hérite), inséré avant `[data-action="copyUuid"]` / `close`. `item-configurator` ajoute une icône au même endroit : classes distinctes, pas de dépendance d'ordre.
- Hook `getHeaderControlsItemSheet5e` (`scripts/foundry/sheet-button.mjs`) : entrée `drakkenheim-recipes-open` dans le menu « ⋮ » de la fiche.
- `Item.update` (description et flag de l'objet), `Item.create` / `update` (Schematic) et `Folder.create` (dossier des Schematics) : documents du monde, visibles des modules qui écoutent `createItem` / `updateItem`.
- Détection textuelle des recettes du module `drakkenheim-monsters` dans les descriptions (`scripts/core/description.mjs`) pour les remplacer ; aucune dépendance technique à ce module.
- Hook `fabricate.ready` (`scripts/foundry/fabricate-bridge.mjs`, écouté, émis par Fabricate seul) et lecture de `game.fabricate.ready` : détection de Fabricate. Module tiers détecté : `fabricate` (`game.modules.get("fabricate")?.active`, vérifié 1.14.1).
- Écritures dans les données de Fabricate par son API publique (`getCraftingSystemManager()` : `createSystem`, `updateSystem`, `addItemFromUuid`, `updateItem`, `addToolFromUuid`, `addRecipeItemFromUuid`, `updateRecipeItemDefinition` ; `getRecipeManager()` : `createRecipe`, `updateRecipe`), seulement pendant l'application d'une recette par un MJ avec la case cochée. Fabricate pose ses propres flags `fabricate.roles.*` sur nos objets du monde ; nous ne les lisons pas. Fabricate écoute `updateItem` et recopie nom, image et description de l'objet vers son composant.
- `Item.createDocuments` dans deux nouveaux dossiers (« Monster Components », « Workshops ») et `Folder.create` : documents du monde visibles des modules qui écoutent `createItem` / `createFolder`.
- Aucune méthode de Foundry, de dnd5e ou de Fabricate remplacée, aucun `CONFIG` modifié, aucun sélecteur CSS global (tout sous `.drakkenheim-recipes`).
