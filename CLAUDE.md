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
| `scripts/core/` | Code pur, sans Foundry : `classify` (éligibilité, genre), `theme` (détection), `generate` (générateur, tirage injectable), `render` (HTML EN/FR du bloc « Crafting. »), `description` (repérage et remplacement du bloc), `schematic` (données du Schematic), `counts`, `rng` |
| `scripts/foundry/` | Couche Foundry : `settings`, `sheet-button` (icône et entrée « ⋮ »), `recipe-dialog` (aperçu ApplicationV2), `apply` (description, flag, Schematic), `api` |
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

## Points de contact avec d'autres modules

Liste maintenue par le développeur et lue par le vérificateur : hooks écoutés, méthodes remplacées, sélecteurs CSS globaux, modules tiers détectés ou adaptés.

- Hook `renderItemSheet5e` (`scripts/foundry/sheet-button.mjs`) : ajoute un bouton `.drakkenheim-recipes-open` dans la barre de titre de la fiche d'objet dnd5e (et du conteneur, qui en hérite), inséré avant `[data-action="copyUuid"]` / `close`. `item-configurator` ajoute une icône au même endroit : classes distinctes, pas de dépendance d'ordre.
- Hook `getHeaderControlsItemSheet5e` (`scripts/foundry/sheet-button.mjs`) : entrée `drakkenheim-recipes-open` dans le menu « ⋮ » de la fiche.
- `Item.update` (description et flag de l'objet), `Item.create` / `update` (Schematic) et `Folder.create` (dossier des Schematics) : documents du monde, visibles des modules qui écoutent `createItem` / `updateItem`.
- Détection textuelle des recettes du module `drakkenheim-monsters` dans les descriptions (`scripts/core/description.mjs`) pour les remplacer ; aucune dépendance technique à ce module.
- Aucune méthode de Foundry ou de dnd5e remplacée, aucun `CONFIG` modifié, aucun sélecteur CSS global (tout sous `.drakkenheim-recipes`).
