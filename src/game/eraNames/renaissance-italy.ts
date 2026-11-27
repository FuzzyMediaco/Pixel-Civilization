import type { EraNameTable } from "./types";

/** Display names for the deliberate renaissance-italy designs in src/game/designs/eraArt/renaissance-italy.ts. */
export default {
  public_library: {
    name: "Printer's Piazza",
    levels: ["Bookseller's Stall", "Print Shop Loggia", "Printer's Court", "Printer's Piazza", "Grand Printer's Piazza"],
    variants: ["Printer's Piazza", "Cloister Library", "Palazzo Biblioteca", "Bookbinders' Gallery"],
    description: "A giant timber screw press spans two loggias over a print court where fresh sheets hang to dry.",
    aliases: ["library", "books", "printing press", "loggia", "printer"],
  },
  post_offices: {
    name: "Courier Fondaco",
    levels: ["Letter Desk", "Messenger Post", "Courier Fondaco", "Merchant Post", "Grand Courier House"],
    variants: ["Messenger Stables", "Fondaco", "Canal Post Loggia", "Dovecote Post"],
    description: "Letters leave a long arcaded post by horse, cart, canal barge or the pigeons of a tall dovecote.",
    aliases: ["post office", "mail", "courier", "messenger", "dovecote"],
  },
  courthouses: {
    name: "Palazzo della Giustizia",
    levels: ["Notary's Bench", "Podestà's Court", "Palazzo della Giustizia", "Basilica of Justice", "High Tribunal of the Republic"],
    variants: ["Palazzo della Giustizia", "Basilica Court", "Loggia dei Giudici", "Domed Tribunal"],
    description: "A tall, symmetric palazzo of justice above a marble stair, crowned by a tower, pediment or dome.",
    aliases: ["courthouse", "court", "justice", "tribunal", "palazzo"],
  },
  city_offices: {
    name: "Palazzo Pubblico",
    levels: ["Commune Office", "Town Loggia", "Palazzo Pubblico", "Torre Civica", "Palazzo of the Republic"],
    variants: ["Torre Civica", "Palazzo Pubblico", "Bell & Clock Palazzo", "Family Towers"],
    description: "The tallest campanile on the island rises over a measured piazza with a fountain.",
    aliases: ["city hall", "town hall", "palazzo", "campanile", "clock tower"],
  },
  banks: {
    name: "Banco",
    levels: ["Money Changer's Bench", "Counting House", "Banco", "Merchant Bank", "Grand Banking House"],
    variants: ["Medici Strongroom", "Counting House", "Monte di Pietà", "Treasury Tower"],
    description: "A heavy rusticated strongroom with tiny windows, a guarded door and a sign of gold balls.",
    aliases: ["bank", "banco", "money", "counting house", "treasury"],
  },
} satisfies EraNameTable;
