/** Island coordinates stay stable across map editions and saved cities. */
export const GRID_HALF = 96;
export const GRID_MIN = -GRID_HALF;
export const GRID_MAX = GRID_HALF - 1;
export const GRID_SIZE = GRID_HALF * 2;
export const withinMap = (x: number, z: number) =>
  Number.isInteger(x) && Number.isInteger(z) && x >= GRID_MIN && z >= GRID_MIN && x <= GRID_MAX && z <= GRID_MAX;
export const cellIndex = (x: number, z: number) => (z - GRID_MIN) * GRID_SIZE + x - GRID_MIN;
export const cellFromIndex = (id: number): [number, number] => [
  (id % GRID_SIZE) + GRID_MIN,
  Math.floor(id / GRID_SIZE) + GRID_MIN,
];

export const REGION_CENTERS = [
  { name: "Central plateau", gx: 0, gz: 0 },
  { name: "Western ranges", gx: -63, gz: -18 },
  { name: "North Sound", gx: 52, gz: -54 },
  { name: "South Island", gx: 10, gz: 62 },
  { name: "Northwest Isle", gx: -61, gz: -66 },
  { name: "Beacon Key", gx: 70, gz: 44 },
] as const;
