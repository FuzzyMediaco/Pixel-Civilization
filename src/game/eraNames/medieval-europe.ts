import type { EraNameTable } from "./types";

export default {
  public_library: {
    name: "Lantern Scriptorium",
    levels: ["Copyist’s Desk", "Manuscript Workshop", "Readers’ Court", "Illuminators’ Gallery", "Great Public Scriptorium"],
    variants: ["Lantern Reading Loft", "Splayed Folio Roof", "Chained-Book Cloister", "Folded Manuscript Stage"],
    description: "Copyists work beside the street beneath a timber lantern, between open folios, along a chained-book cloister or on a manuscript stage. Reading courts and galleries invite the town inside.",
    aliases: ["library", "books", "scribe", "reading", "manuscripts"],
  },
  post_offices: {
    name: "Guild Messenger Yard",
    levels: ["Messenger’s Hatch", "Pigeon Post", "Parcel Mews", "Guild Relay Yard", "Grand Courier Exchange"],
    variants: ["End Dovecote", "Diagonal Dispatch Shed", "Loft over the Cart Lane", "Split Pigeon Mews"],
    description: "Sealed packets pass from the street hatch to a timber sorting shed. Carts and nesting pigeons share a relay yard with a separate dispatch gate.",
    aliases: ["post", "mail", "pigeon", "parcel", "courier"],
  },
  courthouses: {
    name: "Hall of the Assizes",
    levels: ["Petition Stair", "Hearing Chamber", "Witness Galleries", "Borough Assizes", "Great Tribunal"],
    variants: ["Hammer-Beam Hall", "Octagonal Moot", "Assize Gatehouse", "Lancet Tribunal"],
    description: "The town climbs a broad stone stair to hear petitions beneath an open judgment roof. Timber witness galleries, sheltered approaches and a central bench grow around the hearing.",
    aliases: ["courthouse", "court", "justice", "judgment", "jury"],
  },
  city_offices: {
    name: "Market Cross Guild Offices",
    levels: ["Ward Bell", "Town Clerk’s Hall", "Market Cross Square", "Public Guild Assembly", "Free Borough Belfry"],
    variants: ["Detached Stone Belfry", "Jettied Bell Loft", "Open Cruck Bell Frame", "Stair-Turret Guildhall"],
    description: "A guild bell above the clerk’s wing calls the town to its market cross. Notice boards, covered walks and assembly balconies gather around the square.",
    aliases: ["city offices", "town hall", "guild", "bell", "council"],
  },
  banks: {
    name: "Guild Strongroom",
    levels: ["Barred Deposit Hatch", "Guild Counting House", "Weighing Yard", "Treasury Court", "Guild Reserve"],
    variants: ["Ironbound Guild Chest", "Corner-Tower Counting Keep", "Treasury Drum Yard", "Turf-Banked Vault"],
    description: "A guarded hatch admits deposits into an ironbound chest, squat keep, cluster of masonry drums or turf-banked vault. Later reserves add their own locked chambers.",
    aliases: ["bank", "treasury", "vault", "coins", "strongbox"],
  },
} satisfies EraNameTable;
