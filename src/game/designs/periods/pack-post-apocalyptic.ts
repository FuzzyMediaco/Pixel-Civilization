import type { Ink } from "../periodArtCatalog";
import { signatures } from "../eraArt/post-apocalyptic";

export default {
  era: "post-apocalyptic",
  wall: "#a78c68", shade: "#695c4e", roof: "#927257", rim: "#c0ae87", frame: "#5c6864",
  sign: "#ce9a56", floor: "#a49575", leaf: "#70925e", glass: "#84a49a", lamp: "#ecc78b", cloth: "#b76953",
  bay: 5, storey: 5,
  signatures,
} satisfies Ink;
