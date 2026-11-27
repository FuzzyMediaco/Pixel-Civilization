import type { EraNameTable } from "./types";

/** Display names for the deliberate post-apocalyptic designs in src/game/designs/eraArt/post-apocalyptic.ts. */
export default {
  public_library: {
    name: "Reservoir of Stories",
    levels: ["Book Crate", "Salvage Reading Room", "Cistern Library", "Greenhouse Reading Deck", "Reservoir of Stories"],
    variants: ["Sliced Cistern", "Bookmobile Ring", "Container Stack Library", "Greenhouse Reading Dome"],
    description: "A salvaged cistern sliced open to curved shelves, old buses circled as reading rooms, or a patched greenhouse dome of books and plants.",
    aliases: ["library", "books", "reading", "cistern", "salvage"],
  },
  post_offices: {
    name: "Courier Yard",
    levels: ["Drop Box", "Runner Post", "Courier Yard", "Relay Depot", "Wasteland Mail Exchange"],
    variants: ["Junk Courier Yard", "Zipline Post", "Bike Messenger Depot", "Water-Tower Pigeon Post"],
    description: "Parcels leave a patched counter shed by handcart, zipline, bike or pigeon from a repurposed water tower.",
    aliases: ["post office", "mail", "courier", "zipline", "pigeon"],
  },
  courthouses: {
    name: "Rebuilt Tribunal",
    levels: ["Elders' Circle", "Arbitration Shed", "Rebuilt Tribunal", "Stadium Court", "High Tribunal of the Island"],
    variants: ["Stadium Tribunal", "Patched Old Court", "Tower of Scales", "Overpass Hall"],
    description: "The tallest, most deliberate rebuild on the island: stepped tiers, a braced old court or a hall under a broken overpass.",
    aliases: ["courthouse", "court", "tribunal", "justice", "law"],
  },
  city_offices: {
    name: "Rebuild Council",
    levels: ["Signal Post", "Camp Office", "Rebuild Council", "Council Tower", "Skyline Council"],
    variants: ["Radio Tower Council", "Windmill Hall", "Skyscraper Stump", "Crane Council"],
    description: "A tower of salvage over a market square of patchwork sails: a radio mast, a spinning turbine, a gardened ruin or a working crane.",
    aliases: ["city hall", "council", "city offices", "radio tower", "windmill"],
  },
  banks: {
    name: "Water & Fuel Bank",
    levels: ["Barter Box", "Trading Post", "Water Bank", "Strongroom", "Reserve Depot"],
    variants: ["Vault Bunker", "Water Bank", "Container Strongbox", "Fuel Depot Bank"],
    description: "Squat and guarded: an exposed old vault, tanks of clean water, welded containers or a fuel tank farm.",
    aliases: ["bank", "barter", "water", "fuel", "vault"],
  },
} satisfies EraNameTable;
