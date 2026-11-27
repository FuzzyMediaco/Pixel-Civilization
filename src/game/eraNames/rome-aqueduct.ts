import type { EraNameTable } from "./types";

export default {
  public_library: {
    name: "Vaults of the Record Keepers",
    levels: [
      "Lending Niche",
      "Scroll Rooms",
      "Readers’ Court",
      "Archive Galleries",
      "Campus of the Scroll",
    ],
    variants: [
      "Stepped Scroll-Vault Court",
      "Split Barrel Rooms",
      "Archive Niche Alley",
      "Roofed Recital Terrace",
    ],
    description:
      "Brick scroll rooms overlook a stepped reading court. Shelves, benches and recital stages bring readers into the open.",
    aliases: ["bibliotheca", "scroll vault", "public library"],
  },
  post_offices: {
    name: "Cursus Publicus Relay",
    levels: [
      "Rider’s Counter",
      "Change of Horses",
      "Sorting Yard",
      "Dispatch Arcade",
      "Great Relay Station",
    ],
    variants: [
      "Through Stable",
      "Turning Relay Court",
      "Remount Racks",
      "Packet Gatehouse",
    ],
    description:
      "Riders bring sealed packets to a street counter. An open transfer aisle leads past the sorting racks to saddled horses and the dispatch gate.",
    aliases: ["postal relay", "mail stable", "packet counter"],
  },
  courthouses: {
    name: "Basilica of the Tribunal",
    levels: [
      "Raised Hearing Seat",
      "Magistrate’s Hall",
      "Listening Galleries",
      "Basilica Stair",
      "Tribunal of the People",
    ],
    variants: [
      "Pedimented Basilica",
      "Tribunal Exedra",
      "Judgment Arch",
      "Lantern Cross Hall",
    ],
    description:
      "A magistrate sits above a ceremonial stair. The galleries on either side give citizens a place to follow the hearing.",
    aliases: ["tribunal", "judgment hall", "basilica"],
  },
  city_offices: {
    name: "Forum of the Magistrates",
    levels: [
      "Notice Square",
      "Magistrate’s Portico",
      "Civic Forum",
      "Timekeepers’ Galleries",
      "Grand Horologium",
    ],
    variants: [
      "Clepsydra Tower",
      "Beacon Loggia",
      "Meridian Pair",
      "Dial and Rostra",
    ],
    description:
      "A civic timekeeper stands beside a low magistrate’s gallery. Residents read notices, meet at the fountain and hear addresses from the rostra.",
    aliases: ["city offices", "horologium", "water clock", "public forum"],
  },
  banks: {
    name: "Aerarium Counting House",
    levels: [
      "Treasury Counter",
      "Sealed Reserve",
      "Counting Court",
      "Vault Enclosure",
      "Great Aerarium",
    ],
    variants: [
      "Treasury Drum",
      "Twin Coin Vaults",
      "Ashlar Counting Chest",
      "Tally Enclosure",
    ],
    description:
      "A single guarded entrance leads into thick brick vaults. A counting table and bronze locks mark the route from street to treasury.",
    aliases: ["aerarium", "treasury", "argentaria"],
  },
} satisfies EraNameTable;
