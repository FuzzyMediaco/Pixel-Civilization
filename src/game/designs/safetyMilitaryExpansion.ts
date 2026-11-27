import { emergencyDispatch } from "./emergencyDispatch";
import { buildPublicOrderCenter } from "./publicOrderCenter";
/**
 * Procedural 3D voxel designs for the expanded Police, Fire, SWAT, Emergency & Military
 * (Army, Naval, Air Force & Marine Corps) civilization elements.
 */
import { buildUndergroundMissileSilo } from "./undergroundMissileSilo";
import { buildDroneSwarmBase } from "./droneSwarmBase";
import {
  type Ctx,
  PixelVox,
  awning,
  barrelRoof,
  car,
  container,
  crane,
  curtainWall,
  door,
  flag,
  flatRoof,
  gable,
  helipad,
  hip,
  lamp,
  lot,
  person,
  securityFence,
  solarRow,
  speckle,
  tank,
  tree,
  truck,
  windows,
} from "./kit";
import {
  deckhouse,
  funnel,
  helicopter,
  hull,
  jet,
  mast,
  pier,
  propPlane,
  quayFoundation,
  radar,
  radarDish,
  stealthWing,
  turret,
  wake,
} from "./vehicles";
import { defineDesigns, type DesignEntry } from "./registry";
import { NEW_EXPANSION_BY_ID } from "../expansionSafetyMilitaryCommerce";

type V = PixelVox;
const SKIN = ["#e8b38f", "#c68a62", "#8d5a3b", "#f1c9a5"];
const POLICE_BLUE = "#2f6bff";

function guy(c: Ctx, x: number, y: number, z: number, shirt: string, pants = "blueDark"): void {
  person(c.v, x, y, z, shirt, pants, c.pick(SKIN));
}

/** Iconic B-52 Stratofortress parked on tarmac (swept wings, 8 engine pods in 4 twin nacelles, tall tail) */
function parkedB52(v: V, cx: number, y: number, cz: number, body = "steelLight", trim = "steelDark"): void {
  // Long slender fuselage along z
  v.box(cx - 1, y + 1, cz - 9, cx + 2, y + 3, cz + 10, body);
  v.box(cx, y + 2, cz + 8, cx + 1, y + 3, cz + 11, trim); // nose cone
  v.box(cx - 1, y + 3, cz + 6, cx + 2, y + 4, cz + 8, "glassDark", 0.35); // cockpit
  // Swept high wings (wide span!)
  for (let i = 1; i <= 11; i++) {
    const sweep = Math.floor(i * 0.48);
    v.box(cx - 1 - i, y + 2, cz + 3 - sweep, cx - i, y + 3, cz + 6 - sweep, body);
    v.box(cx + 1 + i, y + 2, cz + 3 - sweep, cx + 2 + i, y + 3, cz + 6 - sweep, body);
  }
  // 4 twin-engine pods hung under wings
  for (const dist of [4, 8]) {
    const sw = Math.floor(dist * 0.48);
    for (const side of [-1, 1]) {
      const px = side < 0 ? cx - 1 - dist : cx + 1 + dist;
      v.box(px, y + 1, cz + 3 - sw, px + 1, y + 2, cz + 6 - sw, trim);
    }
  }
  // Towering vertical tail fin + horizontal stabilizers
  v.box(cx, y + 3, cz - 9, cx + 1, y + 9, cz - 5, body);
  v.box(cx, y + 8, cz - 9, cx + 1, y + 9, cz - 6, trim);
  v.box(cx - 4, y + 2, cz - 9, cx + 5, y + 3, cz - 7, body);
  // Landing gear
  v.put(cx, y, cz + 4, "rubber");
  v.put(cx, y, cz - 3, "rubber");
}

/** Heavy 4-engine airlifter (C-17 style) parked on tarmac */
function parkedCargoPlane(v: V, cx: number, y: number, cz: number, body = "steelLight", stripe = "steelDark"): void {
  v.box(cx - 2, y + 1, cz - 8, cx + 3, y + 5, cz + 8, body);
  v.box(cx - 1, y + 2, cz + 8, cx + 2, y + 4, cz + 10, body);
  v.box(cx - 1, y + 4, cz + 6, cx + 2, y + 5, cz + 8, "glassDark", 0.35);
  v.box(cx - 2, y + 3, cz - 7, cx + 3, y + 4, cz + 7, stripe);
  // High wings + 4 engines
  for (let i = 1; i <= 9; i++) {
    const sw = Math.floor(i * 0.35);
    v.box(cx - 2 - i, y + 4, cz + 1 - sw, cx - 1 - i, y + 5, cz + 4 - sw, body);
    v.box(cx + 2 + i, y + 4, cz + 1 - sw, cx + 3 + i, y + 5, cz + 4 - sw, body);
  }
  for (const d of [3, 6]) {
    const sw = Math.floor(d * 0.35);
    v.box(cx - 2 - d, y + 3, cz + 1 - sw, cx - 1 - d, y + 4, cz + 4 - sw, "charcoal");
    v.box(cx + 2 + d, y + 3, cz + 1 - sw, cx + 3 + d, y + 4, cz + 4 - sw, "charcoal");
  }
  // T-tail
  v.box(cx, y + 5, cz - 8, cx + 1, y + 10, cz - 5, body);
  v.box(cx - 4, y + 10, cz - 8, cx + 5, y + 11, cz - 6, body);
}

