import {
  type Ctx,
  bush,
  car,
  chimney,
  door,
  fence,
  flatRoof,
  flowerBed,
  gable,
  hip,
  lot,
  pool,
  speckle,
  tree,
  windows,
} from "./kit";
import { defineDesigns } from "./registry";

/**
 * HOUSE — four architectural styles (variant) that each grow from a starter home into an estate.
 *  V0 Craftsman (wood & cream, deep porch)   V1 Victorian (pastel, turret)
 *  V2 Modernist (white cubes, flat roofs)    V3 Mediterranean (stucco, terracotta)
 */
function buildHouse(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant;
  lot(c, "grass2");
  speckle(c, "grass3", 0.08);

  const wall = ["cream", "pink", "white", "sand"][s];
  const wall2 = ["woodLight", "sky", "charcoal", "terracotta"][s];
  const roof = ["slate", "purpleDark", "concreteDark", "terracotta"][s];
  const trim = ["woodDark", "white", "steelLight", "woodDark"][s];

  // Main body footprint inside the lot, leaving a front yard on +z
  const yard = lv >= 3 ? 5 : 3;
  const x0 = -hx + 2;
  const x1 = lv >= 3 ? Math.min(hx - 2, 6) : hx - 2;
  const z0 = -hz + 2;
  const z1 = hz - yard;
  const floors = lv === 1 ? 1 : lv <= 3 ? 2 : 3;
  const fh = 4;
  const top = 1 + floors * fh;

  // front walkway
  v.box(-1, 0, z1, 1, 1, hz, "path");

  if (s === 2) {
    // Modernist stacked boxes, cantilever upper floor, flat roofs, big glass
    v.box(x0, 1, z0, x1, 1 + fh, z1, wall);
    windows(c, x0, 1, z0, x1, 1 + fh, z1, { col: "glass", w: 3, h: 2, stepH: 5, emit: 0.4 });
    if (floors >= 2) {
      const cx0 = x0 + 2;
      v.box(cx0, 1 + fh, z0, x1 + (lv >= 3 ? 2 : 0), 1 + fh * 2, z1 + 2, wall2);
      v.box(cx0 + 1, 2 + fh, z1 + 1, x1 + (lv >= 3 ? 1 : -1), fh * 2, z1 + 2, "glass", 0.45);
      flatRoof(c, cx0, 1 + fh * 2, z0, x1 + (lv >= 3 ? 2 : 0), z1 + 2, "concreteDark", "white", false);
    }
    if (floors >= 3) {
      v.box(x0, 1 + fh * 2, z0, x0 + 6, 1 + fh * 3, z0 + 6, wall);
      v.box(x0 + 1, 2 + fh * 2, z0 + 5, x0 + 5, fh * 3, z0 + 6, "glass", 0.5);
      flatRoof(c, x0, 1 + fh * 3, z0, x0 + 6, z0 + 6, "concreteDark", "white", false);
    }
    flatRoof(c, x0, 1 + fh, z0, x1, z1, "concreteDark", "white", false);
    door(v, -1, 1, z1 - 1, "charcoal");
  } else {
    // Pitched-roof styles
    v.box(x0, 1, z0, x1, top, z1, wall);
    // corner trim
    for (const [px, pz] of [[x0, z0], [x1 - 1, z0], [x0, z1 - 1], [x1 - 1, z1 - 1]]) {
      v.box(px, 1, pz, px + 1, top, pz + 1, trim);
    }
    if (s === 0) {
      // craftsman shingle band on upper floor
      if (floors >= 2) v.box(x0, 1 + fh, z0, x1, top, z1, wall2);
    }
    windows(c, x0, 1, z0, x1, top, z1, { stepV: fh, stepH: 3, h: 2, emit: 0.42, sill: trim });
    const ridgeAxis = x1 - x0 >= z1 - z0 ? "x" : "z";
    if (s === 3) hip(v, x0 - 1, top, z0 - 1, x1 + 1, z1 + 1, roof, "terracotta");
    else gable(v, x0 - 1, top, z0 - 1, x1 + 1, z1 + 1, ridgeAxis, roof, trim);

    // porch
    const porchZ1 = Math.min(hz - 1, z1 + 3);
    v.box(x0 + 1, 1, z1, x1 - 1, 2, porchZ1, "woodLight");
    for (const px of [x0 + 1, x1 - 2]) v.box(px, 2, porchZ1 - 1, px + 1, 1 + fh, porchZ1, trim);
    v.box(x0, 1 + fh, z1, x1, 2 + fh, porchZ1, roof);
    door(v, -1, 2, z1 - 1, s === 1 ? "crimson" : "woodDark");

    // chimney with smoke
    const ch = chimney(v, x0 + 1, top - 1, z0 + 1, 6 + floors, s === 3 ? "plaster" : "brickDark");
    c.smoke(x0 + 2, ch, z0 + 2, "smoke");

    if (s === 1 && lv >= 2) {
      // Victorian corner turret with witch-hat roof
      const tx = x1 - 2;
      const tz = z1 - 2;
      v.cylinderY(tx, tz, 1, top + 3, 2.6, wall2);
      windows(c, tx - 2, 1, tz - 2, tx + 2, top + 3, tz + 2, { stepV: fh, h: 2, emit: 0.5 });
      v.cone(tx, top + 3, top + 10 + lv, tz, 3.2, 0.3, roof);
      v.put(Math.floor(tx), top + 11 + lv, Math.floor(tz), "gold", 0.5);
    }
  }

  // ---- level-driven yard upgrades ----
  if (lv >= 2) {
    // garden + mailbox + bushes
    bush(v, x0 + 1, 1, hz - 2, 1.2, "leaf", "pink");
    v.box(2, 1, hz - 2, 3, 3, hz - 1, "charcoal");
    v.put(2, 3, hz - 2, "red");
  }
  if (lv >= 3) {
    // detached garage / carport + driveway on +x side, picket fence
    const gx0 = Math.max(x1 + 1, hx - 9);
    v.box(gx0, 0, -hz + 3, hx - 1, 1, hz, "concrete2");
    if (s === 2) {
      v.box(gx0, 1, -hz + 3, hx - 1, 6, -hz + 9, wall2);
      flatRoof(c, gx0, 6, -hz + 3, hx - 1, -hz + 9, "concreteDark", "white", false);
    } else {
      v.box(gx0, 1, -hz + 3, hx - 1, 6, -hz + 9, wall);
      v.box(gx0 + 1, 1, -hz + 8, hx - 2, 5, -hz + 9, "white");
      gable(v, gx0 - 1, 6, -hz + 2, hx, -hz + 10, "x", roof, trim);
    }
    car(v, gx0 + 4, 1, 4, "z", c.vpick(["red", "sky", "silver", "teal"]));
    if (s !== 2) fence(v, -hx + 1, hz - 2, gx0 - 1, hz - 1, 1, 2, "white", [-2, 2]);
    tree(v, -hx + 3, 1, hz - 4, s === 3 ? "palm" : "round", 1.1, c.variant);
  }
  if (lv >= 4) {
    // backyard pool + deck + loungers, flower beds
    const px0 = -hx + 3;
    const pz0 = -hz + 2;
    if (hz >= 16) {
      pool(v, px0, pz0, px0 + 10, pz0 + 6, s === 3 ? "terracotta" : "white");
      v.box(px0 + 11, 1, pz0, px0 + 12, 2, pz0 + 2, "white");
    }
    flowerBed(c, x0, hz - 4, x0 + 5, hz - 3, 1);
    tree(v, hx - 3, 1, -hz + 12, s === 3 ? "cypress" : s === 1 ? "blossom" : "birch", 1.2, 3);
  }
  if (lv >= 5) {
    // grand finale: rooftop solar or widow's walk + lanterns + hedge maze edge
    if (s === 2) {
      for (let x = x0 + 3; x < x1; x += 3) v.box(x, 2 + fh * 2 + 1, z0 + 1, x + 2, 3 + fh * 2 + 1, z0 + 4, "solarBlue", 0.15);
    } else {
      v.box(-2, top + 6, -2, 2, top + 7, 2, trim);
    }
    for (const lx of [-hx + 1, hx - 2]) {
      v.box(lx, 1, hz - 1, lx + 1, 4, hz, "iron");
      v.put(lx, 4, hz - 1, "warmGlow", 1.2);
    }
    v.box(-hx + 1, 1, -hz + 1, hx - 1, 3, -hz + 2, "leafDark");
  }
}

defineDesigns({
  house: {
    footprints: [[1, 1], [1, 1], [2, 1], [2, 2], [2, 2]],
    levels: ["Starter Bungalow", "Two-Story Family Home", "Home with Garage", "Backyard-Pool Estate", "Grand Family Manor"],
    growth: "Adds floors, then a garage and driveway, then a backyard pool and gardens.",
    build: buildHouse,
  },
});
