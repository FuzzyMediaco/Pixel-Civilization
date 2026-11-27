import type { EraNameTable } from "./types";

export default {
  public_library: {
    name: "House of Unrolled Papyrus",
    levels: [
      "Scribe’s Reading Mat",
      "Loan Counter",
      "Papyrus Reading Court",
      "Shaded Copyists’ Walk",
      "House of Unrolled Papyrus",
    ],
    variants: ["Twin Papyrus Scrolls", "Unrolled Reed Terrace", "Bundle-Column Aisles", "Folded River Map"],
    description:
      "Borrow a scroll at the edge of the shade. The reading mat grows into an inhabited papyrus terrace where scribes copy and visitors read.",
    aliases: ["library", "books", "papyrus", "scroll", "scribe", "reading"],
  },
  post_offices: {
    name: "Nile Courier Yard",
    levels: [
      "Sealed Packet Counter",
      "Village Relay",
      "Canal Dispatch Yard",
      "District Sorting Quay",
      "Nile Courier Exchange",
    ],
    variants: ["Papyrus Packet Quay", "Pigeon Dispatch Loft", "Pack-Runner Relay", "Sail and Seal Ferry"],
    description:
      "Packets with fresh clay seals pass from a shaded public counter to a working quay, pigeon loft, pack relay or sail ferry.",
    aliases: ["post office", "mail", "messenger", "packet", "pigeon", "courier"],
  },
  courthouses: {
    name: "Court of the Feather",
    levels: [
      "Village Judgment Seat",
      "Witness Gate",
      "Court of Petition",
      "High Hearing Terrace",
      "Great Court of the Feather",
    ],
    variants: ["Judgment Pylons", "Petitioners’ Crescent", "Hall of the Balance", "Lotus Judgment Dais"],
    description:
      "Follow the axial stair to a raised judge’s seat. Witness boxes, listening terraces and painted stone canopies make room for the assembled court.",
    aliases: ["courthouse", "court", "justice", "balance", "hearing", "judgment"],
  },
  city_offices: {
    name: "Nile Scribes’ Council",
    levels: [
      "Village Notice Stand",
      "District Scribe’s Walk",
      "Council Square",
      "Provincial Signal House",
      "Nile Assembly Court",
    ],
    variants: ["Notice Obelisk", "Flood Gauge Tower", "Woven Signal Mast", "Sun Mirror Square"],
    description:
      "Scribes keep public accounts on desks in a shaded square. Neighbors read the flood gauge, a woven signal or the sun mirror high above it.",
    aliases: ["city offices", "town hall", "council", "scribe", "nilometer", "signal"],
  },
  banks: {
    name: "Treasury of Grain and Gold",
    levels: [
      "Guarded Weighing Door",
      "Sealed Counting House",
      "District Grain Treasury",
      "Twin Reserve Chambers",
      "Treasury of Grain and Gold",
    ],
    variants: ["Sealed Grain Drum", "Cut-Stone Mastaba", "Honeycomb Strongrooms", "Walled Counting Court"],
    description:
      "A clerk weighs grain and metal at one guarded door. The reserve grows into a group of sealed mudbrick chambers with its own sheltered counting floor.",
    aliases: ["bank", "treasury", "granary", "grain", "gold", "strongroom", "weighing"],
  },
  grocery_store: {
    name: "Grain & Produce Market",
    levels: ["Melon Stall", "Produce Court", "Grain Market", "Silo Market", "Great Grain Exchange"],
    variants: ["Silo Market", "Date Palm Court", "Nile Quay Market", "Shaded Stall Rows"],
    description: "Domed grain silos, palm courts, melon boats and striped sails make the market easy to find from the sky.",
    aliases: ["grocery", "market", "grain", "produce", "food", "silo"],
  },
  shops: {
    name: "Craft Lane",
    levels: ["Craft Stall", "Workshop Lane", "Craft Lane", "Artisans' Quarter", "Royal Craft Bazaar"],
    variants: ["Linen Shade Bazaar", "Potter's Row", "Faience Workshop", "Papyrus Sellers"],
    description: "Potters' kilns, glowing faience beads, papyrus bundles and striped sails line a working craft lane.",
    aliases: ["shops", "craft", "pottery", "faience", "bazaar"],
  },
  restaurants: {
    name: "Bread & Fish Kitchen",
    levels: ["Bread Oven", "Oven Court", "Bread & Fish Kitchen", "Feast Terrace", "Great Kitchen"],
    variants: ["Bread Oven Court", "Riverside Fish Grill", "Roof Terrace Feast", "Clay Oven Row"],
    description: "Beehive bread ovens smoke around a court, fish grill on the quay, and diners eat under sails on the roof.",
    aliases: ["restaurant", "bread", "oven", "kitchen", "food"],
  },
  businesses: {
    name: "Scribes' Counting House",
    levels: ["Scribe's Mat", "Tally Room", "Counting House", "Granary Office", "Merchant House"],
    variants: ["Scribe Court", "Granary Office", "Trade Barge Office", "Obelisk House"],
    description: "Scribes tally grain and trade under painted columns, on a stepped granary or beside a barge of crates.",
    aliases: ["business", "office", "scribe", "trade", "merchant"],
  },
  bars: {
    name: "Beer House",
    levels: ["Beer Jar", "Beer Court", "Beer House", "Palm Tavern", "Grand Beer Hall"],
    variants: ["Beer Jar Court", "Palm Shade Tavern", "Rooftop Beer Terrace", "Harp Hall"],
    description: "Giant beer jars, a palm grove, a lamp-lit roof terrace or harpists on a columned porch.",
    aliases: ["bar", "beer", "tavern", "music", "harp"],
  },
  clothing_stores: {
    name: "Linen Weavers",
    levels: ["Spinner's Mat", "Weaving Shed", "Linen Weavers", "Dye Works", "Royal Linen House"],
    variants: ["Loom Courtyard", "Dye Vats", "Drying Lines", "Gold & Faience Boutique"],
    description: "Looms in the court, colored dye vats, long lines of drying linen or a jewel-box of gold and faience.",
    aliases: ["clothing", "linen", "weaver", "dye", "jewelry"],
  },
} satisfies EraNameTable;