/** AWACS Sentry radar aircraft with dorsal rotating radome disc */
function parkedAwacsPlane(c: Ctx, cx: number, y: number, cz: number, body = "white"): void {
  const v = c.v;
  parkedCargoPlane(v, cx, y, cz, body, "#38bdf8");
  v.box(cx - 1, y + 5, cz - 2, cx + 2, y + 7, cz, "steelDark");
  const disc = new PixelVox(81);
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      if (dx * dx + dz * dz <= 10) disc.put(dx, 0, dz, dx === 0 ? "steelDark" : "white");
    }
  }
  c.addRotor({ vox: disc, pivot: [cx + 0.5, y + 7, cz - 1], axis: "y", speed: 2.2 });
}

/** Twin-prop Marine tilt-rotor (Osprey-style) parked on VTOL pad */
function parkedTiltRotor(c: Ctx, cx: number, y: number, cz: number, body = "steelDark"): void {
  const v = c.v;
  v.box(cx - 1, y + 1, cz - 5, cx + 2, y + 4, cz + 5, body);
  v.box(cx - 1, y + 2, cz + 4, cx + 2, y + 4, cz + 6, "glassDark", 0.35);
  v.box(cx - 5, y + 3, cz - 1, cx + 6, y + 4, cz + 2, body);
  // Twin tail fins
  v.box(cx - 3, y + 2, cz - 6, cx - 2, y + 5, cz - 4, body);
  v.box(cx + 3, y + 2, cz - 6, cx + 4, y + 5, cz - 4, body);
  v.box(cx - 3, y + 2, cz - 6, cx + 4, y + 3, cz - 5, body);
  // Twin wingtip spinning rotors
  for (const sx of [cx - 5, cx + 5]) {
    v.box(sx, y + 3, cz - 1, sx + 1, y + 5, cz + 1, "charcoal");
    const blade = new PixelVox(91);
    blade.box(-3, 0, 0, 4, 1, 1, "silver");
    blade.box(0, 0, -3, 1, 1, 4, "silver");
    c.addRotor({ vox: blade, pivot: [sx + 0.5, y + 5.5, cz + 0.5], axis: "y", speed: sx < cx ? 11 : -11 });
  }
}

/** Helipad + hangar + chopper (shared builder for Police / Medevac / Fire / SAR pads) */
function buildHeliBase(
  c: Ctx,
  cfg: {
    padRing: string;
    heliCol: string;
    stripe: string;
    wall: string;
    roof: string;
    beacon: string;
    waterTank?: boolean;
    lodge?: boolean;
  },
): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  lot(c, cfg.lodge ? "grass2" : "concrete2");
  speckle(c, cfg.lodge ? "grass3" : "concrete", 0.08);
  const padX = lv >= 3 ? Math.floor(hx * 0.35) : 0;
  const padZ = lv >= 3 ? Math.floor(hz * 0.22) : 1;
  const padR = Math.min(6, Math.max(4, Math.min(hx, hz) - 2));
  helipad(v, padX, 1, padZ, padR);
  // Corner strobes
  for (const [dx, dz] of [[-padR, -padR], [padR, -padR], [-padR, padR], [padR, padR]]) {
    const bx = Math.max(-hx + 1, Math.min(hx - 2, padX + dx));
    const bz = Math.max(-hz + 1, Math.min(hz - 2, padZ + dz));
    v.put(bx, 1, bz, cfg.beacon, 1.3);
    c.blink(bx, 2, bz, cfg.beacon);
  }
  // Parked helicopter ready for flight
  helicopter(c, padX, 2, padZ, cfg.heliCol, "z", lv >= 2 ? 12 : 4);

  // Control shed / hangar grows with level
  if (lv >= 2) {
    const x0 = -hx + 1;
    const x1 = lv >= 3 ? Math.min(-1, padX - padR - 1) : hx - 2;
    const z0 = -hz + 1;
    const z1 = lv >= 3 ? hz - 2 : Math.min(-2, padZ - padR - 1);
    if (x1 - x0 >= 5 && z1 - z0 >= 4) {
      const h = 4 + Math.min(8, lv * 2);
      v.box(x0, 1, z0, x1, h, z1, cfg.wall);
      v.clear(x0 + 1, 1, z0 + 1, x1 - 1, h - 1, z1 - 1);
      v.box(x0, 2, z1 - 1, x1, 3, z1, cfg.stripe, 0.4);
      windows(c, x0, 1, z0, x1, h, z1, { stepH: 3, stepV: 4, emit: 0.5 });
      if (cfg.lodge) gable(v, x0 - 1, h, z0 - 1, x1 + 1, z1 + 1, "x", cfg.roof);
      else if (s === 1) barrelRoof(v, x0, h, z0, x1, z1, "z", cfg.roof);
      else flatRoof(c, x0, h, z0, x1, z1, cfg.roof, cfg.stripe, true);
      // Radio mast
      v.box(x0 + 1, h + 1, z0 + 1, x0 + 2, h + 7, z0 + 2, "steelDark");
      c.blink(x0 + 1, h + 7, z0 + 1, cfg.beacon);
    }
  }
  if (cfg.waterTank && hx >= 12) {
    tank(v, -hx + 4, hz - 5, 1, 5, 3, "sky", "white");
  }
  if (lv >= 4 && hx >= 14) {
    radarDish(c, -hx + 4, 8, -hz + 4, 2, "white", 1.5);
    car(v, -hx + 5, 1, hz - 3, "x", cfg.heliCol);
  }
  if (cfg.lodge && hx >= 10) {
    tree(v, -hx + 2, 1, hz - 3, "pine", 6);
    tree(v, hx - 3, 1, -hz + 3, "pine", 7);
  }
  guy(c, Math.max(-hx + 2, padX - padR), 1, Math.min(hz - 2, padZ + padR), cfg.stripe, "charcoal");
}

