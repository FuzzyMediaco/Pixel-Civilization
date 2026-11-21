/**
 * FARMSTEADS — the expansion farm anchors and the connected field modules (round 2 redesign).
 *
 * Every anchor SPRAWLS as it levels: a croft or shed at Lv1 grows into a working estate with more buildings,
 * machinery and animals. The four variants are REGIONAL STYLES shared by all anchors, so a farm district reads
 * as one countryside:
 *   V0 American  — red gambrel barns with white trim, white board fences, Harvestore silos, windpumps, red tractors
 *   V1 Tuscan    — ochre stucco and terracotta, dry-stone walls, stone dovecote towers, cypress lanes, orange tractors
 *   V2 Dutch     — dark brick and thatch, green doors, sail windmills, willow trees, canals, blue tractors
 *   V3 Japanese  — dark timber with white plaster panels, tiled roofs with upturned eaves, bamboo fences,
 *                  waterwheels, cherry blossom, little kei trucks
 * The element's catalog style (breed / crop / glasshouse type) is layered on top (cow coats, crop colours…).
 *
 * Animals are ANIMATED (c.critters → farmActivity.ts CritterHerds): they wander inside their pens in-game.
 * Field modules keep low perimeter fences in parcel "fence" colours and crops running to the edges so adjacent
 * modules open into one another (parcelGeometry clears shared farm boundaries).
 */
import { CAMPUS_FARM_ART } from "../campusFarmArt";
import { EXPANSION_ELEMENTS } from "../expansionCatalog";
import { defineDesigns } from "./registry";
import {
  lot,
  speckle,
  gable,
  hip,
  cyl,
  ring,
  tree,
  lamp,
  person,
  fence,
  flag,
  windows,
  door,
  chimney,
  truck,
  awning,
  flowerBed,
  bush,
  solarRow,
  tank,
  PixelVox,
  type Ctx,
  type CritterKind,
  type TreeKind,
} from "./kit";
import {
  barn as redBarn,
  windpump,
  pivotIrrigation,
  greenhouse as glasshouse,
  silo as domeSilo,
  grainBin,
  grainElevator,
  tractor,
  combine,
  haybale,
  scarecrow,
  crops,
  fruitTree,
  beehive,
  crate,
  waterBlob,
  h2,
  type Crop,
} from "./agriculture";

// =============================================================================================
// Regional kit
// =============================================================================================
interface Region {
  wall: string;
  wall2: string;
  roof: string;
  trim: string;
  fence: string;
  tree: TreeKind;
  tractor: string;
  base: string;
  door: string;
  lane: string;
  grass: string;
}
const REGIONS: Region[] = [
  { wall: "red", wall2: "white", roof: "slate", trim: "white", fence: "white", tree: "oak", tractor: "red", base: "stone", door: "redDark", lane: "path2", grass: "grass2" },
  { wall: "#e2b77a", wall2: "#d39a5e", roof: "terracotta", trim: "stone", fence: "stone", tree: "cypress", tractor: "orange", base: "stone", door: "woodDark", lane: "#d8c6a1", grass: "#a9c46a" },
  { wall: "brickDark", wall2: "#8c3a2a", roof: "#c7a35a", trim: "white", fence: "woodLight", tree: "willow", tractor: "blue", base: "brick", door: "#2f7a46", lane: "path2", grass: "grass" },
  { wall: "#f2eadb", wall2: "#3a2c24", roof: "#4a5060", trim: "woodDark", fence: "olive", tree: "blossom", tractor: "orange", base: "stone", door: "woodDark", lane: "path", grass: "grass3" },
];
const R = (c: Ctx) => REGIONS[c.variant % 4];
const L = <T,>(c: Ctx, a: readonly [T, T, T, T, T]): T => a[Math.max(1, Math.min(5, c.lv)) - 1];

function ground(c: Ctx, col = R(c).grass) {
  lot(c, col);
  speckle(c, "grass3", 0.06);
}

/** Low-pitch roof (2 voxels in per step) — Tuscan coppi and Japanese tile. */
function lowGable(v: PixelVox, x0: number, y: number, z0: number, x1: number, z1: number, axis: "x" | "z", col: string, ridge?: string) {
  let s = 0;
  for (;;) {
    const a = axis === "x" ? z0 + s * 2 : x0 + s * 2,
      b = axis === "x" ? z1 - s * 2 : x1 - s * 2;
    if (b - a <= 0) break;
    if (axis === "x") v.box(x0, y + s, a, x1, y + s + 1, b, b - a <= 2 && ridge ? ridge : col);
    else v.box(a, y + s, z0, b, y + s + 1, z1, b - a <= 2 && ridge ? ridge : col);
    s++;
  }
  return y + s;
}

/** Regional roof over [x0,x1)×[z0,z1) at height y; ridge along `axis`. Returns roof top. */
function rroof(c: Ctx, x0: number, y: number, z0: number, x1: number, z1: number, axis: "x" | "z" = "x") {
  const v = c.v,
    r = R(c);
  switch (c.variant % 4) {
    case 0:
      return gable(v, x0 - 1, y, z0 - 1, x1 + 1, z1 + 1, axis, r.roof, "white", r.wall);
    case 1:
      return lowGable(v, x0 - 1, y, z0 - 1, x1 + 1, z1 + 1, axis, r.roof, "#a8502e");
    case 2:
      return hip(v, x0 - 1, y, z0 - 1, x1 + 1, z1 + 1, r.roof, "#a8873f");
    default: {
      const top = lowGable(v, x0 - 2, y, z0 - 2, x1 + 2, z1 + 2, axis, r.roof, "charcoal");
      // upturned eave tips
      for (const xx of [x0 - 2, x1 + 1]) for (const zz of [z0 - 2, z1 + 1]) v.put(xx, y + 1, zz, r.roof);
      return top;
    }
  }
}

/** Regional walls (hollow) with windows. */
function rwalls(c: Ctx, x0: number, z0: number, x1: number, z1: number, h: number, win = true) {
  const v = c.v,
    r = R(c),
    V = c.variant % 4;
  v.box(x0, 1, z0, x1, 1 + h, z1, r.wall);
  if (x1 - x0 > 2 && z1 - z0 > 2) v.clear(x0 + 1, 2, z0 + 1, x1 - 1, h, z1 - 1);
  if (V === 1) {
    v.box(x0, 1, z0, x1, 2, z1, "stone");
    for (let y = 1; y < 1 + h; y++)
      for (const [px, pz] of [[x0, z0], [x1 - 1, z0], [x0, z1 - 1], [x1 - 1, z1 - 1]])
        v.put(px, y, pz, y % 2 ? "stone" : "limestone");
  } else if (V === 2) {
    v.box(x0, 1, z0, x1, 2, z1, "#5a2a22");
  } else if (V === 3) {
    v.box(x0, 1, z0, x1, 2, z1, "stone");
    for (let x = x0; x < x1; x += 3) {
      v.box(x, 2, z0, x + 1, 1 + h, z0 + 1, r.wall2);
      v.box(x, 2, z1 - 1, x + 1, 1 + h, z1, r.wall2);
    }
    for (let z = z0; z < z1; z += 3) {
      v.box(x0, 2, z, x0 + 1, 1 + h, z + 1, r.wall2);
      v.box(x1 - 1, 2, z, x1, 1 + h, z + 1, r.wall2);
    }
    v.box(x0, h, z0, x1, 1 + h, z1, r.wall2);
  } else {
    for (const [px, pz] of [[x0, z0], [x1 - 1, z0], [x0, z1 - 1], [x1 - 1, z1 - 1]]) v.box(px, 1, pz, px + 1, 1 + h, pz + 1, "white");
  }
  if (win && h >= 4)
    windows(c, x0, 1, z0, x1, 1 + h, z1, {
      stepV: 4,
      stepH: V === 3 ? 3 : 4,
      h: 2,
      w: V === 3 ? 2 : 1,
      emit: 0.45,
      sill: V === 2 ? "white" : undefined,
      col: V === 3 ? "#fff3cf" : "glass",
    });
}

/** House or office in the regional style. Returns roof top. */
function rhouse(c: Ctx, x0: number, z0: number, x1: number, z1: number, floors = 1, smoke = true) {
  const v = c.v,
    r = R(c),
    V = c.variant % 4,
    h = floors * 4;
  if (V === 0) {
    v.box(x0, 1, z0, x1, 1 + h, z1, "white");
    v.clear(x0 + 1, 2, z0 + 1, x1 - 1, h, z1 - 1);
    windows(c, x0, 1, z0, x1, 1 + h, z1, { stepV: 4, stepH: 3, h: 2, emit: 0.5, sill: "slate" });
    // porch
    if (z1 + 2 < c.hz) {
      v.box(x0, 1, z1, x1, 2, z1 + 2, "woodLight");
      for (let x = x0; x < x1; x += 3) v.box(x, 2, z1 + 1, x + 1, 4, z1 + 2, "white");
      v.box(x0, 4, z1, x1, 5, z1 + 2, "slate");
    }
  } else rwalls(c, x0, z0, x1, z1, h);
  const top = rroof(c, x0, 1 + h, z0, x1, z1, "x");
  door(v, Math.floor((x0 + x1) / 2) - 1, 1, z1 - 1, r.door, 2, 3, false);
  if (smoke) {
    const cx = x1 - 2,
      ch = chimney(v, cx, h, z0 + 1, Math.max(3, top - h + 1), V === 1 ? "stone" : V === 3 ? "charcoal" : "brickDark");
    c.smoke(cx + 1, ch, z0 + 2, "smoke");
  }
  return top;
}

/** Barn / byre in the regional style; big doors on the +z end. Returns roof top. */
function rbarn(c: Ctx, x0: number, z0: number, x1: number, z1: number, h: number) {
  const v = c.v,
    r = R(c),
    V = c.variant % 4;
  if (V === 0) return redBarn(v, x0, z0, x1, z1, h, "red", "slate", "white", x1 - x0 >= 7);
  rwalls(c, x0, z0, x1, z1, h, false);
  const top =
    V === 2
      ? hip(v, x0 - 1, h, z0 - 1, x1 + 1, z1 + 1, r.roof, "#a8873f")
      : rroof(c, x0, 1 + h, z0, x1, z1, "z");
  const cx = Math.floor((x0 + x1) / 2),
    dw = Math.max(1, Math.min(3, Math.floor((x1 - x0) / 2) - 1)),
    dh = Math.min(h, 5);
  v.box(cx - dw, 1, z1 - 1, cx + dw, 1 + dh, z1, r.door);
  if (V === 1) {
    // arched cart door with a stone surround
    v.box(cx - dw - 1, 1, z1 - 1, cx - dw, 2 + dh, z1, "limestone");
    v.box(cx + dw, 1, z1 - 1, cx + dw + 1, 2 + dh, z1, "limestone");
    v.box(cx - dw, 1 + dh, z1 - 1, cx + dw, 2 + dh, z1, "limestone");
    v.put(cx - dw, dh, z1 - 1, "limestone");
    v.put(cx + dw - 1, dh, z1 - 1, "limestone");
  } else if (V === 2) {
    for (let k = 0; k < dw * 2; k++) v.put(cx - dw + k, 1 + (k % dh), z1 - 1, "white");
    v.box(cx - 1, h - 1, z1 - 1, cx + 1, h, z1, "white");
  } else {
    v.box(cx - dw, 1 + dh, z1 - 1, cx + dw, 2 + dh, z1, r.wall2);
    for (let x = cx - dw; x < cx + dw; x += 2) v.box(x, 1, z1 - 1, x + 1, 1 + dh, z1, "woodDark");
  }
  return top;
}

