/**
 * Handcrafted procedural 3D voxel designs for the 24 balanced catalog expansion elements.
 * Every element features distinct 5-level growth, 4 visual styles, and terrain/water-grounded
 * construction with no meaningless full-parcel flat platform slabs.
 */
import {
  type Ctx,
  archway,
  awning,
  balconies,
  band,
  barrelRoof,
  bench,
  bush,
  chimney,
  clockFace,
  colonnade,
  column,
  crane,
  curtainWall,
  cyl,
  door,
  fence,
  flatRoof,
  flowerBed,
  fountain,
  gable,
  hedge,
  helipad,
  hip,
  lamp,
  mansard,
  pave,
  pediment,
  person,
  ring,
  rocks,
  sawtooth,
  solarRow,
  spire,
  stairs,
  tank,
  tree,
  windows,
} from "./kit";
import {
  deckhouse,
  funnel,
  hull,
  mast,
  pier,
  portholes,
  quayFoundation,
  radar,
  squareSail,
  turret,
  wake,
} from "./vehicles";
import { defineDesigns, type DesignEntry } from "./registry";
import { BALANCED_EXPANSION_BY_ID } from "../expansionBalancedCatalog";
import { PixelVox } from "../voxelCore";

function entry(id: string, build: (c: Ctx) => void): DesignEntry {
  const meta = BALANCED_EXPANSION_BY_ID[id];
  return {
    footprints: meta.footprints,
    levels: meta.levelNames,
    growth: meta.growth,
    build,
  };
}

/** Tight local stone/concrete footing directly underneath a structure (never full-parcel). */
function footing(c: Ctx, x0: number, z0: number, x1: number, z1: number, col = "granite"): void {
  c.v.box(x0, 0, z0, x1, 1, z1, col);
}

/** Create and attach an animated rotor sub-voxel mesh at pivot (x, y, z). */
function spin(c: Ctx, x: number, y: number, z: number, axis: "x" | "y" | "z", speed: number): PixelVox {
  const vox = new PixelVox(c.v.seed);
  c.addRotor({ vox, pivot: [x, y, z], axis, speed });
  return vox;
}