/** Civic/Safety HQ building builder (K9, Crime Lab, Hazmat, Fire Academy, Highway Patrol, Bunker) */
function buildSafetyFacility(
  c: Ctx,
  kind: "k9" | "lab" | "hazmat" | "academy" | "highway" | "bunker",
): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  lot(c, kind === "k9" ? "grass2" : "concrete2");
  if (kind === "k9") speckle(c, "grass3", 0.1);

  if (kind === "bunker") {
    lot(c, s === 1 ? "grass2" : "concrete2");
    const bx0 = -hx + 2, bx1 = hx - 2, bz0 = -hz + 2, bz1 = hz - 3;
    const h = 4 + lv * 2;
    const wall = ["concrete", "grass2", "steelDark", "stone"][s];
    v.box(bx0, 1, bz0, bx1, h, bz1, wall);
    v.box(bx0 + 2, h, bz0 + 2, bx1 - 2, h + 2, bz1 - 2, "concreteDark");
    // Blast door
    door(v, -2, 1, bz1 - 1, "steelDark", 4, 4, true);
    v.box(-3, 5, bz1 - 1, 3, 6, bz1, "hazard");
    // Air vents + siren tower
    v.box(bx1 - 4, h, bz0 + 2, bx1 - 2, h + 8 + lv, bz0 + 4, "steelDark");
    v.box(bx1 - 5, h + 7 + lv, bz0 + 1, bx1 - 1, h + 9 + lv, bz0 + 5, "yellow", 0.8);
    c.blink(bx1 - 3, h + 9 + lv, bz0 + 3, "yellow");
    if (lv >= 3) solarRow(v, bx0 + 3, bx1 - 6, h + 2, bz0 + 3);
    securityFence(v, -hx + 1, -hz + 1, hx - 1, hz - 1, 1, 4, [-3, 3]);
    return;
  }

  const palettes: Record<string, string[]> = {
    k9: ["wood", "brick", "slate", "sand"],
    lab: ["white", "limestone", "concrete", "copper"],
    hazmat: ["concrete", "steelLight", "white", "brick"],
    academy: ["brick", "steelDark", "concrete", "limestone"],
    highway: ["white", "camoTan", "charcoal", "steelLight"],
  };
  const accents: Record<string, string> = {
    k9: "#4f6d9a",
    lab: "#0ea5e9",
    hazmat: "yellow",
    academy: "red",
    highway: "#1d4ed8",
  };
  const wall = palettes[kind][s];
  const accent = accents[kind];
  const floors = Math.min(5, 1 + Math.floor(lv * 0.9));
  const top = 1 + floors * 4;
  const x0 = -hx + 2;
  const x1 = kind === "k9" || kind === "academy" ? Math.min(hx - 2, 2) : hx - 2;
  const z0 = -hz + 2;
  const z1 = hz - (lv >= 3 ? 7 : 4);

  if (kind === "lab" && s === 0) {
    curtainWall(c, x0, 1, z0, x1, top, z1, "#7dd3fc", "white", 3, 4);
  } else {
    v.box(x0, 1, z0, x1, top, z1, wall);
    v.clear(x0 + 1, 1, z0 + 1, x1 - 1, top - 1, z1 - 1);
    windows(c, x0, 1, z0, x1, top, z1, { stepH: 3, stepV: 4, h: 2, emit: 0.48 });
  }
  v.box(x0, 4, z1 - 1, x1, 5, z1 + 1, accent, 0.5);
  door(v, Math.floor((x0 + x1) / 2) - 1, 1, z1 - 1, "glassDark", 2, 3, false);
  flatRoof(c, x0, top, z0, x1, z1, "concreteDark", accent, true);

  if (kind === "k9") {
    // Agility & kennel yard on +x side
    if (hx - 2 - x1 >= 6) {
      securityFence(v, x1 + 1, z0, hx - 1, hz - 2, 1, 4);
      v.box(x1 + 2, 1, z0 + 2, hx - 2, 4, z0 + 5, "woodDark");
      gable(v, x1 + 2, 4, z0 + 2, hx - 2, z0 + 5, "x", "red");
      // Agility jump ramp
      v.box(x1 + 3, 1, 0, hx - 3, 2, 2, "yellow");
      v.box(x1 + 4, 2, 0, hx - 4, 3, 2, "blue");
    }
  } else if (kind === "academy") {
    // Tall firefighter drill tower on +x
    const tx0 = Math.max(x1 + 2, hx - 9);
    const tx1 = hx - 2;
    const th = 10 + lv * 5;
    if (tx1 - tx0 >= 4) {
      v.box(tx0, 1, z0, tx1, th, z0 + 6, "brick");
      windows(c, tx0, 1, z0, tx1, th, z0 + 6, { stepH: 3, stepV: 4, h: 2, col: "glassDark", emit: 0.25 });
      v.box(tx0 - 1, th, z0 - 1, tx1 + 1, th + 1, z0 + 7, "steelDark");
      c.smoke(tx0 + 2, th + 1, z0 + 3, "smoke");
    }
    truck(v, -hx + 5, 1, hz - 3, "x", "red", "white");
  } else if (kind === "hazmat") {
    tank(v, x1 - 4, z0 + 3, top + 1, 4, 2, "yellow", "black");
    truck(v, 0, 1, hz - 3, "x", "yellow", "charcoal");
    c.blink(0, 4, hz - 3, "yellow");
  } else if (kind === "highway") {
    v.box(-hx + 1, 0, z1 + 1, hx - 1, 1, hz - 1, "asphalt");
    for (let x = -hx + 4; x < hx - 3; x += 6) {
      car(v, x, 1, hz - 3, "z", s === 2 ? "charcoal" : "white");
      v.put(x, 3, hz - 3, POLICE_BLUE, 1.3);
    }
    flag(v, -hx + 2, 1, z1 + 1, 9);
  } else if (kind === "lab") {
    v.box(x0 + 2, top + 1, z0 + 2, x1 - 2, top + 3, z1 - 2, "glass", 0.55);
    car(v, -hx + 5, 1, hz - 3, "x", "white");
  }
  lamp(v, -hx + 2, 1, hz - 2, 5);
  guy(c, 2, 1, hz - 2, accent, "charcoal");
}

