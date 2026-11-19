import { type Ctx, lot, rocks, speckle, tree } from "./kit";
import { defineDesigns, type DesignEntry } from "./registry";
import { critter, gator, terrain, vnoise, waterBlob } from "./agriculture";

/**
 * NATURE — PLACEHOLDER builds (redesign not finished; see docs/handoff/agri_nature.md).
 * Each id gets a simple, level-scaled scene so every element is registered and renders.
 */

function grassLot(c: Ctx, sand = false): void {
  lot(c, sand ? "sand" : "grass2");
  speckle(c, sand ? "sandDark" : "grass3", 0.08);
}

function scaledTree(kind: Parameters<typeof tree>[3]) {
  return (c: Ctx) => {
    grassLot(c);
    tree(c.v, 0, 1, 0, kind, 0.7 + c.lv * 0.45, c.variant);
  };
}

function hillish(c: Ctx, peak: number, snow: boolean): void {
  lot(c, "grass2");
  const seed = c.variant * 31 + 7;
  terrain(
    c,
    (x, z) => {
      const d = Math.sqrt((x / c.hx) ** 2 + (z / c.hz) ** 2);
      return (1 - d) * peak * (0.75 + vnoise(x, z, 6, seed) * 0.5);
    },
    (_x, y, _z, _h, top) => (snow && y > peak * 0.7 ? "snow" : top ? (y > peak * 0.45 && snow ? "stone" : "grass") : "stone"),
  );
}

function waterScene(c: Ctx): void {
  grassLot(c);
  waterBlob(c, 0, 0, c.hx * 0.7, c.hz * 0.7, c.variant + 3, "sand");
  for (let i = 0; i < c.lv; i++) critter(c.v, "duck", c.ri(-3, 3), 1, c.ri(-3, 3), "x", 1, i);
}

function simple(build: (c: Ctx) => void, fp: DesignEntry["footprints"], levels: DesignEntry["levels"], growth: string): DesignEntry {
  return { footprints: fp, levels, growth, build };
}

const S1: DesignEntry["footprints"] = [[1, 1], [1, 1], [1, 1], [1, 1], [1, 1]];
const G2: DesignEntry["footprints"] = [[1, 1], [1, 1], [2, 1], [2, 2], [2, 2]];
const BIG: DesignEntry["footprints"] = [[2, 2], [2, 2], [3, 2], [3, 3], [4, 3]];

