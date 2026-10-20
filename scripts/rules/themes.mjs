/**
 * Theme detection tables (C7): damage types and keywords (English and French) mapped to creature types and
 * designations. Keywords are matched as whole words, case- and diacritic-insensitive, with an optional plural.
 */

/** Damage types that carry a theme, in table order (ties in scoring are broken by this order). */
export const DAMAGE_THEMES = {
  fire: {
    creatureTypes: [{ type: "elemental", variant: "fire" }, { type: "dragon", variant: "red" }],
    designations: ["elementalFluid", "elementalDust"]
  },
  cold: {
    creatureTypes: [{ type: "elemental", variant: "water" }, { type: "dragon", variant: "white" }],
    designations: ["elementalFluid", "elementalDust"]
  },
  lightning: {
    creatureTypes: [{ type: "elemental", variant: "air" }, { type: "dragon", variant: "blue" }],
    designations: ["elementalFluid", "elementalDust"]
  },
  thunder: {
    creatureTypes: [{ type: "elemental", variant: "air" }, { type: "dragon", variant: "blue" }],
    designations: ["elementalFluid", "elementalDust"]
  },
  acid: {
    creatureTypes: [{ type: "ooze" }, { type: "dragon", variant: "black" }],
    designations: ["acidicBile"]
  },
  poison: {
    creatureTypes: [{ type: "monstrosity" }, { type: "plant" }, { type: "dragon", variant: "green" }],
    designations: ["venom"]
  },
  necrotic: {
    creatureTypes: [{ type: "undead" }, { type: "fiend" }],
    designations: ["undeadDust", "ectoplasm"]
  },
  radiant: {
    creatureTypes: [{ type: "celestial" }],
    designations: ["celestialDust"]
  },
  psychic: {
    creatureTypes: [{ type: "aberration" }],
    designations: ["brain"]
  },
  force: {
    creatureTypes: [{ type: "construct" }, { type: "aberration" }],
    designations: []
  }
};

/** Damage types ignored by the detection (physical and healing). */
export const IGNORED_DAMAGE = ["bludgeoning", "piercing", "slashing", "healing", "temphp"];

/** Keyword (lower case, without diacritics) -> damage type. Names only. */
export const DAMAGE_KEYWORDS = {
  flame: "fire", fire: "fire", fiery: "fire", burning: "fire", blaze: "fire", blazing: "fire", inferno: "fire",
  ember: "fire", fireball: "fire", flamme: "fire", feu: "fire", ardent: "fire", ardente: "fire", brasier: "fire",
  frost: "cold", ice: "cold", icy: "cold", cold: "cold", winter: "cold", snow: "cold", glacial: "cold",
  givre: "cold", glace: "cold", froid: "cold", gel: "cold", hiver: "cold", neige: "cold",
  storm: "lightning", lightning: "lightning", shock: "lightning", shocking: "lightning",
  tempete: "lightning", foudre: "lightning", orage: "lightning", eclair: "lightning",
  thunder: "thunder", thunderous: "thunder", tonnerre: "thunder",
  acid: "acid", acidic: "acid", corrosive: "acid", acide: "acid", corrosif: "acid",
  venom: "poison", venomous: "poison", poison: "poison", poisonous: "poison", toxic: "poison", toxin: "poison",
  venin: "poison", venimeux: "poison", venimeuse: "poison", toxique: "poison", empoisonne: "poison",
  necrotic: "necrotic", death: "necrotic", wither: "necrotic", withering: "necrotic", grave: "necrotic",
  necrotique: "necrotic", mort: "necrotic", mortel: "necrotic", mortelle: "necrotic", tombe: "necrotic",
  radiant: "radiant", holy: "radiant", sun: "radiant", sunlight: "radiant", sacred: "radiant", dawn: "radiant",
  sacre: "radiant", sacree: "radiant", soleil: "radiant", saint: "radiant", sainte: "radiant", aube: "radiant",
  mind: "psychic", psychic: "psychic", thought: "psychic", esprit: "psychic", psychique: "psychic", pensee: "psychic",
  force: "force"
};