/** Small outbuilding (shed, coop, pump house). */
function rshed(c: Ctx, x0: number, z0: number, x1: number, z1: number, h = 4) {
  rwalls(c, x0, z0, x1, z1, h, false);
  const top = rroof(c, x0, 1 + h, z0, x1, z1, "x");
  c.v.box(Math.floor((x0 + x1) / 2), 1, z1 - 1, Math.floor((x0 + x1) / 2) + 1, 4, z1, R(c).door);
  return top;
}

/** Signature storage tower per region. */
function rsilo(c: Ctx, cx: number, cz: number, h: number, r = 2.2) {
  const v = c.v;
  switch (c.variant % 4) {
    case 0:
      return domeSilo(v, cx, cz, 1, h, r, "blueDark", "silver", "blue");
    case 1: {
      // stone dovecote tower with a terracotta cap and pigeon holes
      v.box(Math.round(cx - r), 1, Math.round(cz - r), Math.round(cx + r), 1 + h, Math.round(cz + r), "limestone");
      for (let y = 3; y < h; y += 3) v.put(Math.round(cx), y, Math.round(cz + r), "charcoal");
      v.box(Math.round(cx - r) - 1, 1 + h, Math.round(cz - r) - 1, Math.round(cx + r) + 1, 2 + h, Math.round(cz + r) + 1, "stone");
      return hip(v, Math.round(cx - r) - 1, 2 + h, Math.round(cz - r) - 1, Math.round(cx + r) + 1, Math.round(cz + r) + 1, "terracotta", "#a8502e");
    }
    case 2:
      return domeSilo(v, cx, cz, 1, h, r, "brick", "#4a5a48", "brickDark");
    default: {
      cyl(v, cx, cz, 1, 1 + h, r, "#c9b48a");
      for (let y = 2; y < h; y += 3) ring(v, cx, cz, y, y + 1, r + 0.2, r - 0.6, "olive");
      v.cone(cx, 1 + h, 4 + h, cz, r + 1, 0.4, "#4a5060");
      return 4 + h;
    }
  }
}

/** Regional water/wind machine (animated). */
function rpump(c: Ctx, x: number, z: number, h = 12) {
  const v = c.v;
  switch (c.variant % 4) {
    case 0:
      windpump(c, x, z, 1, h, "white");
      v.box(x - 3, 1, z + 3, x + 3, 2, z + 5, "steelLight");
      v.box(x - 2, 1, z + 3, x + 2, 2, z + 4, "water");
      return;
    case 1: {
      // stone well with a winch and bucket
      ring(v, x, z, 1, 3, 2.4, 1.4, "stone");
      v.box(x - 1, 0, z - 1, x + 1, 1, z + 1, "waterDeep");
      v.box(x - 2, 3, z, x - 1, 7, z + 1, "woodDark");
      v.box(x + 1, 3, z, x + 2, 7, z + 1, "woodDark");
      v.box(x - 2, 7, z - 1, x + 2, 8, z + 2, "terracotta");
      v.box(x - 1, 5, z, x + 1, 6, z + 1, "wood");
      v.put(x, 4, z, "iron");
      return;
    }
    case 2: {
      // little Dutch polder mill
      v.cone(x, 1, h, z, 2.8, 1.6, "#4a5a48");
      v.box(x - 1, 1, z + 2, x + 1, 4, z + 3, "#2f7a46");
      v.cone(x, h, h + 3, z, 2, 0.5, "#c7a35a");
      const sails = new PixelVox();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        for (let d = 1; d <= 6; d++) {
          sails.put(Math.round(Math.cos(a) * d), Math.round(Math.sin(a) * d), 0, d > 1 ? (d % 2 ? "white" : "cream") : "woodDark");
          if (d > 2) sails.put(Math.round(Math.cos(a) * d - Math.sin(a)), Math.round(Math.sin(a) * d + Math.cos(a)), 0, "white");
        }
      }
      sails.put(0, 0, 0, "woodDark");
      c.addRotor({ vox: sails, pivot: [x, h, z + 3], axis: "z", speed: 1.1, wind: true });
      return;
    }
    default: {
      // timber waterwheel on a little channel
      v.box(x - 5, 0, z - 1, x + 6, 1, z + 2, "water");
      v.box(x + 2, 1, z - 3, x + 3, 6, z - 2, "woodDark");
      v.box(x + 2, 1, z + 3, x + 3, 6, z + 4, "woodDark");
      const wheel = new PixelVox();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        wheel.put(0, Math.round(Math.sin(a) * 4), Math.round(Math.cos(a) * 4), i % 2 ? "woodDark" : "wood");
        if (i % 4 === 0) for (let d = 1; d < 4; d++) wheel.put(0, Math.round(Math.sin(a) * d), Math.round(Math.cos(a) * d), "woodDark");
      }
      for (let dx = -1; dx <= 1; dx++) wheel.put(dx, 0, 0, "iron");
      c.addRotor({ vox: wheel, pivot: [x + 2, 5, z + 1], axis: "x", speed: 0.8 });
      return;
    }
  }
}

function rtree(c: Ctx, x: number, z: number, s = 1) {
  tree(c.v, x, 1, z, R(c).tree, s, x * 7 + z);
}

/** Low perimeter fence/wall (parcel-fence colours so shared farm edges open up). */
function rfence(c: Ctx, x0: number, z0: number, x1: number, z1: number, gate?: [number, number]) {
  const r = R(c);
  fence(c.v, x0, z0, x1, z1, 1, c.variant % 4 === 1 ? 2 : 2, r.fence, gate);
}

/** A fenced pen with animated animals. `inset` keeps animals off the fence. */
function pen(
  c: Ctx,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  kind: CritterKind,
  count: number,
  o: { floor?: string; coat?: number; fence?: boolean; trough?: boolean } = {},
) {
  const v = c.v;
  if (x1 - x0 < 4 || z1 - z0 < 4) return;
  if (o.floor) v.box(x0, 0, z0, x1, 1, z1, o.floor);
  if (o.fence !== false) rfence(c, x0, z0, x1, z1, [Math.floor((x0 + x1) / 2) - 1, Math.floor((x0 + x1) / 2) + 1]);
  if (o.trough !== false && x1 - x0 >= 8) {
    v.box(x0 + 1, 1, z0 + 1, x0 + 5, 2, z0 + 2, "woodDark");
    v.box(x0 + 2, 1, z0 + 1, x0 + 4, 2, z0 + 2, kind === "pig" ? "soilDark" : "water");
  }
  c.critters({ kind, count, area: [x0 + 1, z0 + 2, x1 - 1, z1 - 1], coat: o.coat });
}

function rtractor(c: Ctx, x: number, z: number, axis: "x" | "z" = "x", dir: 1 | -1 = 1, trailer?: string) {
  if (c.variant % 4 === 3 && !trailer) {
    // little white kei truck with crates
    truck(c.v, x, 1, z, axis, "crate", "white");
    return;
  }
  tractor(c.v, x, 1, z, axis, dir, R(c).tractor, trailer);
}

/** Packed farm yard: gravel/cobbles in regional paving. */
function yard(c: Ctx, x0: number, z0: number, x1: number, z1: number) {
  c.v.box(x0, 0, z0, x1, 1, z1, ["path2", "#d8c6a1", "#b08070", "path"][c.variant % 4]);
}

function lane(c: Ctx, x0: number, z0: number, x1: number, z1: number) {
  c.v.box(x0, 0, z0, x1, 1, z1, R(c).lane);
}

/** Row of trees along a lane (cypress avenue / willow canal / blossom walk / shade oaks). */
function avenue(c: Ctx, x0: number, x1: number, z: number, step = 6, s = 0.8) {
  for (let x = x0; x < x1; x += step) rtree(c, x, z, s);
}

/** Dutch canal or Japanese channel strip. */
function canal(c: Ctx, x0: number, z0: number, x1: number, z1: number) {
  c.v.box(x0, 0, z0, x1, 1, z1, "water", 0.05);
}

// ---------------------------------------------------------------------------------------------
// Local crops not in agriculture.crops
// ---------------------------------------------------------------------------------------------
type Veg = Crop | "tomato" | "carrot" | "pepper" | "onion" | "lettuce";
function veg(c: Ctx, x0: number, z0: number, x1: number, z1: number, kind: Veg, axis: "x" | "z" = "z", stage = 3) {
  const v = c.v;
  if (stage >= 2 && !["tomato", "carrot", "pepper", "onion", "lettuce"].includes(kind)) return crops(c, x0, z0, x1, z1, kind as Crop, axis);
  for (let x = x0; x < x1; x++)
    for (let z = z0; z < z1; z++) {
      const ac = axis === "z" ? x - x0 : z - z0,
        al = axis === "z" ? z - z0 : x - x0,
        r = h2(x, z, 31);
      v.put(x, 0, z, ac % 3 === 2 ? "soilDark" : "soil");
      if (ac % 3 === 2) continue;
      if (stage <= 1) {
        if (al % 3 === 0 && ac % 3 === 0) v.put(x, 1, z, "leafLight");
        continue;
      }
      switch (kind) {
        case "tomato":
          if (ac % 3 !== 0) break;
          if (al % 4 === 0) v.box(x, 1, z, x + 1, 5, z + 1, "woodLight");
          v.box(x, 1, z, x + 1, Math.min(4, stage + 1), z + 1, "leafDark");
          if (r < 0.45 && stage >= 3) v.put(x, 2 + Math.floor(r * 4), z, "red");
          break;
        case "carrot":
          v.put(x, 1, z, al % 2 ? "leafLight" : "lime");
          if (r < 0.15 && stage >= 3) v.put(x, 0, z, "orange");
          break;
        case "pepper":
          if (ac % 3 !== 0 || al % 2) break;
          v.box(x, 1, z, x + 1, 3, z + 1, "leafDark");
          if (stage >= 3) v.put(x, 2, z, r < 0.5 ? "red" : r < 0.8 ? "yellow" : "orange");
          break;
        case "onion":
          v.put(x, 1, z, r < 0.6 ? "leaf" : "leafLight");
          if (ac % 3 === 0 && al % 2 === 0 && stage >= 3) v.put(x, 1, z, "white");
          break;
        case "lettuce":
          if (al % 2 === 0) v.put(x, 1, z, r < 0.5 ? "#9fd67a" : "#c3eaa0");
          break;
      }
    }
}

