import type { Ink } from "../periodArtCatalog";
import { signatures } from "../eraArt/renaissance-italy";

export default {
  era: "renaissance-italy",
  wall: "#dba482", shade: "#997460", roof: "#af5841", rim: "#f1d6ae", frame: "#835c44",
  sign: "#7f9983", floor: "#d2b8a0", leaf: "#516e4b", glass: "#81a4a2", lamp: "#f6cc86", cloth: "#ac6a69",
  bay: 5, storey: 6,
  signatures,
} satisfies Ink;
