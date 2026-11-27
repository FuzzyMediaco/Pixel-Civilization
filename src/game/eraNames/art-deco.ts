import type { EraNameTable } from "./types";

/** Display names for the deliberate art-deco designs in src/game/designs/eraArt/art-deco.ts. */
export default {
  public_library: {
    name: "Fanlight Library",
    levels: ["Lending Kiosk", "Branch Reading Room", "Fanlight Library", "Metropolitan Library", "Grand Fanlight Athenaeum"],
    variants: ["Fan Reading Room", "Twin Bookend Towers", "Streamline Reading Deck", "Sunburst Court"],
    description: "Low reading rooms fan out from a lit lobby. Amber clerestories and gold ribs mark the place to borrow a book.",
    aliases: ["library", "books", "reading", "deco library", "fanlight"],
  },
  post_offices: {
    name: "Streamline Mail Terminal",
    levels: ["Stamp Counter", "Branch Post", "Sorting Hall", "Mail Terminal", "Central Air & Rail Mail"],
    variants: ["Streamline Terminal", "Pneumatic Tube Hall", "Airmail Hangar", "Zigzag Sorting Arcade"],
    description: "A long shed with its working yard on show: counter, sorting floor, then vans, tubes or the airmail plane.",
    aliases: ["post office", "mail", "parcel", "airmail", "pneumatic tube"],
  },
  courthouses: {
    name: "Hall of Justice",
    levels: ["Magistrate's Office", "County Court", "Hall of Justice", "Court of Appeals", "Supreme Hall of Justice"],
    variants: ["Ziggurat Hall", "Scales Pylons", "Column Screen", "Spire Tribunal"],
    description: "The tallest, most symmetric of the five: a long ceremonial stair climbs to a stepped hall of justice.",
    aliases: ["courthouse", "court", "justice", "judge", "law"],
  },
  city_offices: {
    name: "Setback City Tower",
    levels: ["Ward Office", "Borough Hall", "City Tower", "Municipal Tower", "Skyline City Hall"],
    variants: ["Setback Needle", "Radio Mast Hall", "Clock Ziggurat", "Twin-Spire Civic Center"],
    description: "A setback tower rises over a terrazzo square with a fountain and flag. The civic skyline marker.",
    aliases: ["city hall", "city offices", "mayor", "municipal", "tower"],
  },
  banks: {
    name: "Gilded Vault",
    levels: ["Savings Window", "Trust Company", "Gilded Vault", "Federal Reserve Branch", "Grand Reserve Bank"],
    variants: ["Vault Drum", "Gilded Strongbox", "Coin Rotunda", "Bronze Doors"],
    description: "Squat, heavy and closed: black granite and gold bands around a strongroom, with one guarded door.",
    aliases: ["bank", "vault", "money", "reserve", "gold"],
  },
} satisfies EraNameTable;
