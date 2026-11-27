import type { Ink } from "../periodArtCatalog";
import { signatures } from "../eraArt/ancient-greece";

export default {
  era: "ancient-greece",
  wall: "#f0e6cd", shade: "#a69b84", roof: "#c48264", rim: "#f9efd4", frame: "#77634d",
  sign: "#407598", floor: "#d4c8b1", leaf: "#788957", glass: "#79a1ae", lamp: "#ecc78b", cloth: "#5b87a8",
  bay: 5, storey: 5,
  signatures,
} satisfies Ink;
