import type { CivElementDef } from "./catalog";
import type { LevelSpanTuple } from "./levelSpans";

/**
 * Historical wonders (landmarks category). Each grows from an excavation or construction site
 * (Lv1) into a fully restored wonder with plaza, crowds and night lighting (Lv5). Benefits use
 * the shared landmark scaling in the simulation (every stat grows with level).
 */
export interface HistoricalWonder extends CivElementDef {
  footprints: LevelSpanTuple;
}

function wonder(def: Omit<HistoricalWonder, "category" | "domain" | "needsMaintenance"> & Partial<CivElementDef>): HistoricalWonder {
  return { category: "landmarks", domain: "land", needsMaintenance: true, ...def } as HistoricalWonder;
}

export const HISTORICAL_WONDERS: HistoricalWonder[] = [
  wonder({
    id: "stonehenge",
    name: "Stonehenge",
    stage: 13,
    cost: 1400,
    archetype: "landmark_obelisk",
    recreation: 220,
    education: 70,
    income: 70,
    footprints: [[1, 1], [2, 2], [2, 2], [3, 3], [3, 3]],
    accentHex: "#9aa0a2",
    description: "A ring of towering sarsen trilithons aligned to the midsummer sunrise. Druids gather for the solstice glow.",
  }),
  wonder({
    id: "moai_statues",
    name: "Moai Statues",
    stage: 13,
    cost: 1300,
    archetype: "landmark_obelisk",
    recreation: 210,
    education: 60,
    income: 75,
    footprints: [[1, 1], [2, 1], [3, 1], [3, 2], [4, 2]],
    accentHex: "#7d7469",
    description: "Giant carved stone heads stand on a ceremonial ahu platform, backs to the sea, watching over the island.",
  }),
  wonder({
    id: "parthenon",
    name: "Parthenon",
    stage: 15,
    cost: 2400,
    archetype: "landmark_smithsonian",
    recreation: 300,
    education: 150,
    government: 60,
    income: 120,
    footprints: [[2, 1], [2, 2], [3, 2], [3, 3], [4, 3]],
    accentHex: "#efe8da",
    description: "A Doric marble temple crowning a rocky acropolis, with columns, friezes and a golden statue of Athena.",
  }),
  wonder({
    id: "colosseum",
    name: "Colosseum",
    stage: 16,
    cost: 3000,
    archetype: "landmark_pyramids",
    recreation: 520,
    income: 220,
    jobs: 40,
    footprints: [[2, 2], [2, 2], [3, 2], [3, 3], [4, 3]],
    accentHex: "#d9b98a",
    description: "An elliptical amphitheatre of tiered travertine arcades. Gladiators duel on the sand while crowds roar.",
  }),
  wonder({
    id: "chichen_itza",
    name: "Chichén Itzá",
    stage: 16,
    cost: 3100,
    archetype: "landmark_pyramids",
    recreation: 450,
    education: 130,
    income: 200,
    footprints: [[2, 2], [2, 2], [3, 3], [3, 3], [4, 4]],
    accentHex: "#cfc2a0",
    description: "El Castillo's nine stepped terraces rise above the jungle; at the equinox a serpent of light slides down its stairs.",
  }),
  wonder({
    id: "great_wall",
    name: "Great Wall",
    stage: 17,
    cost: 3200,
    archetype: "landmark_obelisk",
    recreation: 380,
    military: 160,
    income: 180,
    footprints: [[2, 1], [3, 1], [3, 2], [4, 2], [4, 3]],
    accentHex: "#a59784",
    description: "A crenellated wall snakes over the hills between beacon watchtowers, guarding the frontier and drawing hikers.",
  }),
  wonder({
    id: "angkor_wat",
    name: "Angkor Wat",
    stage: 19,
    cost: 3900,
    archetype: "landmark_pyramids",
    recreation: 600,
    education: 170,
    income: 280,
    footprints: [[2, 2], [3, 2], [3, 3], [4, 3], [4, 4]],
    accentHex: "#8f8a6c",
    description: "Five lotus-bud towers rise over galleried terraces, reached by a naga causeway across a lily-filled moat.",
  }),
  wonder({
    id: "machu_picchu",
    name: "Machu Picchu",
    stage: 20,
    cost: 4600,
    archetype: "landmark_pyramids",
    recreation: 720,
    education: 190,
    food: 40,
    income: 330,
    footprints: [[2, 2], [3, 2], [3, 3], [4, 3], [4, 4]],
    accentHex: "#6f9a58",
    description: "A granite citadel of terraces and thatched houses clinging to a cloud-forest ridge, grazed by llamas.",
  }),
];

export const HISTORICAL_WONDER_IDS: string[] = HISTORICAL_WONDERS.map((w) => w.id);