/** Army / Marine Land Base Builder (ZERO roaming tanks — garrison, barracks, jump tower, dishes, logistics, field hospital) */
function buildLandMilitaryBase(
  c: Ctx,
  kind: "garrison" | "signal" | "logistics" | "airborne" | "engineer" | "medical" | "marines",
): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  const grounds = ["grass2", "sand", "concrete2", "snow"];
  const walls =
    kind === "marines"
      ? ["brick", "oliveDrab", "camoTan", "concrete"]
      : kind === "medical"
        ? ["oliveDrab", "white", "camoTan", "white"]
        : ["oliveDrab", "camoTan", "concrete", "white"];
  const roofs = ["steelDark", "sandDark", "slate", "steelLight"];
  const accent = kind === "marines" ? "crimson" : kind === "medical" ? "red" : "oliveDrab";
  lot(c, grounds[s]);
  speckle(c, s === 1 ? "sandDark" : s === 3 ? "white" : "grass3", 0.08);
  securityFence(v, -hx + 1, -hz + 1, hx - 1, hz - 1, 1, 4, [-4, 4]);
  v.box(-3, 0, -hz + 2, 3, 1, hz, "path");

  const wall = walls[s];
  const roof = roofs[s];
  const bx0 = -hx + 3;
  const bz0 = -hz + 3;
  const bw = Math.min(14, hx - 4);
  const bh = 5 + Math.min(7, lv * 2);

  // Main HQ / barracks block
  v.box(bx0, 1, bz0, bx0 + bw, bh, bz0 + 10, wall);
  v.clear(bx0 + 1, 1, bz0 + 1, bx0 + bw - 1, bh - 1, bz0 + 9);
  windows(c, bx0, 1, bz0, bx0 + bw, bh, bz0 + 10, { stepH: 3, stepV: 4, emit: 0.4 });
  if (kind === "marines") v.box(bx0, bh - 1, bz0, bx0 + bw, bh, bz0 + 10, "gold");
  flatRoof(c, bx0, bh, bz0, bx0 + bw, bz0 + 10, roof, accent, true);
  flag(v, 0, 1, hz - 7, 10 + lv, kind === "marines" ? ["crimson", "gold", "crimson"] : ["red", "white", "blue"]);

  if (kind === "signal") {
    radarDish(c, hx - 7, 1, -hz + 7, 3, "white", 1.3);
    v.dome(hx - 7, 1, hz - 9, 4, "white");
    if (lv >= 3) radarDish(c, bx0 + 4, bh + 1, bz0 + 5, 3, "silver", -1.6);
  } else if (kind === "logistics") {
    // Warehouses + shipping containers + gantry crane
    barrelRoof(v, 2, 1, -hz + 3, hx - 3, -hz + 13, "z", "steelLight", "steelDark");
    container(v, -hx + 4, 1, 3, "x", "oliveDrab");
    container(v, -hx + 4, 1, 7, "x", "camoTan");
    if (lv >= 3) container(v, -hx + 4, 5, 3, "x", "steelDark");
    crane(v, hx - 6, 1, 4, 10 + lv, 8, "yellow");
  } else if (kind === "airborne") {
    // Iconic paratrooper jump training tower (tall steel lattice with jump booms)
    const tx = hx - 8;
    const tz = -hz + 8;
    const th = 14 + lv * 4;
    for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
      v.box(tx + dx, 1, tz + dz, tx + dx + 1, th, tz + dz + 1, "steelDark");
    }
    for (let y = 4; y < th; y += 4) v.box(tx - 2, y, tz - 2, tx + 3, y + 1, tz + 3, "steelLight");
    v.box(tx - 6, th - 1, tz - 1, tx + 7, th, tz + 1, "yellow");
    v.box(tx - 1, th - 1, tz - 6, tx + 1, th, tz + 7, "yellow");
    c.blink(tx, th + 1, tz, "red");
    // White parachute canopy on line
    v.dome(tx - 5, th - 5, tz, 2.5, "white");
  } else if (kind === "engineer") {
    // Stacked bridge pontoons + heavy crane + workshop
    v.box(3, 1, -hz + 3, hx - 3, 6, -hz + 11, "steelLight");
    gable(v, 3, 6, -hz + 3, hx - 3, -hz + 11, "x", "steelDark");
    for (let k = 0; k < Math.min(3, lv); k++) {
      v.box(4, 1 + k * 2, 2, hx - 4, 2 + k * 2, 5, "oliveDrab");
    }
    crane(v, hx - 5, 1, 6, 9 + lv, 7, "orange");
  } else if (kind === "medical") {
    // White hospital wing with giant red cross on roof + medevac helipad
    v.box(3, 1, -hz + 3, hx - 3, 6, -hz + 11, "white");
    v.box(3, 6, -hz + 3, hx - 3, 7, -hz + 11, "white");
    const rcx = Math.floor((3 + hx - 3) / 2);
    const rcz = -hz + 7;
    v.box(rcx - 2, 7, rcz, rcx + 3, 8, rcz + 1, "red", 0.7);
    v.box(rcx, 7, rcz - 2, rcx + 1, 8, rcz + 3, "red", 0.7);
    if (lv >= 3 && hz >= 14) {
      helipad(v, 5, 1, 6, 4);
      helicopter(c, 5, 2, 6, "white", "z", 6);
    }
  } else {
    // Garrison / Marines: second barracks wing + parade ground + ceremonial gate
    if (hx >= 14) {
      v.box(3, 1, bz0, hx - 3, bh - 1, bz0 + 10, wall);
      windows(c, 3, 1, bz0, hx - 3, bh - 1, bz0 + 10, { stepH: 3, stepV: 4, emit: 0.4 });
      flatRoof(c, 3, bh - 1, bz0, hx - 3, bz0 + 10, roof, accent, false);
    }
    v.box(-8, 0, 2, 8, 1, hz - 5, "concrete2");
    if (kind === "marines") {
      // Crimson & gold arch at gate
      v.box(-5, 1, hz - 3, -4, 7, hz - 2, "crimson");
      v.box(4, 1, hz - 3, 5, 7, hz - 2, "crimson");
      v.box(-5, 6, hz - 3, 5, 8, hz - 2, "gold");
    }
  }
  for (let i = 0; i < 2 + lv; i++) guy(c, -6 + i * 3, 1, hz - 4, accent, "charcoal");
}