/** Grain colour per catalog style (wheat/barley/oats/rye). */
const GRAIN = [
  ["#f4c44e", "#f2be38", "#d9a74a"],
  ["#d9a74a", "#c79428", "#e5b866"],
  ["#e6d6b5", "#d8c6a1", "#cfc39a"],
  ["#b8a06a", "#a88a4a", "#c9b07a"],
];
function grain(c: Ctx, x0: number, z0: number, x1: number, z1: number, stage: number, axis: "x" | "z" = "z") {
  const v = c.v,
    g = GRAIN[c.variant % 4];
  for (let x = x0; x < x1; x++)
    for (let z = z0; z < z1; z++) {
      const ac = axis === "z" ? x - x0 : z - z0,
        r = h2(x, z, 13);
      v.put(x, 0, z, ac % 4 === 3 ? "soilDark" : "soil");
      if (ac % 4 === 3) continue;
      if (stage <= 1) {
        if (ac % 2 === 0 && r < 0.5) v.put(x, 1, z, "leafLight");
      } else if (stage === 2) {
        v.put(x, 1, z, r < 0.5 ? "leafLight" : "lime");
        if (r < 0.3) v.put(x, 2, z, "leafLight");
      } else {
        v.put(x, 1, z, "goldDark");
        v.put(x, 2, z, g[Math.floor(r * 3)]);
        if (r < 0.2) v.put(x, 3, z, g[0]);
      }
    }
}

/** Little seed stake with a coloured tag — tells the regional style apart on bare young plots. */
function stake(c: Ctx, x: number, z: number) {
  c.v.box(x, 1, z, x + 1, 3, z + 1, "woodLight");
  c.v.put(x, 3, z, ["red", "terracotta", "#2f7a46", "white"][c.variant % 4]);
  if (c.variant % 2) c.v.put(x + 1, 2, z, ["red", "terracotta", "#2f7a46", "white"][c.variant % 4]);
}

/** Corner flag / sign board with the farm colour. */
function farmSign(c: Ctx, x: number, z: number, col: string) {
  const v = c.v;
  v.box(x, 1, z, x + 1, 5, z + 1, "woodDark");
  v.box(x + 3, 1, z, x + 4, 5, z + 1, "woodDark");
  v.box(x, 4, z, x + 4, 6, z + 1, col);
  v.box(x + 1, 5, z, x + 3, 6, z + 1, "cream", 0.4);
}

// =============================================================================================
// ANCHORS
// =============================================================================================

// VEGETABLE FARM — market garden → market cooperative. Crops by style: pumpkins / tomatoes / carrots / cabbage.
function vegetableFarm(c: Ctx) {
  const { v, lv, hx, hz } = c,
    r = R(c),
    cropK = (["pumpkin", "tomato", "carrot", "cabbage"] as Veg[])[c.variant % 4],
    alt = (["corn", "pepper", "lettuce", "onion"] as Veg[])[c.variant % 4];
  ground(c);
  // homestead strip at the back
  const bz = -hz + L(c, [6, 8, 11, 12, 13]);
  if (lv === 1) {
    rshed(c, -hx + 1, -hz + 1, -hx + 7, -hz + 6, 3);
    veg(c, -hx + 1, -hz + 7, hx - 1, hz - 1, cropK, "z");
    scarecrow(v, hx - 4, 1, 0, r.tractor);
    c.critters({ kind: "chicken", count: 2, area: [-hx + 8, -hz + 1, hx - 1, -hz + 6] });
    return;
  }
  lane(c, -hx, bz, hx, bz + 2);
  rhouse(c, -hx + 2, -hz + 1, -hx + 11, bz - 1, lv >= 4 ? 2 : 1);
  rshed(c, -hx + 13, -hz + 1, -hx + 19, bz - 2, 3);
  // fields: alternating crop strips; more strips as it sprawls
  const strips = L(c, [1, 2, 3, 4, 6]),
    fx0 = -hx + 1,
    fx1 = hx - 1,
    fz0 = bz + 3,
    fz1 = hz - 1;
  const sw = Math.floor((fx1 - fx0) / strips);
  for (let i = 0; i < strips; i++) {
    const a = fx0 + i * sw,
      b = i === strips - 1 ? fx1 : a + sw - 2;
    veg(c, a, fz0, b, fz1, i % 2 ? alt : cropK, "z", Math.min(3, lv));
    if (i < strips - 1) lane(c, b, fz0, b + 2, fz1);
  }
  c.critters({ kind: "chicken", count: L(c, [2, 3, 4, 5, 7]), area: [-hx + 20, -hz + 1, Math.min(hx - 1, -hx + 34), bz - 1] });
  scarecrow(v, Math.floor((fx0 + fx1) / 2), 1, Math.floor((fz0 + fz1) / 2), r.tractor);
  if (lv >= 3) {
    // wash house: tank + crates
    tank(v, -hx + 23, -hz + 4, 1, 5, 2, "steelLight", "silver");
    for (let i = 0; i < 3; i++) crate(v, -hx + 13 + i * 2, 1, bz - 1, i % 2 ? "orange" : "red");
    person(v, Math.floor(fx0 + sw / 2), 1, fz0 + 4, r.tractor);
  }
  if (lv >= 4) {
    rtractor(c, hx - 8, bz + 1, "x", -1, "#e2bd55");
    // produce packing shed (open sided)
    const px = hx - 16;
    v.box(px, 1, -hz + 2, px + 12, 2, bz - 1, "concrete2");
    for (const x of [px, px + 11]) for (const z of [-hz + 2, bz - 2]) v.box(x, 2, z, x + 1, 6, z + 1, "woodDark");
    rroof(c, px, 6, -hz + 2, px + 12, bz - 1, "x");
    for (let i = 0; i < 4; i++) crate(v, px + 2 + i * 2, 2, -hz + 4, ["orange", "red", "lime", "purple"][i]);
    rpump(c, hx - 4, fz0 + 4, 11);
  }
  if (lv >= 5) {
    // market cooperative stalls along the front
    for (let i = 0; i < 4; i++) {
      const sx = -hx + 4 + i * 12;
      v.box(sx, 1, hz - 6, sx + 8, 3, hz - 4, "woodLight");
      for (let k = 0; k < 4; k++) v.put(sx + 1 + k * 2, 3, hz - 5, ["orange", "red", "lime", "purple"][(i + k) % 4]);
      for (const x of [sx, sx + 7]) v.box(x, 3, hz - 6, x + 1, 6, hz - 5, "woodDark");
      awning(v, sx, sx + 8, 6, hz - 7, ["red", "terracotta", "#2f7a46", "indigo"][c.variant % 4], "white");
      person(v, sx + 3, 1, hz - 3, ["blue", "pink", "yellow", "teal"][i]);
    }
    glasshouse(v, hx - 20, fz0 + 2, hx - 6, fz0 + 12, 4, "leaf");
    flag(v, -hx + 1, 1, bz + 2, 9, [r.tractor, "cream"]);
  }
}

// GRAIN FARM — croft → prairie granary. Regional storage: Harvestore / stone granary / mill / kura.
function grainFarm(c: Ctx) {
  const { v, lv, hx, hz } = c,
    r = R(c),
    V = c.variant % 4;
  ground(c);
  if (lv === 1) {
    rshed(c, -hx + 1, -hz + 1, -hx + 7, -hz + 6, 3);
    grain(c, -hx + 1, -hz + 7, hx - 1, hz - 1, 3);
    haybale(v, hx - 5, 1, -hz + 2, V !== 2);
    return;
  }
  const bz = -hz + L(c, [6, 12, 14, 15, 18]);
  yard(c, -hx + 1, -hz + 1, Math.min(hx - 1, -hx + L(c, [8, 20, 24, 30, 40])), bz);
  rbarn(c, -hx + 2, -hz + 2, -hx + L(c, [6, 11, 12, 13, 14]), bz - 1, L(c, [3, 5, 6, 7, 7]));
  // grain beyond, golden with stripes; the fields are mown in strips at higher levels
  const fz0 = bz + 1;
  grain(c, -hx + 1, fz0, hx - 1, hz - 1, 3, lv >= 3 ? "x" : "z");
  if (lv >= 4) for (let z = fz0 + 2; z < hz - 2; z += 8) lane(c, -hx + 1, z, hx - 1, z + 1);
  let sx = -hx + L(c, [8, 15, 16, 17, 18]);
  if (lv >= 2) for (let i = 0; i < 2; i++) haybale(v, sx + i * 4, 1, bz - 4, V !== 2);
  if (lv >= 3) {
    // storage: regional tower(s)
    const n = L(c, [0, 0, 1, 2, 3]);
    for (let i = 0; i < n; i++) rsilo(c, sx + 8 + i * 6, -hz + 5, 12 + lv * 2 + (i % 2) * 3, 2.4);
    sx += 8 + n * 6;
    if (V === 2) rpump(c, hx - 6, -hz + 5, 16);
    else if (V === 3) rpump(c, hx - 8, fz0 + 3);
    rtractor(c, Math.min(hx - 8, sx), bz - 3, "x", -1, lv >= 4 ? GRAIN[c.variant % 4][0] : undefined);
  }
  if (lv >= 4) {
    combine(v, -hx + 10, 1, fz0 + 8, "x", 1, V === 0 ? "leaf" : V === 1 ? "red" : V === 2 ? "#e2bd55" : "red");
    for (let i = 0; i < L(c, [0, 0, 0, 2, 4]); i++) grainBin(v, hx - 5 - i * 6, -hz + 5, 1, 7, 2.4);
  }
  if (lv >= 5) {
    grainElevator(v, Math.floor(hx / 2) - 6, -hz + 13, 3, 20);
    truck(v, -hx + 18, 1, bz - 2, "x", GRAIN[c.variant % 4][1], r.tractor);
    pivotIrrigation(c, hx - 18, fz0 + 14, 14);
    avenue(c, -hx + 3, hx - 3, hz - 2, 8, 0.7);
    flag(v, -hx + 1, 1, bz, 10, [r.tractor, "cream"]);
  }
}

