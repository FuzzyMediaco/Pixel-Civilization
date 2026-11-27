import type { EraNameTable } from "./types";

/** Display names for the deliberate world-war-ii designs in src/game/designs/eraArt/world-war-ii.ts. */
export default {
  public_library: {
    name: "Lending Carriage Hall",
    levels: ["Reading Carriage", "Platform Library", "Twin Carriage Library", "Footbridge Library", "Lending Carriage Hall"],
    variants: ["Lending Carriages", "Nissen Hut Library", "Shelter Reading Room", "Terrace Lending Library"],
    description: "Retired railway reading cars, corrugated huts or a turf-roofed shelter keep the neighborhood reading through the blackout.",
    aliases: ["library", "books", "reading", "carriage", "railway library"],
  },
  post_offices: {
    name: "Home Front Post",
    levels: ["Letter Box Counter", "Village Post", "Sorting Shed", "Mail Depot", "Central Rail Mail"],
    variants: ["Rail Mail Shed", "Pigeon Loft Post", "Field Post Depot", "Despatch Riders' Yard"],
    description: "Letters move from the counter through a sawtooth sorting shed to mail vans, pigeons, lorries or despatch riders.",
    aliases: ["post office", "mail", "letters", "pigeon", "despatch"],
  },
  courthouses: {
    name: "Assize Hall",
    levels: ["Magistrates' Room", "Petty Sessions", "Assize Hall", "Crown Court", "High Court of the Island"],
    variants: ["Town Hall Assizes", "Sandbagged Grand Court", "Tribunal Keep", "Commission Hall"],
    description: "A tall, symmetric hall above a long stone stair, its windows taped and its steps sandbagged.",
    aliases: ["courthouse", "court", "justice", "assizes", "law"],
  },
  city_offices: {
    name: "Civil Defence Town Hall",
    levels: ["Warden's Post", "Parish Office", "Town Hall", "Civil Defence HQ", "Ministry Tower"],
    variants: ["Civil Defence HQ", "Clock Tower Town Hall", "Ministry Radio Mast", "Ration Board Offices"],
    description: "The island's tallest civic tower, with siren, clock or wireless mast over a square of notice boards and queues.",
    aliases: ["city hall", "town hall", "civil defence", "siren", "ration"],
  },
  banks: {
    name: "War Savings Bank",
    levels: ["Savings Window", "Post Office Savings", "War Savings Bank", "Bunker Treasury", "Reserve Strongroom"],
    variants: ["Sandbagged Vault", "War Bonds Bank", "Bunker Treasury", "Brick Savings Bank"],
    description: "Squat and closed behind sandbags, concrete or iron grilles, with one guarded door.",
    aliases: ["bank", "savings", "war bonds", "vault", "treasury"],
  },
} satisfies EraNameTable;