/** Air Force Base Builder (B-52, B-2, Fighter Wing, Airlift Cargo, AWACS, Recon, Marine Tilt-Rotor) */
function buildAirForceBase(
  c: Ctx,
  kind: "b52" | "b2" | "fighter" | "cargo" | "awacs" | "recon" | "tiltrotor",
): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  lot(c, "asphalt");
  // Runway / apron strip across front half (+z)
  const rZ0 = Math.max(0, Math.floor(hz * 0.15));
  const rZ1 = hz - 2;
  v.box(-hx + 1, 0, rZ0, hx - 1, 1, rZ1, "charcoal");
  const midZ = Math.floor((rZ0 + rZ1) / 2);
  for (let x = -hx + 3; x < hx - 3; x += 4) v.box(x, 0, midZ, x + 2, 1, midZ + 1, "white");
  for (let x = -hx + 2; x < hx - 2; x += 6) {
    v.put(x, 1, rZ0, "yellow", 1.1);
    v.put(x, 1, rZ1, "sky", 1.0);
  }
  // Hangars along back (-z)
  const hWall = kind === "b2" ? ["charcoal", "steelDark", "camoTan", "white"][s] : ["steelLight", "concrete", "camoTan", "charcoal"][s];
  const hRoof = kind === "b2" ? "charcoal" : ["steelDark", "blueDark", "sandDark", "charcoal"][s];
  const numHangars = Math.min(3, Math.max(1, Math.floor((hx * 2 - 8) / 14)));
  const hw = Math.floor((hx * 2 - 12) / numHangars) - 2;
  const hz0 = -hz + 2;
  const hz1 = Math.min(rZ0 - 2, -hz + 14);

  for (let i = 0; i < numHangars; i++) {
    const x0 = -hx + 3 + i * (hw + 2);
    const x1 = Math.min(hx - 9, x0 + hw);
    if (x1 - x0 < 7 || hz1 - hz0 < 5) continue;
    v.box(x0, 1, hz0, x1, 8, hz1, hWall);
    v.clear(x0 + 1, 1, hz0 + 1, x1 - 1, 7, hz1); // open hangar front
    if (kind === "b2" || kind === "fighter") {
      barrelRoof(v, x0, 7, hz0, x1, hz1, "z", hRoof);
    } else {
      flatRoof(c, x0, 8, hz0, x1, hz1, hRoof, hWall, false);
    }
    v.box(x0 + 2, 7, hz1 - 1, x1 - 2, 8, hz1, kind === "b2" ? "yellow" : "sky", 0.5);
  }

  // Control tower on +x back corner
  const tx = hx - 7;
  const tz = -hz + 3;
  const th = 10 + lv * 2;
  v.box(tx, 1, tz, tx + 5, th, tz + 5, "concrete");
  v.box(tx - 1, th, tz - 1, tx + 6, th + 3, tz + 6, "glassDark", 0.6);
  v.box(tx - 1, th + 3, tz - 1, tx + 6, th + 4, tz + 6, hRoof);
  radar(c, tx + 2, th + 4, tz + 2, 5, "white", 2.0);
  c.blink(tx + 2, th + 6, tz + 2, "red");

  if (kind === "awacs" || kind === "recon") {
    v.dome(-hx + 5, 1, hz0 + 4, 4, "white");
  }

  // Signature parked aircraft right on the apron/runway!
  if (kind === "b52") {
    parkedB52(v, 0, 1, midZ - 1, s === 3 ? "charcoal" : "steelLight", "steelDark");
  } else if (kind === "b2") {
    stealthWing(v, 0, 2, midZ, "z", s === 1 ? "steelDark" : "charcoal");
    if (lv >= 4 && hx >= 20) stealthWing(v, -12, 2, midZ, "z", "charcoal");
  } else if (kind === "fighter") {
    jet(v, -4, 1, midZ, "z", s === 1 ? "sky" : "steelLight", "steelDark");
    if (lv >= 2) jet(v, 6, 1, midZ, "z", s === 1 ? "sky" : "steelLight", "red");
    if (lv >= 4 && hx >= 20) jet(v, -14, 1, midZ, "z", "steelLight", "yellow");
  } else if (kind === "cargo") {
    parkedCargoPlane(v, 0, 1, midZ - 1, s === 2 ? "camoTan" : "steelLight", s === 3 ? "orange" : "steelDark");
  } else if (kind === "awacs") {
    parkedAwacsPlane(c, 0, 1, midZ - 1, s === 1 ? "steelLight" : "white");
  } else if (kind === "recon") {
    propPlane(v, -4, 1, midZ, "z", "white", "sky");
    if (lv >= 3) propPlane(v, 6, 1, midZ, "z", "charcoal", "cyan");
  } else if (kind === "tiltrotor") {
    helipad(v, 0, 1, midZ, 5);
    parkedTiltRotor(c, 0, 1, midZ, s === 1 ? "crimson" : "steelDark");
    if (lv >= 4 && hx >= 18) {
      helipad(v, -12, 1, midZ, 4);
      parkedTiltRotor(c, -12, 1, midZ, "steelDark");
    }
  }
}