// DAIRY FARM — milking shed → creamery. Breeds by style (Holstein/Jersey/Brown Swiss/Ayrshire).
function dairyFarm(c: Ctx) {
  const { v, lv, hx, hz } = c,
    r = R(c),
    V = c.variant % 4;
  ground(c);
  const cows = L(c, [2, 4, 7, 10, 15]);
  if (lv === 1) {
    rbarn(c, -hx + 2, -hz + 1, -hx + 9, -hz + 7, 3);
    pen(c, -hx + 1, -hz + 8, hx - 1, hz - 1, "cow", cows, { coat: V });
    v.box(hx - 4, 1, -hz + 2, hx - 2, 4, -hz + 4, "silver");
    return;
  }
  const bz = -hz + L(c, [7, 10, 12, 13, 14]);
  yard(c, -hx + 1, -hz + 1, hx - 1, bz);
  // milking parlor (long barn) with cupola
  const bw = L(c, [7, 12, 14, 16, 18]);
  const top = rbarn(c, -hx + 2, -hz + 2, -hx + 2 + bw, bz - 1, L(c, [3, 5, 5, 6, 7]));
  if (lv >= 3) {
    const cx = -hx + 2 + Math.floor(bw / 2);
    v.box(cx - 1, top - 1, -hz + 5, cx + 2, top + 2, -hz + 8, "white");
    v.box(cx - 2, top + 2, -hz + 4, cx + 3, top + 3, -hz + 9, r.roof);
  }
  // pasture = front, split into paddocks as it grows
  const pz0 = bz + 1,
    paddocks = L(c, [1, 1, 2, 2, 3]),
    pw = Math.floor((hx * 2 - 2) / paddocks);
  for (let i = 0; i < paddocks; i++) {
    const a = -hx + 1 + i * pw;
    pen(c, a, pz0, a + pw, hz - 1, "cow", Math.ceil(cows / paddocks), { coat: V, floor: i % 2 ? "grass" : undefined });
  }
  // milk tanks & silos
  let tx = -hx + bw + 5;
  if (lv >= 2) {
    tank(v, tx, -hz + 4, 1, 4, 1.6, "silver", "steelLight");
    tx += 4;
  }
  if (lv >= 3) {
    rsilo(c, tx + 2, -hz + 5, 14 + lv, 2.4);
    tx += 7;
  }
  if (lv >= 4) {
    for (let i = 0; i < 2; i++) tank(v, tx + i * 4, -hz + 4, 1, 6, 1.6, "chrome", "silver");
    truck(v, tx + 2, 1, bz - 3, "x", "white", V === 0 ? "blue" : r.tractor);
    tx += 9;
    rpump(c, hx - 5, -hz + 6, 12);
  }
  if (lv >= 5) {
    // creamery shop with cheese wheels and a giant milk bottle sign
    const cx0 = Math.min(hx - 14, tx);
    rwalls(c, cx0, -hz + 2, cx0 + 10, bz - 3, 5);
    rroof(c, cx0, 6, -hz + 2, cx0 + 10, bz - 3, "x");
    cyl(v, cx0 + 5, bz - 1, 1, 5, 1.2, "white");
    v.box(cx0 + 4, 5, bz - 2, cx0 + 6, 7, bz, "white");
    v.box(cx0 + 4, 7, bz - 2, cx0 + 6, 8, bz, "blue");
    for (let i = 0; i < 3; i++) cyl(v, cx0 + 1 + i * 2, bz - 1, 1, 2, 0.9, "#f4c44e");
    rtractor(c, -hx + 4, bz - 2, "x", 1, "#e2bd55");
    person(v, cx0 + 8, 1, bz - 1, "blue");
  }
}

// POULTRY FARM — henhouse → egg cooperative. Hen colours by style.
function poultryFarm(c: Ctx) {
  const { v, lv, hx, hz } = c,
    V = c.variant % 4;
  ground(c);
  const hens = L(c, [4, 7, 10, 14, 20]);
  if (lv === 1) {
    coop(c, -hx + 2, -hz + 2, 6, 5);
    pen(c, -hx + 1, -hz + 8, hx - 1, hz - 1, "chicken", hens, { coat: V, floor: "path2", trough: false });
    return;
  }
  // long laying houses at the back, free-range yards at the front
  const houses = L(c, [1, 1, 2, 3, 3]);
  const bz = -hz + L(c, [6, 8, 10, 11, 12]);
  for (let i = 0; i < houses; i++) {
    const x0 = -hx + 2 + i * Math.floor((hx * 2 - 4) / houses);
    const w = Math.min(Math.floor((hx * 2 - 4) / houses) - 3, lv >= 3 ? 16 : 10);
    rwalls(c, x0, -hz + 2, x0 + w, bz - 1, 3, false);
    for (let x = x0 + 1; x < x0 + w - 1; x += 2) v.put(x, 3, bz - 2, "glassDark");
    rroof(c, x0, 4, -hz + 2, x0 + w, bz - 1, "x");
    if (lv >= 3) for (let x = x0 + 2; x < x0 + w - 1; x += 4) v.box(x, 6, Math.floor((-hz + bz) / 2), x + 1, 8, Math.floor((-hz + bz) / 2) + 1, "steel");
  }
  const yards = L(c, [1, 1, 2, 2, 3]),
    yw = Math.floor((hx * 2 - 2) / yards);
  for (let i = 0; i < yards; i++) {
    const a = -hx + 1 + i * yw;
    pen(c, a, bz + 1, a + yw, hz - 1, i === 2 && lv >= 5 ? "duck" : "chicken", Math.ceil(hens / yards), {
      coat: V + i,
      floor: i % 2 ? "path2" : undefined,
      trough: false,
    });
    coop(c, a + 2, bz + 3, 4, 3);
  }
  if (lv >= 3) domeSilo(v, hx - 4, -hz + 4, 1, 8 + lv, 1.8, "cream", "silver", "steel");
  if (lv >= 4) {
    truck(v, hx - 12, 1, bz - 1, "x", "cream", R(c).tractor);
    for (let i = 0; i < 3; i++) crate(v, hx - 16 + i * 2, 1, bz - 3, "cream");
  }
  if (lv >= 5) {
    // duck pond for the duck yard
    waterBlob(c, hx - 8, hz - 6, 5, 3, 11, "grass3");
    rpump(c, -hx + 4, bz + 6, 10);
    farmSign(c, 0, hz - 2, "#f4c44e");
  }
}
function coop(c: Ctx, x0: number, z0: number, w: number, d: number) {
  const v = c.v;
  v.box(x0, 1, z0, x0 + w, 2, z0 + d, "woodDark");
  rwalls(c, x0, z0, x0 + w, z0 + d, 3, false);
  v.clear(x0, 1, z0, x0 + w, 2, z0 + d);
  for (const [px, pz] of [[x0, z0], [x0 + w - 1, z0], [x0, z0 + d - 1], [x0 + w - 1, z0 + d - 1]]) v.put(px, 1, pz, "woodDark");
  rroof(c, x0, 4, z0, x0 + w, z0 + d, "x");
  v.put(x0 + 1, 3, z0 + d - 1, "charcoal");
  for (let k = 0; k < 3; k++) v.put(x0 + 1, 1 + Math.max(0, 1 - k), z0 + d + k, "wood");
}

// CATTLE RANCH — stock yard → cattle station. Beef breeds (Hereford/Angus/Longhorn/Shorthorn).
function cattleRanch(c: Ctx) {
  const { v, lv, hx, hz } = c,
    r = R(c),
    V = c.variant % 4,
    coat = 4 + V;
  ground(c, V === 0 ? "#b8c978" : r.grass);
  const head = L(c, [4, 6, 9, 14, 22]);
  // ranch house + corrals at the back-left, open range everywhere else
  const bz = -hz + L(c, [7, 8, 11, 12, 13]);
  if (lv >= 3) rhouse(c, -hx + 2, -hz + 1, -hx + 11, bz - 3, 1);
  else rshed(c, -hx + 2, -hz + 1, -hx + 8, -hz + 6, 3);
  const cx0 = -hx + (lv >= 3 ? 13 : 10);
  // sorting pens: a row of small corrals
  const pens = L(c, [1, 1, 2, 3, 4]);
  for (let i = 0; i < pens; i++) {
    const a = cx0 + i * 9;
    if (a + 8 > hx - 1) break;
    pen(c, a, -hz + 1, a + 8, bz - 1, "cow", 2, { coat, floor: "soil", trough: i === 0 });
  }
  // the range
  pen(c, -hx + 1, bz + 1, hx - 1, hz - 1, "cow", head, { coat, trough: false });
  for (let i = 0; i < L(c, [2, 3, 5, 8, 12]); i++) {
    const x = c.ri(-hx + 3, hx - 4),
      z = c.ri(bz + 3, hz - 3);
    v.put(x, 1, z, "leafDark");
    v.put(x + 1, 0, z, "grass3");
  }
  if (lv >= 2) rpump(c, hx - 5, Math.floor((bz + hz) / 2), 12 + lv);
  else haybale(v, hx - 5, 1, Math.floor((bz + hz) / 2), true);
  if (lv >= 3) for (let i = 0; i < lv - 1; i++) haybale(v, hx - 6 - i * 4, 1, -hz + 2, true);
  if (lv >= 4) {
    // loading chute + cattle truck
    v.box(hx - 14, 1, bz - 1, hx - 12, 4, bz + 6, "woodDark");
    truck(v, hx - 10, 1, bz - 3, "x", "steelLight", r.tractor);
    rtree(c, -hx + 3, hz - 4, 1.2);
  }
  if (lv >= 5) {
    // station gateway arch with the brand
    const gx = Math.floor(hx / 2);
    v.box(gx - 5, 1, hz - 2, gx - 4, 11, hz - 1, "woodDark");
    v.box(gx + 4, 1, hz - 2, gx + 5, 11, hz - 1, "woodDark");
    v.box(gx - 5, 10, hz - 2, gx + 5, 12, hz - 1, "woodDark");
    v.box(gx - 2, 8, hz - 2, gx + 2, 10, hz - 1, "#e6d6b5");
    v.box(gx - 1, 9, hz - 2, gx + 1, 10, hz - 1, "charcoal");
    c.critters({ kind: "horse", count: 2, area: [-hx + 2, bz - 2, -hx + 12, bz + 1], coat: 3 });
    rbarn(c, hx - 16, -hz + 2, hx - 4, bz - 4, 6);
  }
}

// HORSE RANCH — loose box → equestrian centre. Coats by style (chestnut/palomino/grey/bay).
function horseRanch(c: Ctx) {
  const { v, lv, hx, hz } = c,
    r = R(c),
    V = c.variant % 4;
  ground(c);
  const bz = -hz + L(c, [7, 8, 11, 12, 14]);
  // stables: a row of loose boxes with half doors; longer each level
  const sw = L(c, [8, 12, 16, 22, 28]);
  rwalls(c, -hx + 2, -hz + 2, -hx + 2 + sw, bz - 1, 4, false);
  for (let x = -hx + 3; x < -hx + 1 + sw; x += 3) {
    v.box(x, 1, bz - 2, x + 2, 3, bz - 1, r.door);
    v.box(x, 3, bz - 2, x + 2, 4, bz - 1, "charcoal");
  }
  const top = rroof(c, -hx + 2, 5, -hz + 2, -hx + 2 + sw, bz - 1, "x");
  if (lv >= 3) {
    // clock cupola
    const cx = -hx + 2 + Math.floor(sw / 2);
    v.box(cx - 1, top - 1, -hz + 4, cx + 2, top + 3, -hz + 7, "white");
    v.put(cx, top + 1, -hz + 7, "gold", 0.4);
    v.box(cx - 2, top + 3, -hz + 3, cx + 3, top + 4, -hz + 8, r.roof);
    v.box(cx, top + 4, -hz + 5, cx + 1, top + 7, -hz + 6, "iron");
    v.box(cx - 1, top + 6, -hz + 5, cx + 2, top + 7, -hz + 6, "gold");
  }
  const coat = V;
  // paddock(s)
  const arena = lv >= 3,
    ax0 = arena ? Math.floor(hx * 0.1) : hx,
    pz0 = bz + 1;
  pen(c, -hx + 1, pz0, ax0 - 1, hz - 1, "horse", L(c, [2, 3, 3, 4, 6]), { coat });
  if (arena) {
    // sand riding arena with jumps
    const x0 = ax0,
      x1 = hx - 1;
    v.box(x0, 0, pz0, x1, 1, hz - 1, "sand");
    fence(v, x0, pz0, x1, hz - 1, 1, 2, "white", [x0 + 2, x0 + 4]);
    for (let i = 0; i < L(c, [0, 0, 1, 2, 3]); i++) {
      const jx = x0 + 5 + i * Math.floor((x1 - x0 - 8) / Math.max(1, L(c, [1, 1, 1, 2, 3]))),
        jz = Math.floor((pz0 + hz) / 2) - 2;
      v.box(jx, 1, jz, jx + 1, 3, jz + 1, "white");
      v.box(jx, 1, jz + 4, jx + 1, 3, jz + 5, "white");
      for (let z = jz + 1; z < jz + 4; z++) v.put(jx, 2, z, z % 2 ? "red" : "white");
    }
    c.critters({ kind: "horse", count: L(c, [0, 0, 1, 2, 3]), area: [x0 + 2, pz0 + 2, x1 - 2, hz - 3], coat: coat + 1 });
  }
  if (lv >= 2) {
    haybale(v, -hx + sw + 4, 1, -hz + 3, false);
    // grooming shed: open-sided with a tie rail
    for (const x of [-hx + sw + 4, -hx + sw + 9]) v.box(x, 1, bz - 3, x + 1, 5, bz - 2, "woodDark");
    v.box(-hx + sw + 3, 5, bz - 4, -hx + sw + 11, 6, bz - 1, R(c).roof);
  }
  if (lv >= 4) {
    // horsebox + trailer, grandstand bench
    truck(v, hx - 10, 1, bz - 3, "x", "cream", r.tractor);
    for (let x = ax0 + 2; x < hx - 4; x += 4) v.box(x, 1, hz - 1, x + 3, 2, hz, "woodLight");
    rtree(c, hx - 3, -hz + 3, 1.1);
  }
  if (lv >= 5) {
    rpump(c, hx - 5, -hz + 6, 12);
    flag(v, ax0, 1, pz0, 10, ["#2f5696", "white", "red"]);
    for (let i = 0; i < 3; i++) person(v, ax0 + 4 + i * 3, 1, hz - 3, ["red", "blue", "yellow"][i]);
  }
}

