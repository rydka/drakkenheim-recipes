# Drakkenheim Recipe Generator

Generate Monsters of Drakkenheim crafting recipes (workshop and monster components) for any magic item, with schematics.

Module Foundry VTT v14 pour le système dnd5e 6.x.

## Installation

Dans Foundry : **Add-on Modules → Install Module**, puis coller l'adresse du manifeste :

```
https://github.com/rydka/drakkenheim-recipes/releases/latest/download/module.json
```

## Utilisation

Sur la fiche d'un objet magique (dnd5e), le bouton « Recette Drakkenheim » de la barre de titre (ou l'entrée du menu « ⋮ ») ouvre un aperçu : atelier, composants de monstres tirés selon la rareté et le thème de l'objet, lignes modifiables. « Appliquer » écrit le paragraphe « Crafting. » dans la description de l'objet, garde la recette structurée en flag et crée (ou met à jour) le Schematic dans le dossier « Schematics ».

## Intégration Fabricate

Si le module [Fabricate](https://mistersilver-uk.github.io/fabricate/) (≥ 1.14) est actif, l'aperçu propose au MJ la case « Créer aussi la recette Fabricate » (cochée par défaut, réglable). À l'application, le module crée ou réutilise dans Fabricate :

- un **système d'artisanat** « Monsters of Drakkenheim » (nom réglable), en mode de résolution `routedByIngredients`, avec les catégories de composants (Animus, Bones, Dust, Fluid, Hair, Hide, Natural Weapon, Organ), les catégories de recettes (Common … Legendary) et les étiquettes (`bones`, `rare`, `giant`…). Un système existant du même nom est réutilisé tel quel (seules les étiquettes manquantes sont ajoutées) ; s'il n'est pas en mode `routedByIngredients`, la recette exige l'atelier exact au lieu d'accepter les ateliers supérieurs ;
- des **composants génériques** dans le dossier d'objets « Monster Components » (réglable) : objets butin « Rare Bones (Giant) », « Rare Animus »… (poids 1 lb, sans prix), enregistrés comme composants avec leur catégorie et les étiquettes catégorie, type de créature, rareté **et raretés inférieures** (une part plus rare satisfait une recette moins rare). Le MJ distribue ces objets aux joueurs (ou crée les siens dans Fabricate avec les mêmes étiquettes : ils seront acceptés) ;
- des **outils** « Rare Workshop », « Very Rare Workshop »… dans le dossier « Workshops » (réglable), enregistrés dans la bibliothèque d'outils du système ;
- la **recette** (nom de l'objet, catégorie = rareté, description = texte du paragraphe « Crafting. »), un jeu d'ingrédients nommé par atelier accepté (chacun exigeant son outil), un groupe par ligne de la recette (une option par type de créature), l'objet magique comme résultat, et le Schematic comme objet de recette lié (en mode de visibilité `knowledge` de Fabricate, les joueurs voient la recette après avoir appris le Schematic).

Réappliquer une recette met la recette Fabricate à jour sans rien dupliquer. Un échec côté Fabricate n'annule pas la description ni le Schematic ; il est notifié avec le message de Fabricate.

**À configurer par le MJ dans Fabricate** : les stations d'outils (présence virtuelle d'un atelier dans une scène, par région), la récolte des parts sur les monstres, les essences, jets de compétence, temps et monnaie, et le mode de visibilité des recettes. Supprimer une recette Drakkenheim ne supprime rien dans Fabricate.

Sans Fabricate, rien ne change : la case n'apparaît pas.

## Développement

```
npm install
npm test        # tests unitaires
npm run lint
```
