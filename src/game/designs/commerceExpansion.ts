import { buildFurnitureShowroom } from "./furnitureShowrooms";
import { buildAutoDealership } from "./motorShowrooms";
import { buildCornerPharmacy } from "./cornerPharmacy";
import { buildIndieBookstore } from "./indieBookstore";
/**
 * Procedural 3D voxel designs for the 20 new Commercial civilization elements.
 */
import {
  type Ctx,
  awning,
  barrelRoof,
  bench,
  car,
  chimney,
  curtainWall,
  door,
  flatRoof,
  flowerBed,
  gable,
  hip,
  lamp,
  lot,
  mansard,
  person,
  solarRow,
  speckle,
  tree,
  windows,
} from "./kit";
import { hull, pier, quayFoundation } from "./vehicles";
import { defineDesigns, type DesignEntry } from "./registry";
import { NEW_EXPANSION_BY_ID } from "../expansionSafetyMilitaryCommerce";

const SHIRTS = ["red", "blue", "yellow", "teal", "pink", "orange", "purple", "white"];
const SKIN = ["#e8b38f", "#c68a62", "#8d5a3b", "#f1c9a5"];

function shopper(c: Ctx, x: number, z: number, y = 1): void {
  person(c.v, x, y, z, c.pick(SHIRTS), "blueDark", c.pick(SKIN));
}

function entry(id: string, build: (c: Ctx) => void): DesignEntry {
  const meta = NEW_EXPANSION_BY_ID[id];
  return {
    footprints: meta.footprints,
    levels: meta.levelNames,
    growth: meta.growth,
    build,
  };
}

function storefrontBox(
  c: Ctx,
  wall: string,
  roof: string,
  accent: string,
  awn1: string,
  awn2: string,
  floors: number,
  roofStyle: "flat" | "gable" | "mansard" | "barrel" = "flat",
): { x0: number; x1: number; z0: number; z1: number; top: number } {
  const { v, hx, hz } = c;
  const x0 = -hx + 2;
  const x1 = hx - 2;
  const z0 = -hz + 2;
  const z1 = hz - 4;
  const top = 1 + floors * 4;
  v.box(x0, 1, z0, x1, top, z1, wall);
  v.clear(x0 + 1, 1, z0 + 1, x1 - 1, top - 1, z1 - 1);
  // Wide ground-floor shop window
  v.box(x0 + 1, 2, z1 - 1, x1 - 1, 4, z1, "warmGlow", 0.65);
  door(v, -1, 1, z1 - 1, "woodDark", 2, 3, false);
  if (floors > 1) windows(c, x0, 5, z0, x1, top, z1, { stepH: 3, stepV: 4, h: 2, emit: 0.48 });
  awning(v, x0 + 1, x1 - 1, 5, z1, awn1, awn2);
  if (roofStyle === "gable") gable(v, x0 - 1, top, z0 - 1, x1 + 1, z1 + 1, "x", roof, accent);
  else if (roofStyle === "mansard") mansard(v, x0, top, z0, x1, z1, roof, "slateLight", "glass");
  else if (roofStyle === "barrel") barrelRoof(v, x0, top, z0, x1, z1, "z", roof, accent);
  else flatRoof(c, x0, top, z0, x1, z1, roof, accent, true);
  return { x0, x1, z0, z1, top };
}