/** Coastal Naval / Rescue / Marine Quay Bases (ZERO tanks — ships, cranes, boathouses, helipads!) */
function buildNavalQuayBase(
  c: Ctx,
  kind: "coast_rescue" | "harbor_police" | "drydock" | "coast_guard" | "destroyer_dock" | "carrier_berth" | "amphib_dock" | "marine_amphib",
): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  // Water half (+z) + concrete quay (-z)
  const quayZ = Math.min(2, -Math.floor(hz * 0.1));
  quayFoundation(v, -hx, -hz, hx, quayZ, "concreteDark");
  // Side pier arm extending into water
  pier(v, -hx + 2, quayZ, -hx + 8, hz - 2, "concrete", "steelDark", 4, 2);
  if (hx >= 14) pier(v, hx - 8, quayZ, hx - 2, hz - 2, "concrete", "steelDark", 4, 2);

  const accent =
    kind === "coast_rescue" || kind === "coast_guard"
      ? "orange"
      : kind === "harbor_police"
        ? POLICE_BLUE
        : kind === "marine_amphib"
          ? "crimson"
          : "steelDark";
  const bWall =
    kind === "coast_rescue" && s === 0
      ? "red"
      : kind === "coast_guard"
        ? "white"
        : kind === "drydock" && s === 1
          ? "brick"
          : "concrete";
  // Boathouse / HQ on quay
  const bx0 = -hx + 3;
  const bx1 = Math.min(hx - 3, 6);
  const bh = 6 + lv * 2;
  v.box(bx0, 3, -hz + 2, bx1, bh, quayZ - 1, bWall);
  windows(c, bx0, 3, -hz + 2, bx1, bh, quayZ - 1, { stepH: 3, stepV: 4, emit: 0.5 });
  v.box(bx0, 5, quayZ - 2, bx1, 6, quayZ, accent, 0.5);
  if (kind === "coast_rescue" || kind === "harbor_police") {
    gable(v, bx0 - 1, bh, -hz + 1, bx1 + 1, quayZ, "x", "slate");
  } else {
    flatRoof(c, bx0, bh, -hz + 2, bx1, quayZ - 1, "concreteDark", accent, true);
  }
  // Watchtower / radar mast
  const tx = hx - 6;
  v.box(tx, 3, -hz + 3, tx + 4, bh + 5, -hz + 7, "white");
  v.box(tx, bh + 3, -hz + 3, tx + 4, bh + 5, -hz + 7, "glassDark", 0.5);
  radar(c, tx + 2, bh + 6, -hz + 5, 5, "white", 1.8);
  c.blink(tx + 2, bh + 8, -hz + 5, accent === "orange" ? "yellow" : accent === POLICE_BLUE ? "blue" : "red");

  if (kind === "drydock" || kind === "carrier_berth") {
    crane(v, -hx + 5, 3, quayZ + 3, 12 + lv * 2, 10, kind === "drydock" ? "sky" : "yellow");
  }
  if ((kind === "coast_guard" || kind === "carrier_berth") && hx >= 14) {
    helipad(v, bx0 + 5, bh + 1, -hz + 5, 4);
    if (lv >= 3) helicopter(c, bx0 + 5, bh + 2, -hz + 5, kind === "coast_guard" ? "orange" : "steelDark", "z", 9);
  }

  // Moored boat/ship inside the basin!
  const shipZ0 = quayZ + 2;
  const shipZ1 = hz - 3;
  if (shipZ1 - shipZ0 >= 7) {
    const hullCol =
      kind === "coast_rescue"
        ? "orange"
        : kind === "coast_guard" || kind === "harbor_police"
          ? "white"
          : kind === "marine_amphib"
            ? "steelDark"
            : "steelLight";
    const deckY = hull(v, {
      cx: 0,
      y0: 0,
      z0: shipZ0,
      z1: shipZ1,
      beam: Math.min(10, Math.max(4, hx - 8)),
      h: kind === "carrier_berth" ? 5 : 3,
      col: hullCol,
      bottom: "red",
      stripe: accent,
      deck: kind === "carrier_berth" ? "charcoal" : "concreteDark",
    });
    deckhouse(c, -2, deckY, shipZ0 + 2, 2, deckY + 4, shipZ0 + 6, hullCol, "glass", "steelDark");
    if (kind === "carrier_berth") {
      jet(v, -1, deckY, shipZ1 - 5, "z", "steelLight", "red");
    } else if (kind === "destroyer_dock" || kind === "drydock") {
      turret(v, 0, deckY, shipZ1 - 4, 2, 2, 4, 1, "steelDark");
    }
    mast(v, 0, deckY + 4, shipZ0 + 4, 5, "steelDark");
  }
  flag(v, -hx + 3, 3, quayZ - 1, 8, ["red", "white", "blue"]);
}

