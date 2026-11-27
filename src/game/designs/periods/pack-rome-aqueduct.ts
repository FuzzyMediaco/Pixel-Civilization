import type { Ink } from "../periodArtCatalog";
import { signatures } from "../eraArt/rome-aqueduct";

export default {
  era: "rome-aqueduct",
  wall: "#ad694e", shade: "#653f3c", roof: "#943d32", rim: "#d9bb90", frame: "#8b6650",
  sign: "#b58e4a", floor: "#c0a690", leaf: "#657b4f", glass: "#5f9397", lamp: "#eeb979", cloth: "#a84936",
  bay: 5, storey: 6,
  signatures,
} satisfies Ink;
