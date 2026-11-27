import type { Ink } from "../periodArtCatalog";
import { signatures } from "../eraArt/ancient-egypt";

export default {
  era: "ancient-egypt",
  wall: "#d7ad71", shade: "#895d42", roof: "#c39767", rim: "#efd29a", frame: "#836941",
  sign: "#427c91", floor: "#dfc28e", leaf: "#699350", glass: "#42a7a2", lamp: "#edba70", cloth: "#e6d1a0",
  bay: 5, storey: 5,
  signatures,
} satisfies Ink;
