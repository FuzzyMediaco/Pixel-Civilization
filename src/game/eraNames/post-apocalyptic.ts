import type { EraNameTable } from "./types";

export default {
  public_library: {
    name: "Reservoir of Stories",
    levels: [
      "Cistern Book Nook",
      "Salvaged Lending Room",
      "Greenhouse Reading Deck",
      "Town Story Garden",
      "Reservoir of Stories",
    ],
    variants: ["Cutaway Cistern Shelves", "Split Tank Reading Deck", "Salvaged Shelving Lane", "Greenhouse Story Garden"],
    description:
      "A repaired tank shelters a public collection. Curved shelves, catwalks and planted reading rooms grow around the first lending bench.",
    aliases: ["library", "story garden", "book cistern", "public lending", "reading room"],
  },
  post_offices: {
    name: "Handline Mail Yard",
    levels: ["Bicycle Letter Stop", "Day Mail Carriage", "Sorting Sidings", "Pulley Transfer Bridge", "Couriers’ Junction"],
    variants: ["Carriage Mail Line", "Pulley Letter Bridge", "Bicycle Sorting Court", "Signal Box Exchange"],
    description:
      "Bicycle couriers collect sorted mail from a repaired carriage. Canvas bags travel across the yard to waiting racks and dispatch windows.",
    aliases: ["post office", "mail carriage", "bicycle courier", "sorting yard", "dispatch"],
  },
  courthouses: {
    name: "Common Truss Court",
    levels: ["Petition Steps", "Public Hearing Room", "Truss Court", "Witness Galleries", "Assembly of Appeals"],
    variants: ["Rebuilt Truss Hall", "Split Gable Tribunal", "Bridge-Frame Court", "Masonry Jury Steps"],
    description:
      "Recovered masonry steps lead to a public hearing. Exposed trusses shelter the judge, petitioners and jury above the street.",
    aliases: ["court", "courthouse", "tribunal", "appeals", "public hearing"],
  },
  city_offices: {
    name: "Bell Tank Commons",
    levels: ["Town Clerk’s Bell", "Repaired Signal Tower", "Reclaimed Meeting Green", "Town Council Deck", "Belfry Commons"],
    variants: ["Water-Tower Belfry", "Windlass Bell Loft", "Silo Council Balcony", "Open Derrick Commons"],
    description:
      "The settlement’s bell rings above working clerk cabins. Residents cross the reclaimed square to read the notices and address the council.",
    aliases: ["city offices", "town hall", "water tower", "council", "public square"],
  },
  banks: {
    name: "Barter Strongrooms",
    levels: ["Barter Hatch", "Reinforced Exchange", "Tank Strongroom", "Walled Counting Yard", "Common Reserve"],
    variants: ["Riveted Tank Reserve", "Twin Strongroom Hulls", "Barrel Vault Exchange", "Earth-Banked Coffers"],
    description:
      "The settlement stores valuables in salvaged, riveted strongrooms. A small staffed barter hatch opens onto the shared counting yard.",
    aliases: ["bank", "barter exchange", "strongroom", "reserve", "clearing house"],
  },
} satisfies EraNameTable;
