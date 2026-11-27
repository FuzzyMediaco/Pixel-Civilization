import type { EraNameTable } from "./types";

export default {
  public_library: {
    name: "Bamboo Slip Archive",
    levels: [
      "Reader’s Bundle",
      "Slip Reading Walk",
      "Manuscript Court",
      "Scholars’ Archive",
      "Garden of Bound Histories",
    ],
    variants: ["Silk-Bound Fan Court", "Hinged Reading Walk", "Upright Slip Alleys", "Folded Story Theatre"],
    description:
      "Bound bamboo slips open into reading walks and an illustrated garden. Scholars gather under folds, between tied stacks and around a tiny stage.",
    aliases: ["bamboo library", "manuscript", "reading garden"],
  },
  post_offices: {
    name: "Imperial Courier Yard",
    levels: ["Message Stand", "Courier Relay", "Dispatch Court", "Provincial Post", "Grand Relay Station"],
    variants: ["Riders’ Lane", "Turning Cart Inn", "Canal Packet Post", "Packet Hoist Yard"],
    description:
      "Red dispatch gates mark the way between the street and the sorting racks. Couriers move bamboo cases by cart, shallow canal boat and packet hoist.",
    aliases: ["relay", "postal station", "canal mail"],
  },
  courthouses: {
    name: "Timber Judgment Hall",
    levels: [
      "Hearing Bench",
      "Witness Court",
      "District Tribunal",
      "Magistrate’s Hall",
      "Court of Petitions",
    ],
    variants: ["Screen Wall Stair", "Twin Witness Drums", "Listeners’ Fan", "Crossed Hearing Galleries"],
    description:
      "Paired screens and listening seats preserve a clear path up to the magistrate. A timber hearing roof shelters the high bench.",
    aliases: ["tribunal", "judgment hall", "magistrate"],
  },
  city_offices: {
    name: "Drum Tower Offices",
    levels: [
      "Ward Notice Court",
      "Clerks’ Walk",
      "Public Drum Square",
      "Prefecture Hall",
      "Grand Council Terrace",
    ],
    variants: [
      "Stair Drum Pavilion",
      "Water Clock Court",
      "Eight-Sided Lantern Square",
      "Accountants’ Balcony",
    ],
    description:
      "An off-centre drum or gong calls residents to the public notice court. Open clerks’ walks line the square as the district grows.",
    aliases: ["municipal offices", "notice court", "drum tower"],
  },
  banks: {
    name: "Bronze Cash Treasury",
    levels: [
      "Sealed Cash Chest",
      "Counting House",
      "District Strongroom",
      "Treasury Court",
      "Provincial Reserve",
    ],
    variants: ["Square-Hole Coin Mint", "Boat Ingot Vault", "Tally Chest Lanes", "Seal Keeper’s Court"],
    description:
      "A square opening through a bronze cash coin marks the guarded entry. Banded cash chests, ingot walls and counting rooms surround the reserve.",
    aliases: ["cash house", "strongroom", "mint", "sycee"],
  },
} satisfies EraNameTable;