// APIARY — hive garden → bee research garden. Flowers by style: sunflower / heather / clover / lavender.
function apiary(c: Ctx) {
  const { v, lv, hx, hz } = c;
  ground(c);
  const flower: Crop = (["sunflower", "lavender", "tulip", "lavender"] as Crop[])[c.variant % 4];
  // flower meadow fills the front, hives in rows at the back
  const fz0 = Math.floor(-hz * 0.1);
  if (c.variant % 4 === 2) {
    // clover: white & pink speckled meadow
    for (let x = -hx + 1; x < hx - 1; x++)
      for (let z = fz0; z < hz - 1; z++) {
        v.put(x, 0, z, "grass");
        const q = h2(x, z, 5);
        if (q < 0.35) v.put(x, 1, z, q < 0.15 ? "pink" : "white");
        else if (q < 0.5) v.put(x, 1, z, "leaf");
      }
  } else crops(c, -hx + 1, fz0, hx - 1, hz - 1, flower, "z");
  const hives = L(c, [3, 5, 8, 12, 18]);
  let n = 0;
  for (let z = -hz + 2; z < fz0 - 3 && n < hives; z += 5)
    for (let x = -hx + 2; x < hx - 3 && n < hives; x += 4) {
      if (c.variant % 4 === 3) {
        // Japanese: straw skep-style log hives on stands
        v.box(x, 1, z, x + 2, 2, z + 2, "woodDark");
        cyl(v, x + 1, z + 1, 2, 5, 1.2, "#c9b48a");
        v.put(x + 1, 5, z + 1, "#4a5060");
      } else if (c.variant % 4 === 1) {
        // Tuscan: stacked terracotta-roofed boxes
        beehive(v, x, 1, z);
        v.box(x, 4, z, x + 2, 5, z + 2, "terracotta");
      } else beehive(v, x, 1, z);
      v.put(x + 1, 2, z + 2, "charcoal");
      n++;
    }
  // the bees!
  c.critters({ kind: "bee", count: L(c, [4, 6, 9, 12, 16]), area: [-hx + 1, -hz + 1, hx - 1, hz - 1] });
  if (lv >= 2) rshed(c, hx - 7, -hz + 1, hx - 1, -hz + 6, 3);
  if (lv >= 3) {
    person(v, 0, 1, fz0 - 1, "white", "white");
    v.box(-1, 4, fz0 - 1, 1, 5, fz0, "#e6d6b5");
  }
  if (lv >= 4) {
    // extraction hut with honey jars on a stall
    const sx = -hx + 2;
    rwalls(c, sx, hz - 8, sx + 8, hz - 3, 4);
    rroof(c, sx, 5, hz - 8, sx + 8, hz - 3, "x");
    for (let i = 0; i < 4; i++) v.put(sx + 1 + i * 2, 2, hz - 2, "#f2be38", 0.3);
    v.box(sx, 1, hz - 2, sx + 8, 2, hz - 1, "woodLight");
  }
  if (lv >= 5) {
    // research pavilion: glass dome over a giant hive
    const gx = hx - 9,
      gz = hz - 7;
    v.dome(gx, 1, gz, 5, "glass", 0.18);
    v.clear(gx - 4, 1, gz - 4, gx + 5, 5, gz + 5);
    v.box(gx - 1, 1, gz - 1, gx + 2, 5, gz + 2, "#f2be38");
    v.box(gx - 1, 2, gz - 1, gx + 2, 3, gz + 2, "goldDark");
    rtree(c, -hx + 3, fz0 + 3, 1);
  }
}

// VINEYARD — vine garden → estate. Grapes by style (Burgundy, Chardonnay, Rosé, Concord).
const GRAPE = ["purpleDark", "lime", "pink", "indigo"];
function vines(c: Ctx, x0: number, z0: number, x1: number, z1: number, stage: number) {
  const v = c.v,
    g = GRAPE[c.variant % 4];
  for (let x = x0; x < x1; x++)
    for (let z = z0; z < z1; z++) {
      const row = (x - x0) % 4 === 1;
      v.put(x, 0, z, row ? "soil" : (x + z) % 3 ? "grass" : "grass3");
      if (!row) continue;
      if ((z - z0) % 8 === 0) {
        v.box(x, 1, z, x + 1, 5, z + 1, "woodDark");
        continue;
      }
      v.put(x, 1, z, "woodDark");
      if (stage >= 2) v.box(x, 2, z, x + 1, Math.min(5, 2 + stage), z + 1, (z & 1) ? "leaf" : "olive");
      v.put(x, 4, z, "steelDark");
      if (stage >= 3 && h2(x, z, 3) < 0.35) v.put(x + (z % 2 ? 1 : -1), 2, z, g);
    }
}
function vineyard(c: Ctx) {
  const { v, lv, hx, hz } = c,
    r = R(c),
    V = c.variant % 4;
  ground(c);
  if (lv === 1) {
    vines(c, -hx + 1, -hz + 1, hx - 1, hz - 4, 2);
    v.box(-hx + 2, 1, hz - 3, -hx + 4, 3, hz - 1, "oak");
    stake(c, hx - 3, hz - 2);
    return;
  }
  const bz = -hz + L(c, [6, 9, 12, 13, 15]);
  // press house / cellar / villa at the back
  const hw = L(c, [6, 10, 12, 14, 18]);
  rhouse(c, -hx + 2, -hz + 2, -hx + 2 + hw, bz - 2, lv >= 4 ? 2 : 1);
  if (lv >= 3) {
    // press + barrels
    cyl(v, -hx + hw + 6, -hz + 5, 1, 4, 2, "wood");
    v.box(-hx + hw + 4, 5, -hz + 5, -hx + hw + 9, 6, -hz + 6, "woodDark");
  }
  if (lv >= 4) for (let i = 0; i < 4; i++) cyl(v, -hx + hw + 4 + i * 3, bz - 2, 1, 3, 1.2, "oak");
  lane(c, -hx, bz, hx, bz + 2);
  if (V === 1) avenue(c, -hx + 2, hx - 2, bz + 2, 5, 0.9);
  vines(c, -hx + 1, bz + 3, hx - 1, hz - 1, Math.min(3, lv));
  // sheep mow between the rows (an old vineyard trick)
  if (lv >= 3) c.critters({ kind: lv >= 5 && V === 3 ? "duck" : "sheep", count: L(c, [0, 0, 3, 5, 7]), area: [-hx + 1, bz + 3, hx - 1, hz - 1], coat: V });
  if (lv >= 4) {
    person(v, Math.floor(hx / 2), 1, bz + 6, r.tractor);
    crate(v, Math.floor(hx / 2) + 2, 1, bz + 6, GRAPE[V]);
    rtractor(c, hx - 8, bz + 1, "x", -1, GRAPE[V]);
  }
  if (lv >= 5) {
    // tasting terrace with umbrellas and a bell tower
    const tx = hx - 18;
    v.box(tx, 1, -hz + 2, tx + 14, 2, bz - 2, "limestone");
    for (let i = 0; i < 3; i++) {
      const ux = tx + 2 + i * 5;
      v.box(ux, 2, -hz + 6, ux + 1, 6, -hz + 7, "white");
      v.box(ux - 2, 6, -hz + 4, ux + 3, 7, -hz + 9, i % 2 ? "cream" : r.roof === "terracotta" ? "red" : "teal");
    }
    const bx = tx + 12;
    rwalls(c, bx - 2, -hz + 2, bx + 2, -hz + 6, 14, false);
    rroof(c, bx - 2, 15, -hz + 2, bx + 2, -hz + 6, "x");
    v.put(bx, 12, -hz + 6, "gold");
  }
}