defineDesigns({
  // 1. rowhouse_duplex — Cozy mirrored twin-porch duplexes
  rowhouse_duplex: entry("rowhouse_duplex", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    const walls = ["cream", "slateLight", "brick", "#c7d8c5"];
    const roofs = ["terracotta", "slate", "charcoal", "woodDark"];
    const trims = ["wood", "white", "cream", "white"];
    const wall = walls[s];
    const roof = roofs[s];
    const trim = trims[s];

    const x0 = -hx + 2;
    const x1 = hx - 2;
    const z0 = -hz + 3;
    const z1 = hz - 4;
    const floors = lv === 1 ? 1 : lv <= 3 ? 2 : 3;
    const top = 1 + floors * 4;

    footing(c, x0, z0, x1, z1, "stone");
    // Twin side-by-side bays divided by center party wall
    v.box(x0, 1, z0, x1, top, z1, wall);
    v.clear(x0 + 1, 1, z0 + 1, x1 - 1, top - 1, z1 - 1);
    v.box(0, 1, z0, 0, top, z1, trim); // center party divider

    // Mirrored twin doors & front porches
    const midL = Math.floor((x0 + 0) / 2);
    const midR = Math.ceil((0 + x1) / 2);
    door(v, midL - 1, 1, z1, "woodDark", 2, 3, true);
    door(v, midR, 1, z1, "woodDark", 2, 3, true);
    // Raised twin wooden porch decks
    v.box(x0 + 1, 0, z1 + 1, x1 - 1, 1, z1 + 2, "wood");
    v.box(x0 + 1, 4, z1 + 1, x1 - 1, 4, z1 + 2, roof);
    v.box(x0 + 1, 1, z1 + 2, x0 + 1, 4, z1 + 2, trim);
    v.box(0, 1, z1 + 2, 0, 4, z1 + 2, trim);
    v.box(x1 - 1, 1, z1 + 2, x1 - 1, 4, z1 + 2, trim);

    windows(c, x0, 2, z0, x1, top, z1, { stepH: 3, stepV: 4, h: 2, emit: 0.45 });
    const peak = gable(v, x0 - 1, top, z0 - 1, x1 + 1, z1 + 1, "x", roof, trim);
    const ch = chimney(v, 0, peak - 1, Math.floor((z0 + z1) / 2), 4, "brick", 2, "charcoal");
    if (lv >= 2) c.smoke(0, ch, Math.floor((z0 + z1) / 2), "smoke");

    // Organic front stepping stones and flower boxes
    pave(v, midL - 1, z1 + 3, midL, hz - 1, "path");
    pave(v, midR, z1 + 3, midR + 1, hz - 1, "path");
    flowerBed(c, x0, z1 + 3, x0 + 1, z1 + 3, 1);
    flowerBed(c, x1 - 1, z1 + 3, x1, z1 + 3, 1);
    if (lv >= 4) {
      tree(v, -hx + 1, 1, -hz + 1, "round", 0.9, c.v.seed);
      tree(v, hx - 2, 1, -hz + 1, "round", 0.85, c.v.seed + 3);
    }
  }),

  // 2. courtyard_villa — Sunlit walled Mediterranean villa around an inner fountain courtyard
  courtyard_villa: entry("courtyard_villa", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    const walls = ["sandDark", "white", "sand", "cream"];
    const roofs = ["terracotta", "blue", "sandDark", "woodDark"];
    const trim = ["cream", "sky", "gold", "wood"][s];
    const wall = walls[s];
    const roof = roofs[s];

    const x0 = -hx + 2;
    const x1 = hx - 2;
    const z0 = -hz + 2;
    const z1 = hz - 2;
    const hMain = 5 + Math.min(3, lv) * 3;
    const wingW = Math.max(4, Math.floor((x1 - x0) * 0.28));
    const backD = Math.max(5, Math.floor((z1 - z0) * 0.34));

    // North main wing
    footing(c, x0, z0, x1, z0 + backD, "stone");
    v.box(x0, 1, z0, x1, hMain, z0 + backD, wall);
    v.clear(x0 + 1, 1, z0 + 1, x1 - 1, hMain - 1, z0 + backD - 1);
    hip(v, x0 - 1, hMain, z0 - 1, x1 + 1, z0 + backD + 1, roof, trim, 4);
    windows(c, x0, 2, z0, x1, hMain, z0 + backD, { stepH: 3, stepV: 4, h: 2, emit: 0.4 });

    // East & West flanking cloister wings
    const sideH = Math.max(5, hMain - 3);
    footing(c, x0, z0 + backD, x0 + wingW, z1, "stone");
    footing(c, x1 - wingW, z0 + backD, x1, z1, "stone");
    v.box(x0, 1, z0 + backD, x0 + wingW, sideH, z1 - 1, wall);
    v.box(x1 - wingW, 1, z0 + backD, x1, sideH, z1 - 1, wall);
    hip(v, x0 - 1, sideH, z0 + backD, x0 + wingW + 1, z1, roof, trim, 3);
    hip(v, x1 - wingW - 1, sideH, z0 + backD, x1 + 1, z1, roof, trim, 3);

    // Front garden entry wall with arched gate
    if (lv >= 2) {
      v.box(x0 + wingW, 1, z1 - 1, x1 - wingW, 4, z1 - 1, wall);
      archway(v, 0, 1, z1 - 2, z1, 4, 3, trim);
    }

    // Inner tiled courtyard with fountain & cypress trees
    const cx0 = x0 + wingW + 1;
    const cx1 = x1 - wingW - 1;
    const cz0 = z0 + backD + 1;
    const cz1 = z1 - 2;
    if (cx1 > cx0 + 2 && cz1 > cz0 + 2) {
      pave(v, cx0, cz0, cx1, cz1, "path");
      fountain(v, 0, 1, Math.floor((cz0 + cz1) / 2), Math.min(3, Math.floor((cx1 - cx0) / 3)), trim);
      if (lv >= 3) {
        tree(v, cx0 + 1, 1, cz0 + 1, "cypress", 1.1, c.v.seed);
        tree(v, cx1 - 1, 1, cz0 + 1, "cypress", 1.1, c.v.seed + 5);
      }
      if (lv >= 4) {
        // Timber pergola over inner courtyard edge
        colonnade(v, cx0 + 1, cx1 - 1, cz0, 1, 5, "x", 3, trim, trim);
        v.box(cx0, 5, cz0, cx1, 5, cz0 + 1, "wood");
      }
    }
  }),

  // 3. mixed_use_midrise — Ground-floor shops + terraced brick-and-glass apartments
  mixed_use_midrise: entry("mixed_use_midrise", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    const upperWall = ["brick", "cream", "wood", "slateLight"][s];
    const baseWall = ["granite", "marbleShade", "stone", "charcoal"][s];
    const awnA = ["crimson", "teal", "orange", "blue"][s];
    const roofCol = ["slate", "charcoal", "terracotta", "steelDark"][s];

    const x0 = -hx + 2;
    const x1 = hx - 2;
    const z0 = -hz + 2;
    const z1 = hz - 3;
    const floors = 1 + lv;
    const top = 5 + floors * 4;

    footing(c, x0, z0, x1, z1, "concreteDark");
    // Ground-floor commercial podium
    v.box(x0, 1, z0, x1, 5, z1, baseWall);
    v.box(x0 + 1, 2, z1, x1 - 1, 4, z1, "warmGlow", 0.72);
    door(v, -1, 1, z1, "woodDark", 2, 3, false);
    awning(v, x0 + 1, x1 - 1, 5, z1 + 1, awnA, "white");

    // Upper residential stories with setback at higher levels
    const splitY = lv >= 4 ? top - 6 : top;
    v.box(x0, 6, z0, x1, splitY, z1, upperWall);
    v.clear(x0 + 1, 6, z0 + 1, x1 - 1, splitY - 1, z1 - 1);
    band(v, x0, 5, z0, x1, z1, "marble", 0);
    windows(c, x0, 7, z0, x1, splitY - 1, z1, { stepH: 3, stepV: 4, h: 2, emit: 0.45 });
    balconies(c, x0 + 2, x1 - 2, 9, splitY - 2, z1 + 1, 4, "concrete", "iron");

    if (lv >= 4) {
      const inset = 2;
      v.box(x0 + inset, splitY + 1, z0 + inset, x1 - inset, top, z1 - inset, upperWall);
      windows(c, x0 + inset, splitY + 2, z0 + inset, x1 - inset, top - 1, z1 - inset, {
        stepH: 3,
        stepV: 4,
        h: 2,
        emit: 0.55,
      });
      flatRoof(c, x0 + inset, top, z0 + inset, x1 - inset, z1 - inset, roofCol, "marble", true);
      // Planted terrace edge
      hedge(v, x0 + 1, z1 - 1, x1 - 1, z1 - 1, splitY + 1, 2, "leaf");
    } else {
      flatRoof(c, x0, splitY, z0, x1, z1, roofCol, "marble", true);
    }
    pave(v, x0, z1 + 1, x1, hz - 1, "concrete2");
    lamp(v, x0 + 1, 1, hz - 1, 5);
    person(v, 2, 1, hz - 1, awnA, "blueDark");
  }),

  // 4. penthouse_tower — Sculpted setback luxury residential spire with sky gardens
  penthouse_tower: entry("penthouse_tower", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    const stone = ["cream", "marble", "charcoal", "white"][s];
    const glass = ["glass", "cyan", "gold", "teal"][s];
    const accent = ["gold", "silver", "brass", "leaf"][s];

    const x0 = -hx + 2;
    const x1 = hx - 2;
    const z0 = -hz + 2;
    const z1 = hz - 2;
    const h1 = 10 + lv * 5;
    const h2 = h1 + 8 + lv * 3;
    const h3 = h2 + 6 + lv * 2;

    footing(c, x0, z0, x1, z1, "marbleShade");
    // Base tower shaft
    v.box(x0, 1, z0, x1, h1, z1, stone);
    curtainWall(c, x0, 2, z0, x1, h1 - 1, z1, glass, stone, 3, 4);
    door(v, -1, 1, z1, "gold", 3, 4, true);

    // Mid setback with planted sky terrace
    const m = Math.min(2, Math.floor((x1 - x0) / 5));
    if (x1 - m > x0 + m + 3 && z1 - m > z0 + m + 3) {
      hedge(v, x0 + 1, z0 + 1, x1 - 1, z1 - 1, h1 + 1, 2, "leaf");
      v.box(x0 + m, h1 + 1, z0 + m, x1 - m, h2, z1 - m, stone);
      curtainWall(c, x0 + m, h1 + 2, z0 + m, x1 - m, h2 - 1, z1 - m, glass, accent, 3, 4);

      // Crown penthouse lantern
      const k = m + 2;
      if (lv >= 3 && x1 - k > x0 + k + 2 && z1 - k > z0 + k + 2) {
        v.box(x0 + k, h2 + 1, z0 + k, x1 - k, h3, z1 - k, glass, 0.55);
        band(v, x0 + k, h2 + 1, z0 + k, x1 - k, z1 - k, accent, 0);
        band(v, x0 + k, h3, z0 + k, x1 - k, z1 - k, accent, 0);
        if (lv >= 5 && x1 - k - (x0 + k) >= 8) {
          helipad(v, 0, h3 + 1, 0, 3);
        } else {
          spire(v, 0, 0, h3 + 1, 6 + lv, 1.4, accent, "warmGlow");
        }
        c.blink(0, h3 + (lv >= 5 ? 2 : 7 + lv), 0, "red");
      } else {
        flatRoof(c, x0 + m, h2, z0 + m, x1 - m, z1 - m, "slate", accent, false);
      }
    }
  }),

  // 5. tram_station — Arched iron-and-timber streetcar stop with parked vintage tram
  tram_station: entry("tram_station", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    const tramCol = ["crimson", "teal", "cream", "silver"][s];
    const trimCol = ["gold", "white", "woodDark", "blue"][s];

    const x0 = -hx + 1;
    const x1 = hx - 1;
    // Recessed steel rails running along X at z = 2..4
    pave(v, x0, 1, x1, 5, "granite");
    v.box(x0, 1, 2, x1, 1, 2, "steelLight");
    v.box(x0, 1, 4, x1, 1, 4, "steelLight");

    // Raised boarding platform along z = -4..0
    const px0 = -hx + 2;
    const px1 = hx - 2;
    v.box(px0, 0, -4, px1, 1, 0, "stone");
    v.box(px0, 1, 0, px1, 1, 0, "yellow"); // safety tactile strip

    // Iron canopy columns & arched barrel shelter
    colonnade(v, px0 + 1, px1 - 1, -3, 2, 7, "x", 4, "iron", trimCol);
    if (lv >= 2) {
      barrelRoof(v, px0, 7, -4, px1, 1, "x", "glass", "iron");
    } else {
      v.box(px0, 7, -4, px1, 7, 0, "woodDark");
    }

    // Overhead catenary wire & gantry poles
    v.box(px0 + 1, 1, 5, px0 + 1, 9, 5, "iron");
    v.box(px1 - 1, 1, 5, px1 - 1, 9, 5, "iron");
    v.box(px0 + 1, 9, -3, px0 + 1, 9, 5, "iron");
    v.box(px1 - 1, 9, -3, px1 - 1, 9, 5, "iron");
    v.box(x0, 8, 3, x1, 8, 3, "steelDark"); // overhead trolley wire

    // Vintage parked electric streetcar on the tracks
    const tx0 = Math.max(x0 + 1, -5 - lv);
    const tx1 = Math.min(x1 - 1, 5 + lv);
    v.box(tx0, 2, 2, tx1, 5, 4, tramCol);
    v.box(tx0 + 1, 3, 2, tx1 - 1, 4, 4, "warmGlow", 0.55);
    v.box(tx0 + 1, 6, 2, tx1 - 1, 6, 4, "cream");
    // Pantograph reaching the overhead wire
    v.put(0, 7, 3, "iron");
    v.box(-1, 8, 3, 1, 8, 3, "iron");
    v.put(tx1, 2, 3, "warmGlow", 1.2); // headlight

    if (lv >= 3) {
      clockFace(v, 0, 9, -4, 1, "white", "black");
    }
    bench(v, px0 + 2, 2, -2, "x", "wood");
    lamp(v, px1 - 2, 2, -2, 4);
    person(v, 0, 2, -1, trimCol, "blueDark");
  }),

  // 6. harbor_tugboat — Chunky harbor tug with tire fenders, pilot house & smoking funnel
  harbor_tugboat: entry("harbor_tugboat", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    const hullCol = ["crimson", "blueDark", "orange", "leafDark"][s];
    const cabinCol = ["cream", "white", "cream", "white"][s];

    const beam = Math.min(hx - 2, 4 + Math.floor(lv / 2));
    const len = Math.min(hz - 2, 7 + lv * 2);
    const opts = {
      cx: 0,
      z0: -len,
      z1: len,
      beam,
      h: 4,
      bow: Math.max(3, Math.floor(len * 0.4)),
      stern: 2,
      col: hullCol,
      bottom: "redDark",
      water: 1,
      deck: "woodDark",
      bulwark: hullCol,
    };
    const deckY = hull(v, opts);
    portholes(v, opts, deckY - 1, 3, "warmGlow", 0.5);

    // Rubber tire fenders around hull sides
    for (let z = -len + 3; z <= len - 3; z += 3) {
      v.put(-beam, deckY - 1, z, "black");
      v.put(beam, deckY - 1, z, "black");
    }

    // Raised pilothouse forward of midships
    const dhTop = deckY + 4;
    deckhouse(c, -beam + 2, deckY, -2, beam - 2, dhTop, Math.max(2, Math.floor(len * 0.45)), cabinCol, "glass", "charcoal");
    // Tug funnel with active smoke puff
    const fTop = funnel(c, 0, -Math.max(2, Math.floor(len * 0.25)), deckY, 5 + lv, 1.3, hullCol, "yellow", "smoke");
    // Towing bitt & fire monitor nozzle on upper levels
    v.box(-1, deckY, -len + 3, 1, deckY + 2, -len + 4, "steelDark");
    if (lv >= 3) {
      v.box(-1, dhTop + 1, 2, 1, dhTop + 2, 4, "gold"); // fire monitor cannon
      radar(c, 0, dhTop + 2, 0, 4, "white", 2.0);
    }
    if (lv >= 4) {
      mast(v, 0, fTop, -2, 4, "white", 2);
    }
    c.bob();
    wake(v, 0, -len - 1, beam, 4, -hz + 1);
  }),

  // 7. coastal_corvette — Faceted stealth coastal warship with turret, radar mast & helideck
  coastal_corvette: entry("coastal_corvette", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    const hullCol = ["steelDark", "silver", "slate", "charcoal"][s];
    const deckCol = ["slate", "concreteDark", "charcoal", "black"][s];

    const beam = Math.min(hx - 2, 4 + Math.floor(lv / 2));
    const len = Math.min(hz - 1, 9 + lv * 2);
    const opts = {
      cx: 0,
      z0: -len,
      z1: len,
      beam,
      h: 4 + (lv >= 4 ? 1 : 0),
      bow: Math.max(4, Math.floor(len * 0.55)),
      stern: 1,
      col: hullCol,
      bottom: "crimson",
      water: 1,
      deck: deckCol,
      bulwark: hullCol,
    };
    const deckY = hull(v, opts);
    // Faceted stealth superstructure
    const superZ0 = -Math.floor(len * 0.2);
    const superZ1 = Math.floor(len * 0.45);
    const sTop = deckY + 4 + Math.floor(lv / 2);
    deckhouse(c, -beam + 2, deckY, superZ0, beam - 2, sTop, superZ1, hullCol, "cyan", deckCol);
    // Forward deck turret
    turret(v, 0, deckY, Math.floor(len * 0.65), 2, 1, 4, 1, hullCol, "black");
    // Stealth radar pyramid & spinning radar bar
    v.box(-1, sTop, superZ0 + 1, 1, sTop + 4 + lv, superZ0 + 3, hullCol);
    radar(c, 0, sTop + 5 + lv, superZ0 + 2, 5, "silver", 2.6);
    c.blink(0, sTop + 6 + lv, superZ0 + 2, "red");

    // Aft helideck markings
    const heliZ = -Math.floor(len * 0.62);
    v.box(-beam + 2, deckY, heliZ - 2, beam - 2, deckY + 1, heliZ + 2, "charcoal");
    v.box(-1, deckY, heliZ - 1, 1, deckY + 1, heliZ + 1, "yellow");
    if (lv >= 3) {
      // VLS missile cells forward of bridge
      v.box(-1, deckY, superZ1 + 1, 1, deckY + 2, superZ1 + 3, "steelLight");
    }
    c.bob();
    wake(v, 0, -len - 1, beam, 4, -hz + 1);
  }),

  // 8. shoreline_overlook — Cantilevered coastal promontory deck & brass viewing telescope
  shoreline_overlook: entry("shoreline_overlook", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    const timber = ["wood", "stone", "sand", "marble"][s];
    const rail = ["woodDark", "iron", "woodLight", "marbleShade"][s];

    const x0 = -hx + 2;
    const x1 = hx - 2;
    const z0 = -hz + 2;
    const z1 = hz - 2;

    // Natural rocky cliff base on landward side
    v.box(x0 + 1, 0, z0, x1 - 1, 2, 0, "stone");
    rocks(c, x0 + 2, 1, z0 + 1, 3, "granite");
    rocks(c, x1 - 2, 1, z0 + 1, 3, "stone");

    // Timber viewing platform cantilevered toward +z (auto-oriented toward water!)
    const deckY = 3;
    v.box(x0 + 1, deckY, -1, x1 - 1, deckY, z1 - 1, timber);
    // Angled support pilings beneath cantilevered deck
    for (const px of [x0 + 2, 0, x1 - 2]) {
      v.box(px, 0, z1 - 2, px, deckY - 1, z1 - 2, "woodDark");
      v.box(px, 0, 0, px, deckY - 1, 0, "woodDark");
    }
    // Safety railings along seaward edge
    fence(v, x0 + 1, z1 - 1, x1 - 1, z1 - 1, deckY + 1, 2, rail);
    fence(v, x0 + 1, -1, x0 + 1, z1 - 1, deckY + 1, 2, rail);
    fence(v, x1 - 1, -1, x1 - 1, z1 - 1, deckY + 1, 2, rail);

    // Brass binocular / telescope pedestal looking out over the sea
    v.box(0, deckY + 1, z1 - 2, 0, deckY + 3, z1 - 2, "iron");
    v.box(0, deckY + 4, z1 - 2, 0, deckY + 4, z1 - 1, "brass");

    // Scenic stone steps, benches, coastal pines & optional belvedere pergola
    stairs(v, -2, 2, 0, -2, 3, "stone", 1);
    bench(v, x0 + 2, deckY + 1, 1, "z", "wood");
    tree(v, x0 + 1, 2, z0 + 1, "pine", 1.15, c.v.seed);
    if (lv >= 2) tree(v, x1 - 1, 2, z0 + 1, "pine", 1.0, c.v.seed + 7);
    if (lv >= 3) {
      // Shaded timber pergola over rear of deck
      colonnade(v, x0 + 2, x1 - 2, 0, deckY + 1, deckY + 6, "x", 4, rail, timber);
      v.box(x0 + 1, deckY + 6, -1, x1 - 1, deckY + 6, 2, timber);
    }
    if (lv >= 4) {
      lamp(v, x0 + 2, deckY + 1, z1 - 2, 4, "iron", "warmGlow");
      lamp(v, x1 - 2, deckY + 1, z1 - 2, 4, "iron", "warmGlow");
    }
    person(v, 2, deckY + 1, z1 - 3, "teal", "blueDark");
  }),

  // 9. tidal_turbine_array — Offshore marine-current pylons with rotating underwater/surface turbines
  tidal_turbine_array: entry("tidal_turbine_array", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    const pylonCol = ["white", "yellow", "steelLight", "teal"][s];
    const bladeCol = ["cyan", "white", "gold", "sky"][s];

    const count = Math.min(3, 1 + Math.floor(lv / 2));
    const xs = count === 1 ? [0] : count === 2 ? [-hx + 5, hx - 5] : [-hx + 4, 0, hx - 4];

    for (const px of xs) {
      // Concrete seabed collar & aerodynamic marine pylon
      cyl(v, px, 0, 0, 2, 2.2, "concreteDark");
      cyl(v, px, 0, 2, 8 + lv, 1.3, pylonCol);
      // Nacelle housing just above waterline
      v.box(px - 1, 3, -3, px + 1, 5, 3, "steelDark");
      // Animated tidal rotor spinning around Z axis (facing coastal current)
      const rotor = spin(c, px, 4, 4, "z", 2.4 + (px % 2) * 0.2);
      rotor.box(-1, -1, 0, 1, 1, 1, "gold");
      rotor.box(-3, 0, 0, 4, 1, 1, bladeCol);
      rotor.box(0, -3, 0, 1, 4, 1, bladeCol);
      // Top navigation lantern
      c.blink(px, 9 + lv, 0, "amber");
    }

    // Elevated steel maintenance catwalk linking the pylons at Lv2+
    if (count > 1) {
      v.box(xs[0], 6, -1, xs[xs.length - 1], 6, 1, "steelLight");
      v.box(xs[0], 7, -1, xs[xs.length - 1], 7, -1, "iron");
      v.box(xs[0], 7, 1, xs[xs.length - 1], 7, 1, "iron");
    }
    if (lv >= 4) {
      // Compact transformer pod on central pylon
      v.box(-2, 7, -2, 2, 10, 2, "concrete");
      v.box(-1, 8, 2, 1, 9, 2, "cyan", 0.8);
    }
  }),

  // 10. recycling_center — Clean color-coded materials recovery & sorting plant
  recycling_center: entry("recycling_center", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    const wall = ["leaf", "steelLight", "wood", "concrete"][s];
    const roof = ["slate", "blue", "leafDark", "steelDark"][s];

    const x0 = -hx + 2;
    const x1 = hx - 2;
    const z0 = -hz + 2;
    const z1 = Math.max(1, hz - 5);
    const h = 6 + lv * 2;

    footing(c, x0, z0, x1, z1, "concreteDark");
    // Main sorting hall with sawtooth skylight roof
    v.box(x0, 1, z0, x1, h, z1, wall);
    v.clear(x0 + 1, 1, z0 + 1, x1 - 1, h - 1, z1 - 1);
    sawtooth(v, x0, h, z0, x1, z1, roof, "glass", 4);
    // Wide loading bay openings
    v.clear(x0 + 2, 1, z1, x0 + 5, 4, z1);
    if (x1 - x0 >= 12) v.clear(x1 - 5, 1, z1, x1 - 2, 4, z1);

    // Color-coded recycling drop-off bins & neatly baled material stacks in front yard
    const yardZ = Math.min(hz - 2, z1 + 3);
    pave(v, x0, z1 + 1, x1, yardZ + 1, "concrete2");
    const binCols = ["blue", "leaf", "gold", "orange"];
    for (let i = 0; i < 4; i++) {
      const bx = x0 + 1 + i * Math.max(2, Math.floor((x1 - x0 - 2) / 4));
      if (bx + 1 <= x1 - 1) {
        v.box(bx, 1, yardZ, bx + 1, 3, yardZ, binCols[i]);
      }
    }
    // Solar panels on roof at Lv3+
    if (lv >= 3 && x1 - x0 >= 10) {
      solarRow(v, x0 + 2, x1 - 2, h + 2, z0 + 2, 3);
    }
    // Elevated sorting conveyor chute at Lv4+
    if (lv >= 4) {
      v.box(x0 + 1, 4, z1 + 1, x0 + 3, 5, yardZ - 1, "silver");
    }
  }),

  // 11. compost_works — Aerated organic windrows + domed biogas digesters
  compost_works: entry("compost_works", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    const domeCol = ["wood", "leaf", "copper", "white"][s];
    const trimCol = ["woodDark", "stone", "brass", "steelLight"][s];

    const x0 = -hx + 2;
    const x1 = hx - 2;
    const z0 = -hz + 2;
    const z1 = hz - 2;

    // Aerated organic compost windrows in low timber bays
    const rowX1 = Math.min(0, x0 + 6);
    for (let rz = z0 + 1; rz <= z1 - 2; rz += 4) {
      v.box(x0, 1, rz, rowX1, 2, rz + 2, "woodDark");
      v.box(x0 + 1, 1, rz + 1, rowX1 - 1, 3, rz + 1, "soil");
      if (lv >= 2) c.smoke(Math.floor((x0 + rowX1) / 2), 3, rz + 1, "steam");
    }

    // Geodesic anaerobic biogas digester dome(s)
    const cx = Math.max(2, Math.floor((rowX1 + x1) / 2));
    const r = Math.min(4.5, Math.max(2.5, (x1 - rowX1) * 0.36));
    cyl(v, cx, -1, 0, 4 + lv, r, "concrete");
    v.dome(cx, 4 + lv, -1, r, domeCol);
    // Steel biogas pipe leading to compact co-gen turbine shed
    v.box(cx - 1, 2, Math.ceil(r) - 1, cx - 1, 3, z1 - 3, trimCol);
    if (lv >= 2) {
      const sx0 = Math.max(1, cx - 3);
      const sx1 = Math.min(x1, cx + 3);
      footing(c, sx0, z1 - 4, sx1, z1 - 1, "concreteDark");
      v.box(sx0, 1, z1 - 4, sx1, 5, z1 - 1, trimCol);
      flatRoof(c, sx0, 5, z1 - 4, sx1, z1 - 1, "slate", "steelLight", false);
      v.put(sx1, 3, z1 - 2, "gold", 0.9);
    }
    if (lv >= 4 && z1 - z0 >= 14) {
      cyl(v, cx, z0 + 3, 0, 5, Math.max(2, r - 1), "concrete");
      v.dome(cx, 5, z0 + 3, Math.max(2, r - 1), domeCol);
    }
  }),

  // 12. spring_house — Stone-vaulted natural spring pavilion with bubbling basin
  spring_house: entry("spring_house", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    const stone = ["stone", "wood", "marble", "slateLight"][s];
    const roof = ["leafDark", "woodDark", "terracotta", "slate"][s];

    // Clear turquoise spring basin recessed at front
    v.box(-4, 0, 1, 4, 1, 5, stone);
    v.box(-3, 0, 2, 3, 0, 4, "water", 0.35);

    // Arched stone spring house sheltering the source
    footing(c, -4, -5, 4, 1, "granite");
    v.box(-4, 1, -5, 4, 5 + lv, 1, stone);
    v.clear(-3, 1, -4, 3, 4 + lv, 0);
    archway(v, 0, 1, 0, 2, 4, 4, "granite");
    // Copper water spout pouring into the basin
    v.box(0, 2, 0, 0, 2, 2, "copper");
    v.box(0, 1, 2, 0, 1, 2, "water", 0.5);

    gable(v, -5, 5 + lv, -6, 5, 2, "z", roof, "woodDark");
    // Mossy boulders & ferns framing the spring
    rocks(c, -5, 1, 2, 2, "stone");
    rocks(c, 5, 1, 2, 2, "granite");
    bush(v, -5, 1, -4, 1.3, "leaf");
    bush(v, 5, 1, -4, 1.3, "leafDark");
    if (lv >= 3) {
      lamp(v, 5, 1, 4, 4, "iron", "warmGlow");
    }
  }),

  // 13. tidal_sluice — Twin masonry winch towers & steel sluice gate spanning coastal water
  tidal_sluice: entry("tidal_sluice", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    const masonry = ["stone", "brick", "concrete", "steelDark"][s];
    const gateCol = ["steelDark", "iron", "steelLight", "teal"][s];
    const capCol = ["slate", "terracotta", "concreteDark", "copper"][s];

    const x0 = -hx + 1;
    const x1 = hx - 1;
    const towerW = Math.max(3, Math.floor((x1 - x0) * 0.22));
    const h = 8 + lv * 2;

    // Left & right masonry winch gatehouse piers
    quayFoundation(v, x0, -3, x0 + towerW, 3, "granite");
    quayFoundation(v, x1 - towerW, -3, x1, 3, "granite");
    v.box(x0, 1, -3, x0 + towerW, h, 3, masonry);
    v.box(x1 - towerW, 1, -3, x1, h, 3, masonry);
    hip(v, x0 - 1, h, -4, x0 + towerW + 1, 4, capCol, "iron", 3);
    hip(v, x1 - towerW - 1, h, -4, x1 + 1, 4, capCol, "iron", 3);

    // Steel sluice gate leaf & overhead walkway bridge spanning between piers
    const gx0 = x0 + towerW + 1;
    const gx1 = x1 - towerW - 1;
    if (gx1 >= gx0) {
      v.box(gx0, 0, -1, gx1, 4, 1, gateCol);
      // Geared hoist chains & high catwalk bridge
      v.box(gx0, h - 2, -2, gx1, h - 1, 2, "steelLight");
      v.box(gx0, h, -2, gx1, h, -2, "iron");
      v.box(gx0, h, 2, gx1, h, 2, "iron");
      for (let x = gx0 + 1; x <= gx1 - 1; x += 3) {
        v.box(x, 4, 0, x, h - 2, 0, "iron");
      }
    }
    // Navigation beacons on both towers
    c.blink(x0 + 1, h + 3, 0, "green");
    c.blink(x1 - 1, h + 3, 0, "red");
  }),

  // 14. tidal_pool_walk — Natural basalt rock tide pools linked by weathered cedar boardwalks
  tidal_pool_walk: entry("tidal_pool_walk", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    const rockCol = ["granite", "marbleShade", "sand", "stone"][s];
    const deckCol = ["wood", "woodLight", "woodDark", "wood"][s];

    const x0 = -hx + 2;
    const x1 = hx - 2;
    const z0 = -hz + 2;
    const z1 = hz - 2;

    // Organic curved basalt ledges cradling shallow turquoise tide pools
    ring(v, -2, 1, 0, 1, Math.min(5, hx - 2), Math.max(2, hx - 5), rockCol);
    cyl(v, -2, 1, 0, 0, Math.max(2, hx - 5), "water", 0.35);
    if (lv >= 2) {
      ring(v, 3, -2, 0, 1, Math.min(4, hx - 3), 2, rockCol);
      cyl(v, 3, -2, 0, 0, 2, "cyan", 0.35);
    }
    // Starfish & sea-anemone color specks inside the tide pools
    v.put(-2, 0, 1, "orange", 0.4);
    v.put(-1, 0, 2, "pink", 0.4);
    if (lv >= 2) v.put(3, 0, -2, "gold", 0.4);

    // Elevated weathered cedar boardwalk looping beside the tide pools
    pier(v, x0, z0, x1, z0 + 2, deckCol, "woodDark", 3, 2);
    if (lv >= 3) {
      pier(v, x1 - 2, z0 + 2, x1, z1, deckCol, "woodDark", 3, 2);
      fence(v, x0, z0, x1, z0, 3, 1, "woodDark");
    }
    // Interpretive coastal sign & reed tufts
    v.box(x0 + 2, 3, z0 + 1, x0 + 4, 5, z0 + 2, "teal");
    bush(v, x0 + 1, 1, z1 - 1, 1.1, "leaf");
    if (lv >= 4) lamp(v, x1 - 1, 3, z0 + 1, 4, "woodDark", "warmGlow");
    if (lv >= 5) {
      // Coastal tide-gauge viewing arch & beacon on Lv5
      v.box(x0 + 1, 3, z0, x0 + 2, 8, z0 + 1, "woodDark");
      v.box(x0 + 5, 3, z0, x0 + 6, 8, z0 + 1, "woodDark");
      v.box(x0 + 1, 8, z0, x0 + 6, 9, z0 + 2, deckCol);
      v.put(x0 + 3, 9, z0 + 1, "warmGlow", 1.1);
    }
    person(v, 0, 3, z0 + 1, "yellow", "blueDark");
  }),

  // 15. public_library — Classical pedimented stone library with arched reading windows
  public_library: entry("public_library", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    const wall = ["marble", "brick", "woodLight", "white"][s];
    const trim = ["marbleShade", "cream", "woodDark", "steelLight"][s];
    const roof = ["slate", "terracotta", "copper", "glass"][s];

    const x0 = -hx + 2;
    const x1 = hx - 2;
    const z0 = -hz + 2;
    const z1 = hz - 4;
    const h = 7 + lv * 2;

    footing(c, x0, z0, x1, z1, "stone");
    v.box(x0, 1, z0, x1, h, z1, wall);
    v.clear(x0 + 1, 1, z0 + 1, x1 - 1, h - 1, z1 - 1);
    windows(c, x0, 3, z0, x1, h - 1, z1, { stepH: 3, stepV: 4, h: 3, emit: 0.5 });

    // Classical front portico with columns, pediment & broad entry steps
    const px0 = Math.max(x0 + 1, -4);
    const px1 = Math.min(x1 - 1, 4);
    colonnade(v, px0, px1, z1 + 1, 2, h - 1, "x", 2, "marble", trim);
    pediment(v, px0 - 1, px1 + 1, h - 1, z1 - 1, z1 + 2, trim, wall);
    stairs(v, px0, px1, 0, z1 + 1, 2, "marbleShade", 1);
    door(v, -1, 2, z1, "woodDark", 2, 3, true);

    if (s === 3 || lv >= 4) {
      // Central glass skylight lantern on roof
      flatRoof(c, x0, h, z0, x1, z1, roof, trim, false);
      v.box(x0 + 3, h + 1, z0 + 3, x1 - 3, h + 3, z1 - 3, "glass", 0.45);
    } else {
      hip(v, x0 - 1, h, z0 - 1, x1 + 1, z1 + 1, roof, trim, 4);
    }
    // Shaded reading bench & lamps
    bench(v, x0 + 1, 1, hz - 2, "x", "wood");
    lamp(v, px0 - 1, 1, hz - 2, 5);
    lamp(v, px1 + 1, 1, hz - 2, 5);
  }),

  // 16. bell_tower_chapel — Intimate stone chapel + slender freestanding campanile bell tower
  bell_tower_chapel: entry("bell_tower_chapel", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    const wall = ["brick", "sandDark", "white", "slateLight"][s];
    const roof = ["terracotta", "terracotta", "blue", "slate"][s];
    const trim = ["cream", "marble", "white", "stone"][s];

    // Chapel nave on left side
    const nx0 = -hx + 2;
    const nx1 = Math.max(1, hx - 6);
    const nz0 = -hz + 3;
    const nz1 = hz - 3;
    const nh = 6 + Math.min(3, lv);
    footing(c, nx0, nz0, nx1, nz1, "stone");
    v.box(nx0, 1, nz0, nx1, nh, nz1, wall);
    v.clear(nx0 + 1, 1, nz0 + 1, nx1 - 1, nh - 1, nz1 - 1);
    gable(v, nx0 - 1, nh, nz0 - 1, nx1 + 1, nz1 + 1, "z", roof, trim);
    door(v, Math.floor((nx0 + nx1) / 2) - 1, 1, nz1, "woodDark", 2, 3, true);
    windows(c, nx0, 3, nz0, nx1, nh - 1, nz1, { stepH: 3, stepV: 4, h: 2, emit: 0.45 });

    // Freestanding campanile bell tower on right side
    const tx0 = Math.min(hx - 4, nx1 + 1);
    const tx1 = hx - 2;
    const tz0 = -2;
    const tz1 = 2;
    const th = 12 + lv * 3;
    footing(c, tx0, tz0, tx1, tz1, "granite");
    v.box(tx0, 1, tz0, tx1, th, tz1, wall);
    // Open belfry arches & hanging bronze bell
    v.clear(tx0, th - 3, tz0 + 1, tx1, th - 1, tz1 - 1);
    v.clear(tx0 + 1, th - 3, tz0, tx1 - 1, th - 1, tz1);
    v.box(Math.floor((tx0 + tx1) / 2), th - 2, 0, Math.floor((tx0 + tx1) / 2), th - 1, 0, "gold");
    spire(v, (tx0 + tx1) / 2, 0, th + 1, 5 + lv, 1.8, roof, "gold");

    // Cypress sentinel trees
    tree(v, nx0, 1, nz1 + 1, "cypress", 1.2, c.v.seed);
    if (lv >= 3) tree(v, tx1, 1, nz0, "cypress", 1.1, c.v.seed + 4);
  }),

  // 17. stone_abbey — Four-sided cloister abbey around a peaceful herb garden
  stone_abbey: entry("stone_abbey", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    const wall = ["cream", "sand", "stone", "marbleShade"][s];
    const roof = ["slate", "terracotta", "charcoal", "crimson"][s];

    const x0 = -hx + 2;
    const x1 = hx - 2;
    const z0 = -hz + 2;
    const z1 = hz - 2;
    const naveZ1 = z0 + Math.max(5, Math.floor((z1 - z0) * 0.36));
    const nh = 9 + lv * 2;

    // Vaulted abbey church along north side
    footing(c, x0, z0, x1, naveZ1, "granite");
    v.box(x0, 1, z0, x1, nh, naveZ1, wall);
    v.clear(x0 + 1, 1, z0 + 1, x1 - 1, nh - 1, naveZ1 - 1);
    gable(v, x0 - 1, nh, z0 - 1, x1 + 1, naveZ1 + 1, "x", roof, "stone");
    // Rose window & crossing bell turret
    v.box(-1, Math.floor(nh * 0.55), naveZ1, 1, Math.floor(nh * 0.55) + 2, naveZ1, "gold", 0.65);
    spire(v, 0, Math.floor((z0 + naveZ1) / 2), nh + 4, 6 + lv, 1.8, roof, "gold");

    // Arched cloister walk framing the central herb garden
    const clH = 4;
    v.box(x0, 1, naveZ1, x0 + 3, clH, z1, wall);
    v.box(x1 - 3, 1, naveZ1, x1, clH, z1, wall);
    v.box(x0, 1, z1 - 3, x1, clH, z1, wall);
    v.box(x0, clH + 1, naveZ1, x0 + 3, clH + 1, z1, roof);
    v.box(x1 - 3, clH + 1, naveZ1, x1, clH + 1, z1, roof);
    v.box(x0, clH + 1, z1 - 3, x1, clH + 1, z1, roof);
    archway(v, 0, 1, z1 - 3, z1 + 1, 3, 3, "stone");

    // Inner herb garden cross-walks & central well/fountain
    const gx0 = x0 + 4;
    const gx1 = x1 - 4;
    const gz0 = naveZ1 + 1;
    const gz1 = z1 - 4;
    if (gx1 > gx0 + 1 && gz1 > gz0 + 1) {
      pave(v, gx0, gz0, gx1, gz1, "grass");
      pave(v, 0, gz0, 0, gz1, "path");
      pave(v, gx0, Math.floor((gz0 + gz1) / 2), gx1, Math.floor((gz0 + gz1) / 2), "path");
      flowerBed(c, gx0 + 1, gz0 + 1, -1, Math.floor((gz0 + gz1) / 2) - 1, 1, ["leaf", "purple", "yellow"]);
      fountain(v, 0, 1, Math.floor((gz0 + gz1) / 2), 2, "stone");
    }
  }),

  // 18. zen_shrine — Vermilion torii gate, raked white gravel, stone lanterns & curved sanctuary
  zen_shrine: entry("zen_shrine", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    const gateCol = ["crimson", "woodDark", "orange", "crimson"][s];
    const roofCol = ["charcoal", "leafDark", "slate", "white"][s];
    const treeCol = s === 2 ? "autumn" : s === 3 ? "pine" : "blossom";

    const x0 = -hx + 2;
    const x1 = hx - 2;
    const z0 = -hz + 2;
    const z1 = hz - 2;

    // Raked white zen gravel garden core (inset inside natural terrain)
    pave(v, x0 + 1, z0 + 1, x1 - 1, z1 - 1, "marble");
    for (let z = z0 + 2; z <= z1 - 2; z += 2) {
      v.box(x0 + 2, 0, z, x1 - 2, 0, z, "white");
    }
    // Stepping-stone walkway from Torii to shrine hall
    for (let z = z1; z >= 0; z -= 2) {
      v.box(-1, 0, z, 1, 0, z, "granite");
    }

    // Iconic vermilion Torii gate at entrance
    const tz = z1 - 1;
    v.box(-3, 1, tz, -3, 7, tz, gateCol);
    v.box(3, 1, tz, 3, 7, tz, gateCol);
    v.box(-4, 6, tz, 4, 6, tz, gateCol); // nuki crossbeam
    v.box(-5, 8, tz, 5, 8, tz, gateCol); // kasagi top lintel
    v.put(-5, 9, tz, "charcoal");
    v.put(5, 9, tz, "charcoal");
    v.box(-4, 9, tz, 4, 9, tz, "charcoal");

    // Curved-eave timber sanctuary hall at north end
    const hz0 = z0 + 1;
    const hz1 = Math.min(-1, z0 + 5 + lv);
    const sh = 5 + lv;
    v.box(-4, 1, hz0, 4, sh, hz1, "woodLight");
    v.box(-3, 2, hz1, 3, 4, hz1, "warmGlow", 0.5);
    // Sweeping upturned sanctuary eaves
    v.box(-6, sh + 1, hz0 - 1, 6, sh + 1, hz1 + 1, roofCol);
    v.box(-5, sh + 2, hz0, 5, sh + 2, hz1, roofCol);
    v.box(-3, sh + 3, hz0 + 1, 3, sh + 3, hz1 - 1, roofCol);
    v.put(-6, sh + 2, hz0 - 1, roofCol);
    v.put(6, sh + 2, hz0 - 1, roofCol);
    v.put(-6, sh + 2, hz1 + 1, roofCol);
    v.put(6, sh + 2, hz1 + 1, roofCol);

    // Stone tōrō lanterns & koi pond at higher levels
    v.box(-4, 1, 2, -4, 3, 2, "stone");
    v.put(-4, 3, 2, "warmGlow", 0.8);
    v.box(4, 1, 2, 4, 3, 2, "stone");
    v.put(4, 3, 2, "warmGlow", 0.8);
    if (lv >= 3 && x1 >= 6) {
      v.box(x0 + 1, 0, -1, -4, 0, 3, "water", 0.3);
      v.put(-5, 0, 1, "orange", 0.5); // koi glint
    }
    tree(v, x1 - 1, 1, z0 + 2, treeCol, 1.1, c.v.seed);
  }),

  // 19. meditation_pavilion — Octagonal open-air sanctuary floating over lotus reflection basin
  meditation_pavilion: entry("meditation_pavilion", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    const wood = ["woodDark", "sand", "wood", "cream"][s];
    const roof = ["charcoal", "gold", "teal", "slate"][s];

    const rPool = Math.min(hx - 2, hz - 2, 5 + lv);
    // Shallow lotus reflection basin with stone coping
    ring(v, 0, 0, 0, 1, rPool, rPool - 1, "stone");
    cyl(v, 0, 0, 0, 0, rPool - 1, "water", 0.35);
    // Floating lotus pads & pink blossoms
    v.put(-rPool + 2, 0, 2, "leaf");
    v.put(-rPool + 2, 1, 2, "pink", 0.5);
    v.put(rPool - 2, 0, -2, "leaf");
    v.put(rPool - 2, 1, -2, "white", 0.5);

    // Stepping-stone footbridge from south shore into pavilion
    v.box(-1, 1, Math.floor(rPool * 0.45), 1, 1, rPool, wood);

    // Elevated central octagonal timber platform & open colonnade
    const rPav = Math.max(3, Math.floor(rPool * 0.55));
    const h = 5 + lv;
    cyl(v, 0, 0, 1, 2, rPav, wood);
    for (const [dx, dz] of [
      [-rPav + 1, -rPav + 1],
      [rPav - 1, -rPav + 1],
      [-rPav + 1, rPav - 1],
      [rPav - 1, rPav - 1],
    ]) {
      column(v, dx, dz, 2, h, wood, "gold");
    }
    // Sweeping tiered octagonal pavilion roof
    for (let step = 0; step <= rPav + 1; step++) {
      const rr = Math.max(0.8, rPav + 1.4 - step * 0.9);
      cyl(v, 0, 0, h + step, h + step, rr, roof);
    }
    v.put(0, h + rPav + 2, 0, "gold", 0.9);
    // Warm hanging lantern inside sanctuary
    v.put(0, h - 1, 0, "warmGlow", 1.1);

    // Slender bamboo culms on outer corners
    if (lv >= 2) {
      for (const [bx, bz] of [
        [-hx + 2, -hz + 2],
        [hx - 2, -hz + 2],
      ]) {
        v.box(bx, 1, bz, bx, 6 + lv, bz, "leaf");
        v.put(bx + 1, 5 + lv, bz, "leafLight");
      }
    }
  }),

  // 20. colossus_lighthouse — Monumental tapered harbor lighthouse with rotating golden beam
  colossus_lighthouse: entry("colossus_lighthouse", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    const baseCol = ["white", "sand", "stone", "marble"][s];
    const bandCol = ["crimson", "gold", "copper", "teal"][s];
    const capCol = ["charcoal", "brass", "copper", "slate"][s];

    // Octagonal stone seawall plinth
    const rBase = Math.min(hx - 2, 4.5 + lv * 0.4);
    cyl(v, 0, 0, 0, 3, rBase, "granite");
    cyl(v, 0, 0, 3, 4, rBase - 0.5, "stone");

    // Soaring tapered lighthouse shaft with horizontal nautical bands
    const towerH = 14 + lv * 4;
    for (let y = 5; y <= towerH; y++) {
      const t = (y - 5) / Math.max(1, towerH - 5);
      const r = Math.max(2.1, (rBase - 1.2) * (1 - t * 0.45));
      const stripe = Math.floor((y - 5) / 4) % 2 === 1;
      cyl(v, 0, 0, y, y, r, stripe ? bandCol : baseCol);
    }
    // Gallery deck & iron balustrade
    const gR = 3.2;
    cyl(v, 0, 0, towerH + 1, towerH + 1, gR, "granite");
    ring(v, 0, 0, towerH + 2, towerH + 2, gR, gR - 0.8, "iron");

    // Glowing Fresnel lantern room & dome cupola
    cyl(v, 0, 0, towerH + 2, towerH + 5, 2.0, "warmGlow", 1.35);
    v.dome(0, towerH + 6, 0, 2.2, capCol);
    spire(v, 0, 0, towerH + 8, 3, 0.7, "gold", "gold");

    // Rotating volumetric lighthouse light beam!
    const beam = spin(c, 0, towerH + 3, 0, "y", 1.3);
    beam.box(2, 0, 0, 6 + lv, 2, 1, "warmGlow", 1.5);
    beam.box(-6 - lv, 0, 0, -2, 2, 1, "warmGlow", 1.5);

    // Keeper's stone cottage tucked beside base at Lv3+
    if (lv >= 3 && hx >= 8) {
      const kx0 = Math.floor(rBase * 0.5);
      const kx1 = hx - 2;
      if (kx1 >= kx0 + 3) {
        v.box(kx0, 1, -3, kx1, 5, 3, baseCol);
        gable(v, kx0, 5, -3, kx1, 3, "z", bandCol, "white");
        door(v, kx0 + 1, 1, 3, "woodDark", 2, 3, true);
      }
    }
  }),

  // 21. civic_observatory — Hilltop copper-domed observatory with brass telescope barrel
  civic_observatory: entry("civic_observatory", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    const domeCol = ["teal", "silver", "brass", "white"][s];
    const wall = ["marble", "concrete", "cream", "stone"][s];

    const rDrum = Math.min(hx - 3, 5 + lv * 0.6);
    const drumH = 6 + lv * 2;
    // Circular stone drum & stepped observatory plinth
    cyl(v, 0, -1, 0, 2, rDrum + 1.2, "granite");
    cyl(v, 0, -1, 2, drumH, rDrum, wall);
    // Classical arched windows around drum
    for (const [wx, wz] of [
      [-Math.floor(rDrum), -1],
      [Math.floor(rDrum), -1],
      [0, Math.floor(rDrum) - 1],
    ]) {
      v.box(wx, 4, wz, wx, 6, wz, "warmGlow", 0.55);
    }

    // Slotted astronomical dome with brass refractor barrel poking skyward
    v.dome(0, drumH + 1, -1, rDrum, domeCol);
    // Shutter slit & angled brass telescope tube
    const slitZ = Math.floor(rDrum * 0.55);
    v.clear(-1, drumH + 2, 0, 1, drumH + Math.ceil(rDrum), Math.ceil(rDrum));
    for (let i = 0; i < 5; i++) {
      v.box(0, drumH + 3 + i, slitZ - 1 + Math.floor(i * 0.7), 0, drumH + 3 + i, slitZ + Math.floor(i * 0.7), "brass");
    }
    v.put(0, drumH + 8, slitZ + 3, "cyan", 0.8); // objective lens glint

    // Flanking meridian library wing & twin auxiliary dome at Lv3+
    if (lv >= 3 && hx >= 10) {
      v.box(-hx + 2, 1, -4, -Math.floor(rDrum) + 1, 6, 2, wall);
      flatRoof(c, -hx + 2, 6, -4, -Math.floor(rDrum) + 1, 2, "slate", "marble", false);
    }
    if (lv >= 4 && hx >= 12) {
      const ax = hx - 4;
      cyl(v, ax, -2, 1, 6, 2.5, wall);
      v.dome(ax, 7, -2, 2.5, domeCol);
    }
    // Public stargazing entry steps & sundial
    stairs(v, -2, 2, 0, Math.ceil(rDrum) + 1, 2, "marbleShade", 1);
    lamp(v, -3, 1, hz - 2, 4);
    lamp(v, 3, 1, hz - 2, 4);
  }),

  // 22. maritime_museum — Vaulted waterfront museum beside an exhibition basin cradling a tall ship
  maritime_museum: entry("maritime_museum", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    const wall = ["brick", "white", "marble", "wood"][s];
    const roof = ["glass", "cyan", "copper", "slate"][s];

    const x0 = -hx + 2;
    const x1 = hx - 2;
    const z0 = -hz + 2;
    const z1 = hz - 2;
    const hallX1 = Math.min(1, Math.floor((x0 + x1) / 2) + 1);
    const h = 7 + lv * 2;

    // Vaulted exhibition hall along left/west quay
    quayFoundation(v, x0, z0, hallX1, z1, "granite");
    v.box(x0, 1, z0, hallX1, h, z1, wall);
    v.clear(x0 + 1, 1, z0 + 1, hallX1 - 1, h - 1, z1 - 1);
    windows(c, x0, 2, z0, hallX1, h - 1, z1, { stepH: 3, stepV: 4, h: 3, emit: 0.55 });
    barrelRoof(v, x0, h, z0, hallX1, z1, "z", roof, "steelDark");

    // Preserved wooden tall ship displayed in flooded exhibition basin on right side
    const sx = Math.floor((hallX1 + 2 + x1) / 2);
    const shipLen = Math.max(5, Math.min(hz - 3, 5 + lv * 2));
    const shipBeam = Math.max(2, Math.min(3, Math.floor((x1 - hallX1) / 3)));
    if (x1 - hallX1 >= 6) {
      const deckY = hull(v, {
        cx: sx,
        z0: -shipLen,
        z1: shipLen,
        beam: shipBeam,
        h: 4,
        col: "woodDark",
        bottom: "brickDark",
        water: 1,
        deck: "woodLight",
        bulwark: "woodDark",
      });
      const mH = 8 + lv * 2;
      mast(v, sx, deckY, 0, mH, "wood", 3);
      squareSail(v, sx, deckY + 2, deckY + mH - 2, 1, shipBeam * 2, "cream", "woodDark");
      if (lv >= 3) {
        mast(v, sx, deckY, -Math.floor(shipLen * 0.45), mH - 2, "wood", 2);
      }
      // Viewing boardwalk around museum basin
      pier(v, hallX1 + 1, z1 - 1, x1, z1, "wood", "woodDark", 3, 1);
    }
    lamp(v, hallX1, 2, z1 - 1, 5);
  }),

  // 23. boatyard_slipway — Sloped stone marine railway descending into water + gantry travel-lift
  boatyard_slipway: entry("boatyard_slipway", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    const craneCol = ["orange", "blue", "woodDark", "yellow"][s];
    const shedCol = ["wood", "steelLight", "brick", "concrete"][s];

    const x0 = -hx + 2;
    const x1 = hx - 2;
    const z0 = -hz + 2;
    const z1 = hz - 1;

    // Sloped stone slipway ramp descending toward +z (auto-oriented into water!)
    for (let z = z0; z <= z1; z++) {
      const t = (z - z0) / Math.max(1, z1 - z0);
      const rampY = Math.max(0, Math.round((1 - t) * 3));
      v.box(-4, 0, z, 4, rampY + 1, z + 1, "concreteDark");
      // Twin iron marine railway rails
      v.put(-2, rampY + 1, z, "steelLight");
      v.put(2, rampY + 1, z, "steelLight");
    }

    // Wooden vessel hull resting in keel cradle on the slipway
    const hullZ0 = Math.max(z0 + 2, -5);
    const hullZ1 = Math.min(z1 - 2, 4);
    if (hullZ1 > hullZ0 + 3) {
      hull(v, {
        cx: 0,
        z0: hullZ0,
        z1: hullZ1,
        beam: 3,
        h: 3,
        col: lv >= 3 ? "blueDark" : "wood",
        bottom: "crimson",
        water: 1,
        deck: "woodLight",
        bulwark: "woodDark",
      });
    }

    // Overhead straddle travel-lift gantry crane spanning the slipway (half-open box coords)
    const gH = 9 + lv * 2;
    v.box(-5, 1, -2, -4, gH, -1, craneCol);
    v.box(4, 1, -2, 5, gH, -1, craneCol);
    v.box(-5, 1, 2, -4, gH, 3, craneCol);
    v.box(4, 1, 2, 5, gH, 3, craneCol);
    v.box(-5, gH, -2, 5, gH + 1, 3, craneCol);
    // Hoist straps descending from gantry beam
    v.box(-2, 4, 0, -1, gH, 1, "charcoal");
    v.box(1, 4, 0, 2, gH, 1, "charcoal");

    // Timber rigging loft & jib crane on landward flank at Lv2+
    if (lv >= 2 && x0 <= -7) {
      footing(c, x0, z0, -6, 1, "granite");
      v.box(x0, 1, z0, -6, 6 + lv, 1, shedCol);
      gable(v, x0, 6 + lv, z0, -6, 1, "z", "slate", "woodDark");
    }
    if (lv >= 4 && x1 >= 7) {
      crane(v, x1 - 1, 1, -2, 12 + lv, 6, craneCol, "x");
    }
  }),

  // 24. solar_spire_arcology — Helical golden-glass eco-arcology with sky forests & solar crown
  solar_spire_arcology: entry("solar_spire_arcology", (c) => {
    const { v, lv, hx, hz } = c;
    const s = c.variant % 4;
    const glass = ["gold", "cyan", "glass", "sky"][s];
    const rib = ["marble", "white", "cream", "steelLight"][s];
    const crown = ["warmGlow", "gold", "cyan", "gold"][s];

    const baseR = Math.min(hx - 2, hz - 2, 6 + lv * 0.9);
    const totalH = 20 + lv * 6;

    // Grounded organic landscaped stone podium (round, never a square full-parcel slab)
    cyl(v, 0, 0, 0, 3, baseR, "marbleShade");
    ring(v, 0, 0, 3, 4, baseR, baseR - 1.4, "leaf");

    // Helical tapering eco-spire with sky-garden cutouts every 6 voxels
    for (let y = 4; y <= totalH; y++) {
      const t = (y - 4) / Math.max(1, totalH - 4);
      const r = Math.max(2.2, (baseR - 0.8) * (1 - t * 0.62));
      const isTerrace = y % 6 === 0 && y < totalH - 3;
      cyl(v, 0, 0, y, y, r, isTerrace ? "leaf" : glass, isTerrace ? 0 : 0.25);

      // Twin spiralling structural ribs twisting around the tower
      const angle = y * 0.28;
      for (const offset of [0, Math.PI]) {
        const rx = Math.round(Math.cos(angle + offset) * r);
        const rz = Math.round(Math.sin(angle + offset) * r);
        v.put(rx, y, rz, rib);
        v.put(rx, y + 1, rz, rib);
      }

      // Wind-catching sky portal opening at mid-height on Lv3+
      if (lv >= 3 && y >= Math.floor(totalH * 0.45) && y <= Math.floor(totalH * 0.58)) {
        v.clear(-1, y, -Math.ceil(r), 1, y, Math.ceil(r));
      }
    }

    // Blazing concentrated solar collector crown & rotating collector ring
    const crownY = totalH + 1;
    ring(v, 0, 0, crownY, crownY + 2, 3.2, 2.0, "gold", 0.6);
    cyl(v, 0, 0, crownY + 1, crownY + 4, 1.4, crown, 1.4);
    const halo = spin(c, 0, crownY + 2, 0, "y", 0.9);
    halo.box(-4, 0, 0, -2, 1, 1, "gold", 0.9);
    halo.box(3, 0, 0, 5, 1, 1, "gold", 0.9);
    halo.box(0, 0, -4, 1, 1, -2, "gold", 0.9);
    halo.box(0, 0, 3, 1, 1, 5, "gold", 0.9);

    // Park trees tucked around circular base
    for (const [tx, tz] of [
      [-Math.floor(baseR), -Math.floor(baseR * 0.6)],
      [Math.floor(baseR), Math.floor(baseR * 0.6)],
    ]) {
      if (Math.abs(tx) < hx - 1 && Math.abs(tz) < hz - 1) {
        tree(v, tx, 1, tz, "round", 1.1, c.v.seed + tx);
      }
    }
  }),
});