/** Keyword -> creature type (names and descriptions). */
export const CREATURE_KEYWORDS = {
  // undead
  undead: "undead", undying: "undead", lich: "undead", vampire: "undead", vampiric: "undead", zombie: "undead",
  skeleton: "undead", skeletal: "undead", ghost: "undead", ghostly: "undead", wraith: "undead", spectre: "undead",
  specter: "undead", spectral: "undead", mummy: "undead", ghoul: "undead", revenant: "undead",
  "mort-vivant": "undead", "morts-vivants": "undead", liche: "undead", squelette: "undead", fantome: "undead",
  momie: "undead", goule: "undead",
  // dragon
  dragon: "dragon", draconic: "dragon", drake: "dragon", wyrm: "dragon", wyvern: "dragon", dragonkind: "dragon",
  draconique: "dragon", vouivre: "dragon",
  // fey
  fey: "fey", fae: "fey", faerie: "fey", fairy: "fey", elf: "fey", elven: "fey", elvish: "fey", pixie: "fey",
  sprite: "fey", hag: "fey", satyr: "fey", dryad: "fey", elvenkind: "fey",
  fee: "fey", feerique: "fey", elfe: "fey", elfique: "fey", farfadet: "fey", dryade: "fey",
  // fiend
  fiend: "fiend", fiendish: "fiend", demon: "fiend", demonic: "fiend", devil: "fiend", devilish: "fiend",
  infernal: "fiend", abyssal: "fiend", hellish: "fiend", hell: "fiend", imp: "fiend", succubus: "fiend",
  fielon: "fiend", demoniaque: "fiend", diable: "fiend", diabolique: "fiend", enfer: "fiend",
  // giant
  giant: "giant", ogre: "giant", troll: "giant", titan: "giant", cyclops: "giant", ettin: "giant",
  geant: "giant", geante: "giant", cyclope: "giant",
  // elemental
  elemental: "elemental", efreeti: "elemental", djinni: "elemental", genie: "elemental", elementaire: "elemental",
  efrit: "elemental", djinn: "elemental",
  // celestial
  celestial: "celestial", angel: "celestial", angelic: "celestial", heavenly: "celestial", seraph: "celestial",
  unicorn: "celestial", pegasus: "celestial",
  celeste: "celestial", ange: "celestial", angelique: "celestial", licorne: "celestial", pegase: "celestial",
  // aberration
  aberration: "aberration", aberrant: "aberration", illithid: "aberration", beholder: "aberration",
  eldritch: "aberration", aboleth: "aberration", "mind flayer": "aberration",
  aberrante: "aberration", flagelleur: "aberration", tyrannoeil: "aberration",
  // construct
  construct: "construct", golem: "construct", clockwork: "construct", automaton: "construct", animated: "construct",
  artificiel: "construct", artificielle: "construct", automate: "construct", anime: "construct", animee: "construct",
  // ooze
  ooze: "ooze", slime: "ooze", jelly: "ooze", pudding: "ooze",
  vase: "ooze", gelee: "ooze", limon: "ooze",
  // plant
  plant: "plant", tree: "plant", treant: "plant", vine: "plant", fungal: "plant", fungus: "plant", myconid: "plant",
  blight: "plant", shambling: "plant",
  plante: "plant", vegetal: "plant", vegetale: "plant", arbre: "plant", sylvanien: "plant", champignon: "plant",
  liane: "plant",
  // monstrosity
  monstrosity: "monstrosity", monstrous: "monstrosity", chimera: "monstrosity", manticore: "monstrosity",
  basilisk: "monstrosity", medusa: "monstrosity", griffon: "monstrosity", griffin: "monstrosity", hydra: "monstrosity",
  owlbear: "monstrosity", displacer: "monstrosity", mimic: "monstrosity", gorgon: "monstrosity",
  monstruosite: "monstrosity", monstrueux: "monstrosity", monstrueuse: "monstrosity", chimere: "monstrosity",
  basilic: "monstrosity", meduse: "monstrosity", hydre: "monstrosity", hibours: "monstrosity"
};

/** Animal names (names only): the non-Animus parts then come from a Beast or a Monstrosity. */
export const BEAST_KEYWORDS = [
  "wolf", "wolves", "bear", "spider", "serpent", "snake", "lion", "eagle", "owl", "bat", "scorpion", "shark", "hawk",
  "frog", "toad", "ram", "horse", "boar", "bull", "ox", "stag", "elk", "deer", "cat", "panther", "tiger", "raven",
  "crow", "rat", "mouse", "fox", "hound", "dog", "ape", "monkey", "crab", "beetle", "wasp", "bee", "fish", "octopus",
  "squid", "whale", "viper", "cobra", "rhino", "elephant", "mammoth", "goat", "bird", "falcon", "vulture", "lizard",
  "crocodile", "turtle", "tortoise", "bison", "jackal", "hyena", "weasel", "badger", "mole", "python", "adder",
  "insect", "arachnid", "arachnida", "manta", "scarab", "animal", "beast", "leech", "lizard", "wyrmling", "animaux",
  "bete", "insecte", "sangsue",
  "loup", "loups", "ours", "araignee", "aigle", "hibou", "chouette", "chauve-souris", "requin", "faucon",
  "grenouille", "crapaud", "belier", "cheval", "sanglier", "taureau", "cerf", "chat", "panthere", "tigre", "corbeau",
  "renard", "chien", "singe", "crabe", "scarabee", "guepe", "abeille", "poisson", "pieuvre", "baleine", "vipere",
  "chevre", "oiseau", "vautour", "lezard", "tortue", "chacal", "hyene", "belette", "blaireau", "taupe"
];

/** Damage words recognised in descriptions (`<type> damage`, `resistance to <type>`, `dégâts de <type>`). */
export const DESCRIPTION_DAMAGE_WORDS = {
  fire: "fire", cold: "cold", lightning: "lightning", thunder: "thunder", acid: "acid", poison: "poison",
  necrotic: "necrotic", radiant: "radiant", psychic: "psychic", force: "force",
  feu: "fire", froid: "cold", foudre: "lightning", tonnerre: "thunder", acide: "acid",
  necrotiques: "necrotic", necrotique: "necrotic", radiants: "radiant", psychiques: "psychic", psychique: "psychic"
};