// RICE FARM — starter paddy → terraced paddies. Grain by style; ducks patrol the paddies (rice-duck farming).
const RICE = ["leafLight", "#f2be38", "#3a3044", "#a8342b"];
function paddy(c: Ctx, x0: number, z0: number, x1: number, z1: number, y: number, stage: number) {
  const v = c.v,
    head = RICE[c.variant % 4];
  for (let x = x0; x < x1; x++)
    for (let z = z0; z < z1; z++) {
      const edge = x === x0 || z === z0 || x === x1 - 1 || z === z1 - 1;
      for (let k = 0; k < y; k++) v.put(x, k, z, "soilDark");
      if (edge) {
        v.put(x, y, z, "grass");
        continue;
      }
      v.put(x, y, z, h2(x, z, 2) < 0.5 ? "#79c3cf" : "#6ab7c8", 0.08);
      if ((x - x0) % 3 === 1 && (z - z0) % 2 === 1) {
        v.put(x, y + 1, z, "lime");
        if (stage >= 3) v.put(x, y + 2, z, head);
      }
    }
}
function riceFarm(c: Ctx) {
  const { v, lv, hx, hz } = c,
    r = R(c);
  ground(c);
  const bz = lv === 1 ? -hz + 1 : -hz + L(c, [1, 8, 11, 12, 13]);
  if (lv >= 2) {
    rhouse(c, -hx + 2, -hz + 1, -hx + 10, bz - 2, 1);
    if (lv >= 4) rbarn(c, -hx + 12, -hz + 1, -hx + 20, bz - 2, 4);
  }
  // paddies tile the front; at Lv5 they become terraces stepping up toward the back
  const cols = L(c, [1, 2, 2, 3, 4]),
    rows = L(c, [1, 1, 2, 2, 3]),
    w = Math.floor((hx * 2 - 2) / cols),
    d = Math.floor((hz - 1 - bz) / rows);
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      const y = lv >= 5 ? rows - 1 - j : 0;
      paddy(c, -hx + 1 + i * w, bz + j * d, -hx + 1 + (i + 1) * w, bz + (j + 1) * d, y, lv >= 2 ? 3 : 2);
      if (lv >= 3 && (i + j) % 2 === 0)
        c.critters({ kind: "duck", count: L(c, [0, 0, 2, 2, 3]), area: [-hx + 2 + i * w, bz + j * d + 1, -hx + (i + 1) * w, bz + (j + 1) * d - 1], y: y + 1, coat: 1 });
    }
  person(v, -hx + 1 + Math.floor(w / 2), 1, bz + Math.floor(d / 2), r.tractor);
  if (lv === 1) stake(c, hx - 2, hz - 2);
  v.box(-hx + Math.floor(w / 2), 4, bz + Math.floor(d / 2) - 1, -hx + 3 + Math.floor(w / 2), 5, bz + Math.floor(d / 2) + 2, "#e6c45c");
  if (lv >= 3) rpump(c, hx - 8, bz - 3);
  if (lv >= 4) {
    for (let i = 0; i < 4; i++) v.box(hx - 18 + i * 2, 1, -hz + 2, hx - 17 + i * 2, 4, -hz + 3, "#e6c45c");
    rtractor(c, hx - 12, -hz + 5, "x", -1);
  }
  if (lv >= 5) {
    rsilo(c, -hx + 24, -hz + 5, 12, 2.2);
    for (let i = 0; i < 3; i++) rtree(c, hx - 4 - i * 6, -hz + 3, 0.8);
  }
}

// GREENHOUSE FARM — glass shed → botanical range. Glasshouse type by style (Victorian/Hydroponic/Sawtooth/Hoop).
function glassBay(c: Ctx, x0: number, z0: number, x1: number, z1: number, h: number) {
  const v = c.v,
    V = c.variant % 4,
    frame = ["white", "steelLight", "steel", "steelDark"][V];
  v.box(x0, 0, z0, x1, 1, z1, "concrete2");
  for (let z = z0 + 1; z < z1 - 1; z += 2) v.box(x0 + 1, 1, z, x1 - 1, 2, z + 1, V === 1 ? "white" : "soil");
  for (let z = z0 + 1; z < z1 - 1; z += 2)
    for (let x = x0 + 1; x < x1 - 1; x++) v.put(x, 2, z, ["leaf", "lime", "red", "leafLight"][(x + z + V) % 4]);
  if (V === 3) {
    // polytunnel hoops
    const w = x1 - x0;
    for (let i = 0; i < w; i++) {
      const y = 1 + Math.round(Math.sin((Math.PI * (i + 0.5)) / w) * h);
      for (let z = z0; z < z1; z++) v.put(x0 + i, y, z, z % 4 === 0 ? frame : "#e8f4f0", 0.12);
      for (let yy = 1; yy < y; yy++) {
        v.put(x0 + i, yy, z0, "#e8f4f0", 0.1);
        v.put(x0 + i, yy, z1 - 1, "#e8f4f0", 0.1);
      }
    }
    return;
  }
  v.box(x0, 1, z0, x1, 1 + h, z1, "glass", 0.18);
  v.clear(x0 + 1, 1, z0 + 1, x1 - 1, 1 + h, z1 - 1);
  for (let x = x0; x < x1; x += 3) {
    v.box(x, 1, z0, x + 1, 1 + h, z0 + 1, frame);
    v.box(x, 1, z1 - 1, x + 1, 1 + h, z1, frame);
  }
  if (V === 2) {
    // sawtooth north-light roof
    for (let x = x0; x < x1; x++) {
      const t = (x - x0) % 5;
      v.box(x, 1 + h, z0, x + 1, 2 + h + t, z1, t === 4 ? frame : "glass", 0.2);
      if (t < 4) v.clear(x, 2 + h, z0 + 1, x + 1, 1 + h + t, z1 - 1);
    }
  } else if (V === 0) {
    // Victorian ridge with a lantern
    const rise = Math.ceil((z1 - z0) / 2);
    for (let s = 0; s < rise; s++) v.box(x0, 1 + h + s, z0 + s, x1, 2 + h + s, z1 - s, s === rise - 1 ? frame : "glass", 0.18);
    v.box(x0 + 2, 1 + h + rise, z0 + rise - 1, x1 - 2, 2 + h + rise, z0 + rise + 1, "glass", 0.3);
  } else {
    v.box(x0, 1 + h, z0, x1, 2 + h, z1, "glass", 0.2);
    for (let x = x0 + 1; x < x1; x += 4) v.box(x, 1 + h, z0, x + 1, 2 + h, z1, frame);
    v.box(x0 + 1, h, z0 + 1, x1 - 1, 1 + h, z0 + 2, "magenta", 0.9);
  }
}
function greenhouseFarm(c: Ctx) {
  const { v, lv, hx, hz } = c;
  ground(c, "grass2");
  const n = L(c, [1, 2, 2, 3, 4]),
    rows = lv >= 3 ? 2 : 1,
    w = Math.floor((hx * 2 - 4) / n),
    d = Math.floor((hz * 2 - (lv >= 2 ? 8 : 4)) / rows);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < rows; j++) glassBay(c, -hx + 2 + i * w, -hz + 2 + j * d, -hx + 1 + (i + 1) * w - 1, -hz + 1 + (j + 1) * d - 1, L(c, [3, 4, 4, 5, 5]));
  if (lv >= 2) for (let i = 0; i < 3; i++) crate(v, -hx + 2 + i * 3, 1, hz - 3, ["red", "lime", "yellow"][i]);
  if (lv >= 3) person(v, 0, 1, hz - 3, "teal");
  if (lv >= 4) {
    // service boilers with steam
    const bx = hx - 5;
    tank(v, bx, hz - 4, 1, 5, 1.8, "steelLight", "silver");
    const t = chimney(v, bx - 4, 1, hz - 5, 10, "brick");
    c.smoke(bx - 3, t, hz - 4, "steam");
    truck(v, -hx + 12, 1, hz - 3, "x", "lime", "white");
  }
  if (lv >= 5) {
    solarRow(v, -hx + 2, -hx + 18, 1, hz - 8, 3);
    flag(v, hx - 2, 1, hz - 2, 9, ["leaf", "white"]);
  }
}

// VERTICAL FARM — grows TALL: grow room → sky harvest tower. Styles: leaf tower / helical / LED stack / solar terrace.
function verticalFarm(c: Ctx) {
  const { v, lv, hx, hz } = c,
    V = c.variant % 4;
  lot(c, "concrete2");
  const floors = L(c, [2, 4, 6, 9, 13]),
    w = Math.min(hx * 2 - 6, L(c, [10, 12, 14, 18, 22])),
    d = Math.min(hz * 2 - 6, L(c, [10, 12, 12, 16, 18])),
    x0 = -Math.floor(w / 2),
    z0 = -Math.floor(d / 2) - (hz > 8 ? 2 : 0);
  // planters and seating ring the base
  for (let x = -hx + 1; x < hx - 1; x += 4) if (x < x0 - 2 || x > x0 + w + 1) bush(v, x, 1, -hz + 2, 1, "leaf", V === 2 ? "pink" : "yellow");
  for (let f = 0; f < floors; f++) {
    const y = 1 + f * 4,
      sh = V === 1 ? [0, 1, 2, 1][f % 4] : 0,
      inset = V === 3 ? Math.min(3, Math.floor(f / 3)) : 0;
    const a = x0 + sh + inset,
      b = x0 + w + sh - inset,
      za = z0 + inset,
      zb = z0 + d - inset;
    v.box(a, y, za, b, y + 1, zb, "white");
    v.box(a + 1, y + 1, za + 1, b - 1, y + 4, zb - 1, "glassDark", 0.3);
    // racks of greens glowing pink under LEDs
    for (let x = a + 1; x < b - 1; x += 2) {
      v.box(x, y + 1, zb - 1, x + 1, y + 3, zb, (x + f) % 3 ? "leafLight" : "leaf");
      v.box(x, y + 1, za, x + 1, y + 3, za + 1, (x + f) % 3 ? "leaf" : "lime");
    }
    if (V === 2) v.box(a, y + 3, za, b, y + 4, zb, "magenta", 1.2);
    else v.box(a, y + 3, zb - 1, b, y + 4, zb, V === 0 ? "leafDark" : "#d95ca3", V === 0 ? 0 : 0.8);
    if (V === 3) solarRow(v, a, b, y + 4, zb - 1, 1);
  }
  const top = 1 + floors * 4;
  v.box(x0, top, z0, x0 + w, top + 1, z0 + d, "concreteDark");
  if (V === 0) tree(v, 0, top + 1, z0 + Math.floor(d / 2), "round", 1 + lv * 0.15, 2);
  if (lv >= 3) {
    tank(v, x0 + w - 2, z0 + 2, top + 1, 3, 1.5, "tealDark", "teal");
    c.blink(x0 + 1, top + 2, z0 + 1, "red");
  }
  if (lv >= 4) {
    const blades = new PixelVox();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      for (let dd = 1; dd <= 5; dd++) blades.put(Math.round(Math.cos(a) * dd), Math.round(Math.sin(a) * dd), 0, "white");
    }
    blades.put(0, 0, 0, "steelDark");
    v.box(x0 + 1, top + 1, z0 + Math.floor(d / 2), x0 + 2, top + 9, z0 + Math.floor(d / 2) + 1, "steel");
    c.addRotor({ vox: blades, pivot: [x0 + 1, top + 9, z0 + Math.floor(d / 2) + 1], axis: "z", speed: 2.5, wind: true });
  }
  // street level: a market kiosk + delivery van
  v.box(x0, 1, z0 + d, x0 + w, 2, Math.min(hz - 1, z0 + d + 3), "concrete");
  if (lv >= 2) awning(v, x0 + 1, x0 + w - 1, 4, z0 + d, "leaf", "white");
  if (lv >= 3 && hx > 8) truck(v, hx - 8, 1, hz - 3, "x", "lime", "white");
}

// =============================================================================================
// MODULES (connected field tiles)
// =============================================================================================