/** Standalone Naval Vessel Designs (Patrol Cutter, Frigate, Minesweeper, Hospital Ship) */
function buildNavalVesselDesign(
  c: Ctx,
  kind: "cutter" | "frigate" | "minesweeper" | "hospital",
): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  c.bob();
  const z0 = -hz + 3;
  const z1 = hz - 2;
  const beam = Math.min(hx * 2 - 4, kind === "cutter" ? 5 + lv : 7 + lv);
  const h = kind === "hospital" ? 5 : kind === "frigate" ? 4 : 3;
  const vesselStyles: Record<typeof kind, { hull: string[]; stripe: string[]; deck: string[] }> = {
    hospital: {
      hull: ["white", "cream", "stone", "concrete2"],
      stripe: ["red", "crimson", "orange", "sky"],
      deck: ["concrete2", "slateLight", "woodLight", "steelLight"],
    },
    cutter: {
      hull: ["steelLight", "white", "charcoal", "navy"],
      stripe: ["steelDark", "orange", "sky", "red"],
      deck: ["steelDark", "concreteDark", "charcoal", "slate"],
    },
    frigate: {
      hull: ["steelLight", "slate", "charcoal", "navy"],
      stripe: ["steelDark", "crimson", "sky", "gold"],
      deck: ["steelDark", "charcoal", "concreteDark", "slate"],
    },
    minesweeper: {
      hull: ["steelLight", "olive", "charcoal", "woodDark"],
      stripe: ["yellow", "orange", "red", "white"],
      deck: ["steelDark", "wood", "charcoal", "concreteDark"],
    },
  };
  const pal = vesselStyles[kind];
  const hullCol = pal.hull[s];
  const stripe = pal.stripe[s];
  const deckCol = pal.deck[s];

  const deckY = hull(v, {
    cx: 0,
    y0: 0,
    z0,
    z1,
    beam,
    h,
    col: hullCol,
    bottom: s === 3 ? "navy" : "crimson",
    stripe,
    deck: deckCol,
    bulwark: hullCol,
  });
  wake(v, 0, z0, Math.max(3, Math.floor(beam * 0.6)), 3, -hz);

  if (kind === "hospital") {
    const dx0 = -Math.max(2, Math.floor(beam / 2) - 1);
    const dx1 = Math.max(3, Math.floor(beam / 2));
    deckhouse(c, dx0, deckY, z0 + 4, dx1, deckY + 5 + lv, z1 - 5, "white", "warmGlow", "white", 2);
    // Bold Red Crosses on roof and sides
    const rY = deckY + 6 + lv;
    v.box(-2, rY, -1, 3, rY + 1, 0, "red", 0.6);
    v.box(0, rY, -3, 1, rY + 1, 2, "red", 0.6);
    // Aft medevac helideck
    helipad(v, 0, deckY, z0 + 2, 3);
    if (lv >= 3) helicopter(c, 0, deckY + 1, z0 + 2, "white", "z", 8);
    funnel(c, 0, 2, rY, 4, 1.5, "white", "red");
  } else if (kind === "frigate") {
    deckhouse(c, -3, deckY, -4, 3, deckY + 5 + Math.min(3, lv), 5, hullCol, "glass", "steelDark");
    mast(v, 0, deckY + 5 + Math.min(3, lv), 0, 6, "steelDark");
    radar(c, 0, deckY + 11 + Math.min(3, lv), 0, 5, "white", 2.2);
    turret(v, 0, deckY, z1 - 5, 2, 1, 4, 1, "steelDark");
    funnel(c, 0, -2, deckY + 4, 4, 1.4, hullCol, "black");
    if (lv >= 3 && z0 + 5 < -4) {
      helipad(v, 0, deckY, z0 + 4, 3);
      helicopter(c, 0, deckY + 1, z0 + 4, "steelDark", "z", 5);
    }
  } else if (kind === "minesweeper") {
    deckhouse(c, -2, deckY, -2, 2, deckY + 4, 4, hullCol, "glass", "steelDark");
    radar(c, 0, deckY + 5, 1, 4, "white", 2.4);
    // Stern A-frame minesweep crane
    v.box(-2, deckY, z0 + 1, -1, deckY + 5, z0 + 2, "yellow");
    v.box(1, deckY, z0 + 1, 2, deckY + 5, z0 + 2, "yellow");
    v.box(-2, deckY + 4, z0 + 1, 2, deckY + 5, z0 + 2, "yellow");
    c.blink(0, deckY + 6, 1, "yellow");
  } else {
    // Fast Patrol Cutter
    deckhouse(c, -2, deckY, -3, 2, deckY + 3 + Math.min(2, lv), 3, hullCol, "glass", stripe);
    turret(v, 0, deckY, z1 - 4, 1, 1, 3, 1, "steelDark");
    radar(c, 0, deckY + 4 + Math.min(2, lv), 0, 4, "white", 2.8);
    c.blink(0, deckY + 5 + Math.min(2, lv), 0, "blue");
  }
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

