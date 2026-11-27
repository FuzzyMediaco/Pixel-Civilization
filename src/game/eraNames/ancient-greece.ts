import type { EraNameTable } from "./types";

export default {
  public_library: {
    name: "Olive Grove Lyceum",
    levels: ["Olive Reading Steps", "Scroll Stoa", "Terrace of Readers", "Scholars’ Garden", "Great Grove Lyceum"],
    variants: ["Lyceum Listening Steps", "V-Shaped Stoa", "Scroll Cabinet Passage", "Olive-Grove Reading Circle"],
    description:
      "Listen to a reader under the olive branches. Painted stoas shelter scroll cabinets as new terraces and teaching courts open.",
  },
  post_offices: {
    name: "Messenger Stoa",
    levels: ["Runner’s Counter", "Relay Gate", "District Dispatch Yard", "Courier Exchange", "Great Messenger Stoa"],
    variants: ["Runner’s Relay", "Sailcloth Dispatch Lane", "Scroll Hoist", "Pigeon Fork"],
    description:
      "A public scroll counter opens onto a working relay yard. Couriers carry sealed rolls past canvas bays, loaded carts and raised dispatch gates.",
  },
  courthouses: {
    name: "Heliaia Judgment Court",
    levels: ["Judgment Seat", "Jurors’ Stair", "Civic Tribunal", "Court of the Assembly", "Great Heliaia"],
    variants: ["Pediment of the Jurors", "Open Jury Theatre", "Bridge of Judges", "Round Hearing Hall"],
    description:
      "Curving stone benches face a single high judgment seat. A ceremonial stair draws speakers through the middle of the seated jury.",
  },
  city_offices: {
    name: "Agora of the City Council",
    levels: ["Speaker’s Square", "Council Records Stoa", "District Agora", "Assembly Balcony", "Great Council Agora"],
    variants: ["Tiered Signal Beacon", "Twin-Pier Bell Frame", "Speaker’s Terraced Tower", "Spiral Herald Stair"],
    description:
      "A herald calls the city into the open agora. An offset signal tower rises above a speaker’s platform and the shaded public records counter.",
  },
  banks: {
    name: "Polis Treasury",
    levels: [
      "Coin-Weighing Niche",
      "Walled Deposit Court",
      "City Strongroom",
      "Guarded Counting Galleries",
      "Great Polis Treasury",
    ],
    variants: ["Battered Stone Vault", "Beehive Strongroom", "Twin Weighing Vaults", "Bronze-Shield Gallery"],
    description:
      "Thick stone walls shelter bullion and a deeply recessed weighing table. Smaller guarded courts receive deposits beside the strongroom.",
  },
} satisfies EraNameTable;