function vegetableFields(c: Ctx) {
  const { v, lv, hx, hz } = c,
    kind = (["carrot", "pumpkin", "pepper", "onion"] as Veg[])[c.variant % 4];
  lot(c, "soil");
  const stage = L(c, [1, 2, 3, 3, 3]);
  veg(c, -hx, -hz, hx, hz, kind, "z", stage);
  if (lv <= 2) stake(c, -hx + 2, 0);
  if (lv >= 3) {
    // drip irrigation line + sprinkler on a spinning head
    v.box(-hx, 0, -1, hx, 1, 0, "tealDark");
    const s = new PixelVox();
    for (let i = -3; i <= 3; i++) s.put(i, 0, 0, i ? "cyan" : "steel", i ? 0.4 : 0);
    v.box(0, 1, -1, 1, 3, 0, "steel");
    c.addRotor({ vox: s, pivot: [0, 3, -1], axis: "y", speed: 1.4 });
  }
  if (lv >= 4) for (let i = 0; i < L(c, [0, 0, 0, 3, 6]); i++) crate(v, -hx + 2 + i * 3, 1, hz - 3, ["orange", "red", "yellow", "white"][c.variant % 4]);
  if (lv >= 4) person(v, Math.floor(hx / 2), 1, 3, ["orange", "red", "yellow", "white"][c.variant % 4]);
  if (lv >= 5) {
    // allotment sheds
    for (let i = 0; i < 2; i++) rshed(c, -hx + 3 + i * 18, -hz + 1, -hx + 8 + i * 18, -hz + 5, 3);
    scarecrow(v, hx - 6, 1, -hz + 4, "red");
  }
}

function grainFields(c: Ctx) {
  const { v, lv, hx, hz } = c,
    g = GRAIN[c.variant % 4];
  lot(c, "soil");
  const stage = L(c, [1, 2, 3, 3, 3]);
  grain(c, -hx, -hz, hx, hz, stage, "z");
  if (lv === 4) {
    // sheaves / stooks across the stubble half
    for (let x = -hx; x < hx; x++) for (let z = 0; z < hz; z++) if (v.v.size) v.box(x, 1, z, x + 1, 4, z + 1, null);
    for (let x = -hx; x < hx; x++) for (let z = 0; z < hz; z++) v.put(x, 1, z, (x + z) % 2 ? "goldDark" : "sandDark");
    for (let x = -hx + 2; x < hx - 2; x += 4)
      for (let z = 2; z < hz - 2; z += 4) {
        v.box(x, 2, z, x + 2, 4, z + 2, g[0]);
        v.put(x, 4, z, g[1]);
      }
  }
  if (lv === 5) {
    // harvest in progress: stubble + round bales, half still standing
    for (let x = -hx; x < hx; x++) for (let z = -hz; z < 0; z++) {
      v.box(x, 2, z, x + 1, 4, z + 1, null);
      v.put(x, 1, z, (x + z) % 3 ? "goldDark" : "sandDark");
    }
    for (let x = -hx + 3; x < hx - 3; x += 7) haybale(v, x, 2, -hz + 4 + ((x / 7) & 1) * 4, c.variant % 2 === 0);
  }
  if (lv === 2) scarecrow(v, 0, 1, 0, ["red", "blue", "orange", "purple"][c.variant % 4]);
  if (lv === 1) stake(c, 0, 0);
  if (lv >= 3 && hx >= 16) v.box(-hx, 0, -1, hx, 1, 1, "path2");
}

function orchardBlock(c: Ctx) {
  const { v, lv, hx, hz } = c,
    kind = ["apple", "peach", "orange", "cherry"][c.variant % 4];
  ground(c, "grass2");
  for (let x = -hx; x < hx; x += 8) v.box(x + 2, 0, -hz, x + 5, 1, hz, "grass3");
  const size = L(c, [0.5, 0.8, 1.0, 1.1, 1.15]);
  for (let x = -hx + 3; x < hx; x += 8)
    for (let z = -hz + 3; z < hz; z += 7) {
      if (lv === 1) {
        v.box(x + 1, 1, z, x + 2, 5, z + 1, "woodLight");
        v.box(x, 1, z, x + 1, 4, z + 1, "woodDark");
        v.put(x, 4, z, "leafLight");
        v.put(x - 1, 4, z, "leaf");
        stake(c, x + 2, z + 2);
        continue;
      }
      fruitTree(c, x, 1, z, lv === 2 ? "cherry" : kind, size);
    }
  if (lv >= 3) c.critters({ kind: "chicken", count: L(c, [0, 0, 2, 3, 4]), area: [-hx + 1, -hz + 1, hx - 1, hz - 1] });
  if (lv >= 4) {
    person(v, -hx + 6, 1, 0, "red");
    for (let k = 0; k < 5; k++) {
      v.put(-hx + 6, 1 + k, -2, "woodLight");
      v.put(-hx + 8, 1 + k, -2, "woodLight");
    }
  }
  if (lv >= 5) {
    for (let i = 0; i < 6; i++) crate(v, -hx + 2 + i * 3, 1, hz - 2, ["red", "#f6a77a", "orange", "magenta"][c.variant % 4]);
    rtractor(c, hx - 8, hz - 3, "x", -1, "crate");
  }
}

function grazingPasture(c: Ctx) {
  const { v, lv, hx, hz } = c,
    V = c.variant % 4;
  ground(c, ["grass", "#9ccf6a", "grass2", "#a9c46a"][V]);
  for (let i = 0; i < 6 + lv * 4; i++) {
    const x = c.ri(-hx + 1, hx - 2),
      z = c.ri(-hz + 1, hz - 2);
    v.put(x, 1, z, V === 2 ? (i % 2 ? "white" : "pink") : V === 1 ? "purple" : "leafDark");
  }
  const kind: CritterKind = (["cow", "sheep", "goat", "sheep"] as const)[V];
  rfence(c, -hx, -hz, hx, hz);
  c.critters({ kind, count: L(c, [2, 3, 5, 7, 10]), area: [-hx + 2, -hz + 2, hx - 2, hz - 2], coat: V === 0 ? 0 : V === 3 ? 2 : V });
  if (lv >= 2) {
    v.box(-hx + 3, 1, -hz + 3, -hx + 7, 2, -hz + 4, "woodDark");
    v.box(-hx + 4, 1, -hz + 3, -hx + 6, 2, -hz + 4, "water");
  }
  if (lv >= 3) {
    // grazing shelter
    const sx = hx - 9;
    for (const x of [sx, sx + 6]) for (const z of [-hz + 2, -hz + 6]) v.box(x, 1, z, x + 1, 5, z + 1, "woodDark");
    rroof(c, sx, 5, -hz + 2, sx + 7, -hz + 7, "x");
  }
  if (lv >= 4) {
    // strip-grazing electric wire
    for (let z = -hz + 2; z < hz - 2; z += 3) v.put(0, 1, z, "white");
    for (let z = -hz + 2; z < hz - 2; z++) v.put(0, 2, z, "#f6d55c");
  }
  if (lv >= 5) {
    rpump(c, -hx + 5, hz - 6, 12);
    rtree(c, hx - 4, hz - 4, 1.1);
  }
}

function livestockPen(c: Ctx) {
  const { v, lv, hx, hz } = c,
    V = c.variant % 4,
    rail = ["woodLight", "stone", "steelDark", "woodDark"][V];
  lot(c, "soil");
  speckle(c, "soilDark", 0.2);
  // pens subdivide as the yard grows; pigs wallow in mud, goats on a climbing mound
  const n = L(c, [1, 1, 2, 3, 4]),
    w = Math.floor((hx * 2) / n);
  for (let i = 0; i < n; i++) {
    const a = -hx + i * w,
      b = a + w,
      kind: CritterKind = i % 3 === 1 ? "goat" : i % 3 === 2 ? "sheep" : "pig";
    fence(v, a, -hz, b, hz, 1, 2, rail, [Math.floor((a + b) / 2) - 1, Math.floor((a + b) / 2) + 1]);
    if (kind === "pig") waterBlob(c, (a + b) / 2, 2, 3, 2.2, 3 + i, "", 0.5, "soilDark", "#5a3a22");
    if (kind === "goat") {
      v.box(a + 3, 1, -hz + 3, a + 8, 2, -hz + 7, "stone");
      v.box(a + 4, 2, -hz + 4, a + 7, 3, -hz + 6, "stone");
    }
    v.box(a + 1, 1, hz - 3, b - 1, 2, hz - 2, "woodDark");
    v.box(a + 2, 1, hz - 3, b - 2, 2, hz - 2, kind === "pig" ? "#c9935b" : "#e6c45c");
    c.critters({ kind, count: L(c, [2, 3, 3, 3, 3]) + (lv >= 3 ? 1 : 0), area: [a + 1, -hz + 2, b - 1, hz - 3], coat: V + i });
  }
  if (lv >= 3) {
    // handling gate / race
    v.box(-hx + 1, 1, -hz + 1, hx - 1, 2, -hz + 2, rail);
  }
  if (lv >= 5) {
    // sale-yard auction stand
    v.box(hx - 6, 1, -hz + 2, hx - 2, 5, -hz + 5, "woodDark");
    v.box(hx - 6, 5, -hz + 2, hx - 2, 6, -hz + 5, R(c).roof);
    person(v, hx - 4, 5, -hz + 4, "red");
  }
}

function chickenCoop(c: Ctx) {
  const { v, lv, hx, hz } = c,
    V = c.variant % 4,
    roof = ["redDark", "#7c9c59", "#c7a35a", "blue"][V];
  lot(c, "path2");
  speckle(c, "grass3", 0.15);
  const n = L(c, [1, 1, 2, 2, 3]);
  for (let i = 0; i < n; i++) {
    const x0 = -hx + 2 + i * 10,
      z0 = -hz + 2;
    if (x0 + 7 > hx) break;
    v.box(x0, 1, z0, x0 + 7, 2, z0 + 5, "woodDark");
    v.box(x0, 2, z0, x0 + 7, 5, z0 + 5, V === 2 ? "#e6c45c" : "woodLight");
    v.clear(x0, 1, z0 + 1, x0 + 7, 2, z0 + 4);
    v.put(x0 + 3, 3, z0 + 4, "charcoal");
    gable(v, x0 - 1, 5, z0 - 1, x0 + 8, z0 + 6, "x", roof);
    for (let k = 0; k < 3; k++) v.put(x0 + 3, 1 + Math.max(0, 1 - k), z0 + 5 + k, "wood");
    if (lv >= 3) v.box(x0 + 7, 2, z0 + 1, x0 + 9, 4, z0 + 4, "woodDark"); // nest boxes
  }
  fence(v, -hx, -hz, hx, hz, 1, 2, "woodLight", [-1, 1]);
  c.critters({ kind: "chicken", count: L(c, [3, 5, 7, 9, 12]), area: [-hx + 1, -hz + 8, hx - 1, hz - 1], coat: V });
  if (lv >= 4) c.critters({ kind: "chicken", count: 2, area: [-hx + 1, -hz + 1, hx - 1, -hz + 8], coat: V + 1 });
  if (lv >= 2) {
    cyl(v, hx - 3, hz - 3, 1, 3, 1, "steelLight");
    v.put(hx - 3, 3, hz - 3, "steel");
  }
  if (lv >= 5) domeSilo(v, hx - 4, -hz + 4, 1, 10, 1.8, "cream", roof, "steel");
}

