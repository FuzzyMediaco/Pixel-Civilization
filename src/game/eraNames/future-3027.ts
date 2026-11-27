import type { EraNameTable } from "./types";

export default {
  public_library: {
    name: "Memory Orbit",
    levels: ["Reading Leaf", "Paired Memory Decks", "Open Archive Garden", "Civic Reading Orbit", "Common Memory Atlas"],
    variants: ["Broken Memory Orbit", "Folded Data-Leaf Terrace", "Paired Archive Ribs", "Canopy of Story Pods"],
    description:
      "Readers step between charged data leaves and open reading pods. Ribbed walkways connect the archive over a planted entrance.",
    aliases: ["library", "reading garden", "data leaf", "public archive", "memory orbit"],
  },
  post_offices: {
    name: "Pneumatic Post Exchange",
    levels: ["Capsule Window", "Return Line", "Open Sorting Yard", "Carrier Exchange", "Regional Parcel Array"],
    variants: ["Twin Transfer Tubes", "Carousel Sorter", "Carrier Dock Comb", "Branching Parcel Switch"],
    description: "Follow a sealed parcel from the public counter through an open sorting line to the waiting carrier.",
    aliases: ["post office", "pneumatic mail", "postal sorting", "carrier dock"],
  },
  courthouses: {
    name: "Daylight Jury Chamber",
    levels: ["Hearing Room", "Twin Petition Stairs", "Public Jury Court", "Appeal Galleries", "High Daylight Chamber"],
    variants: ["Ribbon Jury Ring", "Prismatic Tribunal", "Oculus Hearing Hall", "Folded Jury Galleries"],
    description:
      "Petitioners ascend paired public approaches to a centered chamber. Separate jury seats and public galleries keep its daylight floor in view.",
    aliases: ["court", "courthouse", "jury chamber", "tribunal", "appeals"],
  },
  city_offices: {
    name: "Signal Assembly Square",
    levels: ["Civic Desk", "Signal Office", "Assembly Square", "Council Balcony", "Metropolitan Signal Forum"],
    variants: ["Council Signal Sail", "Halo Address Tower", "Stepped Speaker’s Rostrum", "Twin Semaphore Fins"],
    description:
      "A civic signal rises above an accessible assembly square. The glazed council balcony faces the residents below.",
    aliases: ["city offices", "city hall", "municipal services", "civic square", "council"],
  },
  banks: {
    name: "Phase-Lock Reserve",
    levels: ["Deposit Niche", "Local Clearing Vault", "District Reserve", "Secure Counting Hall", "Metropolitan Reserve"],
    variants: ["Segmented Vault Seal", "Armored Crescent", "Ingot Strongroom", "Interlocking Coffers"],
    description:
      "Heavy overlapping armor encloses the reserve. The illuminated deposit slot is the public opening in the outer shell.",
    aliases: ["bank", "secure vault", "reserve", "deposits", "strongroom"],
  },
} satisfies EraNameTable;