defineDesigns({
  // Police / Fire / SWAT / Emergency (14)
  police_heli_pad: entry("police_heli_pad", (c) =>
    buildHeliBase(c, { padRing: POLICE_BLUE, heliCol: POLICE_BLUE, stripe: POLICE_BLUE, wall: "white", roof: "concreteDark", beacon: "blue" }),
  ),
  medevac_heli_pad: entry("medevac_heli_pad", (c) =>
    buildHeliBase(c, { padRing: "red", heliCol: "red", stripe: "red", wall: "white", roof: "concreteDark", beacon: "red" }),
  ),
  fire_heli_base: entry("fire_heli_base", (c) =>
    buildHeliBase(c, { padRing: "yellow", heliCol: "yellow", stripe: "red", wall: "brick", roof: "steelDark", beacon: "yellow", waterTank: true }),
  ),
  search_rescue_hq: entry("search_rescue_hq", (c) =>
    buildHeliBase(c, { padRing: "orange", heliCol: "orange", stripe: "orange", wall: "wood", roof: "slate", beacon: "yellow", lodge: true }),
  ),
  emergency_dispatch: entry("emergency_dispatch", emergencyDispatch),
  k9_police_unit: entry("k9_police_unit", (c) => buildSafetyFacility(c, "k9")),
  forensic_crime_lab: entry("forensic_crime_lab", (c) => buildSafetyFacility(c, "lab")),
  hazmat_response: entry("hazmat_response", (c) => buildSafetyFacility(c, "hazmat")),
  fire_academy: entry("fire_academy", (c) => buildSafetyFacility(c, "academy")),
  traffic_precinct: entry("traffic_precinct", (c) => buildSafetyFacility(c, "highway")),
  riot_command_center: entry("riot_command_center", buildPublicOrderCenter),
  civil_defense_bunker: entry("civil_defense_bunker", (c) => buildSafetyFacility(c, "bunker")),
  coast_rescue_station: entry("coast_rescue_station", (c) => buildNavalQuayBase(c, "coast_rescue")),
  harbor_patrol_pier: entry("harbor_patrol_pier", (c) => buildNavalQuayBase(c, "harbor_police")),

  // Army (6)
  army_garrison: entry("army_garrison", (c) => buildLandMilitaryBase(c, "garrison")),
  army_signal_corps: entry("army_signal_corps", (c) => buildLandMilitaryBase(c, "signal")),
  army_logistics_depot: entry("army_logistics_depot", (c) => buildLandMilitaryBase(c, "logistics")),
  army_airborne_school: entry("army_airborne_school", (c) => buildLandMilitaryBase(c, "airborne")),
  army_engineer_base: entry("army_engineer_base", (c) => buildLandMilitaryBase(c, "engineer")),
  army_medical_corps: entry("army_medical_corps", (c) => buildLandMilitaryBase(c, "medical")),

  // Naval Bases & Vessels (9)
  naval_shipyard_base: entry("naval_shipyard_base", (c) => buildNavalQuayBase(c, "drydock")),
  naval_coast_guard_base: entry("naval_coast_guard_base", (c) => buildNavalQuayBase(c, "coast_guard")),
  naval_destroyer_dock: entry("naval_destroyer_dock", (c) => buildNavalQuayBase(c, "destroyer_dock")),
  naval_carrier_berth: entry("naval_carrier_berth", (c) => buildNavalQuayBase(c, "carrier_berth")),
  naval_amphibious_dock: entry("naval_amphibious_dock", (c) => buildNavalQuayBase(c, "amphib_dock")),
  naval_patrol_cutter: entry("naval_patrol_cutter", (c) => buildNavalVesselDesign(c, "cutter")),
  naval_frigate_ship: entry("naval_frigate_ship", (c) => buildNavalVesselDesign(c, "frigate")),
  naval_minesweeper: entry("naval_minesweeper", (c) => buildNavalVesselDesign(c, "minesweeper")),
  naval_hospital_ship: entry("naval_hospital_ship", (c) => buildNavalVesselDesign(c, "hospital")),

  // Air Force Bases & Wings (6)
  strategic_bomber_wing: entry("strategic_bomber_wing", (c) => buildAirForceBase(c, "b52")),
  stealth_bomber_hangar: entry("stealth_bomber_hangar", (c) => buildAirForceBase(c, "b2")),
  fighter_wing_base: entry("fighter_wing_base", (c) => buildAirForceBase(c, "fighter")),
  airlift_cargo_base: entry("airlift_cargo_base", (c) => buildAirForceBase(c, "cargo")),
  awacs_radar_base: entry("awacs_radar_base", (c) => buildAirForceBase(c, "awacs")),
  underground_missile_silo: entry("underground_missile_silo", buildUndergroundMissileSilo),
  drone_swarm_base: entry("drone_swarm_base", buildDroneSwarmBase),
  drone_recon_base: entry("drone_recon_base", (c) => buildAirForceBase(c, "recon")),

  // Marine Corps (3)
  marine_corps_base: entry("marine_corps_base", (c) => buildLandMilitaryBase(c, "marines")),
  marine_amphib_base: entry("marine_amphib_base", (c) => buildNavalQuayBase(c, "marine_amphib")),
  marine_aviation_wing: entry("marine_aviation_wing", (c) => buildAirForceBase(c, "tiltrotor")),
});