defineDesigns({
  artisan_bakery: entry("artisan_bakery", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    lot(c, "path");
    const walls = ["cream", "brick", "woodLight", "#d1fae5"];
    const awns = [["red", "white"], ["orange", "cream"], ["woodDark", "cream"], ["teal", "white"]];
    const { x0, z0, top } = storefrontBox(c, walls[s], "terracotta", "woodDark", awns[s][0], awns[s][1], Math.min(3, lv), s === 0 ? "mansard" : "gable");
    const chTop = chimney(v, x0 + 2, top + 1, z0 + 2, 4, "brick", 2, "charcoal");
    c.smoke(x0 + 3, chTop, z0 + 3, "smoke");
    // Golden baguette / croissant rooftop sign
    v.box(-3, top + 2, 0, 3, top + 4, 2, "gold", 0.5);
    bench(v, -hx + 3, 1, hz - 2, "x", "woodDark");
    shopper(c, 2, hz - 2);
  }),

  coffee_roastery: entry("coffee_roastery", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    lot(c, "path");
    const walls = ["brick", "wood", "copper", "leafDark"];
    const { top } = storefrontBox(c, walls[s], "slate", "woodDark", "woodDark", "cream", Math.min(3, lv), "flat");
    // Giant steaming coffee cup on roof
    v.cylinderY(0, 0, top + 1, top + 5, 2.2, "white");
    v.box(2, top + 2, 0, 4, top + 4, 1, "white");
    c.smoke(0, top + 5, 0, "steam");
    // Outdoor cafe tables
    for (let x = -hx + 3; x <= hx - 4; x += 5) {
      v.put(x, 1, hz - 2, "steelDark");
      v.put(x, 2, hz - 2, "white");
      v.box(x - 1, 4, hz - 3, x + 2, 5, hz - 1, s % 2 ? "teal" : "orange");
    }
    shopper(c, -2, hz - 2);
  }),

  retro_diner: entry("retro_diner", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    lot(c, "asphalt");
    const neon = ["crimson", "cyan", "gold", "magenta"][s];
    const { x0, x1, z1, top } = storefrontBox(c, "silver", "steelLight", neon, neon, "white", Math.min(2, lv), "barrel");
    v.box(x0, 4, z1, x1, 5, z1 + 1, neon, 1.3);
    // Neon pylon sign
    v.box(hx - 3, 1, hz - 3, hx - 2, 10 + lv * 2, hz - 2, "silver");
    v.box(hx - 5, 8 + lv * 2, hz - 3, hx - 1, 11 + lv * 2, hz - 2, neon, 1.4);
    car(v, -hx + 5, 1, hz - 2, "x", neon);
    shopper(c, 1, hz - 2);
  }),

  hardware_store: entry("hardware_store", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    lot(c, "concrete2");
    const walls = ["brick", "wood", "concrete", "orange"];
    const { x0, x1, z0, top } = storefrontBox(c, walls[s], "steelDark", "orange", "orange", "white", Math.min(2, lv), "gable");
    // Stacked lumber yard
    if (lv >= 2) {
      for (let y = 1; y <= 3; y++) v.box(x0, y, hz - 3, x0 + 6, y + 1, hz - 1, y % 2 ? "woodLight" : "wood");
    }
    v.box(x0 + 2, top + 1, z0 + 2, x1 - 2, top + 3, z0 + 4, "orange", 0.7);
    shopper(c, 3, hz - 2);
  }),

  indie_bookstore: entry("indie_bookstore", buildIndieBookstore),

  flower_shop: entry("flower_shop", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    lot(c, "grass2");
    speckle(c, "grass3", 0.1);
    const x0 = -hx + 2, x1 = hx - 2, z0 = -hz + 2, z1 = hz - 4;
    const h = 4 + Math.min(6, lv * 2);
    // Glass conservatory
    v.box(x0, 1, z0, x1, 2, z1, ["brick", "white", "limestone", "wood"][s]);
    v.box(x0, 2, z0, x1, h, z1, "glass", 0.38);
    v.clear(x0 + 1, 2, z0 + 1, x1 - 1, h - 1, z1 - 1);
    barrelRoof(v, x0, h, z0, x1, z1, "z", "glass", "white");
    flowerBed(c, -hx + 2, hz - 3, hx - 2, hz - 1);
    if (lv >= 3) tree(v, -hx + 3, 1, hz - 3, "round", 1.2);
    shopper(c, 2, hz - 2);
  }),

  neighborhood_pharmacy: entry("neighborhood_pharmacy", buildCornerPharmacy),

  cinema_theater: entry("cinema_theater", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    lot(c, "path");
    const walls = ["crimson", "limestone", "charcoal", "white"];
    const trim = ["gold", "gold", "cyan", "red"][s];
    const { x0, x1, z1, top } = storefrontBox(c, walls[s], "concreteDark", trim, "red", "gold", Math.min(4, 1 + lv), "flat");
    // Projecting glowing marquee
    v.box(x0 + 2, 4, z1, x1 - 2, 7, z1 + 3, trim, 1.3);
    v.box(x0 + 3, 5, z1 + 2, x1 - 3, 6, z1 + 3, "white", 1.5);
    // Vertical blade sign
    v.box(-1, 7, z1, 1, top + 6, z1 + 2, trim, 1.4);
    c.blink(0, top + 6, z1 + 1, "yellow");
    shopper(c, -3, hz - 2);
    shopper(c, 2, hz - 2);
  }),

  bowling_alley: entry("bowling_alley", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    lot(c, "asphalt");
    const accent = ["cyan", "crimson", "magenta", "orange"][s];
    const { top, z1 } = storefrontBox(c, "white", "concreteDark", accent, accent, "white", Math.min(2, lv), "flat");
    // Giant rooftop white bowling pin with red neck stripes!
    v.cylinderY(0, 0, top + 1, top + 6, 2.2, "white");
    v.cylinderY(0, 0, top + 6, top + 8, 1.2, "red");
    v.cylinderY(0, 0, top + 8, top + 10, 1.6, "white");
    v.box(-5, 5, z1, 5, 7, z1 + 1, accent, 1.4);
    car(v, -hx + 5, 1, hz - 2, "x", accent);
    shopper(c, 3, hz - 2);
  }),

  retro_arcade: entry("retro_arcade", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    lot(c, "asphalt");
    const neon1 = ["magenta", "cyan", "yellow", "lime"][s];
    const neon2 = ["cyan", "magenta", "red", "purple"][s];
    const { x0, x1, z1, top } = storefrontBox(c, "charcoal", "black", neon1, neon1, neon2, Math.min(4, lv), "flat");
    // Glowing neon strips
    for (let y = 3; y < top; y += 4) v.box(x0, y, z1, x1, y + 1, z1 + 1, y % 8 === 3 ? neon1 : neon2, 1.5);
    // Giant rooftop pixel invader / joystick icon
    v.box(-4, top + 1, 0, 4, top + 6, 2, neon1, 1.4);
    v.put(-2, top + 4, 2, "white", 1.6);
    v.put(2, top + 4, 2, "white", 1.6);
    c.blink(0, top + 6, 1, neon2);
    shopper(c, -2, hz - 2);
    shopper(c, 3, hz - 2);
  }),

  auto_dealership: entry("auto_dealership", buildAutoDealership),

  furniture_showroom: entry("furniture_showroom", buildFurnitureShowroom),

  boutique_hotel: entry("boutique_hotel", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    lot(c, "path");
    const wall = ["cream", "#fbcfe8", "#bae6fd", "stone"][s];
    const floors = 2 + lv * 2;
    const x0 = -hx + 3, x1 = hx - 3, z0 = -hz + 2, z1 = hz - 5;
    const top = 1 + floors * 4;
    if (s === 2) curtainWall(c, x0, 1, z0, x1, top, z1, "#7dd3fc", "white", 3, 4);
    else {
      v.box(x0, 1, z0, x1, top, z1, wall);
      v.clear(x0 + 1, 1, z0 + 1, x1 - 1, top - 1, z1 - 1);
      windows(c, x0, 1, z0, x1, top, z1, { stepH: 3, stepV: 4, h: 2, emit: 0.55 });
    }
    // Porte-cochere canopy
    v.box(-4, 4, z1, 4, 5, z1 + 4, "gold", 0.5);
    v.box(-4, 1, z1 + 3, -3, 4, z1 + 4, "white");
    v.box(3, 1, z1 + 3, 4, 4, z1 + 4, "white");
    flatRoof(c, x0, top, z0, x1, z1, "concreteDark", "gold", true);
    // Rooftop turquoise pool!
    if (lv >= 3 && x1 - x0 >= 8) {
      v.box(x0 + 2, top + 1, z0 + 2, x1 - 2, top + 2, z1 - 2, "cyan", 0.4);
    }
    shopper(c, -2, hz - 2);
    shopper(c, 2, hz - 2);
  }),

  art_gallery: entry("art_gallery", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    lot(c, "path");
    const wall = ["white", "terracotta", "glass", "concrete"][s];
    const x0 = -hx + 3, x1 = hx - 3, z0 = -hz + 2, z1 = hz - 6;
    const top = 6 + lv * 2;
    v.box(x0, 1, z0, x1, top, z1, wall);
    v.clear(x0 + 1, 1, z0 + 1, x1 - 1, top - 1, z1 - 1);
    v.box(x0 + 2, 2, z1 - 1, x1 - 2, top - 2, z1, "glass", 0.45);
    // Sawtooth skylights
    for (let x = x0 + 1; x < x1 - 2; x += 4) {
      v.box(x, top, z0 + 1, x + 2, top + 3, z1 - 1, "white");
      v.box(x + 2, top, z0 + 1, x + 3, top + 2, z1 - 1, "glass", 0.4);
    }
    // Outdoor colorful voxel sculpture on front plaza
    v.box(-2, 1, hz - 4, 2, 2, hz - 2, "marble");
    v.box(-1, 2, hz - 3, 1, 6, hz - 2, "orange");
    v.box(-2, 4, hz - 4, 2, 5, hz - 2, "crimson");
    shopper(c, 4, hz - 3);
  }),

  jazz_club: entry("jazz_club", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    lot(c, "path");
    const neon = ["magenta", "gold", "cyan", "crimson"][s];
    const { x0, x1, z1, top } = storefrontBox(c, s === 0 ? "brickDark" : "charcoal", "slate", neon, "crimson", "gold", Math.min(3, lv), "flat");
    v.box(x0 + 1, 5, z1, x1 - 1, 6, z1 + 1, neon, 1.5);
    // Golden saxophone / music note rooftop neon
    v.box(-1, top + 1, z1 - 1, 1, top + 6, z1, "gold", 1.4);
    v.box(-1, top + 5, z1 - 1, 3, top + 6, z1, "gold", 1.4);
    lamp(v, -hx + 2, 1, hz - 2, 5);
    shopper(c, 0, hz - 2);
  }),

  coworking_loft: entry("coworking_loft", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    lot(c, "path");
    const x0 = -hx + 2, x1 = hx - 2, z0 = -hz + 2, z1 = hz - 4;
    const floors = 2 + lv;
    const top = 1 + floors * 4;
    if (s === 1 || s === 2) {
      curtainWall(c, x0, 1, z0, x1, top, z1, "#99f6e4", s === 1 ? "wood" : "white", 3, 4);
    } else {
      v.box(x0, 1, z0, x1, top, z1, "brick");
      windows(c, x0, 1, z0, x1, top, z1, { stepH: 3, stepV: 4, h: 3, emit: 0.55 });
    }
    flatRoof(c, x0, top, z0, x1, z1, "grass2", "woodDark", false);
    // Rooftop pergola + greenery
    for (let x = x0 + 2; x < x1 - 2; x += 4) v.box(x, top + 1, z0 + 2, x + 1, top + 4, z0 + 3, "woodDark");
    v.box(x0 + 2, top + 4, z0 + 2, x1 - 2, top + 5, z0 + 6, "woodLight");
    shopper(c, -2, hz - 2);
  }),

  tech_startup_hub: entry("tech_startup_hub", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    lot(c, "grass2");
    const x0 = -hx + 2, x1 = hx - 2, z0 = -hz + 2, z1 = hz - 5;
    const top = 5 + lv * 4;
    const glassCol = ["#67e8f9", "#a7f3d0", "#94a3b8", "#bae6fd"][s];
    const frameCol = ["white", "wood", "charcoal", "silver"][s];
    curtainWall(c, x0, 1, z0, x1, top, z1, glassCol, frameCol, 4, 4);
    // Cantilevered upper glass ring
    if (lv >= 3) {
      curtainWall(c, x0 - 1, top - 4, z0 - 1, x1 + 1, top, z1 + 1, glassCol, "cyan", 4, 4);
    }
    flatRoof(c, x0, top, z0, x1, z1, "concreteDark", "cyan", false);
    solarRow(v, x0 + 2, x1 - 2, top + 1, z0 + 2);
    tree(v, -hx + 2, 1, hz - 3, "round", 1.2);
    tree(v, hx - 3, 1, hz - 3, "round", 1.2);
    shopper(c, 0, hz - 2);
  }),

  department_store: entry("department_store", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    lot(c, "path");
    const wall = ["limestone", "cream", "terracotta", "white"][s];
    const floors = 2 + lv;
    const x0 = -hx + 2, x1 = hx - 2, z0 = -hz + 2, z1 = hz - 4;
    const top = 1 + floors * 4;
    v.box(x0, 1, z0, x1, top, z1, wall);
    v.clear(x0 + 1, 1, z0 + 1, x1 - 1, top - 1, z1 - 1);
    v.box(x0 + 2, 2, z1 - 1, x1 - 2, 4, z1, "warmGlow", 0.7);
    windows(c, x0, 5, z0, x1, top, z1, { stepH: 3, stepV: 4, h: 2, sill: "gold", emit: 0.55 });
    awning(v, x0 + 1, x1 - 1, 5, z1, "crimson", "gold");
    mansard(v, x0, top, z0, x1, z1, "slate", "gold", "warmGlow");
    if (lv >= 4) v.dome(0, top + 4, 0, Math.min(5, Math.floor((x1 - x0) / 4)), "copper");
    shopper(c, -3, hz - 2);
    shopper(c, 3, hz - 2);
  }),

  night_market: entry("night_market", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    lot(c, "path");
    const lan = ["red", "gold", "lime", "magenta"][s];
    // Iconic entry torii / market arch at front
    v.box(-5, 1, hz - 3, -4, 9, hz - 2, "crimson");
    v.box(4, 1, hz - 3, 5, 9, hz - 2, "crimson");
    v.box(-7, 8, hz - 3, 7, 10, hz - 2, "crimson");
    v.box(-6, 10, hz - 3, 6, 11, hz - 2, "gold");
    // Rows of glowing stalls
    const rows = Math.min(3, 1 + Math.floor(lv / 2));
    for (let r = 0; r < rows; r++) {
      const z = -hz + 3 + r * 6;
      if (z + 4 >= hz - 4) break;
      for (const sx of [-hx + 2, 2]) {
        const sx1 = Math.min(hx - 2, sx + 7);
        if (sx1 - sx < 4) continue;
        v.box(sx, 1, z, sx1, 3, z + 3, "wood");
        v.box(sx, 5, z, sx1, 6, z + 4, r % 2 ? "red" : "orange");
        v.put(sx + 1, 4, z + 3, lan, 1.5);
        v.put(sx1 - 2, 4, z + 3, "gold", 1.5);
      }
      // Overhead lantern string
      for (let x = -hx + 3; x < hx - 3; x += 3) v.put(x, 7, z + 4, x % 6 === 0 ? lan : "gold", 1.5);
    }
    shopper(c, -1, 0);
    shopper(c, 2, hz - 5);
  }),

  seafood_pier: entry("seafood_pier", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    const wall = ["wood", "sky", "red", "white"][s];
    // Timber deck over water
    quayFoundation(v, -hx + 1, -hz + 1, hx - 1, 2, "woodDark");
    pier(v, -hx + 2, 2, hx - 2, hz - 3, "woodLight", "woodDark", 4, 2);
    // Waterfront seafood house
    const x0 = -hx + 3, x1 = hx - 3, z0 = -hz + 2, z1 = 1;
    const h = 5 + Math.min(5, lv * 2);
    v.box(x0, 2, z0, x1, h, z1, wall);
    windows(c, x0, 2, z0, x1, h, z1, { stepH: 3, stepV: 4, emit: 0.55 });
    gable(v, x0 - 1, h, z0 - 1, x1 + 1, z1 + 1, "x", "slate");
    awning(v, x0 + 1, x1 - 1, 5, z1, "sky", "white");
    // String lights over boardwalk
    for (let x = -hx + 3; x < hx - 3; x += 3) v.put(x, 6, 4, "warmGlow", 1.4);
    // Moored fishing skiff beside pier
    if (hz >= 10) {
      hull(v, { cx: 0, y0: 0, z0: 4, z1: hz - 2, beam: 4, h: 2, col: "white", stripe: "sky", open: true });
    }
    shopper(c, -2, 3, 2);
    shopper(c, 3, 3, 2);
  }),
});
