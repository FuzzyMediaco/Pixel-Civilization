import type { Ink } from "../periodArtCatalog";
import { signatures } from "../eraArt/world-war-ii";

export default {
  era: "world-war-ii",
  wall: "#ac7966", shade: "#735e56", roof: "#686d69", rim: "#c5c0aa", frame: "#586159",
  sign: "#b8aa79", floor: "#a7a395", leaf: "#74825a", glass: "#7b9290", lamp: "#d4ae72", cloth: "#787f60",
  bay: 4, storey: 5,
  signatures,
} satisfies Ink;