defineDesigns({
  trees: simple(scaledTree("oak"), [[1, 1], [1, 1], [1, 1], [2, 2], [2, 2]], ["Sapling", "Young Tree", "Shade Tree", "Grand Old Tree", "Ancient Giant"], "Grows from a sapling into an ancient giant."),
  pine_trees: simple(scaledTree("pine"), [[1, 1], [1, 1], [1, 1], [2, 2], [2, 2]], ["Seedling", "Young Pine", "Tall Pine", "Pine Stand", "Ancient Evergreen"], "Grows taller and fuller."),
  redwood_trees: simple((c) => { grassLot(c); const v = c.v; const h = 10 + c.lv * 8; v.cylinderY(0.5, 0.5, 1, h, 0.8 + c.lv * 0.4, "#9a4a2e"); v.cone(0.5, h * 0.5, h + 6, 0.5, 2 + c.lv, 0.5, "leafDark"); }, [[1, 1], [1, 1], [2, 2], [2, 2], [2, 2]], ["Redwood Sprout", "Young Redwood", "Towering Redwood", "Cathedral Redwood", "Ancient Sequoia"], "Trunk thickens and height soars."),
  plants: simple((c) => { grassLot(c); for (let i = 0; i < 3 + c.lv * 3; i++) c.v.put(c.ri(-c.hx + 1, c.hx - 2), 1, c.ri(-c.hz + 1, c.hz - 2), c.pick(["pink", "yellow", "red", "purple", "white"])); }, [[1, 1], [1, 1], [1, 1], [2, 1], [2, 2]], ["Sprout", "Flower Clump", "Wildflower Patch", "Flower Meadow", "Giant Bloom Garden"], "More and bigger blooms."),
  shrubs: simple((c) => { grassLot(c); for (let i = 0; i < c.lv; i++) c.v.sphere(-c.hx + 4 + i * 5, 2, 0, 1.8, 1.6, 1.8, "leafDark"); }, G2, ["Potted Boxwood", "Topiary Row", "Parterre", "Hedge Garden", "Grand Topiary Garden"], "More sculpted shrubs."),
  bushes: simple((c) => { grassLot(c); for (let i = 0; i < c.lv + 1; i++) { c.v.sphere(-c.hx + 4 + i * 4, 2, 2, 1.8, 1.5, 1.8, "leaf"); c.v.put(-c.hx + 4 + i * 4, 3, 3, "red"); } }, [[1, 1], [1, 1], [2, 1], [2, 1], [2, 2]], ["Lone Bush", "Berry Cluster", "Hedgerow", "Bramble Thicket", "Great Hedgerow"], "Bushes multiply into hedgerows."),
  ponds: simple(waterScene, G2, ["Puddle", "Lily Pond", "Koi Pond", "Duck Pond", "Garden Pond"], "Pond widens and gains life."),
  lakes: simple(waterScene, [[2, 2], [3, 2], [3, 3], [4, 3], [4, 4]], ["Tarn", "Lake with Dock", "Island Lake", "Boathouse Lake", "Grand Lake"], "Lake widens and gains an island and docks."),
  hills: simple((c) => hillish(c, 3 + c.lv * 2, false), [[1, 1], [2, 1], [2, 2], [2, 2], [3, 2]], ["Knoll", "Hillock", "Rolling Hill", "Twin Hills", "Great Hill"], "Grows taller and wider."),
  mountains: simple((c) => hillish(c, 10 + c.lv * 6, true), [[2, 2], [2, 2], [3, 2], [3, 3], [4, 4]], ["Rocky Peak", "Snowcap", "Twin Peaks", "Mountain Range", "Legendary Massif"], "Rises into a snow-capped range."),
  canyons: simple((c) => { lot(c, "terracotta"); terrain(c, (x) => (Math.abs(x) < 3 ? 0 : 4 + c.lv * 3), (_x, y) => (y % 3 ? "terracotta" : "brick2")); c.v.box(-3, 0, -c.hz, 3, 1, c.hz, "water", 0.1); }, BIG, ["Gully", "Gorge", "Arch Canyon", "Mesa Canyon", "Grand Canyon"], "Deepens into a layered canyon."),
  deserts: simple((c) => { lot(c, "sand"); terrain(c, (x, z) => vnoise(x, z, 8, c.variant) * (2 + c.lv), (_x, _y, _z, _h, top) => (top ? "sand" : "sandDark")); c.v.box(2, 1, 2, 3, 5 + c.lv, 3, "leaf"); }, BIG, ["Dune Patch", "Cactus Flat", "Dune Sea", "Oasis", "Great Desert"], "Dunes grow and an oasis appears."),
  sand: simple((c) => { grassLot(c, true); rocks(c, 0, 1, 0, c.lv, "sandDark"); }, G2, ["Sand Patch", "Dune", "Sandcastle", "Castle & Moat", "Sandcastle Fortress"], "Sculpted dunes and sandcastles grow."),
  beaches: simple((c) => { grassLot(c, true); c.v.box(-c.hx, 0, c.hz - 3, c.hx, 1, c.hz, "water", 0.2); c.v.box(-c.hx, 0, c.hz - 4, c.hx, 1, c.hz - 3, "foam"); }, [[1, 1], [2, 1], [2, 2], [3, 2], [3, 2]], ["Cove", "Sandy Beach", "Family Beach", "Surf Beach", "Resort Beach"], "Beach widens with more amenities."),
  beach_umbrellas: simple((c) => { grassLot(c, true); for (let i = 0; i < c.lv; i++) { const x = -c.hx + 4 + (i % 3) * 5; const z = -2 + Math.floor(i / 3) * 6; c.v.box(x, 1, z, x + 1, 6, z + 1, "white"); c.v.cone(x + 0.5, 6, 8, z + 0.5, 3, 0.4, i % 2 ? "red" : "sky"); } }, G2, ["Lone Parasol", "Parasol Pair", "Umbrella Row", "Beach Club", "Riviera Lido"], "More parasols, loungers and a lifeguard tower."),
  tubbleweeds: simple((c) => { lot(c, "#c9b26a"); for (let i = 0; i < c.lv + 1; i++) c.v.sphere(c.ri(-4, 4), 2, c.ri(-4, 4), 1.6, 1.5, 1.6, "#a0784a"); }, G2, ["Lone Tumbleweed", "Drifting Pair", "Dusty Flat", "Tumbleweed Prairie", "Dust-Devil Badlands"], "More tumbleweeds and prairie props."),
  swamps: simple((c) => { lot(c, "moss"); waterBlob(c, 0, 0, c.hx * 0.7, c.hz * 0.7, 9, "moss", 0.6, "#3d6b5a", "#4f8a6e"); tree(c.v, -c.hx + 3, 1, -c.hz + 3, "willow", 1 + c.lv * 0.2); c.smoke(0, 2, 0, "steam"); }, BIG, ["Marshy Hollow", "Reed Bog", "Cypress Swamp", "Bayou", "Primeval Bayou"], "Swamp spreads with cypress and mist."),
  alligators: simple((c) => { grassLot(c); waterBlob(c, 0, 0, c.hx * 0.7, c.hz * 0.6, 5, "moss"); gator(c.v, -c.hx + 2, 1, 0, 6 + c.lv * 3, "x", 1, ["#4f7a3a", "#a08a52", "white", "#5a6a3a"][c.variant % 4], "#c9c27a", c.lv >= 3); }, [[1, 1], [2, 1], [2, 2], [2, 2], [3, 2]], ["Hatchling", "Basking Gator", "Gator Nest", "Gator Lagoon", "King Croc"], "Gators grow up to a giant croc."),
});