function feedSilo(c: Ctx) {
  const { v, lv, hx, hz } = c,
    V = c.variant % 4,
    col = ["silver", "#a8502e", "cream", "#3e853b"][V];
  lot(c, "concrete2");
  const n = L(c, [1, 1, 2, 3, 4]),
    h = L(c, [8, 12, 14, 16, 18]),
    r = lv >= 3 ? 2.6 : 2.2;
  const perRow = Math.max(1, Math.floor((hx * 2 - 6) / 7)),
    rowsN = Math.ceil(n / perRow);
  for (let i = 0; i < n; i++) {
    const inRow = Math.min(perRow, n - Math.floor(i / perRow) * perRow),
      ci = i % perRow,
      cx = Math.round((ci - (inRow - 1) / 2) * 7) - 1,
      cz = rowsN > 1 ? (i < perRow ? -hz + 5 : -hz + 12) : -hz + Math.max(5, Math.floor(hz * 0.6));
    if (lv === 1) {
      // hopper bin on legs
      for (const [dx, dz] of [[-2, -2], [1, -2], [-2, 1], [1, 1]]) v.box(cx + dx, 1, cz + dz, cx + dx + 1, 4, cz + dz + 1, "steelDark");
      v.cone(cx, 3, 6, cz, 0.6, r, col);
      cyl(v, cx, cz, 6, h, r, col);
      v.cone(cx, h, h + 2, cz, r + 0.3, 0.5, "steelLight");
      continue;
    }
    cyl(v, cx, cz, 1, h, r, col);
    for (let y = 2; y < h; y += 2) ring(v, cx, cz, y, y + 1, r + 0.1, r - 0.6, V === 0 ? "steelLight" : "steelDark");
    v.cone(cx, h, h + 3, cz, r + 0.4, 0.5, V === 1 ? "terracotta" : "steelLight");
    for (let y = 2; y < h; y += 2) v.put(Math.round(cx + r), y, cz, "iron");
  }
  if (lv >= 2) {
    // auger + feed truck bay
    for (let k = 0; k < 8; k++) v.put(-hx + 4 + k, 2 + k, hz - 4, "steelLight");
    truck(v, -hx + 2, 1, hz - 3, "x", col, R(c).tractor);
    // feed piles & sacks
    for (let i = 0; i < L(c, [0, 2, 3, 4, 6]); i++) v.box(hx - 4 - i * 3, 1, hz - 3, hx - 2 - i * 3, 2 + (i % 2), hz - 1, i % 2 ? "#e6c45c" : "sand");
  }
  if (lv >= 4) {
    // elevator leg with walkway
    const lx = hx - 4;
    v.box(lx, 1, -hz + 3, lx + 2, h + 8, -hz + 5, "iron");
    v.box(lx - 1, h + 8, -hz + 2, lx + 3, h + 10, -hz + 6, "steelDark");
    v.box(-hx + 3, h + 4, -hz + 4, lx, h + 5, -hz + 5, "steelLight");
    c.blink(lx, h + 10, -hz + 3, "red");
  }
  if (lv >= 5) c.critters({ kind: "chicken", count: 3, area: [-hx + 1, 0, hx - 1, hz - 4] });
}

function irrigationPond(c: Ctx) {
  const { v, lv, hx, hz } = c,
    V = c.variant % 4,
    bank = ["#bd8866", "stone", "moss", "woodDark"][V];
  ground(c);
  const rx = hx * L(c, [0.55, 0.6, 0.6, 0.62, 0.65]),
    rz = hz * L(c, [0.55, 0.6, 0.6, 0.62, 0.65]);
  waterBlob(c, 0, 0, rx, rz, 21, bank, 0.4);
  if (V === 2) for (let i = 0; i < 10 + lv * 3; i++) {
    const a = (i / (10 + lv * 3)) * Math.PI * 2;
    v.box(Math.round(Math.cos(a) * (rx + 1)), 1, Math.round(Math.sin(a) * (rz + 1)), Math.round(Math.cos(a) * (rx + 1)) + 1, 3, Math.round(Math.sin(a) * (rz + 1)) + 1, "olive");
  }
  // ducks on the water
  c.critters({ kind: "duck", count: L(c, [2, 3, 4, 5, 7]), area: [Math.round(-rx * 0.6), Math.round(-rz * 0.6), Math.round(rx * 0.6), Math.round(rz * 0.6)], coat: V });
  if (lv >= 2) {
    // gated outlet: sluice + channel to the front edge
    v.box(-1, 0, Math.round(rz), 1, 1, hz, "water");
    v.box(-2, 1, Math.round(rz), 2, 3, Math.round(rz) + 1, V === 3 ? "woodDark" : "concrete");
    v.box(-1, 3, Math.round(rz), 1, 4, Math.round(rz) + 1, "red");
  }
  if (lv >= 3) {
    rshed(c, -hx + 1, -hz + 1, -hx + 6, -hz + 5, 3);
    rpump(c, hx - 4, -hz + 4, 10);
  }
  if (lv >= 4) {
    // settling beds
    for (let i = 0; i < 2; i++) v.box(hx - 10 + i * 4, 0, hz - 6, hx - 7 + i * 4, 1, hz - 2, "#5da6c9");
  }
  if (lv >= 5) {
    // jetty + rowboat
    v.box(-hx + 4, 1, 0, -Math.round(rx * 0.4), 2, 2, "woodLight");
    v.box(-Math.round(rx * 0.3), 1, 3, -Math.round(rx * 0.3) + 4, 2, 5, "redDark");
    lamp(v, -hx + 4, 2, 0, 4);
  }
}

function greenhouseBay(c: Ctx) {
  const { v, lv, hx, hz } = c;
  lot(c, "concrete2");
  const h = L(c, [2, 3, 4, 4, 5]);
  if (lv === 1) {
    // cold frame: low glass lids
    for (let i = 0; i < 2; i++) {
      const z0 = -hz + 3 + i * 6;
      v.box(-hx + 2, 1, z0, hx - 2, 2, z0 + 4, "woodDark");
      v.box(-hx + 3, 2, z0 + 1, hx - 3, 3, z0 + 3, "glass", 0.2);
      for (let x = -hx + 3; x < hx - 3; x += 2) v.put(x, 1, z0 + 2, "leafLight");
    }
    stake(c, hx - 2, hz - 2);
    return;
  }
  if (lv === 2) {
    // propagation benches with seed trays under a canopy
    for (let z = -hz + 2; z < hz - 2; z += 4) {
      v.box(-hx + 2, 1, z, hx - 2, 3, z + 2, "steelLight");
      for (let x = -hx + 2; x < hx - 2; x++) v.put(x, 3, z, x % 2 ? "leafLight" : "lime");
    }
    v.box(-hx + 1, 6, -hz + 1, hx - 1, 7, hz - 1, "glass", 0.15);
    for (const x of [-hx + 1, hx - 2]) for (const z of [-hz + 1, hz - 2]) v.box(x, 1, z, x + 1, 6, z + 1, ["white", "#7c9c59", "#4c82d4", "copper"][c.variant % 4]);
    return;
  }
  const bays = L(c, [1, 1, 1, 2, 3]),
    rows = hz > 8 ? 2 : 1,
    w = Math.floor((hx * 2 - 2) / bays),
    d = Math.floor((hz * 2 - 4) / rows);
  for (let i = 0; i < bays; i++)
    for (let j = 0; j < rows; j++) glassBay(c, -hx + 1 + i * w, -hz + 1 + j * d, -hx + (i + 1) * w, -hz + (j + 1) * d, h);
  if (lv >= 4) {
    const t = chimney(v, hx - 3, 1, hz - 3, 9, "brick");
    c.smoke(hx - 2, t, hz - 2, "steam");
  }
  if (lv >= 5) for (let i = 0; i < 4; i++) bush(v, -hx + 3 + i * 4, 1, hz - 2, 1, "leaf", ["pink", "yellow", "red", "purple"][i]);
}

const BUILDERS: Record<string, (c: Ctx) => void> = {
  vegetable_farm: vegetableFarm,
  grain_farm: grainFarm,
  dairy_farm: dairyFarm,
  poultry_farm: poultryFarm,
  cattle_ranch: cattleRanch,
  horse_ranch: horseRanch,
  apiary,
  vineyard,
  rice_farm: riceFarm,
  greenhouse_farm: greenhouseFarm,
  vertical_farm: verticalFarm,
  vegetable_fields: vegetableFields,
  grain_fields: grainFields,
  orchard_block: orchardBlock,
  grazing_pasture: grazingPasture,
  livestock_pen: livestockPen,
  chicken_coop: chickenCoop,
  feed_silo: feedSilo,
  irrigation_pond: irrigationPond,
  greenhouse_bay: greenhouseBay,
};

const GROWTH: Record<string, string> = {
  vegetable_farm: "Raised beds by a shed grow into a homestead with crop strips, a packing shed, windpump and a market co-op of awning stalls.",
  grain_farm: "A croft in the wheat gains a barn, regional storage towers, combines and grain bins, then a concrete elevator and pivot irrigation.",
  dairy_farm: "A milking shed with two cows becomes a parlor with paddocks of grazing herd, milk tanks, silos, a tanker and a creamery.",
  poultry_farm: "One henhouse becomes rows of laying houses with free-range yards of wandering hens, a feed silo, egg truck and duck pond.",
  cattle_ranch: "A stock yard opens into a fenced range of roaming beef cattle, sorting pens, windpump, loading chute and a branded gateway.",
  horse_ranch: "A loose box becomes a long stable with clock cupola, paddocks of grazing horses and a jumping arena.",
  apiary: "Hives in a flower meadow multiply, with bees buzzing everywhere, an extraction hut and a glass research dome.",
  vineyard: "Trellis rows spread from a press house to an estate villa with barrels, sheep mowing the rows and a tasting terrace.",
  rice_farm: "One paddy becomes a grid of flooded fields patrolled by ducks, a waterwheel and finally terraces stepping up the slope.",
  greenhouse_farm: "A glass shed multiplies into a range of glasshouses with boilers, steam and solar arrays.",
  vertical_farm: "A grow room stacks floor upon glowing floor into a sky harvest tower with a rooftop turbine.",
  vegetable_fields: "Seed beds sprout into full rows with drip lines and a spinning sprinkler, then crates, pickers and allotment sheds.",
  grain_fields: "Sown strips turn green, then golden, then stand in sheaves before round bales mark the harvest.",
  orchard_block: "Staked whips flower, then hang with fruit; hens forage underneath, ladders and crates arrive for picking.",
  grazing_pasture: "A paddock of grazing animals gains a trough, a shelter, strip-grazing wire and a windpump.",
  livestock_pen: "One pen of pigs splits into pig wallows, goat mounds and sheep folds with a sale-yard auction stand.",
  chicken_coop: "A nest box grows into a colony of coops with nest boxes, feeders and lots of busy hens.",
  feed_silo: "A hopper bin becomes a row of tall silos with an auger, feed truck and an elevator leg.",
  irrigation_pond: "A catch pond with ducks gains a sluice, a pump house, settling beds and a jetty.",
  greenhouse_bay: "Cold frames become propagation benches, then glass bays with heated boilers.",
};

defineDesigns(
  Object.fromEntries(
    EXPANSION_ELEMENTS.filter((d) => d.category === "agriculture").map((d) => [
      d.id,
      {
        ...CAMPUS_FARM_ART[d.id],
        growth: GROWTH[d.id] ?? CAMPUS_FARM_ART[d.id].levels.join(" → "),
        build: BUILDERS[d.id] ?? vegetableFarm,
      },
    ]),
  ),
);
