import {
  type Ctx,
  PixelVox,
  bench,
  bush,
  container,
  door,
  flag,
  gable,
  hip,
  lamp,
  lot,
  person,
  ring,
  tree,
  windows,
} from "./kit";
import * as K from "./kit";
import { defineDesigns } from "./registry";
import { WEALTH_PROJECTS } from "../wealthProjects";
import { quayFoundation } from "./vehicles";

const walls = ["#e7c698", "#dde9db", "#bb765e", "#586f81"],
  trim = ["#97694e", "#288889", "#48654e", "#dea64d"];
function foundation(c: Ctx, water = false) {
  lot(c, water ? "#529cb0" : c.variant === 2 ? "#d2b995" : "#bac7aa");
}
function hall(c: Ctx, x: number, z: number, w: number, d: number, h: number, base = 1) {
  const { v, variant: s } = c;
  v.hollowBox(x, base, z, x + w, base + h, z + d, walls[s], trim[s]);
  windows(c, x, base, z, x + w, base + h, z + d, {
    w: 2,
    h: 2,
    stepH: 4,
    stepV: 4,
    col: s === 3 ? "#8ebacd" : "glass",
  });
  if (w >= 4) door(v, x + 1, base, z + d - 1);
  if (s === 0) gable(v, x - 1, base + h, z - 1, x + w + 1, z + d + 1, "x", "terracotta", "cream");
  if (s === 1) {
    v.box(x - 1, base + h, z - 1, x + w + 1, base + h + 1, z + d + 1, "white");
    v.box(x + 1, base + h + 1, z + 1, x + w - 1, base + h + 2, z + d - 1, "teal");
  }
  if (s === 2) {
    hip(v, x - 1, base + h, z - 1, x + w + 1, z + d + 1, "#586451", "woodLight", 3);
  }
  if (s === 3) {
    for (let i = 0; i < w; i++) {
      const dy = Math.floor((i % 5) / 2);
      v.box(x + i, base + h, z - 1, x + i + 1, base + h + 1 + dy, z + d + 1, "steelDark");
    }
  }
}
function machine(c: Ctx, x: number, y: number, z: number, r: number, axis: "x" | "y" | "z", col: string) {
  const rotor = new PixelVox();
  for (let i = 0; i < 4 + c.variant; i++) {
    const a = (i * Math.PI * 2) / (4 + c.variant);
    for (let d = 0; d <= r; d++) {
      const p = Math.round(Math.cos(a) * d),
        q = Math.round(Math.sin(a) * d);
      rotor.put(
        axis === "x" ? 0 : p,
        axis === "y" ? 0 : axis === "x" ? p : q,
        axis === "y" || axis === "x" ? q : 0,
        d === r ? "warmGlow" : col,
        d === r ? 0.35 : 0,
      );
    }
  }
  c.addRotor({ vox: rotor, axis, pivot: [x, y, z], speed: 0.55 + c.lv * 0.07 });
}
function cart(c: Ctx, cx: number, cz: number, r: number, y: number, col: string, personOn = false) {
  const v = new PixelVox();
  v.box(r - 1, 0, -1, r + 2, 1, 2, "steelDark");
  v.box(r - 1, 1, -1, r + 2, 3, 2, col);
  if (personOn) person(v, r, 3, 0, "sky");
  else v.box(r, 3, -1, r + 2, 4, 1, "crate");
  c.addRotor({ vox: v, pivot: [cx, y, cz], axis: "y", speed: 0.18 + c.lv * 0.035 });
}
function arc(
  c: Ctx,
  x: number,
  z: number,
  r: number,
  start: number,
  end: number,
  y: number,
  h: number,
  col: string,
  width = 1.5,
) {
  for (let dx = -Math.ceil(r + width); dx <= r + width; dx++)
    for (let dz = -Math.ceil(r + width); dz <= r + width; dz++) {
      const d = Math.hypot(dx, dz),
        a = (Math.atan2(dz, dx) + Math.PI * 2) % (Math.PI * 2);
      if (Math.abs(d - r) < width && (start <= end ? a >= start && a <= end : a >= start || a <= end))
        c.v.box(x + dx, y, z + dz, x + dx + 1, y + h, z + dz + 1, col);
    }
}
function pool(c: Ctx, x: number, z: number, r: number, y = 1) {
  c.v.cylinderY(x, z, y, y + 1, r + 1.4, "stone");
  c.v.cylinderY(x, z, y, y + 1, r, "#66b8c6", 0.13);
}
function canopy(c: Ctx, x: number, z: number, r: number, h: number, col: string) {
  c.v.box(x, 1, z, x + 1, h, z + 1, "woodDark");
  const v = c.v;
  if (c.variant === 0) v.cone(x + 0.5, h, h + 3, z + 0.5, r, 0.5, col);
  if (c.variant === 1)
    for (let i = -r; i <= r; i++)
      v.box(
        x + i,
        h + Math.floor(Math.abs(i) / 2),
        z - r,
        x + i + 1,
        h + Math.floor(Math.abs(i) / 2) + 1,
        z + r + 1,
        col,
      );
  if (c.variant === 2) hip(v, x - r, h, z - r, x + r + 1, z + r + 1, col, "woodLight", 3);
  if (c.variant === 3)
    for (let d = -r; d <= r; d++)
      v.box(
        x + d,
        h + Math.floor((d + r) / 2),
        z - r,
        x + d + 1,
        h + Math.floor((d + r) / 2) + 1,
        z + r + 1,
        col,
      );
}
function storage(c: Ctx) {
  foundation(c);
  const { v, lv, hx, hz } = c;
  const r = Math.min(hx, hz) * 0.47,
    x = Math.round(hx * 0.45),
    y = 3 + lv * 2;
  v.cone(-x, 1, y, -2, r + 2, r, "stone");
  pool(c, -x, -2, r, y);
  pool(c, x, 3, r, 1);
  for (let dx = -x; dx <= x; dx++) {
    const pipeY = Math.round(y - ((dx + x) / (2 * x)) * (y - 2));
    v.box(dx, pipeY - 1, 0, dx + 1, pipeY + 1, 2, "steelLight");
  }
  hall(c, x - 3, Math.round(-hz * 0.6), 6, 5, 4 + lv);
  machine(c, x, 4, 2, 2 + Math.floor(lv / 2), "z", "teal");
}
function skyDepot(c: Ctx, teleport = false) {
  foundation(c);
  const { v, lv, hx, hz } = c,
    r = Math.min(hx, hz) - 3;
  const col = teleport ? ["#9c7fc9", "#69c5be", "#d289b1", "#8aa7d7"][c.variant] : trim[c.variant];
  hall(c, -hx + 2, -hz + 2, Math.min(6, hx), Math.min(6, hz), 6 + lv * 3);
  if (teleport) {
    for (let i = 0; i < Math.min(3, lv + 1); i++) {
      const z = -hz + 4 + i * Math.max(3, Math.floor((2 * hz - 8) / Math.min(2, lv)));
      v.ringZ(0, 4 + r * 0.55, z, z + 2, r * 0.7, r * 0.7 - 1.7, col, 0.45);
      v.box(-r, 1, z - 1, r + 1, 3, z + 3, "slate");
    }
    machine(c, 0, 4 + r * 0.55, 0, 2, "z", col);
  } else {
    for (let j = 0; j < lv; j++) {
      const y = 3 + j * 4;
      arc(c, 0, 0, r, 2.8, 2.1, y, 1, j % 2 ? col : "cream", 1.8);
      v.box(-r, y, -1, 1, y + 1, 1, col);
    }
    const deck = 4 * lv - 1;
    v.box(-3, deck, 0, 4, deck + 1, 6, "slate");
    for (const x of [-2, 2]) v.box(x, deck + 1, 1, x + 1, deck + 2, 5, "cream");
    v.box(-1, deck + 1, 2, 2, deck + 2, 3, "cream");
    machine(c, 0, 6 + lv * 3, -3, 2, "y", "steel");
  }
  c.blink(-hx + 3, 7 + lv * 3, -hz + 3, "cyan");
}
function solarOrchard(c: Ctx) {
  foundation(c);
  const { v, lv, hx, hz } = c;
  for (let i = 0; i < lv + 1; i++) {
    const x = Math.round(-hx + 4 + (i * (2 * hx - 9)) / lv);
    for (let z = -hz + 4; z < hz - 2; z += 7) {
      tree(v, x, 1, z, "fruit", 0.78 + (i % 2) * 0.16, i);
      v.box(x, 1, z - 2, x + 1, 8, z - 1, "steel");
      for (let k = -2; k <= 2; k++) {
        const y = 7 + Math.floor((k + 2) / 2);
        v.box(x + k, y, z - 3, x + k + 1, y + 1, z + 1, k === 0 ? "steelLight" : "solarBlue", 0.15);
      }
    }
  }
  machine(c, 0, 9, 0, 2 + Math.floor(lv / 2), "y", "solarBlue");
  cart(c, 0, hz - 4, 2, 1, "wood");
}
function floodpark(c: Ctx) {
  foundation(c);
  const { v, hx, hz, lv } = c,
    r = Math.min(hx, hz) - 4;
  pool(c, 0, 0, r);
  arc(c, 0, 0, r, 0.2, 5.8, 3, 1, "wood", 1.8);
  for (let i = 0; i < lv + 2; i++) {
    const a = (i * 5.4) / (lv + 1);
    const x = Math.round(Math.cos(a) * r),
      z = Math.round(Math.sin(a) * r);
    v.box(x, 1, z, x + 1, 5, z + 1, "woodDark");
    tree(v, x, 4, z, "willow", 0.58 + (i % 2) * 0.2);
  }
  v.box(-2, 1, hz - 5, 3, 4, hz - 3, "steelDark");
  machine(c, 0, 5, hz - 3, 2, "z", trim[c.variant]);
  if (lv >= 3) bench(v, -hx + 3, 1, hz - 4);
}
function arcology(c: Ctx) {
  foundation(c);
  const { v, lv, hx, hz } = c,
    r = Math.min(hx, hz) - 4;
  for (let i = 0; i < lv + 2; i++) {
    const y = 1 + i * 4,
      rr = Math.max(3, r - i * 0.35);
    arc(c, 0, 0, rr, 2.5, 0.65, y, 3, walls[c.variant], 2);
    arc(c, 0, 0, rr + 1, 2.5, 0.65, y + 3, 1, trim[c.variant], 2);
    for (let j = 0; j < 4 + i; j++) {
      const a = 2.6 + (j * 4.02) / (3 + i);
      bush(v, Math.cos(a) * rr, y + 4, Math.sin(a) * rr, 1.4, "leaf");
    }
  }
  v.box(-1, 1, -r, 1, 9 + lv * 4, -r + 1, "glass", 0.4);
  machine(c, 0, 8 + lv * 4, -r + 1, 2, "z", "brass");
  tree(v, 0, 1, 1, "blossom", 1.2);
}
function foundry(c: Ctx) {
  foundation(c);
  const { v, lv, hx, hz } = c,
    r = Math.min(hx, hz) - 4;
  ring(v, 0, 0, 2, 4, r + 1.2, r - 1.1, "steelDark");
  for (let i = 0; i < lv + 1; i++) {
    const a = (i * 2 * Math.PI) / (lv + 1);
    hall(c, Math.round(Math.cos(a) * r) - 2, Math.round(Math.sin(a) * r) - 2, 5, 5, 3 + (i % 3) + lv);
  }
  cart(c, 0, 0, r, 4, "steel");
  v.cylinderY(0, 0, 1, 5 + lv, 2.8, "brickDark");
  v.cylinderY(0, 0, 5 + lv, 6 + lv, 2, "fire", 0.9);
  c.smoke(0, 6 + lv, 0, "spark");
}
function rainvault(c: Ctx) {
  foundation(c);
  const { v, lv, hx, hz } = c,
    r = Math.min(8, hx - 3);
  for (let i = 0; i < lv + 2; i++) {
    const z = Math.round(-hz + 3 + (i * (2 * hz - 7)) / (lv + 1));
    for (let dx = -r; dx <= r; dx++) {
      const y = Math.round(Math.sqrt(Math.max(0, r * r - dx * dx))) + 3 + lv;
      v.box(dx, y, z, dx + 1, y + 2, z + 2, i % 2 ? walls[c.variant] : "glass", 0.22);
      if (Math.abs(dx) === r) v.box(dx, 1, z, dx + 1, y, z + 1, trim[c.variant]);
    }
  }
  pool(c, 0, 0, Math.max(2, r - 2));
  machine(c, 0, 3, hz - 3, 2, "z", "teal");
  if (lv === 5) c.blink(0, r + lv + 6, 0, "cyan");
}
function spaceport(c: Ctx) {
  foundation(c);
  const { v, hx, hz, lv } = c,
    r = Math.min(hx, hz) - 5;
  v.cylinderY(0, 0, 1, 2, r, "slate");
  ring(v, 0, 0, 2, 3, r, r - 1, "hazard");
  const x = -Math.round(r * 0.65),
    h = 7 + lv * 3;
  for (const dx of [-1, 1]) v.box(x + dx, 1, -1, x + dx + 1, h, 1, "steel");
  for (let y = 3; y < h; y += 3) v.box(x - 1, y, -1, x + 3, y + 1, 2, "orange");
  v.box(x, h - 1, -1, 1, h + 1, 1, "steelDark");
  hall(c, hx - 10, -hz + 3, 8, 6, 3 + lv);
  cart(c, 0, 0, r, 2, "steelLight");
  // The launch actor takes over above this reusable pad, including a stationary rocket during preparation.
  v.cylinderY(1, 1, 2, 4, 2, "steelDark");
  c.blink(x, h, 0, "red");
}
function university(c: Ctx) {
  foundation(c);
  const { v, lv, hx, hz } = c,
    x = Math.round(hx * 0.48),
    h = 7 + lv * 5;
  hall(c, -x - 3, -5, 7, 8, h);
  hall(c, x - 3, -1, 7, 8, h - 3);
  for (let i = 0; i < lv; i++) {
    const y = 6 + i * 4;
    v.box(-x, y, 0, x + 1, y + 1, 4, "steel");
    v.box(-x, y + 1, 0, x + 1, y + 4, 4, "glassDark", 0.3);
    v.box(-x, y + 4, 0, x + 1, y + 5, 4, trim[c.variant]);
  }
  machine(c, -x + 1, h + 2, 1, 2, "z", "brass");
  tree(v, -2, 1, hz - 4, "round", 1.3);
}
function oceanRing(c: Ctx) {
  foundation(c, true);
  const { v, lv, hx, hz } = c,
    r = Math.min(hx, hz) - 4;
  arc(c, 0, 0, r, 2.7, 1.8, 1, 2, "steelDark", 2.4);
  arc(c, 0, 0, r, 2.7, 1.8, 3, 1, "woodLight", 2.5);
  for (let i = 0; i < lv + 2; i++) {
    const a = 2.85 + (i * 4.85) / (lv + 1),
      x = Math.round(Math.cos(a) * r),
      z = Math.round(Math.sin(a) * r);
    hall(c, x - 2, z - 2, 4, 4, 3 + (i % 3), 4);
    if (lv >= 3) v.dome(x, 8 + (i % 3), z, 2.4, "glass", 0.3);
  }
  cart(c, 0, 0, Math.max(2, r - 4), 1, "white", true);
}
/** Working buildings share a few construction details, sized to the actual mature parcel. */
function projectDetail(id: string, c: Ctx) {
  const { v, hx, hz, lv, variant: s } = c,
    edge = trim[s],
    side = s % 2 ? -1 : 1;
  const stone = ["#cbb38e", "marble", "brick", "steelLight"][s],
    metal = ["brass", "steel", "#ad8058", "steelDark"][s];
  const cx = Math.round(hx * 0.48) * side,
    cz = Math.round(hz * 0.48);
  function mast(x: number, z: number, h: number) {
    v.box(x - 1, 1, z - 1, x + 1, h, z + 1, metal);
    v.box(x - 2, h, z - 2, x + 2, h + 1, z + 2, edge);
    c.blink(x, h + 1, z, "amber");
  }
  function pipe(x0: number, z0: number, x1: number, z1: number, y: number, col: string) {
    const count = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0), 1));
    for (let i = 0; i <= count; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / count),
        z = Math.round(z0 + ((z1 - z0) * i) / count);
      v.box(x, y, z, x + 2, y + 2, z + 2, col);
      if (i % 7 === 0) v.box(x, y - 2, z, x + 2, y, z + 2, "concrete");
    }
  }
  switch (id) {
    case "pumped_storage_station": {
      const x = Math.round(hx * 0.43),
        z = Math.round(hz * 0.45);
      for (let i = 0; i < lv; i++)
        pipe(-x + i * 2, -2, x + i * 2, z, 3 + (i % 2), ["steel", "steelLight", "#ad8058", "cyan"][s]);
      if (lv >= 2) hall(c, x - 4, z - 3, 6 + lv, 5, 4 + lv);
      break;
    }
    case "solar_canopy_orchard": {
      const x = Math.round(hx * 0.65) * side;
      for (let z = -hz + 3; z < hz - 4; z += 6) {
        const h = 5 + (s === 3 ? 2 : 0);
        v.box(x, 1, z, x + 1, h, z + 1, metal);
        for (let i = -2; i <= 2; i++)
          v.box(
            x + i,
            h + Math.floor((i + 2) / 2),
            z - 1,
            x + i + 1,
            h + Math.floor((i + 2) / 2) + 1,
            z + 2,
            edge,
          );
      }
      if (lv >= 3) hall(c, -hx + 3, hz - 8, 6 + lv, 5, 4);
      break;
    }
    case "floodplain_park": {
      const r = Math.min(hx, hz) - 5;
      for (let i = 0; i < 3 + lv; i++) {
        const a = s * 0.4 + (i * 4.85) / (lv + 2),
          x = Math.round(Math.cos(a) * r * 0.6),
          z = Math.round(Math.sin(a) * r * 0.65);
        v.cylinderY(x, z, 2, 3, 2 + lv / 4, "#96ae6d");
        bush(v, x, 3, z, 1.3, "olive");
        v.put(x - 1, 4, z + 1, "gold");
      }
      const z = Math.round(hz * 0.21);
      for (let x = -Math.round(r * 0.8); x < r * 0.8; x++) {
        const h = 4 + Math.round(Math.cos((x / r) * 1.7) * 2);
        v.box(x, h, z, x + 1, h + 1, z + 3, "woodLight");
        if (!(x % 4)) v.box(x, 2, z, x + 1, h + 3, z + 1, metal);
      }
      if (lv >= 3) canopy(c, -cx, cz, 3, 6, edge);
      break;
    }
    case "materials_foundry": {
      const r = Math.min(hx, hz) * 0.19;
      v.cylinderY(0, 0, 1, 5 + lv, r, "brickDark");
      v.cone(0, 5 + lv, 9 + lv, 0, r + 1, r * 0.6, metal);
      v.cylinderY(0, 0, 9 + lv, 10 + lv, r * 0.5, "fire", 1);
      if (lv >= 2) {
        const x = Math.round(hx * 0.45) * side;
        v.box(x, 1, -2, x + 3, 9 + lv * 2, 1, "hazard");
        pipe(x, -1, -x, -1, 9 + lv * 2, edge);
        v.box(-x, 4, -1, -x + 1, 10 + lv * 2, 0, "steelDark");
      }
      break;
    }
    case "rainwater_cathedral": {
      const r = Math.min(8, hx - 3);
      for (const side of [-1, 1]) {
        const x = side * (r + 1);
        v.box(x, 3, -hz + 2, x + 2, 4, hz - 3, "teal");
        for (let z = -hz + 3; z < hz - 2; z += 6) v.box(x, 1, z, x + 1, 4 + lv, z + 2, stone);
      }
      if (lv >= 3) {
        const r = Math.round(hx * 0.18);
        for (const side of [-1, 1]) {
          const x = side * Math.round(hx * 0.68);
          v.cylinderY(x, cz, 1, 4 + lv, r, stone);
          v.dome(x, 4 + lv, cz, r, edge);
        }
      }
      break;
    }
    case "spaceport": {
      if (lv >= 2) {
        const x = Math.round(hx * 0.55) * side,
          z = Math.round(-hz * 0.5);
        for (let i = 0; i < Math.min(3, lv); i++) {
          v.cylinderY(x + i * 3, z, 1, 4 + lv, 2, "cream");
          v.dome(x + i * 3, 4 + lv, z, 2, edge);
        }
        pipe(x, z, -2, -2, 2, "steelLight");
      }
      mast(-hx + 3, hz - 4, 4 + lv);
      if (lv >= 3) {
        mast(hx - 4, hz - 4, 5 + lv * 2);
        hall(c, -hx + 2, -hz + 3, Math.round(hx * 0.55), 6, 4 + lv);
      }
      break;
    }
    case "skybridge_university": {
      const x = Math.round(hx * 0.48),
        h = 7 + lv * 5;
      for (let i = 0; i < lv; i++) {
        const y = 6 + i * 4;
        v.box(-x + 2, y + 1, 4, x - 1, y + 3, 5, "glass", 0.2);
        for (let j = -x + 2; j < x - 1; j += 3) v.put(j, y + 2, 5, edge);
      }
      if (lv >= 3) {
        hall(c, -hx + 3, -hz + 3, Math.round(hx * 0.55), Math.round(hz * 0.4), Math.round(h * 0.48));
        for (let i = -Math.round(hx * 0.5); i < Math.round(hx * 0.5); i += 5)
          tree(v, i, 1, hz - 4, s % 2 ? "cypress" : "round", 0.9);
      }
      break;
    }
    case "ocean_habitat_ring": {
      const r = Math.min(hx, hz) - 4;
      for (let i = 0; i < lv + 2; i++) {
        const a = 3.1 + (i * 4) / (lv + 1),
          x = Math.round(Math.cos(a) * r * 0.62),
          z = Math.round(Math.sin(a) * r * 0.62);
        ring(v, x, z, 1, 2, 2 + lv * 0.25, 1 + lv * 0.25, edge);
        v.put(x, 1, z, "orange");
      }
      if (lv >= 3) {
        const x = Math.round(hx * 0.6) * side,
          z = -Math.round(hz * 0.42);
        v.cylinderY(x, z, 2, 4, 4, "steel");
        v.dome(x, 4, z, 4, "glass", 0.25);
      }
      break;
    }
    case "flying_car_depot":
    case "teleportation_depot":
    case "hanging_garden_arcology": {
      const z = hz - 3;
      v.box(-hx + 2, 1, z - 1, hx - 2, 2, z + 1, stone);
      lamp(v, -hx + 3, 1, z, 3 + lv);
      if (lv >= 2) bench(v, hx - 5, 1, z);
      if (lv >= 4 && id === "hanging_garden_arcology") v.box(-1, 1, z - 2, 2, 5, z, "water", 0.25);
      break;
    }
  }
}

// ==== ROUND2 BEGIN
// ---------------------------------------------------------------------------------------------
// ROUND 2 REDESIGN (growers_exchange … maritime_college). Every builder below draws the whole
// parcel itself (no shared projectDetail). Four house styles match designStyles.json labels:
//   0 Terracotta        — Mediterranean stucco, clay-tile gables, arches, warm ochre ground
//   1 White & teal      — crisp modernist: white slabs, teal fascias, cantilevered flat roofs
//   2 Brick & evergreen — Victorian industrial: red brick, evergreen iron, sawtooth / steep gables
//   3 Slate & brass     — art-deco night style: slate walls, stepped brass crowns, glowing trim
// ---------------------------------------------------------------------------------------------
interface PStyle {
  wall: string;
  wall2: string;
  roof: string;
  trim: string;
  accent: string;
  glass: string;
  metal: string;
  ground: string;
  path: string;
  awnA: string;
  awnB: string;
  livery: string;
}
const PS: PStyle[] = [
  { wall: "#f0dcb4", wall2: "#dba56d", roof: "terracotta", trim: "#8a5a3a", accent: "#2f8f8a", glass: "glass", metal: "#8a6a4a", ground: "#cfc08f", path: "#e2cfa3", awnA: "terracotta", awnB: "cream", livery: "#d0643a" },
  { wall: "white", wall2: "#d6ece7", roof: "#2aa198", trim: "#1d7a73", accent: "teal", glass: "glass", metal: "steelLight", ground: "#b8cdb0", path: "concrete", awnA: "teal", awnB: "white", livery: "#25a7a0" },
  { wall: "brick", wall2: "#8c3b2b", roof: "#2f5d3a", trim: "#1f4a2c", accent: "cream", glass: "glass", metal: "#2e4a36", ground: "#9fb38a", path: "stone", awnA: "#2f6b3e", awnB: "cream", livery: "#2f7a45" },
  { wall: "#4f5d6b", wall2: "#36424e", roof: "#2b333c", trim: "brass", accent: "gold", glass: "#a8d4e4", metal: "brass", ground: "#a9b0a2", path: "slateLight", awnA: "#2f3a46", awnB: "brass", livery: "#1f2a44" },
];
const ps = (c: Ctx): PStyle => PS[c.variant & 3];
const lvPick = <T,>(c: Ctx, a: readonly [T, T, T, T, T]): T => a[Math.max(1, Math.min(5, c.lv)) - 1];

/** Style roof over the box [x0,x1)×[z0,z1) whose walls end at y. Returns the top y. */
function sroof(c: Ctx, x0: number, y: number, z0: number, x1: number, z1: number, axis: "x" | "z" = "x"): number {
  const { v } = c,
    s = ps(c);
  const k = c.variant & 3;
  if (k === 0) return gable(v, x0 - 1, y, z0 - 1, x1 + 1, z1 + 1, axis, s.roof, s.trim, s.wall);
  if (k === 1) {
    v.box(x0 - 2, y, z0 - 2, x1 + 2, y + 1, z1 + 2, "white");
    v.box(x0 - 2, y, z1 + 1, x1 + 2, y + 1, z1 + 2, s.accent);
    if (x1 - x0 > 4 && z1 - z0 > 4) v.box(x0 + 1, y + 1, z0 + 1, x1 - 1, y + 2, z1 - 1, "#cfe9e4");
    return y + 2;
  }
  if (k === 2) {
    const span = axis === "x" ? x1 - x0 : z1 - z0;
    if (span >= 12 && z1 - z0 >= 5) {
      K.sawtooth(v, x0, y, z0, x1, z1, s.roof, "glass", 4);
      return y + 3;
    }
    return gable(v, x0 - 1, y, z0 - 1, x1 + 1, z1 + 1, axis, s.roof, "#5b2a20");
  }
  // stepped deco crown with brass edges
  v.box(x0 - 1, y, z0 - 1, x1 + 1, y + 1, z1 + 1, "brass");
  v.box(x0, y, z0, x1, y + 1, z1, s.roof);
  let t = y + 1;
  for (let i = 1; i <= 3; i++) {
    const a = i * 2;
    if (x1 - x0 - 2 * a < 2 || z1 - z0 - 2 * a < 2) break;
    v.box(x0 + a - 1, t, z0 + a - 1, x1 - a + 1, t + 2, z1 - a + 1, s.wall2);
    v.box(x0 + a - 1, t + 1, z0 + a - 1, x1 - a + 1, t + 2, z1 - a + 1, "brass");
    v.box(x0 + a, t + 1, z0 + a, x1 - a, t + 2, z1 - a, s.wall2);
    t += 2;
  }
  return t;
}

/** A styled building: hollow walls, windows, a front door, and a style roof. Returns the roof top. */
function sbldg(
  c: Ctx,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  h: number,
  o: { y?: number; roof?: boolean; axis?: "x" | "z"; door?: boolean; wall?: string; win?: string; emit?: number } = {},
): number {
  const { v } = c,
    s = ps(c),
    y = o.y ?? 1;
  v.hollowBox(x0, y, z0, x1, y + h, z1, o.wall ?? s.wall, s.trim);
  if (h >= 4)
    windows(c, x0, y, z0, x1, y + h, z1, {
      col: o.win ?? s.glass,
      w: 2,
      h: 2,
      stepH: 4,
      stepV: 4,
      startY: 1,
      emit: o.emit ?? 0.4,
      margin: 1,
    });
  if (o.door !== false && x1 - x0 >= 5) door(v, Math.floor((x0 + x1) / 2) - 1, y, z1 - 1, s.trim, 2, 3, true);
  if (c.variant === 0 && h >= 5) v.box(x0, y + h - 1, z0, x1, y + h, z1, s.wall2);
  if (c.variant === 2) v.box(x0, y + Math.min(h - 1, 3), z1 - 1, x1, y + Math.min(h, 4), z1, "cream");
  if (o.roof === false) return y + h;
  return sroof(c, x0, y + h, z0, x1, z1, o.axis ?? (x1 - x0 >= z1 - z0 ? "x" : "z"));
}

/** Fill a heightfield column without solid interiors: only the visible skin is drawn. */
function heightfield(
  c: Ctx,
  hf: (x: number, z: number) => number,
  col: (x: number, y: number, z: number, top: boolean) => string,
): void {
  const { v, hx, hz } = c;
  for (let x = -hx; x < hx; x++)
    for (let z = -hz; z < hz; z++) {
      const h = hf(x, z);
      if (h <= 0) continue;
      const nb = Math.min(
        x > -hx ? hf(x - 1, z) : 0,
        x < hx - 1 ? hf(x + 1, z) : 0,
        z > -hz ? hf(x, z - 1) : 0,
        z < hz - 1 ? hf(x, z + 1) : 0,
      );
      for (let y = Math.max(1, Math.min(h, nb + 1)); y <= h; y++) v.put(x, y, z, col(x, y, z, y === h));
    }
}

/** Little crowd of people scattered in a rectangle. */
function crowd(c: Ctx, x0: number, z0: number, x1: number, z1: number, n: number, y = 1) {
  const shirts = ["red", "blue", "yellow", "teal", "pink", "orange", "white", "purple", "lime"];
  for (let i = 0; i < n; i++) person(c.v, c.ri(x0, x1 - 1), y, c.ri(z0, z1 - 1), c.pick(shirts), c.pick(["blueDark", "charcoal", "woodDark"]));
}

// GROWERS' EXCHANGE — a produce market that becomes a regional auction house. Signature: a giant
// fruit mascot (0 lemon, 1 red apple, 2 pumpkin, 3 grape bunch) that climbs higher every level.
// Lv1 cart + parasol → Lv2 three-stall court under an entry arch → Lv3 round auction ring with tiered
// benches → Lv4 arcaded market hall + ring + lorries → Lv5 grand exchange hall, clock tower, price board.
const PRODUCE = ["red", "orange", "yellow", "leaf", "purple", "lime", "crimson", "#f2a03d"];
function giantFruit(c: Ctx, x: number, y: number, z: number, r: number): number {
  const { v } = c;
  const k = c.variant & 3;
  if (k === 0) {
    v.sphere(x, y + r, z, r * 1.3, r, r, "yellow");
    v.put(Math.floor(x + r * 1.3), y + Math.round(r), Math.floor(z), "#e8d33a");
    v.box(Math.floor(x), y + Math.round(2 * r), Math.floor(z), Math.floor(x) + 2, y + Math.round(2 * r) + 1, Math.floor(z) + 1, "leaf");
    return y + Math.round(2 * r) + 1;
  }
  if (k === 1) {
    v.sphere(x, y + r, z, r, r * 0.95, r, "red");
    v.put(Math.floor(x - r * 0.5), y + Math.round(r * 1.3), Math.floor(z + r * 0.7), "white", 0.2);
    v.box(Math.floor(x), y + Math.round(2 * r) - 1, Math.floor(z), Math.floor(x) + 1, y + Math.round(2 * r) + 2, Math.floor(z) + 1, "woodDark");
    v.box(Math.floor(x) + 1, y + Math.round(2 * r) + 1, Math.floor(z), Math.floor(x) + 3, y + Math.round(2 * r) + 2, Math.floor(z) + 1, "leaf");
    return y + Math.round(2 * r) + 2;
  }
  if (k === 2) {
    v.sphere(x, y + r * 0.8, z, r * 1.35, r * 0.8, r * 1.2, "orange");
    for (const dx of [-r * 0.7, 0, r * 0.7]) v.box(Math.floor(x + dx), y, Math.floor(z + r * 1.2) - 1, Math.floor(x + dx) + 1, y + Math.round(r * 1.5), Math.floor(z + r * 1.2), "#d9681e");
    v.box(Math.floor(x), y + Math.round(1.6 * r), Math.floor(z), Math.floor(x) + 1, y + Math.round(1.6 * r) + 2, Math.floor(z) + 1, "leafDark");
    return y + Math.round(1.6 * r) + 2;
  }
  // grape bunch
  for (let row = 0; row < 4; row++) {
    const rr = Math.max(0, 3 - row) * (r / 3);
    const yy = y + Math.round(r * 2) - Math.round(row * r * 0.55);
    for (let a = 0; a < Math.max(1, 3 - row) * 2; a++) {
      const ang = (a / Math.max(1, (3 - row) * 2)) * Math.PI * 2 + row;
      v.sphere(x + Math.cos(ang) * rr * 0.7, yy, z + Math.sin(ang) * rr * 0.7, r * 0.42, r * 0.42, r * 0.42, row % 2 ? "purple" : "purpleDark");
    }
  }
  v.box(Math.floor(x) - 1, y + Math.round(r * 2.4), Math.floor(z), Math.floor(x) + 3, y + Math.round(r * 2.4) + 1, Math.floor(z) + 1, "leaf");
  return y + Math.round(r * 2.4) + 1;
}
function produceStall(c: Ctx, x: number, z: number, w: number) {
  const { v } = c,
    s = ps(c);
  v.box(x, 1, z, x + w, 3, z + 3, c.variant === 1 ? "white" : c.variant === 3 ? "#3a4552" : "wood");
  for (let i = 0; i < w; i += 2) v.box(x + i, 3, z, Math.min(x + w, x + i + 2), 4, z + 3, PRODUCE[(i / 2 + c.variant + (x & 7)) % PRODUCE.length]);
  for (const px of [x, x + w - 1]) v.box(px, 1, z - 1, px + 1, 7, z, "woodDark");
  for (let i = 0; i < w; i++) {
    const col = i % 2 ? s.awnB : s.awnA;
    v.box(x + i, 7, z - 1, x + i + 1, 8, z + 1, col);
    v.box(x + i, 6, z + 1, x + i + 1, 7, z + 3, col);
  }
  person(v, x + Math.floor(w / 2), 1, z - 1, c.pick(["red", "leaf", "orange"]));
}
function crateStack(c: Ctx, x: number, z: number, n: number) {
  for (let i = 0; i < n; i++) {
    c.v.box(x + (i % 2) * 2, 1 + Math.floor(i / 2) * 2, z, x + (i % 2) * 2 + 2, 3 + Math.floor(i / 2) * 2, z + 2, "crate");
    c.v.box(x + (i % 2) * 2, 2 + Math.floor(i / 2) * 2, z, x + (i % 2) * 2 + 2, 3 + Math.floor(i / 2) * 2, z + 2, PRODUCE[(i + c.variant) % PRODUCE.length]);
  }
}
function auctionRing(c: Ctx, cx: number, cz: number, r: number, tiers: number) {
  const { v } = c,
    s = ps(c);
  v.cylinderY(cx, cz, 0, 1, r, "sand");
  ring(v, cx, cz, 1, 2, r, r - 1, s.trim);
  for (let t = 1; t <= tiers; t++) {
    ring(v, cx, cz, 1, 1 + t, r + t * 2, r + t * 2 - 2, t % 2 ? s.wall2 : s.wall);
    for (let a = 0; a < 6 + t * 2; a++) {
      const ang = (a / (6 + t * 2)) * Math.PI * 2 + t;
      if (c.rand() < 0.6) person(v, Math.floor(cx + Math.cos(ang) * (r + t * 2 - 1)), 1 + t, Math.floor(cz + Math.sin(ang) * (r + t * 2 - 1)), c.pick(["red", "blue", "yellow", "white", "teal"]));
    }
  }
  // auctioneer's rostrum and lots of produce on the sand
  v.box(cx - 1, 1, cz - 2, cx + 2, 3, cz, s.trim);
  person(v, cx, 3, cz - 1, "white", "charcoal");
  crateStack(c, cx - 3, cz + 1, 2);
  crateStack(c, cx + 1, cz + 1, 3);
}
function priceBoard(c: Ctx, x0: number, x1: number, y: number, z: number) {
  const { v } = c;
  v.box(x0, y, z, x1, y + 4, z + 1, "charcoal");
  for (let x = x0 + 1; x < x1 - 1; x += 2)
    for (let yy = y + 1; yy < y + 3; yy++) v.put(x, yy, z + 1, (x + yy) % 3 ? "screenGreen" : "amber", 0.9);
  v.box(x0, y - 1, z, x0 + 1, y, z + 1, "steelDark");
}
function growersExchange(c: Ctx) {
  const { v, lv, hx, hz } = c,
    s = ps(c),
    k = c.variant & 3;
  lot(c, s.ground);
  K.speckle(c, s.path, 0.25);
  if (lv === 1) {
    // a produce cart under a big parasol
    v.box(-4, 2, -2, 5, 3, 3, k === 1 ? "white" : k === 3 ? "#3a4552" : "wood");
    for (const z of [-3, 3]) for (const x of [-2, 3]) v.box(x, 1, z, x + 1, 3, z + 1, "rubber");
    v.box(-6, 2, 0, -4, 3, 1, "woodDark");
    for (let i = 0; i < 4; i++) v.box(-4 + i * 2, 3, -2, -2 + i * 2, 4, 3, PRODUCE[(i + k) % PRODUCE.length]);
    v.box(0, 4, 0, 1, 10, 1, "woodDark");
    if (k === 0) for (let r = 6; r > 0; r--) v.cylinderY(0.5, 0.5, 16 - r, 17 - r, r, r % 2 ? s.awnA : s.awnB);
    else if (k === 1) {
      v.box(-6, 10, -6, 7, 11, 7, "white");
      v.box(-6, 10, 6, 7, 11, 7, "teal");
      v.box(-6, 10, -6, 7, 11, -5, "teal");
    } else if (k === 2) gable(v, -6, 10, -6, 7, 7, "x", s.roof, "cream");
    else {
      hip(v, -6, 10, -6, 7, 7, s.wall2, "brass", 2);
      v.put(0, 12, 0, "brass");
    }
    giantFruit(c, 0.5, k === 0 ? 16 : k === 2 ? 17 : 12, 0.5, 1.6);
    person(v, 6, 1, 0, "leaf");
    person(v, -1, 1, 5, "pink");
    v.box(-6, 1, 5, -3, 4, 6, "charcoal");
    v.put(-5, 3, 6, "red");
    v.put(-4, 2, 6, "yellow");
    return;
  }
  if (lv === 2) {
    const w = Math.floor((2 * hx - 6) / 3);
    for (let i = 0; i < 3; i++) produceStall(c, -hx + 2 + i * (w + 1), -hz + 3, w);
    // entry arch across the front lane with the fruit on top
    for (const x of [-hx + 3, hx - 4]) v.box(x, 1, hz - 2, x + 1, 10, hz - 1, s.trim);
    v.box(-hx + 3, 10, hz - 2, hx - 3, 11, hz - 1, s.awnA);
    giantFruit(c, 0.5, 11, hz - 1.5, 1.7);
    crateStack(c, -2, 1, 3);
    crowd(c, -hx + 2, 1, hx - 2, hz - 2, 5);
    return;
  }
  if (lv === 3) {
    auctionRing(c, 0, -3, 5, 2);
    produceStall(c, -hx + 1, hz - 5, 8);
    produceStall(c, hx - 9, hz - 5, 8);
    priceBoard(c, -6, 7, 6, -hz + 1);
    for (const x of [-6, 6]) v.box(x, 1, -hz + 1, x + 1, 6, -hz + 2, "steelDark");
    v.box(-hx + 2, 1, -hz + 2, -hx + 3, 12, -hz + 3, s.trim);
    giantFruit(c, -hx + 2.5, 12, -hz + 2.5, 2.2);
    crowd(c, -4, hz - 6, 4, hz - 1, 3);
    return;
  }
  // Lv4/5: an arcaded market hall across the back
  const hallZ1 = lv === 4 ? -2 : -8,
    hallH = lv === 4 ? 7 : 9;
  const x0 = -hx + 2,
    x1 = hx - 2,
    z0 = -hz + 1;
  v.box(x0, 1, z0, x1, 1 + hallH, z0 + 1, s.wall);
  v.box(x0, 1, z0, x0 + 1, 1 + hallH, hallZ1, s.wall);
  v.box(x1 - 1, 1, z0, x1, 1 + hallH, hallZ1, s.wall);
  for (let x = x0; x < x1; x += 4) {
    v.box(x, 1, hallZ1 - 1, x + 1, 1 + hallH, hallZ1, s.trim);
    if (k === 0 || k === 2) v.box(x + 1, hallH - 1, hallZ1 - 1, x + 4, hallH + 1, hallZ1, s.wall2);
  }
  v.box(x0, hallH, hallZ1 - 1, x1, 1 + hallH, hallZ1, s.wall2);
  v.box(x0, 0, z0, x1, 1, hallZ1, s.path);
  const roofTop = k === 2 ? K.barrelRoof(v, x0 - 1, 1 + hallH, z0 - 1, x1 + 1, hallZ1 + 1, "x", s.roof, "cream") : sroof(c, x0, 1 + hallH, z0, x1, hallZ1, "x");
  const inner = Math.floor((x1 - x0 - 4) / 9);
  for (let i = 0; i < inner; i++) produceStall(c, x0 + 2 + i * 9, z0 + 3, 7);
  if (lv === 4) {
    giantFruit(c, 0.5, roofTop, (z0 + hallZ1) / 2, 2.6);
    auctionRing(c, -hx + 11, hz - 8, 4, 1);
    K.truck(v, hx - 8, 1, hz - 9, "x", PRODUCE[k], s.livery);
    K.truck(v, hx - 8, 1, hz - 4, "x", "white", s.livery);
    crateStack(c, 0, hz - 8, 4);
    crowd(c, -6, 2, 6, hz - 2, 5);
    return;
  }
  // Lv5: clock tower + price board + full ring + produce lorries
  const tx = 0,
    tz = Math.round((z0 + hallZ1) / 2);
  v.box(tx - 3, 1, tz - 3, tx + 3, roofTop + 9, tz + 3, s.wall);
  v.box(tx - 3, roofTop + 9, tz - 3, tx + 3, roofTop + 10, tz + 3, s.trim);
  K.clockFace(v, tx, roofTop + 6, tz + 3, 2, "white", "black");
  const crown = k === 0 ? K.hip(v, tx - 4, roofTop + 10, tz - 4, tx + 4, tz + 4, s.roof, s.trim) : k === 1 ? roofTop + 11 : k === 2 ? K.hip(v, tx - 4, roofTop + 10, tz - 4, tx + 4, tz + 4, s.roof, "#5b2a20", 2) : sroof(c, tx - 3, roofTop + 10, tz - 3, tx + 3, tz + 3);
  if (k === 1) v.box(tx - 4, roofTop + 10, tz - 4, tx + 4, roofTop + 11, tz + 4, "teal");
  giantFruit(c, tx, crown, tz, 3);
  priceBoard(c, -hx + 4, -6, hallH + 3, hallZ1);
  priceBoard(c, 6, hx - 4, hallH + 3, hallZ1);
  auctionRing(c, 0, 6, 5, 2);
  for (let i = 0; i < 3; i++) K.truck(v, -hx + 6 + i * 11, 1, hz - 3, "x", PRODUCE[(i + k) % PRODUCE.length], s.livery);
  produceStall(c, -hx + 2, 2, 8);
  produceStall(c, hx - 10, 2, 8);
  for (const x of [-hx + 3, hx - 4]) flag(v, x, 1, hz - 7, 12, [s.awnA, s.awnB, "leaf"]);
  crowd(c, -hx + 3, -4, hx - 3, hz - 6, 8);
}

// BAKERY CO-OP — wood-fired bakery growing into a bread court. Signature: smoking ovens/chimneys and a
// giant bread sign (0 round country loaf, 1 croissant, 2 pretzel, 3 neon baguette).
// Lv1 outdoor dome oven → Lv2 bakehouse + hanging sign → Lv3 row of three shopfronts with chimneys →
// Lv4 arched bread arcade with café → Lv5 U-shaped co-op court around a spinning flour windmill.
function breadSign(c: Ctx, x: number, y: number, z: number, r: number): number {
  const { v } = c,
    k = c.variant & 3;
  if (k === 0) {
    v.sphere(x, y + r * 0.7, z, r * 1.3, r * 0.75, r, "#c98b45");
    for (const dx of [-r * 0.6, 0, r * 0.6]) v.box(Math.floor(x + dx), y + Math.round(r * 1.2), Math.floor(z) - 1, Math.floor(x + dx) + 1, y + Math.round(r * 1.2) + 1, Math.floor(z) + 1, "#f2dca8");
    return y + Math.round(r * 1.5);
  }
  if (k === 1) {
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI * (0.1 + (0.8 * i) / 8);
      const rr = r * (0.5 + 0.5 * Math.sin(a)) * 0.55 + 0.6;
      v.sphere(x + Math.cos(a) * r * 1.5, y + r * 0.4 + Math.sin(a) * r * 1.1, z, rr, rr, rr, i % 2 ? "#e0a24a" : "#c7832e", 0.1);
    }
    return y + Math.round(r * 2);
  }
  if (k === 2) {
    const R = r * 1.3;
    for (let i = 0; i < 40; i++) {
      const t = (i / 40) * Math.PI * 2;
      // pretzel = two lobes + a twist
      const px = Math.sin(t) * R,
        py = Math.sin(2 * t) * R * 0.55 + Math.cos(t) * 0.2;
      v.box(Math.floor(x + px), Math.floor(y + R * 0.8 + py), Math.floor(z), Math.floor(x + px) + 1, Math.floor(y + R * 0.8 + py) + 1, Math.floor(z) + 1, "#8a4a1e");
    }
    v.put(Math.floor(x), Math.floor(y + R * 0.8), Math.floor(z) + 1, "white");
    return y + Math.round(R * 1.6);
  }
  // neon baguette on a brass frame
  const len = Math.round(r * 3);
  for (let i = -len; i <= len; i++) {
    const yy = Math.floor(y + 1 + (i + len) * 0.25);
    v.box(Math.floor(x) + i, yy, Math.floor(z), Math.floor(x) + i + 1, yy + 2, Math.floor(z) + 1, i % 3 === 0 ? "#ffd27a" : "#e09a3c", 0.7);
  }
  return Math.floor(y + 1 + len * 0.5) + 2;
}
function bakeOven(c: Ctx, x: number, z: number, r: number) {
  const { v } = c,
    k = c.variant & 3;
  v.box(x - r - 1, 1, z - r - 1, x + r + 2, 3, z + r + 2, k === 1 ? "concrete" : k === 3 ? "#36424e" : "stone");
  v.dome(x + 0.5, 3, z + 0.5, r + 0.5, ["#c8744a", "#f4f1ea", "brick", "#5a6673"][k]);
  v.box(x - 1, 3, z + r, x + 2, 5, z + r + 2, "charcoal");
  v.box(x, 3, z + r + 1, x + 1, 4, z + r + 2, "fire", 1.4);
  const top = 3 + r + 4;
  v.box(x, 3 + r - 1, z - 1, x + 1, top, z, k === 3 ? "brass" : "brickDark");
  c.smoke(x, top, z - 1, "smoke");
}
function loafRack(c: Ctx, x: number, z: number, w: number) {
  const { v } = c;
  v.box(x, 1, z, x + w, 3, z + 2, "woodDark");
  for (let i = 0; i < w; i++) v.put(x + i, 3, z + (i % 2), i % 3 ? "#c98b45" : "#e6b46a");
}
function bakeryCoop(c: Ctx) {
  const { v, lv, hx, hz } = c,
    s = ps(c),
    k = c.variant & 3;
  lot(c, s.ground);
  K.speckle(c, s.path, 0.3);
  if (lv === 1) {
    bakeOven(c, 0, -3, 3);
    for (let i = 0; i < 3; i++) v.box(-7, 1 + i, -6 + i, -4, 2 + i, -1, "woodDark");
    loafRack(c, 2, 4, 5);
    person(v, -2, 1, 3, "white", "charcoal");
    v.box(-1, 2, 3, 0, 3, 6, "wood");
    v.box(-6, 1, 5, -5, 9, 6, s.trim);
    breadSign(c, -5, 9, 5.5, 1.2);
    return;
  }
  if (lv === 2) {
    const bx1 = -1;
    const top = sbldg(c, -hx + 1, -hz + 2, bx1, hz - 2, 6, { axis: "x" });
    v.box(-hx + 3, 1, -hz + 2, -hx + 6, top + 3, -hz + 4, "brickDark");
    c.smoke(-hx + 4, top + 3, -hz + 3, "smoke");
    // projecting sign bracket
    v.box(bx1, 7, hz - 3, bx1 + 4, 8, hz - 2, "iron");
    breadSign(c, bx1 + 3, 1 + 3, hz - 2.5, 1.4);
    bakeOven(c, hx - 7, -2, 3);
    loafRack(c, 2, hz - 3, 5);
    bench(v, hx - 6, 1, hz - 2, "x", "wood");
    crowd(c, 1, 2, hx - 2, hz - 1, 3);
    return;
  }
  if (lv === 3) {
    const w = Math.floor((2 * hx - 4) / 3);
    for (let i = 0; i < 3; i++) {
      const x0 = -hx + 2 + i * w,
        h = [6, 8, 7][i];
      v.hollowBox(x0, 1, -2, x0 + w - 1, 1 + h, hz - 4, i === 1 ? s.wall2 : s.wall, s.trim);
      v.box(x0 + 1, 2, hz - 5, x0 + w - 2, 5, hz - 4, "#ffd896", 0.6);
      for (let x = x0 + 1; x < x0 + w - 2; x += 2) v.put(x, 2, hz - 4, "#c98b45");
      K.awning(v, x0, x0 + w - 1, 6, hz - 4, i === 1 ? s.awnB : s.awnA, i === 1 ? s.awnA : s.awnB);
      const top = sroof(c, x0, 1 + h, -2, x0 + w - 1, hz - 4, "z");
      v.box(x0 + 1, 1 + h, -1, x0 + 3, top + 2, 1, "brickDark");
      c.smoke(x0 + 2, top + 2, 0, "smoke");
      if (i === 1) breadSign(c, x0 + w / 2 - 0.5, top + 1, hz - 6, 2.2);
    }
    bakeOven(c, -hx + 6, -hz + 5, 2);
    bakeOven(c, hx - 7, -hz + 5, 2);
    for (let i = 0; i < 4; i++) v.box(-3 + i * 2, 1, -hz + 3, -2 + i * 2, 3, -hz + 5, "cream");
    crowd(c, -hx + 2, hz - 3, hx - 2, hz - 1, 4);
    return;
  }
  if (lv === 4) {
    const x0 = -hx + 3,
      x1 = hx - 3,
      z0 = -hz + 2,
      z1 = 3,
      h = 8;
    v.hollowBox(x0, 1, z0, x1, 1 + h, z1, s.wall, s.trim);
    for (let x = x0 + 2; x + 3 < x1; x += 5) {
      v.clear(x, 1, z1 - 1, x + 3, 5, z1);
      v.box(x, 5, z1 - 1, x + 3, 6, z1, s.wall2);
      v.put(x + 1, 5, z1 - 1, null);
      v.put(x + 1, 4, z1 - 2, "#ffd896", 0.8);
    }
    const top = sroof(c, x0, 1 + h, z0, x1, z1, "x");
    for (let i = 0; i < 3; i++) {
      const cx = x0 + 6 + i * Math.floor((x1 - x0 - 12) / 2);
      v.box(cx, 1, z0 + 1, cx + 2, top + 4, z0 + 3, k === 3 ? "#2b333c" : "brickDark");
      c.smoke(cx + 1, top + 4, z0 + 2, "smoke");
    }
    breadSign(c, 0, top, (z0 + z1) / 2 + 2, 2.6);
    for (let i = 0; i < 4; i++) {
      const tx = -hx + 6 + i * Math.floor((2 * hx - 12) / 3),
        tz = hz - 6;
      v.box(tx, 1, tz, tx + 1, 6, tz + 1, "steelDark");
      v.cylinderY(tx + 0.5, tz + 0.5, 6, 7, 3, i % 2 ? s.awnA : s.awnB);
      v.box(tx - 1, 2, tz - 1, tx + 2, 3, tz + 2, "white");
      person(v, tx - 2, 1, tz, "pink");
    }
    K.car(v, hx - 6, 1, hz - 2, "x", s.livery);
    return;
  }
  // Lv5 U-shaped court with a flour windmill
  const h = 9;
  const bw = Math.round(hz * 0.5);
  sbldg(c, -hx + 2, -hz + 2, hx - 2, -hz + 2 + bw, h, { axis: "x" });
  sbldg(c, -hx + 2, -hz + 2 + bw, -hx + 12, hz - 8, h - 2, { axis: "z", door: false });
  sbldg(c, hx - 12, -hz + 2 + bw, hx - 2, hz - 8, h - 2, { axis: "z", door: false });
  for (const x of [-hx + 6, -hx + 16, hx - 18, hx - 8]) {
    v.box(x, 1, -hz + 3, x + 2, h + 10, -hz + 5, k === 3 ? "#2b333c" : "brickDark");
    c.smoke(x + 1, h + 10, -hz + 4, "smoke");
  }
  breadSign(c, 0, h + 7, -hz + 2 + bw - 1, 3.2);
  // windmill in the court
  const wz = 2;
  v.cone(0.5, 1, 18, wz + 0.5, 4, 2.6, k === 1 ? "white" : k === 3 ? "#4f5d6b" : k === 2 ? "brick" : "#efe2c4");
  v.cone(0.5, 18, 22, wz + 0.5, 3.2, 0.6, s.roof);
  door(v, 0, 1, wz + 4, s.trim, 2, 3, true);
  const sails = new PixelVox();
  for (let a = 0; a < 4; a++) {
    const ang = (a * Math.PI) / 2;
    for (let d = 1; d <= 9; d++) {
      const px = Math.round(Math.cos(ang) * d),
        py = Math.round(Math.sin(ang) * d);
      sails.put(px, py, 0, "woodDark");
      if (d > 2) sails.put(px + Math.round(-Math.sin(ang) * 1), py + Math.round(Math.cos(ang) * 1), 0, k === 3 ? "brass" : "cream");
    }
  }
  sails.put(0, 0, 0, "iron");
  c.addRotor({ vox: sails, pivot: [0, 17, wz + 5], axis: "z", speed: 0.6, wind: true });
  for (let i = 0; i < 4; i++) {
    const tx = -hx + 15 + (i % 2) * 6 + (i > 1 ? 2 * hx - 36 : 0);
    v.cylinderY(tx + 0.5, hz - 12.5, 6, 7, 2.5, i % 2 ? s.awnA : s.awnB);
    v.box(tx, 1, hz - 13, tx + 1, 6, hz - 12, "steelDark");
  }
  K.truck(v, -hx + 8, 1, hz - 3, "x", "white", s.livery);
  K.truck(v, hx - 8, 1, hz - 3, "x", "cream", s.livery);
  crowd(c, -8, hz - 10, 8, hz - 4, 6);
}

// OPEN-PIT MINE — a stepped crater that deepens each level (rim height 3→14, benches 1→6) with a
// straight haul ramp, dump trucks on the benches and dust plumes. Lv1 test cut + drill rig → Lv2
// switchback pit + excavator → Lv3 haul benches + conveyor to an ore pile & crusher → Lv4 deep mine with
// rail load-out silo + floodlights → Lv5 basin with a turquoise pit lake and a spinning bucket-wheel.
// Variants = geology & fleet: 0 red copper (yellow trucks), 1 white limestone quarry (orange/white),
// 2 coal seam with evergreen rim (green trucks), 3 slate with glinting gold veins (black & brass).
const STRATA = [
  ["#b5653a", "#9a4f2c", "#c98a55", "#7d3f22"],
  ["#ece6d4", "#d8cfb6", "#c4bba0", "#f5f0e2"],
  ["#4a423a", "#2f2b27", "#6b5a44", "#3a3632"],
  ["#7c8590", "#5f6873", "#949ca6", "#4d5560"],
];
const BENCH = ["#dcae7c", "#fbf8ee", "#8a7a62", "#b9c1ca"];
function haulTruck(c: Ctx, x: number, y: number, z: number, axis: "x" | "z", ore: string) {
  const { v } = c,
    k = c.variant & 3;
  const body = ["busYellow", "orange", "#3f8a4a", "#23272e"][k],
    trimCol = ["charcoal", "white", "cream", "brass"][k];
  const L = axis === "x" ? [x - 3, x + 3, z - 2, z + 2] : [x - 2, x + 2, z - 3, z + 3];
  v.box(L[0], y, L[2], L[1], y + 2, L[3], "rubber");
  v.box(L[0], y + 1, L[2], L[1], y + 3, L[3], body);
  if (axis === "x") {
    v.box(x - 3, y + 3, z - 2, x + 1, y + 4, z + 2, ore);
    v.box(x + 1, y + 3, z - 2, x + 3, y + 5, z - 0, trimCol);
    v.put(x + 2, y + 4, z - 2, "glassDark");
  } else {
    v.box(x - 2, y + 3, z - 3, x + 2, y + 4, z + 1, ore);
    v.box(x - 2, y + 3, z + 1, x, y + 5, z + 3, trimCol);
    v.put(x - 2, y + 4, z + 2, "glassDark");
  }
}
function excavator(c: Ctx, x: number, y: number, z: number, big = false) {
  const { v } = c,
    k = c.variant & 3;
  const body = ["busYellow", "orange", "#3f8a4a", "#23272e"][k];
  const s = big ? 2 : 1;
  v.box(x - 3 * s, y, z - 2 * s, x + 3 * s, y + s, z - s, "charcoal");
  v.box(x - 3 * s, y, z + s, x + 3 * s, y + s, z + 2 * s, "charcoal");
  v.box(x - 2 * s, y + s, z - 2 * s, x + 2 * s, y + 3 * s, z + 2 * s, body);
  v.box(x - 2 * s, y + 3 * s, z - s, x, y + 4 * s, z + s, "glassDark");
  for (let i = 0; i < 5 * s; i++) v.box(x + 2 * s + i, y + 3 * s + Math.min(i, 3 * s) - Math.max(0, i - 3 * s) * 2, z, x + 3 * s + i, y + 4 * s + Math.min(i, 3 * s) - Math.max(0, i - 3 * s) * 2, z + 1, body);
  v.box(x + 6 * s, y, z - s, x + 8 * s, y + 2 * s, z + s + 1, "steelDark");
  c.smoke(x + 7 * s, y + 2 * s, z, "smoke");
}
function openPitMine(c: Ctx) {
  const { v, lv, hx, hz } = c,
    s = ps(c),
    k = c.variant & 3;
  const strata = STRATA[k];
  const H = lvPick(c, [3, 5, 7, 10, 14]),
    n = lvPick(c, [1, 2, 3, 4, 6]);
  const front = lv >= 3 ? 11 : 2;
  const rx = hx - 2,
    rz = (2 * hz - 2 - front) / 2,
    pcx = 0,
    pcz = -hz + 1 + rz;
  const rimTop = k === 2 ? "leaf" : k === 1 ? "#e3dccb" : k === 3 ? "#8f9aa5" : "#c58e5c";
  lot(c, k === 2 ? "grass" : s.ground);
  const rampW = 2;
  const pitH = (x: number, z: number): [number, number] => {
    const dx = (x + 0.5 - pcx) / rx,
      dz = (z + 0.5 - pcz) / rz;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d >= 1) {
      const out = (d - 1) * Math.min(rx, rz);
      const h = H - Math.floor(out * 1.4);
      return [Math.max(0, h), 2];
    }
    const step = Math.floor(d * (n + 0.35));
    let h = step === 0 ? 0 : 1 + Math.round(((H - 1) * step) / (n + 0.35));
    // straight haul ramp running east from the pit floor to the rim
    if (Math.abs(z + 0.5 - pcz) <= rampW && x > pcx + 2) {
      const t = (x - pcx - 2) / Math.max(1, rx - 2);
      return [Math.max(1, Math.round(1 + (H - 1) * t)), 1];
    }
    if (h > H) h = H;
    return [h, 0];
  };
  heightfield(
    c,
    (x, z) => pitH(x, z)[0],
    (x, y, z, top) => {
      const kind = pitH(x, z)[1];
      if (top && kind === 1) return "path2";
      if (top && kind === 2) return y >= H - 1 ? rimTop : strata[(y >> 1) & 3];
      if (k === 3 && !top && ((x * 7 + y * 13 + z * 5) & 15) === 0) return "gold";
      if (k === 0 && !top && ((x * 5 + y * 11 + z * 3) & 31) === 0) return "#4fa08a";
      if (top) return ((x * 3 + z * 5) & 7) === 0 ? strata[0] : BENCH[k];
      return strata[(y >> 1) & 3];
    },
  );
  // pit floor
  v.cylinderY(pcx + 0.5, pcz + 0.5, 0, 1, Math.min(rx, rz) / (n + 0.35) - 0.5, strata[1]);
  if (lv >= 4) {
    const r = Math.min(rx, rz) / (n + 0.35) - 1.2;
    v.cylinderY(pcx - 1, pcz - 1, 0, 1, r * (lv === 5 ? 1 : 0.5), "#3fc1b0", 0.15);
  }
  const ore = k === 0 ? "#4fa08a" : k === 3 ? "gold" : strata[2];
  // trucks on the benches
  const trucks = lvPick(c, [1, 2, 3, 4, 6]);
  for (let i = 0; i < trucks; i++) {
    const bench = n === 1 ? 0.6 : (n - 1 - (i % (n - 1)) + 0.5) / (n + 0.35);
    const a = 1.9 + i * 1.7;
    const tx = Math.round(pcx + Math.cos(a) * rx * bench),
      tz = Math.round(pcz + Math.sin(a) * rz * bench);
    const ty = pitH(tx, tz)[0] + 1;
    haulTruck(c, tx, Math.max(1, ty), tz, Math.abs(Math.sin(a)) > Math.abs(Math.cos(a)) ? "x" : "z", i % 2 ? ore : strata[2]);
  }
  // a truck climbing the ramp
  if (lv >= 2) {
    const tx = Math.round(pcx + rx * 0.55);
    haulTruck(c, tx, pitH(tx, Math.round(pcz))[0] + 1, Math.round(pcz), "x", ore);
  }
  if (lv === 1) {
    // drill rig on the rim, survey flags and the site trailer
    const dx = -hx + 4,
      dz = hz - 4;
    v.box(dx - 2, H + 1, dz - 2, dx + 2, H + 3, dz + 2, ["busYellow", "orange", "#3f8a4a", "#23272e"][k]);
    v.box(dx, H + 3, dz, dx + 1, H + 15, dz + 1, s.metal);
    v.box(dx - 1, H + 14, dz - 1, dx + 2, H + 15, dz + 2, "red");
    c.blink(dx, H + 16, dz, "red");
    c.smoke(0, 2, Math.round(pcz), "smoke");
    for (const [fx, fz] of [[hx - 3, -hz + 3], [-hx + 3, -hz + 3]]) {
      v.box(fx, H - 2, fz, fx + 1, H + 4, fz + 1, "woodLight");
      v.put(fx + 1, H + 3, fz, "orange");
    }
    excavator(c, pcx - 3, 1, Math.round(pcz), false);
    return;
  }
  excavator(c, pcx - 2, 1, Math.round(pcz) - 1, lv === 5 ? false : lv >= 3);
  // dust plumes from blasting at the deepest face
  c.smoke(pcx - 6, 3, Math.round(pcz) - 4, "dark");
  if (lv === 2) {
    const ox = -hx + 2,
      oz = hz - 6;
    v.box(ox, H + 1, oz, ox + 8, H + 4, oz + 4, s.wall);
    v.box(ox, H + 4, oz, ox + 8, H + 5, oz + 4, s.roof);
    v.box(ox + 1, H + 2, oz + 4, ox + 3, H + 3, oz + 5, "glass", 0.4);
    return;
  }
  // conveyor from the pit floor over the rim to the ore pile and crusher on the front apron
  const cx = -Math.round(hx * 0.45),
    z0 = Math.round(pcz),
    z1 = hz - 5;
  for (let z = z0; z <= z1; z++) {
    const t = (z - z0) / (z1 - z0);
    const y = Math.round(2 + (H + 2) * Math.min(1, t * 1.35));
    v.box(cx, y, z, cx + 2, y + 1, z + 1, "rubber");
    v.put(cx, y + 1, z, z % 2 ? ore : strata[0]);
    if (z % 5 === 0) {
      const base = Math.max(1, pitH(cx, z)[0] + 1);
      v.box(cx, base, z, cx + 1, y, z + 1, s.metal);
      v.box(cx + 1, base, z, cx + 2, y, z + 1, s.metal);
    }
  }
  const pileH = lvPick(c, [0, 0, 6, 8, 10]);
  v.cone(cx + 1, 1, 1 + pileH, z1 + 1, pileH * 0.75, 0.4, ore);
  // crusher house on the apron
  const bx = Math.round(hx * 0.15);
  sbldg(c, bx, hz - 10, bx + 10, hz - 2, 6, { axis: "x" });
  v.box(bx + 8, 1, hz - 9, bx + 10, 15, hz - 7, s.metal);
  c.smoke(bx + 9, 15, hz - 8, "smoke");
  if (lv >= 4) {
    // rail load-out silo with wagons + floodlight masts
    const sx = hx - 6;
    v.cylinderY(sx + 0.5, hz - 5.5, 6, 18, 3.5, s.metal === "brass" ? "#4f5d6b" : "silver");
    v.cone(sx + 0.5, 18, 21, hz - 5.5, 3.5, 0.5, s.roof);
    for (const x of [sx - 3, sx + 3]) v.box(x, 1, hz - 9, x + 1, 6, hz - 2, "steelDark");
    for (let x = -hx; x < hx; x++) v.put(x, 1, hz - 1, x % 3 ? "steel" : "woodDark");
    for (let i = 0; i < 3; i++) {
      const wx = -hx + 3 + i * 7;
      v.box(wx, 1, hz - 3, wx + 6, 4, hz, "#5b4a3a");
      v.box(wx + 1, 4, hz - 2, wx + 5, 5, hz - 1, ore);
    }
    for (const [mx, mz] of [[-hx + 2, -hz + 2], [hx - 3, -hz + 2]]) {
      v.box(mx, H, mz, mx + 1, H + 10, mz + 1, "steelDark");
      v.box(mx - 1, H + 10, mz, mx + 2, H + 11, mz + 1, "warmGlow", 1.2);
      c.blink(mx, H + 12, mz, "amber");
    }
  }
  if (lv === 5) {
    // giant bucket-wheel excavator on the west bench with a spinning wheel
    const wx = -Math.round(rx * 0.55),
      wz = Math.round(pcz) - Math.round(rz * 0.25);
    const by = Math.max(1, pitH(wx, wz)[0] + 1);
    const body = ["busYellow", "orange", "#3f8a4a", "#23272e"][k];
    v.box(wx - 4, by, wz - 3, wx + 4, by + 2, wz + 3, "charcoal");
    v.box(wx - 3, by + 2, wz - 2, wx + 3, by + 7, wz + 2, body);
    v.box(wx - 1, by + 7, wz - 1, wx + 1, by + 14, wz + 1, s.metal);
    for (let i = 0; i < 12; i++) v.box(wx + 3 + i, by + 9 - Math.floor(i / 3), wz, wx + 4 + i, by + 10 - Math.floor(i / 3), wz + 1, body);
    for (let i = 0; i < 9; i++) v.box(wx - 3 - i, by + 9 + Math.floor(i / 3), wz, wx - 2 - i, by + 10 + Math.floor(i / 3), wz + 1, body);
    v.box(wx - 13, by + 8, wz - 1, wx - 10, by + 13, wz + 2, "concreteDark");
    const wheel = new PixelVox();
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      const px = Math.round(Math.cos(ang) * 4),
        py = Math.round(Math.sin(ang) * 4);
      wheel.put(px, py, 0, body);
      if (a % 2 === 0) wheel.box(Math.round(Math.cos(ang) * 5), Math.round(Math.sin(ang) * 5), -1, Math.round(Math.cos(ang) * 5) + 1, Math.round(Math.sin(ang) * 5) + 1, 1, "steelDark");
    }
    for (let d = -3; d <= 3; d++) {
      wheel.put(d, 0, 0, s.metal);
      wheel.put(0, d, 0, s.metal);
    }
    c.addRotor({ vox: wheel, pivot: [wx + 16, by + 5, wz], axis: "z", speed: 1.1 });
    c.smoke(wx + 16, by + 1, wz, "smoke");
    c.smoke(4, 2, Math.round(pcz) + 4, "dark");
  }
}

// REGIONAL AIRPORT — runway along x across the front half (planes roll at z ≈ +hz/2), terminal at the
// back. Lv1 grass strip, quonset hangar, prop plane with spinning propeller, windsock → Lv2 paved
// runway + village terminal with a glass cab + twin-prop → Lv3 two jet bridges, regional jet, control
// tower with rotating radar, blinking runway lights → Lv4 long concourse, three jets → Lv5 curved
// crescent terminal, four jets incl. a wide-body, landmark tower, approach light chain.
// Variants: terminal architecture (sroof styles) + airline livery (0 terracotta, 1 teal, 2 green, 3 navy/gold).
function propPlane(c: Ctx, x: number, z: number, twin: boolean) {
  const { v } = c,
    s = ps(c);
  const body = c.variant === 3 ? "#e9e4d4" : "white";
  v.box(x - 4, 2, z - 1, x + 4, 4, z + 1, body);
  v.box(x - 4, 3, z - 1, x + 3, 4, z + 1, s.livery);
  v.box(x - 4, 3, z - 1, x + 4, 4, z + 1, body);
  v.box(x - 4, 2, z, x + 4, 3, z + 1, s.livery);
  v.box(x + 2, 4, z - 1, x + 3, 5, z + 1, "glassDark");
  v.box(x, 4, z - 7, x + 2, 5, z + 7, body);
  v.box(x, 4, z - 7, x + 2, 5, z - 6, s.livery);
  v.box(x, 4, z + 6, x + 2, 5, z + 7, s.livery);
  v.box(x - 4, 4, z, x - 3, 7, z + 1, s.livery);
  v.box(x - 5, 4, z - 3, x - 3, 5, z + 3, body);
  for (const zz of [z - 2, z + 2]) v.box(x + 1, 1, zz, x + 2, 2, zz + 1, "rubber");
  v.put(x - 3, 1, z, "rubber");
  const props = twin ? [z - 4, z + 4] : [z];
  for (const pz of props) {
    if (twin) v.box(x + 1, 3, pz - 1, x + 4, 4, pz + 1, "steelDark");
    const prop = new PixelVox();
    for (let d = -2; d <= 2; d++) prop.put(0, d, 0, "charcoal");
    prop.put(0, 0, 0, s.livery);
    c.addRotor({ vox: prop, pivot: [twin ? x + 4 : x + 5, 3, pz], axis: "x", speed: 9 });
  }
}
/** Jet parked nose-in (nose toward -z). len along z, span half-width. */
function jet(c: Ctx, x: number, zNose: number, len: number, span: number, wide = false) {
  const { v } = c,
    s = ps(c);
  const w = wide ? 2 : 1,
    hb = wide ? 6 : 5;
  const z1 = zNose + len;
  v.box(x - w, 2, zNose + 1, x + w + 1, hb, z1, "white");
  v.box(x - w + 1, 3, zNose, x + w, hb - 1, zNose + 1, "white");
  v.box(x - w, 2, zNose + 1, x + w + 1, 3, z1, "#d9dde2");
  v.box(x - w, hb - 2, zNose + 1, x - w + 1, hb - 1, z1 - 1, s.livery);
  v.box(x + w, hb - 2, zNose + 1, x + w + 1, hb - 1, z1 - 1, s.livery);
  v.box(x - w + 1, hb - 2, zNose, x + w, hb - 1, zNose + 1, "glassDark");
  const wz = zNose + Math.round(len * 0.4);
  v.box(x - span, 3, wz, x + span + 1, 4, wz + 3, "silver");
  for (let i = 0; i < span; i++) v.box(x - span + i, 3, wz + 3, x - span + i + 1, 4, wz + 3 + Math.floor((span - i) / 3), "silver");
  for (let i = 0; i < span; i++) v.box(x + span - i, 3, wz + 3, x + span - i + 1, 4, wz + 3 + Math.floor((span - i) / 3), "silver");
  for (const ex of wide ? [-span + 2, -Math.floor(span / 2), Math.floor(span / 2), span - 2] : [-Math.floor(span / 2), Math.floor(span / 2)]) {
    v.box(x + ex, 1, wz - 1, x + ex + 2, 3, wz + 2, "steelDark");
    v.put(x + ex, 2, wz - 1, "charcoal");
  }
  v.box(x, hb, z1 - 4, x + 1, hb + (wide ? 6 : 5), z1, s.livery);
  v.box(x, hb + (wide ? 5 : 4), z1 - 1, x + 1, hb + (wide ? 6 : 5), z1, c.variant === 3 ? "gold" : "white");
  v.box(x - 3, hb - 1, z1 - 3, x + 4, hb, z1 - 1, "silver");
  v.put(x, 1, zNose + 2, "rubber");
  for (const gx of [x - w, x + w]) v.put(gx, 1, wz + 1, "rubber");
  c.blink(x - span, 3, wz + 1, "red");
  c.blink(x + span, 3, wz + 1, "lime");
}
function runway(c: Ctx, z0: number, z1: number, paved: boolean, lights: boolean) {
  const { v, hx } = c;
  const mid = Math.floor((z0 + z1) / 2);
  if (!paved) {
    v.box(-hx, 0, z0, hx, 1, z1, "grass3");
    v.box(-hx, 0, mid - 1, hx, 1, mid + 1, "path2");
    for (let x = -hx + 2; x < hx; x += 6) {
      v.put(x, 1, z0, "white");
      v.put(x, 1, z1 - 1, "white");
    }
    return;
  }
  v.box(-hx, 0, z0, hx, 1, z1, "asphaltDark");
  for (let x = -hx + 8; x < hx - 8; x += 6) v.box(x, 0, mid, x + 3, 1, mid + 1, "white");
  for (const ex of [-hx + 1, hx - 5])
    for (let z = z0 + 1; z < z1 - 1; z += 2) v.box(ex, 0, z, ex + 4, 1, z + 1, "white");
  if (lights) {
    for (let x = -hx + 1; x < hx; x += 5) {
      v.put(x, 1, z0, "warmGlow", 1.2);
      v.put(x, 1, z1 - 1, "warmGlow", 1.2);
    }
    for (let z = z0; z < z1; z += 3) {
      c.blink(-hx, 1, z, "lime");
      c.blink(hx - 1, 1, z, "red");
    }
  }
}
function windsock(c: Ctx, x: number, z: number) {
  const { v } = c;
  v.box(x, 1, z, x + 1, 8, z + 1, "white");
  for (let i = 0; i < 4; i++) v.box(x + 1 + i, 7 - (i >> 1), z, x + 2 + i, 8 - (i >> 1), z + 1, i % 2 ? "white" : "orange");
}
function controlTower(c: Ctx, x: number, z: number, h: number) {
  const { v } = c,
    s = ps(c),
    k = c.variant & 3;
  if (k === 1) v.cylinderY(x + 0.5, z + 0.5, 1, h, 1.8, "white");
  else if (k === 3) {
    v.box(x - 2, 1, z - 2, x + 3, h, z + 3, s.wall);
    for (let y = 4; y < h; y += 4) v.box(x - 2, y, z - 2, x + 3, y + 1, z + 3, "brass");
  } else v.box(x - 1, 1, z - 1, x + 2, h, z + 2, k === 2 ? "brick" : s.wall);
  v.box(x - 3, h, z - 3, x + 4, h + 1, z + 4, s.trim);
  v.box(x - 3, h + 1, z - 3, x + 4, h + 4, z + 4, "#9fd8ea", 0.5);
  v.box(x - 3, h + 4, z - 3, x + 4, h + 5, z + 4, k === 0 ? "terracotta" : s.trim);
  v.box(x, h + 5, z, x + 1, h + 7, z + 1, "steelDark");
  const radar = new PixelVox();
  radar.box(-3, 0, 0, 4, 1, 1, "white");
  radar.box(-3, 1, 0, 4, 2, 1, "silver");
  radar.put(0, -1, 0, "steelDark");
  c.addRotor({ vox: radar, pivot: [x, h + 8, z], axis: "y", speed: 1.4 });
  c.blink(x, h + 10, z, "red");
}
function jetBridge(c: Ctx, x: number, zTerm: number, zDoor: number) {
  const { v } = c,
    s = ps(c);
  for (let z = zTerm; z < zDoor; z++) v.box(x, 4, z, x + 3, 6, z + 1, z % 3 ? "steelLight" : s.trim);
  v.box(x + 1, 1, zDoor - 2, x + 2, 4, zDoor - 1, "steelDark");
}
function regionalAirport(c: Ctx) {
  const { v, lv, hx, hz } = c,
    s = ps(c),
    k = c.variant & 3;
  lot(c, lv === 1 ? "grass" : s.ground);
  const rw = lvPick(c, [8, 8, 9, 10, 12]);
  const rz0 = Math.round(hz / 2 - rw / 2),
    rz1 = rz0 + rw;
  runway(c, rz0, rz1, lv >= 2, lv >= 3);
  if (lv >= 2) v.box(-hx + 2, 0, rz0 - 4, hx - 2, 1, rz0, "asphalt");
  if (lv >= 3) for (let x = -hx + 2; x < hx - 2; x += 2) v.put(x, 0, rz0 - 2, "yellow");
  if (lv === 1) {
    v.box(-hx + 2, 0, -hz + 2, -1, 1, -hz + 13, "path2");
    K.barrelRoof(v, -hx + 2, 1, -hz + 2, -2, -hz + 12, "x", k === 1 ? "white" : k === 3 ? "#4f5d6b" : k === 2 ? "#4f7d5a" : "#c9b48a", s.trim);
    v.box(-hx + 4, 1, -hz + 11, -4, 4, -hz + 12, "charcoal");
    sbldg(c, 4, -hz + 3, 11, -hz + 9, 4);
    propPlane(c, -4, -1, false);
    windsock(c, hx - 3, -hz + 3);
    for (let i = 0; i < 3; i++) v.box(hx - 6 + i * 2, 1, -2, hx - 5 + i * 2, 3, -1, "red");
    person(v, 2, 1, 0, "white", "blueDark");
    return;
  }
  if (lv === 2) {
    const top = sbldg(c, -hx + 3, -hz + 2, 6, -hz + 10, 5);
    v.box(-4, top, -hz + 4, 0, top + 1, -hz + 8, s.trim);
    v.box(-4, top + 1, -hz + 4, 0, top + 4, -hz + 8, "#9fd8ea", 0.5);
    v.box(-5, top + 4, -hz + 3, 1, top + 5, -hz + 9, s.trim);
    propPlane(c, 10, -2, true);
    windsock(c, hx - 3, -hz + 3);
    K.car(v, hx - 6, 1, -hz + 6, "x", s.livery);
    crowd(c, -hx + 4, -hz + 11, 2, -hz + 13, 3);
    return;
  }
  // terminal + gates
  const tz1 = lvPick(c, [0, 0, -hz + 8, -hz + 11, -hz + 13]);
  const gateZ = tz1 + 1;
  if (lv === 3 || lv === 4) {
    const tx1 = lv === 3 ? 8 : hx - 2;
    sbldg(c, -hx + 2, -hz + 1, tx1, tz1, lv === 3 ? 6 : 8, { axis: "x" });
    v.box(-hx + 2, 1, tz1, tx1, 2, tz1 + 1, s.trim);
    const gates = lv === 3 ? [-14, -2] : [-16, -3, 10];
    const len = lv === 3 ? 10 : 12;
    for (const gx of gates) {
      jetBridge(c, gx + 2, tz1, gateZ + 2);
      jet(c, gx, gateZ + 1, len, lv === 3 ? 6 : 7);
    }
    if (lv === 3) controlTower(c, hx - 7, -hz + 5, 16);
    else {
      controlTower(c, hx - 5, rz0 - 9, 22);
      v.box(-hx + 2, 0, rz1 + 1, hx - 2, 1, hz, "asphalt");
      for (let x = -hx + 4; x < hx - 4; x += 4) v.put(x, 0, rz1 + 3, "white");
    }
    crowd(c, -hx + 4, tz1 + 1, 0, tz1 + 3, 2);
    return;
  }
  // Lv5 crescent terminal
  const ccx = 0,
    ccz = 8,
    R0 = 30,
    R1 = 38;
  for (let x = -hx; x < hx; x++)
    for (let z = -hz; z < -8; z++) {
      const d = Math.hypot(x + 0.5 - ccx, z + 0.5 - ccz);
      if (d < R0 || d >= R1) continue;
      const ang = Math.atan2(z + 0.5 - ccz, x + 0.5 - ccx);
      const edge = d < R0 + 1 || d >= R1 - 1;
      const h = 9 + Math.round(Math.sin(ang * 6) * 1.5) + (k === 3 ? 0 : 0);
      if (edge) {
        v.box(x, 1, z, x + 1, h, z + 1, d < R0 + 1 ? (Math.floor(ang * 40) % 3 ? s.glass : s.trim) : s.wall, d < R0 + 1 ? 0.45 : 0);
      }
      const roofCol = k === 0 ? "terracotta" : k === 1 ? "white" : k === 2 ? s.roof : (Math.floor(d) % 3 === 0 ? "brass" : s.wall2);
      v.box(x, h, z, x + 1, h + 1, z + 1, roofCol);
      if (k === 1 && Math.floor(d) === R0 + 1) v.box(x, h + 1, z, x + 1, h + 2, z + 1, "teal");
      if (k === 2 && Math.floor(d) % 4 === 0) v.box(x, h + 1, z, x + 1, h + 2, z + 1, "glass", 0.3);
    }
  const gates: [number, boolean][] = [
    [-22, false],
    [-8, true],
    [8, false],
    [21, false],
  ];
  for (const [gx, wide] of gates) {
    const zTerm = Math.floor(ccz - Math.sqrt(R0 * R0 - gx * gx)) + 1;
    const zNose = -8;
    jetBridge(c, gx + 2, zTerm, zNose + 2);
    jet(c, gx, zNose, wide ? 15 : 13, wide ? 9 : 7, wide);
  }
  controlTower(c, hx - 5, -hz + 4, 28);
  // terminal plaza & car park behind the crescent
  K.parking(c, -14, -hz, 14, -hz + 4, { cars: 0.7 });
  for (let i = 0; i < 6; i++) c.blink(-hx + 1 + i * 2, 2, Math.round(hz / 2), "white");
  for (const x of [-hx + 3, hx - 4]) flag(v, x, 1, -10, 10, [s.livery, "white", s.accent]);
}

// FREIGHT RAIL TERMINAL — tracks along x multiply (1→6) and the cranes grow from a loading dock to
// towering rail-mounted gantries. Lv1 siding + boxcars + dock shed → Lv2 first gantry + stacks → Lv3
// switchyard: four tracks, switches, signal box, locomotive → Lv4 container yard: two gantries, tall
// stacks, reach stacker, trucks → Lv5 intermodal: three giant gantries, long train, floodlights, tower.
// Variants: gantry & loco livery (0 orange/terracotta, 1 white & teal, 2 evergreen & brick, 3 black & brass).
const BOX = ["crimson", "blue", "teal", "orange", "yellow", "#7d4fb0", "leaf", "white"];
function track(c: Ctx, z: number) {
  const { v, hx } = c;
  for (let x = -hx; x < hx; x += 2) v.box(x, 0, z - 1, x + 1, 1, z + 3, "woodDark");
  v.box(-hx, 1, z - 1 + 0, hx, 2, z, "steel");
  v.box(-hx, 1, z + 2, hx, 2, z + 3, "steel");
}
function wagon(c: Ctx, x: number, z: number, kind: number) {
  const { v } = c;
  v.box(x, 1, z - 1, x + 8, 2, z + 3, "charcoal");
  if (kind === 0) {
    v.box(x, 2, z - 1, x + 8, 6, z + 3, ["#8c3b2b", "#5b6b7a", "#4a6b3a", "#6b4a2a"][(x >> 3) & 3]);
    v.box(x + 3, 2, z - 1, x + 5, 5, z + 3, "woodDark");
  } else if (kind === 1) {
    K.container(v, x + 1, 2, z - 1, "x", BOX[((x >> 2) + c.variant) & 7]);
  } else {
    for (let i = 0; i < 8; i++) v.box(x + i, 3, z - 1, x + i + 1, 5 - (i === 0 || i === 7 ? 1 : 0), z + 3, "silver");
  }
}
function loco(c: Ctx, x: number, z: number) {
  const { v } = c,
    s = ps(c);
  v.box(x, 1, z - 1, x + 11, 2, z + 3, "charcoal");
  v.box(x, 2, z - 1, x + 11, 6, z + 3, s.livery);
  v.box(x, 4, z - 1, x + 11, 5, z + 3, c.variant === 3 ? "gold" : c.variant === 1 ? "white" : "yellow");
  v.box(x + 8, 6, z - 1, x + 11, 7, z + 3, s.livery);
  v.box(x + 10, 4, z - 1, x + 11, 6, z + 3, "glassDark");
  v.put(x + 10, 3, z, "warmGlow", 1);
  v.put(x + 10, 3, z + 2, "warmGlow", 1);
  v.box(x + 3, 6, z, x + 5, 7, z + 2, "steelDark");
  c.smoke(x + 4, 7, z + 1, "dark");
}
function gantry(c: Ctx, x: number, z0: number, z1: number, h: number, boxCol: string) {
  const { v } = c;
  const col = ["orange", "white", "#2f6b3e", "#23272e"][c.variant & 3],
    acc = ["terracotta", "teal", "cream", "brass"][c.variant & 3];
  for (const z of [z0, z1 - 2])
    for (const xx of [x, x + 6]) {
      v.box(xx, 1, z, xx + 2, h, z + 2, col);
      v.box(xx, 1, z, xx + 2, 2, z + 2, "steelDark");
    }
  for (const z of [z0, z1 - 2]) v.box(x, h - 2, z, x + 8, h - 1, z + 2, acc);
  v.box(x, h, z0, x + 2, h + 2, z1, col);
  v.box(x + 6, h, z0, x + 8, h + 2, z1, col);
  v.box(x, h + 2, z0, x + 8, h + 3, z1, acc);
  const tz = Math.round((z0 + z1) / 2);
  v.box(x + 1, h - 1, tz - 2, x + 7, h, tz + 2, "steelDark");
  v.box(x + 3, h - 6, tz, x + 4, h - 1, tz + 1, "steelDark");
  v.box(x + 1, h - 7, tz - 2, x + 7, h - 6, tz + 2, "hazard");
  K.container(v, x + 1, h - 10, tz - 1, "x", boxCol);
  v.box(x + 6, h - 4, z1 - 3, x + 8, h - 1, z1 - 1, "glass", 0.5);
  c.blink(x, h + 3, z0, "amber");
}
function boxStack(c: Ctx, x: number, z: number, rows: number, tiers: number) {
  for (let r = 0; r < rows; r++)
    for (let t = 0; t < tiers; t++) if (t === 0 || c.rand() < 0.8) K.container(c.v, x, 1 + t * 3, z + r * 3, "x", BOX[(r * 3 + t + (x >> 2) + c.variant) & 7]);
}
function freightTerminal(c: Ctx) {
  const { v, lv, hx, hz } = c,
    s = ps(c);
  lot(c, s.ground);
  K.speckle(c, "concrete2", 0.2);
  const nT = lvPick(c, [1, 2, 4, 5, 6]);
  const tz0 = -hz + 3;
  const tracks: number[] = [];
  for (let i = 0; i < nT; i++) tracks.push(tz0 + i * 5);
  for (const z of tracks) track(c, z);
  // buffer stop
  for (const z of tracks) {
    v.box(hx - 2, 1, z - 1, hx - 1, 4, z + 3, "red");
    v.box(hx - 2, 4, z, hx - 1, 5, z + 2, "hazard");
  }
  const yard0 = tracks[tracks.length - 1] + 5;
  if (lv === 1) {
    for (let i = 0; i < 3; i++) wagon(c, -hx + 2 + i * 9, tz0, i === 1 ? 1 : 0);
    v.box(-hx + 2, 1, yard0 - 1, hx - 4, 3, yard0 + 3, "concrete");
    sbldg(c, -hx + 4, yard0 + 1, 6, hz - 1, 5, { y: 1, axis: "x" });
    for (let i = 0; i < 3; i++) v.box(8 + i * 2, 3, yard0, 10 + i * 2, 5, yard0 + 2, "crate");
    K.truck(v, 11, 1, hz - 3, "x", "white", s.livery);
    return;
  }
  if (lv === 2) {
    wagon(c, -hx + 1, tz0, 1);
    wagon(c, -hx + 10, tz0, 1);
    loco(c, -hx + 19, tz0 + 5);
    gantry(c, 2, tz0 - 2, hz - 1, 15, BOX[c.variant + 1]);
    boxStack(c, -hx + 2, yard0, 2, 2);
    K.truck(v, hx - 5, 1, hz - 3, "x", BOX[c.variant], s.livery);
    return;
  }
  // switch diagonals between adjacent tracks
  for (let i = 0; i + 1 < tracks.length; i++) {
    const x0 = -hx + 6 + i * 4;
    for (let d = 0; d < 5; d++) v.box(x0 + d * 2, 1, tracks[i] + d, x0 + d * 2 + 2, 2, tracks[i] + d + 1, "steel");
  }
  if (lv === 3) {
    loco(c, -hx + 12, tracks[0]);
    for (let i = 0; i < 2; i++) wagon(c, -hx + 23 + i * 9, tracks[0], i);
    for (let i = 0; i < 3; i++) wagon(c, -4 + i * 9, tracks[2], 2);
    wagon(c, 4, tracks[3], 1);
    // signal box
    const bx = -hx + 2,
      bz = yard0;
    v.box(bx, 1, bz, bx + 8, 5, bz + 6, s.wall2);
    v.box(bx, 5, bz, bx + 8, 8, bz + 6, s.glass, 0.5);
    sroof(c, bx, 8, bz, bx + 8, bz + 6, "x");
    for (const z of tracks) {
      v.box(hx - 6, 1, z + 3, hx - 5, 6, z + 4, "steelDark");
      c.blink(hx - 6, 6, z + 3, z === tracks[1] ? "red" : "lime");
    }
    gantry(c, hx - 18, tracks[1] - 2, hz - 1, 18, BOX[c.variant + 3]);
    boxStack(c, -6, yard0 + 1, 2, 2);
    return;
  }
  const g = lv === 4 ? 2 : 3;
  const gh = lv === 4 ? 20 : 26;
  loco(c, hx - 16, tracks[0]);
  for (let i = 0; i < (lv === 4 ? 4 : 7); i++) wagon(c, hx - 25 - i * 9, tracks[0], 1);
  for (let i = 0; i < 3; i++) wagon(c, -hx + 2 + i * 9, tracks[2], i === 1 ? 2 : 1);
  wagon(c, 0, tracks[3], 0);
  const stackZ = yard0;
  for (let i = 0; i < Math.floor((2 * hx - 6) / 8); i++) boxStack(c, -hx + 3 + i * 8, stackZ, Math.max(1, Math.floor((hz - 1 - stackZ) / 3) - 1), lv === 4 ? 3 : 4);
  for (let i = 0; i < g; i++) gantry(c, -hx + 6 + Math.round((i * (2 * hx - 20)) / Math.max(1, g - 1)), tz0 - 2, hz - 1, gh, BOX[(i + c.variant) & 7]);
  // reach stacker
  const rx = lv === 4 ? hx - 8 : 0;
  v.box(rx - 3, 1, hz - 4, rx + 3, 4, hz - 1, ["orange", "white", "#2f6b3e", "#23272e"][c.variant & 3]);
  for (let i = 0; i < 6; i++) v.box(rx + 2 + i, 4 + i, hz - 3, rx + 3 + i, 5 + i, hz - 2, "steelDark");
  if (lv === 5) {
    const tx = hx - 6,
      tz = hz - 8;
    v.cylinderY(tx + 0.5, tz + 0.5, 1, 20, 1.6, s.wall);
    v.box(tx - 3, 20, tz - 3, tx + 4, 24, tz + 4, s.glass, 0.5);
    v.box(tx - 3, 24, tz - 3, tx + 4, 25, tz + 4, s.trim);
    c.blink(tx, 26, tz, "red");
    for (const mx of [-hx + 1, hx - 2]) {
      v.box(mx, 1, hz - 2, mx + 1, 22, hz - 1, "steelDark");
      v.box(mx - 1, 22, hz - 3, mx + 2, 23, hz - 1, "warmGlow", 1.3);
    }
  }
}

// DISTRICT HEAT WORKS — signature: fat insulated pipes with U-shaped expansion loops, steam vents and a
// giant thermal-storage tank whose thermometer gauge glows red. Lv1 exchanger hut + pipe loop → Lv2 pipe
// court + small accumulator → Lv3 round turbine hall with spinning heat-pump fans → Lv4 tall
// accumulator + steaming stack → Lv5 twin accumulators, glowing heat-pump hall, rainbow pipe bundle.
// Variants: 0 copper pipes & terracotta, 1 red/blue pipes & white, 2 green pipes & brick chimney, 3 brass & slate.
const HOT = ["copper", "red", "#2f6b3e", "brass"],
  COLD = ["#c9a46a", "blue", "#9fb38a", "#7c8590"];
function hpipe(c: Ctx, x0: number, z0: number, x1: number, z1: number, y: number, col: string) {
  const { v } = c;
  v.box(Math.min(x0, x1), y, Math.min(z0, z1), Math.max(x0, x1) + 2, y + 2, Math.max(z0, z1) + 2, col);
  const len = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
  for (let i = 0; i <= len; i += 6) {
    const px = x0 === x1 ? x0 : Math.min(x0, x1) + i,
      pz = z0 === z1 ? z0 : Math.min(z0, z1) + i;
    if (y > 1) v.box(px, 1, pz, px + 2, y, pz + 2, "concrete");
    v.box(px, y, pz, px + 2, y + 2, pz + 2, "silver");
  }
}
function expansionLoop(c: Ctx, x: number, z: number, y: number, h: number, col: string) {
  const { v } = c;
  v.box(x, y, z, x + 2, y + h, z + 2, col);
  v.box(x + 6, y, z, x + 8, y + h, z + 2, col);
  v.box(x, y + h, z, x + 8, y + h + 2, z + 2, col);
}
function accumulator(c: Ctx, x: number, z: number, r: number, h: number) {
  const { v } = c,
    s = ps(c),
    k = c.variant & 3;
  v.cylinderY(x + 0.5, z + 0.5, 1, h, r, k === 1 ? "white" : k === 3 ? "#4f5d6b" : k === 2 ? "#6b7f6a" : "#e9d2a8");
  for (let y = 4; y < h; y += 5) v.cylinderY(x + 0.5, z + 0.5, y, y + 1, r + 0.3, s.trim);
  v.cone(x + 0.5, h, h + 3, z + 0.5, r, r * 0.4, s.metal);
  // thermometer gauge on the front
  const gz = Math.floor(z + r) + 1;
  v.box(x - 1, 3, gz, x + 2, h - 2, gz + 1, "white");
  v.box(x, 4, gz, x + 1, Math.round(4 + (h - 8) * (0.4 + c.lv * 0.12)), gz + 1, "red", 1);
  v.box(x - 1, 2, gz, x + 2, 4, gz + 1, "red", 1);
  c.blink(x, h + 3, z, "red");
  c.smoke(x, h + 3, z, "steam");
}
function heatWorks(c: Ctx) {
  const { v, lv, hx, hz } = c,
    s = ps(c),
    k = c.variant & 3;
  lot(c, s.ground);
  K.speckle(c, s.path, 0.2);
  const hot = HOT[k],
    cold = COLD[k];
  // the pipe main runs along the front, out of the parcel on both sides
  hpipe(c, -hx, hz - 5, hx - 2, hz - 5, 3, hot);
  hpipe(c, -hx, hz - 2, hx - 2, hz - 2, 3, cold);
  expansionLoop(c, -4, hz - 5, 5, lvPick(c, [4, 5, 6, 7, 8]), hot);
  if (lv === 1) {
    sbldg(c, -hx + 2, -hz + 2, 2, 1, 5, { axis: "x" });
    v.box(4, 1, -hz + 3, 12, 6, -hz + 7, s.metal);
    for (let x = 5; x < 12; x += 2) v.box(x, 6, -hz + 3, x + 1, 7, -hz + 7, "steelDark");
    hpipe(c, 6, -hz + 7, 6, hz - 5, 3, hot);
    c.smoke(8, 7, -hz + 5, "steam");
    return;
  }
  if (lv === 2) {
    // pipe court ringed by a rack
    for (const x of [-hx + 2, hx - 4]) hpipe(c, x, -hz + 2, x, hz - 7, 5, hot);
    hpipe(c, -hx + 2, -hz + 2, hx - 4, -hz + 2, 5, cold);
    sbldg(c, -8, -6, 4, 4, 6, { axis: "x" });
    accumulator(c, 9, -4, 3.5, 13);
    c.smoke(-6, 9, -4, "steam");
    return;
  }
  if (lv === 3) {
    // round turbine hall with spinning fans
    const cx = -6,
      cz = -3;
    ring(v, cx, cz, 1, 8, 9, 7.8, s.wall);
    windows(c, cx - 9, 1, cz - 9, cx + 9, 8, cz + 9, { col: s.glass, stepH: 3, faces: "s" });
    v.cylinderY(cx, cz, 8, 9, 9, s.roof === "terracotta" ? "terracotta" : s.trim);
    for (const [fx, fz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
      v.cylinderY(cx + fx, cz + fz, 9, 10, 2.6, "steelDark");
      const fan = new PixelVox();
      for (let d = -2; d <= 2; d++) {
        fan.put(d, 0, 0, "silver");
        fan.put(0, 0, d, "silver");
      }
      fan.put(0, 0, 0, hot);
      c.addRotor({ vox: fan, pivot: [cx + fx, 10, cz + fz], axis: "y", speed: 3 + fx * 0.1 });
    }
    accumulator(c, hx - 8, -hz + 6, 4, 16);
    hpipe(c, hx - 9, -hz + 10, hx - 9, hz - 5, 3, hot);
    return;
  }
  // Lv4/5 accumulator towers + stack
  const accH = lv === 4 ? 24 : 30;
  accumulator(c, -hx + 9, -hz + 9, 6, accH);
  if (lv === 5) accumulator(c, -hx + 23, -hz + 8, 5, accH - 6);
  const sx = hx - 6,
    sz = -hz + 5;
  if (k === 2) {
    v.box(sx - 2, 1, sz - 2, sx + 3, accH + 6, sz + 3, "brick");
    v.box(sx - 3, accH + 4, sz - 3, sx + 4, accH + 6, sz + 4, "brickDark");
  } else K.smokestack(v, sx + 0.5, sz + 0.5, 1, accH + 4, 2.2, k === 1 ? "white" : k === 3 ? "#36424e" : "#d9b07a", k === 1 ? "red" : k === 3 ? "brass" : "terracotta");
  c.smoke(sx, accH + 7, sz, "steam");
  const hx0 = lv === 4 ? -2 : 2,
    hz0 = -2;
  const top = sbldg(c, hx0, hz0, hx - 3, hz - 8, lv === 4 ? 8 : 10, { axis: "x", win: lv === 5 ? "#ffb36b" : s.glass, emit: lv === 5 ? 0.9 : 0.4 });
  for (let x = hx0 + 3; x < hx - 6; x += 6) c.smoke(x, top + 1, hz0 + 3, "steam");
  // pipe rack from tanks to the hall and out to the district
  hpipe(c, -hx + 9, -hz + 16, -hx + 9, hz - 5, 3, hot);
  hpipe(c, -hx + 12, -hz + 16, -hx + 12, hz - 5, 3, cold);
  expansionLoop(c, -hx + 2, hz - 8, 5, 6, cold);
  if (lv === 5) {
    // rainbow pipe bundle arching over the gate
    const cols = ["red", "orange", "yellow", "leaf", "blue"];
    for (let i = 0; i < 5; i++) {
      v.box(hx - 14 + i * 2, 1, hz - 9, hx - 13 + i * 2, 12, hz - 8, cols[i]);
      v.box(hx - 14 + i * 2, 12 - i, hz - 9, hx - 13 + i * 2, 13 - i, -hz + 2, cols[i]);
    }
    crowd(c, -6, hz - 9, 4, hz - 7, 3);
  }
}

// WATER REUSE WORKS — reed beds + round clarifiers with rotating skimmer bridges. Lv1 reed filter pond →
// Lv2 + settling drum (spinning bridge) → Lv3 cascading reed terraces → Lv4 cooling channel with
// steaming sprays + second clarifier → Lv5 reclamation works: rotating drum filters, glowing clean-water
// tower, lab. Variants: 0 terracotta pump house, 1 white & teal lab, 2 brick Victorian pump station, 3 slate & brass.
function clarifier(c: Ctx, x: number, z: number, r: number) {
  const { v } = c,
    s = ps(c);
  ring(v, x, z, 1, 3, r, r - 1, "concrete");
  v.cylinderY(x, z, 1, 2, r - 1, "#5aa69a", 0.12);
  v.cylinderY(x, z, 2, 3, 1.2, "#2f7f75", 0.12);
  v.cylinderY(x, z, 1, 4, 0.9, "concreteDark");
  const bridge = new PixelVox();
  bridge.box(-Math.floor(r), 0, 0, Math.floor(r), 1, 2, s.metal);
  bridge.box(-Math.floor(r), 1, 0, Math.floor(r), 2, 1, c.variant === 1 ? "teal" : "hazard");
  bridge.box(Math.floor(r) - 2, 1, 0, Math.floor(r), 3, 2, s.wall);
  c.addRotor({ vox: bridge, pivot: [Math.floor(x), 3, Math.floor(z)], axis: "y", speed: 0.25 });
}
function reedBed(c: Ctx, x0: number, z0: number, x1: number, z1: number, y: number) {
  const { v } = c;
  v.box(x0, y, z0, x1, y + 1, z1, "#6aa9a0", 0.08);
  for (let x = x0 + 1; x < x1 - 1; x++)
    for (let z = z0 + 1; z < z1 - 1; z++)
      if (((x * 7 + z * 3) & 3) === 0) {
        const h = 2 + ((x + z) & 1);
        v.box(x, y + 1, z, x + 1, y + h, z + 1, (x & 1) ? "olive" : "leaf");
        v.put(x, y + h, z, "woodDark");
      }
}
function waterReuse(c: Ctx) {
  const { v, lv, hx, hz } = c,
    s = ps(c),
    k = c.variant & 3;
  lot(c, s.ground);
  if (lv <= 2) {
    v.box(-hx + 1, 1, -hz + 1, lv === 1 ? hx - 1 : 0, 2, -hz + (lv === 1 ? 10 : 14), "#7b8f5a");
    reedBed(c, -hx + 2, -hz + 2, lv === 1 ? hx - 2 : -1, -hz + (lv === 1 ? 9 : 13), 1);
    for (let x = -hx + 2; x < (lv === 1 ? hx - 2 : -1); x++) v.put(x, 2, hz - 6 - (lv === 2 ? -1 : 0), "woodLight");
    sbldg(c, lv === 1 ? -hx + 2 : 2, hz - 6, lv === 1 ? -hx + 9 : 9, hz - 1, 4, { door: false });
    hpipe(c, lv === 1 ? -hx + 9 : 9, hz - 4, hx - 2, hz - 4, 1, s.metal === "brass" ? "brass" : "steelLight");
    if (lv === 2) clarifier(c, 8, -5, 7);
    if (lv === 1) {
      v.box(hx - 6, 1, hz - 7, hx - 2, 2, hz - 1, "#5aa69a", 0.12);
      c.smoke(hx - 4, 2, hz - 4, "steam");
    }
    return;
  }
  // terraces stepping down from the back toward the front
  const tiers = lv === 3 ? 3 : 4;
  const tw = Math.floor((hz * 2 - 10) / tiers);
  const tx1 = lv === 3 ? 0 : -6;
  for (let i = 0; i < tiers; i++) {
    const y = 1 + (tiers - 1 - i) * 2;
    const z0 = -hz + 1 + i * tw;
    v.box(-hx + 1, 1, z0, tx1, y, z0 + tw, k === 2 ? "brick" : k === 3 ? "#5f6873" : "#c9b48a");
    reedBed(c, -hx + 2, z0 + 1, tx1 - 1, z0 + tw - 1, y);
    v.box(-hx + 4 + i * 3, y - 1, z0 + tw - 1, -hx + 7 + i * 3, y + 1, z0 + tw, "foam", 0.3);
  }
  clarifier(c, Math.round(hx * 0.45), -hz + 9, 7);
  if (lv === 3) {
    sbldg(c, 4, 4, hx - 2, hz - 2, 5, { axis: "x" });
    return;
  }
  clarifier(c, Math.round(hx * 0.45) + (lv === 5 ? -14 : 0), lv === 5 ? -hz + 9 : 6, lv === 5 ? 6 : 6);
  // cooling channel along the front with steam sprays
  v.box(-hx + 1, 1, hz - 5, hx - 1, 2, hz - 2, "concrete");
  v.box(-hx + 2, 1, hz - 4, hx - 2, 2, hz - 3, "#5aa69a", 0.15);
  for (let x = -hx + 4; x < hx - 3; x += 6) {
    v.box(x, 2, hz - 4, x + 1, 4, hz - 3, "steelDark");
    v.put(x, 4, hz - 4, "foam", 0.5);
    c.smoke(x, 5, hz - 4, "steam");
  }
  if (lv === 4) {
    sbldg(c, 4, 14, hx - 2, hz - 7, 6, { axis: "x" });
    return;
  }
  // Lv5: rotating drum filters in an open shed, clean-water tower, lab
  const dz = 6;
  v.box(-2, 1, dz - 4, hx - 3, 2, dz + 6, "concrete");
  for (const px of [-2, hx - 4]) for (const pz of [dz - 4, dz + 5]) v.box(px, 2, pz, px + 1, 11, pz + 1, s.metal);
  sroof(c, -2, 11, dz - 4, hx - 3, dz + 6, "x");
  for (let i = 0; i < 2; i++) {
    const drum = new PixelVox();
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      drum.box(-6, Math.round(Math.sin(ang) * 3), Math.round(Math.cos(ang) * 3), 7, Math.round(Math.sin(ang) * 3) + 1, Math.round(Math.cos(ang) * 3) + 1, a % 4 ? "#9fb7c4" : s.metal);
    }
    c.addRotor({ vox: drum, pivot: [Math.round(hx * 0.4), 6, dz + i * 0], axis: "x", speed: 0.8 });
    if (i === 0) break;
  }
  const wx = -hx + 6 + 22,
    wz = hz - 12;
  v.cylinderY(wx + 0.5, wz + 0.5, 1, 14, 1.2, s.metal);
  v.cylinderY(wx + 0.5, wz + 0.5, 14, 20, 4, k === 1 ? "white" : s.wall);
  v.cylinderY(wx + 0.5, wz + 0.5, 16, 18, 4.3, "cyan", 0.8);
  v.dome(wx + 0.5, 20, wz + 0.5, 3.6, s.trim);
  c.blink(wx, 24, wz, "red");
  sbldg(c, -hx + 1, hz - 13, -hx + 18, hz - 6, 6, { axis: "x", door: true });
}

// TERRACED GLASSHOUSES — glasshouses multiply and climb terraces toward the back. Lv1 one cloche →
// Lv2 twin ferneries → Lv3 "petal" hothouse (central dome ringed by petal wings) → Lv4 three-tier
// terraced nursery → Lv5 four tiers crowned by a great dome with glowing grow lights + heat stack.
// Variants = glasshouse type: 0 Mediterranean ridge house, 1 white geodesic domes, 2 Victorian
// curved-iron conservatory on brick, 3 slate vertical farm glowing magenta.
function glasshouse(c: Ctx, x0: number, z0: number, x1: number, z1: number, y: number) {
  const { v } = c,
    s = ps(c),
    k = c.variant & 3;
  const frame = ["white", "white", "#2f5d3a", "#8a96a3"][k];
  const pane = k === 3 ? "#d77bd8" : "#bfe6ea";
  const e = k === 3 ? 0.7 : 0.25;
  if (k === 2) v.box(x0, y, z0, x1, y + 2, z1, "brick");
  const by = k === 2 ? y + 2 : y;
  // rows of crops visible at the open front
  if (k === 1) {
    const r = Math.min(x1 - x0, z1 - z0) / 2;
    v.dome((x0 + x1) / 2, by, (z0 + z1) / 2, r, pane, e);
    v.dome((x0 + x1) / 2, by, (z0 + z1) / 2, r - 1.2, null as unknown as string);
    const cx = (x0 + x1) / 2,
      cz = (z0 + z1) / 2;
    for (let a = 0; a < 4; a++) {
      const ang = (a / 4) * Math.PI;
      for (let t = 0; t <= 12; t++) {
        const th = (t / 12) * Math.PI;
        v.put(Math.floor(cx + Math.cos(ang) * Math.cos(th) * r), Math.floor(by + Math.sin(th) * (r - 0.3)), Math.floor(cz + Math.sin(ang) * Math.cos(th) * r), frame);
      }
    }
    for (let t = 0; t < 16; t++) {
      const ang = (t / 16) * Math.PI * 2;
      v.put(Math.floor(cx + Math.cos(ang) * r * 0.75), Math.floor(by + r * 0.62), Math.floor(cz + Math.sin(ang) * r * 0.75), frame);
    }
    v.box(Math.floor((x0 + x1) / 2) - 1, by, z1 - 1, Math.floor((x0 + x1) / 2) + 1, by + 3, z1, s.trim);
    return;
  }
  const h = k === 3 ? 7 : 3;
  v.box(x0, by, z0, x1, by + h, z1, pane, e);
  if (x1 - x0 > 2 && z1 - z0 > 2) v.clear(x0 + 1, by, z0 + 1, x1 - 1, by + h, z1 - 1);
  for (let x = x0; x < x1; x += 3) v.box(x, by, z0, x + 1, by + h, z1, frame);
  v.box(x1 - 1, by, z0, x1, by + h, z1, frame);
  if (k === 0) gable(v, x0, by + h, z0, x1, z1, "z", pane, frame);
  else if (k === 2) K.barrelRoof(v, x0, by + h, z0, x1, z1, "z", pane, frame);
  else {
    v.box(x0, by + h, z0, x1, by + h + 1, z1, frame);
    for (let yy = by + 2; yy < by + h; yy += 2) {
      v.box(x0, yy, z0, x1, yy + 1, z1, "#5b2a6b");
      v.clear(x0 + 1, yy, z0 + 1, x1 - 1, yy + 1, z1 - 1);
    }
    v.box(x0 + 1, by + h + 1, z0 + 1, x1 - 1, by + h + 2, z1 - 1, "#f0a8f0", 0.9);
    v.clear(x0 + 2, by + h + 1, z0 + 2, x1 - 2, by + h + 2, z1 - 2);
    for (let x = x0 + 2; x < x1 - 2; x += 3) v.box(x, by + h + 1, z0 + 2, x + 2, by + h + 2, z1 - 2, "solarBlue", 0.2);
  }
  for (let x = x0 + 1; x < x1 - 1; x += 2) v.put(x, by, z1, ["red", "orange", "leaf", "yellow"][(x >> 1) & 3]);
}
function terracedGlasshouses(c: Ctx) {
  const { v, lv, hx, hz } = c,
    s = ps(c),
    k = c.variant & 3;
  lot(c, s.ground);
  if (lv === 1) {
    glasshouse(c, -hx + 3, -hz + 2, 4, hz - 3, 1);
    for (let z = -hz + 2; z < hz - 2; z += 2) v.box(7, 1, z, hx - 2, 2, z + 1, z % 4 ? "leaf" : "leafDark");
    person(v, 6, 1, hz - 2, "leaf");
    return;
  }
  if (lv === 2) {
    glasshouse(c, -hx + 2, -hz + 2, -2, hz - 4, 1);
    glasshouse(c, 2, -hz + 2, hx - 2, hz - 4, 1);
    v.box(-hx + 2, 1, hz - 3, hx - 2, 2, hz - 1, "soil");
    for (let x = -hx + 2; x < hx - 2; x += 2) v.put(x, 2, hz - 2, ["pink", "yellow", "red"][(x >> 1) % 3 & 3] ?? "pink");
    return;
  }
  if (lv === 3) {
    // petal hothouse: a central dome with four petal wings
    const cz = -2;
    for (const [dx, dz] of [[-11, 0], [11, 0], [0, -11]]) glasshouse(c, dx - 5, cz + dz - 4, dx + 5, cz + dz + 4, 1);
    v.dome(0.5, 1, cz + 0.5, 8, k === 3 ? "#d77bd8" : "#bfe6ea", k === 3 ? 0.7 : 0.3);
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      for (let t = 0; t < 8; t++) {
        const th = (t / 8) * (Math.PI / 2);
        v.put(Math.floor(0.5 + Math.cos(ang) * Math.cos(th) * 8), Math.floor(1 + Math.sin(th) * 8), Math.floor(cz + 0.5 + Math.sin(ang) * Math.cos(th) * 8), ["white", "white", "#2f5d3a", "brass"][k]);
      }
    }
    v.box(-1, 9, cz - 1, 2, 11, cz + 2, s.trim);
    flowerBedRow(c, -hx + 2, hz - 3, hx - 2);
    return;
  }
  // Lv4/5 terraces climbing to the back
  const tiers = lv === 4 ? 3 : 4;
  const depth = Math.floor((2 * hz - 4) / tiers);
  for (let i = 0; i < tiers; i++) {
    const y = 1 + (tiers - 1 - i) * 4;
    const z0 = -hz + 1 + i * depth;
    v.box(-hx + 1, 1, z0, hx - 1, y, z0 + depth, k === 2 ? "brick" : k === 3 ? "#4f5d6b" : k === 1 ? "concrete" : "#d9b98a");
    v.box(-hx + 1, y - 1, z0 + depth - 1, hx - 1, y, z0 + depth, "leaf");
    const n = Math.floor((2 * hx - 4) / 12);
    for (let j = 0; j < n; j++) {
      const x0 = -hx + 2 + j * 12;
      if (lv === 5 && i === 0 && j >= Math.floor(n / 2) - 1 && j <= Math.floor(n / 2)) continue;
      glasshouse(c, x0, z0 + 1, x0 + 10, z0 + depth - 2, y);
    }
  }
  if (lv === 5) {
    const y = 1 + (tiers - 1) * 4;
    v.dome(0.5, y, -hz + 1 + depth / 2, 9, k === 3 ? "#d77bd8" : "#bfe6ea", 0.6);
    v.box(-1, y + 9, -hz + depth / 2 - 1, 2, y + 12, -hz + depth / 2 + 2, s.trim);
    c.blink(0, y + 13, Math.round(-hz + depth / 2), "pink");
    K.smokestack(v, -hx + 3.5, -hz + 3.5, y, 12, 1.4, s.metal === "brass" ? "#36424e" : "brick", "white");
    c.smoke(-hx + 3, y + 13, -hz + 3, "steam");
  }
}
function flowerBedRow(c: Ctx, x0: number, z: number, x1: number) {
  for (let x = x0; x < x1; x++) {
    c.v.put(x, 1, z, "soil");
    if (x % 2 === 0) c.v.put(x, 2, z, ["pink", "yellow", "red", "purple"][((x >> 1) & 3)]);
  }
}

// Shared waterside pieces: real game water sits at the BACK (-z) on coast_or_water lots; street at front.
function waterBack(c: Ctx, depth: number, quayCol: string) {
  const { v, hx, hz } = c;
  const qz = -hz + depth;
  v.clear(-hx, 0, -hz, hx, 2, qz);
  quayFoundation(v, -hx, qz, hx, hz, quayCol);
  v.box(-hx, 0, qz, hx, 1, hz, quayCol);
  v.box(-hx, 1, qz, hx, 2, qz + 1, "stone");
  for (let x = -hx + 2; x < hx; x += 6) v.box(x, 2, qz, x + 1, 3, qz + 1, "charcoal");
  return qz;
}
function pier(c: Ctx, x0: number, x1: number, z0: number, z1: number) {
  const { v } = c;
  v.box(x0, 1, z0, x1, 2, z1, "woodLight");
  for (let z = z0; z < z1; z += 4)
    for (const x of [x0, x1 - 1]) v.box(x, -4, z, x + 1, 3, z + 1, "woodDark");
}
/** Passenger ferry along z, bow toward -z. w = beam (x), len along z. */
function ferryBoat(c: Ctx, x: number, z0: number, len: number, decks: number, w = 5) {
  const { v } = c,
    s = ps(c);
  const half = Math.floor(w / 2);
  for (let z = z0; z < z0 + len; z++) {
    const t = z - z0;
    const ww = t < 3 ? Math.max(1, half - (3 - t)) : half;
    v.box(x - ww, -1, z, x + ww + 1, 1, z + 1, "#7a2a22");
    v.box(x - ww, 1, z, x + ww + 1, 3, z + 1, s.livery);
    v.box(x - ww, 3, z, x + ww + 1, 4, z + 1, "white");
  }
  for (let d = 0; d < decks; d++) {
    const y = 4 + d * 3,
      a = 3 + d,
      b = z0 + len - 1 - d;
    v.box(x - half + 1, y, z0 + a, x + half, y + 2, b, "white");
    v.box(x - half + 1, y + 1, z0 + a, x + half, y + 2, b, "glassDark", 0.5);
    for (let z = z0 + a; z < b; z += 2) {
      v.put(x - half + 1, y + 1, z, "#9fd8ea", 0.6);
      v.put(x + half - 1, y + 1, z, "#9fd8ea", 0.6);
    }
    v.box(x - half, y + 2, z0 + a - 1, x + half + 1, y + 3, b + 1, d === decks - 1 ? s.livery : "white");
  }
  const top = 4 + decks * 3;
  v.box(x - 1, top, z0 + 4, x + 2, top + 2, z0 + 6, "glassDark");
  v.box(x - 1, top, z0 + len - 5, x + 2, top + 3, z0 + len - 3, c.variant === 3 ? "gold" : s.livery);
  v.box(x - 1, top + 3, z0 + len - 5, x + 2, top + 4, z0 + len - 3, "charcoal");
  c.smoke(x, top + 4, z0 + len - 4, "smoke");
  v.put(x, top + 2, z0 + 5, "red", 1);
}

// FERRY EXCHANGE — a passenger harbour whose piers, boats and terminal grow together. Lv1 timber pier,
// launch and ticket hut → Lv2 twin finger piers with two ferries and a waiting shelter → Lv3 transfer
// pier with a covered gangway, departure board and transfer hall → Lv4 covered concourse canopy along the
// whole quay, three ferries → Lv5 harbour exchange: grand hall with clock tower & beacon, four berths
// incl. a big car ferry. Variants: 0 terracotta loggia, 1 white streamline, 2 brick & green iron pier, 3 slate & brass deco.
function departureBoard(c: Ctx, x: number, z: number, w: number) {
  const { v } = c;
  v.box(x, 1, z, x + 1, 6, z + 1, "steelDark");
  v.box(x + w - 1, 1, z, x + w, 6, z + 1, "steelDark");
  v.box(x, 6, z, x + w, 9, z + 1, "charcoal");
  for (let i = 1; i < w - 1; i += 2) v.put(x + i, 7 + (i % 2), z + 1, i % 3 ? "amber" : "screenGreen", 1);
}
function concourseRoof(c: Ctx, x0: number, x1: number, z0: number, z1: number, y: number) {
  const { v } = c,
    s = ps(c),
    k = c.variant & 3;
  for (let x = x0; x < x1; x += 6) for (const z of [z0, z1 - 1]) v.box(x, 1, z, x + 1, y, z + 1, s.metal);
  if (k === 0) {
    for (let x = x0; x < x1; x += 6) gable(v, x, y, z0 - 1, Math.min(x1, x + 6), z1 + 1, "z", s.roof, s.trim);
  } else if (k === 1) {
    for (let x = x0; x < x1; x++) {
      const dy = Math.round(Math.sin(((x - x0) / 12) * Math.PI) * 2);
      v.box(x, y + dy, z0 - 1, x + 1, y + dy + 1, z1 + 1, "white");
    }
  } else if (k === 2) K.barrelRoof(v, x0, y, z0 - 1, x1, z1 + 1, "x", "#bfe6ea", "#2f5d3a");
  else {
    v.box(x0, y, z0 - 1, x1, y + 1, z1 + 1, s.wall2);
    v.box(x0, y + 1, z1, x1, y + 2, z1 + 1, "brass", 0.4);
    for (let x = x0 + 2; x < x1; x += 6) v.box(x, y + 1, z0, x + 2, y + 4, z0 + 2, "brass");
  }
}
function ferryExchange(c: Ctx) {
  const { v, lv, hx, hz } = c,
    s = ps(c),
    k = c.variant & 3;
  const depth = lvPick(c, [7, 12, 12, 16, 18]);
  const qz = waterBack(c, depth, s.path);
  if (lv === 1) {
    pier(c, -9, -5, -hz, qz);
    ferryBoat(c, -1, -hz, 7, 1, 3);
    sbldg(c, 4, qz + 2, 12, hz - 1, 4, { axis: "x" });
    lamp(v, -4, 1, qz + 2, 5);
    bench(v, -10, 1, hz - 2, "x", "wood");
    crowd(c, -8, qz + 2, 0, hz - 1, 3);
    return;
  }
  if (lv === 2) {
    pier(c, -11, -7, -hz, qz);
    pier(c, 5, 9, -hz, qz);
    ferryBoat(c, -2, -hz + 1, 10, 1);
    ferryBoat(c, 13, -hz, 11, 2);
    const top = sbldg(c, -hx + 2, qz + 3, 2, hz - 2, 5, { axis: "x" });
    flag(v, 6, 1, qz + 3, Math.max(8, top - 1), [s.livery, "white"]);
    departureBoard(c, 5, hz - 4, 7);
    crowd(c, -8, qz + 1, 12, qz + 3, 4);
    return;
  }
  if (lv === 3) {
    pier(c, -3, 3, -hz, qz);
    for (let z = -hz + 2; z < qz; z += 4) v.box(-3, 2, z, -2, 6, z + 1, s.metal);
    v.box(-3, 6, -hz + 1, 3, 7, qz, k === 1 ? "white" : s.roof);
    ferryBoat(c, -8, -hz, 11, 2);
    ferryBoat(c, 8, -hz + 1, 10, 1);
    ferryBoat(c, 19, -hz, 9, 1, 3);
    sbldg(c, -hx + 2, qz + 3, -4, hz - 1, 7, { axis: "x" });
    departureBoard(c, 2, qz + 3, 10);
    K.clockFace(v, 16, 8, qz + 4, 2);
    v.box(16, 1, qz + 3, 17, 7, qz + 4, s.metal);
    crowd(c, -2, qz + 1, 14, hz - 2, 6);
    return;
  }
  // Lv4/5: concourse canopy all along the quay + piers
  const piers = lv === 4 ? [-18, -2, 14] : [-26, -10, 6, 22];
  for (const px of piers) pier(c, px, px + 4, -hz, qz);
  const boats = lv === 4 ? [-10, 6, 21] : [-18, -2, 14, 29];
  boats.forEach((bx, i) => {
    if (lv === 5 && i === 1) ferryBoat(c, bx, -hz, 17, 3, 9);
    else ferryBoat(c, bx, -hz + (i % 2), lv === 4 ? 13 : 12, 2 + (i % 2), i === boats.length - 1 ? 3 : 5);
  });
  concourseRoof(c, -hx + 1, hx - 1, qz + 1, qz + 7, 8);
  crowd(c, -hx + 3, qz + 1, hx - 3, qz + 7, 10);
  if (lv === 4) {
    sbldg(c, -hx + 3, qz + 10, -2, hz - 2, 8, { axis: "x" });
    departureBoard(c, 4, qz + 9, 12);
    for (let x = 2; x < hx - 2; x += 5) K.tree(v, x, 1, hz - 3, "round", 0.8);
    crowd(c, 0, qz + 9, hx - 3, hz - 4, 5);
    return;
  }
  // Lv5 grand harbour hall with a clock & beacon tower
  const hz0 = qz + 10;
  const top = sbldg(c, -hx + 3, hz0, 6, hz - 2, 10, { axis: "x" });
  K.fountain(v, 18, 1, Math.round((hz0 + hz) / 2), 4);
  for (let x = 10; x < hx - 2; x += 6) K.tree(v, x, 1, hz - 3, "palm", 0.9);
  crowd(c, 8, qz + 9, hx - 3, hz - 4, 6);
  const tx = -10,
    tz = Math.round((hz0 + hz - 2) / 2);
  v.box(tx - 3, top - 2, tz - 3, tx + 3, top + 12, tz + 3, s.wall);
  K.clockFace(v, tx, top + 8, tz + 3, 2);
  v.box(tx - 4, top + 12, tz - 4, tx + 4, top + 13, tz + 4, s.trim);
  v.box(tx - 2, top + 13, tz - 2, tx + 2, top + 16, tz + 2, "warmGlow", 1.1);
  const cap = k === 1 ? top + 17 : K.hip(v, tx - 3, top + 16, tz - 3, tx + 3, tz + 3, k === 3 ? "brass" : s.roof, s.trim);
  if (k === 1) v.box(tx - 3, top + 16, tz - 3, tx + 3, top + 17, tz + 3, "teal");
  c.blink(tx, cap + 1, tz, "red");
  departureBoard(c, -hx + 6, qz + 8, 12);
  departureBoard(c, 10, qz + 8, 12);
  for (const x of [-hx + 2, hx - 3]) flag(v, x, 1, hz - 1, 12, [s.livery, "white", s.accent]);
}

// CANAL BOAT LIFT — boats rise from the lower basin at the back to an aqueduct leaving the front.
// Lv1 cradle lock with balance-beam gates → Lv2 a single caisson hoisted between two towers, spinning
// pulley sheaves → Lv3 twin caissons (one up, one down) with hanging counterweights → Lv4 taller frame
// crowned by a glass viewing gallery with visitors → Lv5 Falkirk-style rotating navigation wheel whose
// two water-filled gondolas swap boats between basin and aqueduct.
// Variants: 0 stone & terracotta arches, 1 white concrete & teal, 2 brick piers & riveted green iron, 3 slate & brass deco.
function canalBoat(c: Ctx, x: number, y: number, z: number, axis: "x" | "z") {
  const { v } = c,
    s = ps(c);
  if (axis === "z") {
    v.box(x - 1, y, z - 3, x + 2, y + 1, z + 4, s.livery);
    v.box(x - 1, y + 1, z - 1, x + 2, y + 3, z + 3, "cream");
    v.box(x - 1, y + 3, z - 1, x + 2, y + 4, z + 3, s.livery);
    v.put(x, y + 2, z + 3, "glass", 0.5);
  } else {
    v.box(x - 3, y, z - 1, x + 4, y + 1, z + 2, s.livery);
    v.box(x - 1, y + 1, z - 1, x + 3, y + 3, z + 2, "cream");
    v.box(x - 1, y + 3, z - 1, x + 3, y + 4, z + 2, s.livery);
  }
}
function caisson(c: Ctx, x0: number, x1: number, z0: number, z1: number, y: number) {
  const { v } = c,
    s = ps(c);
  v.box(x0, y, z0, x1, y + 4, z1, c.variant === 1 ? "white" : s.metal);
  v.box(x0 + 1, y + 1, z0 + 1, x1 - 1, y + 4, z1 - 1, "water", 0.15);
  v.box(x0, y + 4, z0, x1, y + 5, z0 + 1, "hazard");
  v.box(x0, y + 4, z1 - 1, x1, y + 5, z1, "hazard");
  canalBoat(c, Math.floor((x0 + x1) / 2), y + 3, Math.floor((z0 + z1) / 2), "x");
}
function liftTower(c: Ctx, x: number, z0: number, z1: number, h: number) {
  const { v } = c,
    s = ps(c),
    k = c.variant & 3;
  const col = ["#d9c39a", "white", "brick", "#4f5d6b"][k];
  v.box(x, 1, z0, x + 4, h, z1, col);
  if (k === 2) for (let y = 3; y < h; y += 4) v.box(x, y, z0, x + 4, y + 1, z1, "#2f5d3a");
  if (k === 3) for (let y = 4; y < h; y += 5) v.box(x - 1, y, z0, x + 5, y + 1, z1, "brass");
  if (k === 0) for (let z = z0 + 1; z + 2 < z1; z += 4) v.clear(x, 1, z, x + 4, 5, z + 2);
  if (k === 1) v.box(x + 1, 2, z1 - 1, x + 3, h - 2, z1, "teal", 0.3);
  v.box(x - 1, h, z0 - 1, x + 5, h + 1, z1 + 1, s.trim);
}
function sheave(c: Ctx, x: number, y: number, z: number, r: number) {
  const wheel = new PixelVox();
  for (let a = 0; a < 16; a++) {
    const ang = (a / 16) * Math.PI * 2;
    wheel.put(0, Math.round(Math.sin(ang) * r), Math.round(Math.cos(ang) * r), c.variant === 3 ? "brass" : "steelDark");
  }
  for (let d = -r; d <= r; d++) {
    wheel.put(0, d, 0, "silver");
    wheel.put(0, 0, d, "silver");
  }
  c.addRotor({ vox: wheel, pivot: [x, y, z], axis: "x", speed: 0.7 });
}
function aqueduct(c: Ctx, x0: number, x1: number, z0: number, z1: number, y: number) {
  const { v } = c,
    s = ps(c),
    k = c.variant & 3;
  v.box(x0, y - 1, z0, x1, y + 2, z1, ["#d9c39a", "concrete", "brick", "#4f5d6b"][k]);
  v.box(x0 + 1, y, z0, x1 - 1, y + 2, z1, "water", 0.15);
  for (let z = z0 + 2; z < z1; z += 6) {
    v.box(x0, 1, z, x0 + 2, y - 1, z + 2, k === 2 ? "#2f5d3a" : s.metal === "brass" ? "#36424e" : ["#d9c39a", "concrete"][k]);
    v.box(x1 - 2, 1, z, x1, y - 1, z + 2, k === 2 ? "#2f5d3a" : s.metal === "brass" ? "#36424e" : ["#d9c39a", "concrete"][k]);
  }
  for (let z = z0; z < z1; z += 2) {
    v.put(x0, y + 2, z, s.trim);
    v.put(x1 - 1, y + 2, z, s.trim);
  }
}
function canalBoatLift(c: Ctx) {
  const { v, lv, hx, hz } = c,
    s = ps(c),
    k = c.variant & 3;
  const depth = lvPick(c, [5, 11, 11, 14, 16]);
  const qz = waterBack(c, depth, s.ground);
  K.speckle(c, s.path, 0.2, 0, 0);
  if (lv === 1) {
    // a lock chamber climbing toward the front
    const wallCol = ["#d9c39a", "concrete", "brick", "#4f5d6b"][k];
    v.box(-6, 1, qz, -4, 6, hz, wallCol);
    v.box(4, 1, qz, 6, 6, hz, wallCol);
    v.box(-4, 0, qz, 4, 3, hz - 7, "water", 0.15);
    v.box(-4, 0, hz - 7, 4, 5, hz, "water", 0.15);
    for (const gz of [qz, hz - 7]) {
      v.box(-4, 1, gz, 4, 6, gz + 1, "woodDark");
      v.box(-12, 6, gz, -4, 7, gz + 1, "wood");
      v.box(4, 6, gz, 12, 7, gz + 1, "wood");
    }
    canalBoat(c, 0, 3, qz + 3, "z");
    sbldg(c, 8, qz + 1, 15, hz, 4, { door: false });
    person(v, -9, 1, qz + 2, "white");
    return;
  }
  const UH = lvPick(c, [0, 14, 16, 20, 22]);
  if (lv === 2) {
    liftTower(c, -12, -hz + 2, qz, UH + 8);
    liftTower(c, 8, -hz + 2, qz, UH + 8);
    caisson(c, -8, 8, -hz + 3, qz - 1, Math.round(UH * 0.55));
    v.box(-12, UH + 8, -hz + 3, 12, UH + 10, -hz + 5, s.trim);
    v.box(-12, UH + 8, qz - 3, 12, UH + 10, qz - 1, s.trim);
    for (const x of [-7, 6]) for (const z of [-hz + 4, qz - 2]) v.box(x, Math.round(UH * 0.55) + 5, z, x + 1, UH + 8, z + 1, "steelDark");
    sheave(c, -2, UH + 11, Math.round((-hz + qz) / 2), 3);
    aqueduct(c, -5, 5, qz - 1, hz, UH);
    sbldg(c, 8, qz + 4, hx - 1, hz - 1, 5, { axis: "x" });
    return;
  }
  if (lv === 3 || lv === 4) {
    const top = UH + 8;
    const towers = [-hx + 2, -2, hx - 6];
    for (const tx of towers) liftTower(c, tx, -hz + 2, qz, top);
    v.box(-hx + 2, top, -hz + 3, hx - 2, top + 2, qz - 1, s.trim);
    v.clear(-hx + 6, top, -hz + 5, hx - 6, top + 2, qz - 3);
    // left caisson up (meets the aqueduct), right caisson down in the basin
    caisson(c, -hx + 6, -2, -hz + 3, qz - 1, UH - 3);
    caisson(c, 2, hx - 6, -hz + 3, qz - 1, 0);
    // counterweights hang opposite: low on the left, high on the right
    v.box(-hx + 7, 3, qz - 1, -hx + 10, 7, qz + 1, "concreteDark");
    v.box(hx - 10, top - 6, qz - 1, hx - 7, top - 2, qz + 1, "concreteDark");
    v.box(-hx + 8, 7, qz - 1, -hx + 9, top, qz, "steelDark");
    v.box(hx - 9, top - 2, qz - 1, hx - 8, top, qz, "steelDark");
    sheave(c, -hx + 4, top + 3, -hz + 6, 3);
    sheave(c, hx - 4, top + 3, -hz + 6, 3);
    aqueduct(c, -hx + 10, -6, qz - 1, hz, UH);
    if (lv === 3) {
      sbldg(c, 4, qz + 4, hx - 2, hz - 1, 6, { axis: "x" });
      return;
    }
    // Lv4 viewing gallery
    v.box(-hx + 4, top + 2, -hz + 2, hx - 4, top + 7, -hz + 9, "#9fd8ea", 0.5);
    v.clear(-hx + 5, top + 2, -hz + 3, hx - 5, top + 6, -hz + 8);
    v.box(-hx + 4, top + 2, -hz + 2, hx - 4, top + 3, -hz + 9, s.trim);
    crowd(c, -hx + 6, -hz + 4, hx - 6, -hz + 7, 7, top + 3);
    sroof(c, -hx + 4, top + 7, -hz + 2, hx - 4, -hz + 9, "x");
    for (const x of [-hx + 3, hx - 4]) flag(v, x, top + 2, qz - 2, 8, [s.livery, "white"]);
    sbldg(c, 4, qz + 4, hx - 2, hz - 1, 7, { axis: "x" });
    return;
  }
  // Lv5 rotating wheel lift — the wheel faces the street so both gondolas are on show
  const pz = -hz + 9,
    py = 15,
    R = 14;
  const pyl = ["#d9c39a", "white", "brick", "#4f5d6b"][k];
  const armCol = k === 3 ? "brass" : k === 2 ? "#2f5d3a" : k === 1 ? "#e9eef0" : "#b8b0a0";
  v.box(-2, 1, pz - 7, 2, py + 2, pz - 4, pyl);
  v.box(-3, py + 1, pz - 8, 3, py + 3, pz - 3, s.trim);
  v.box(-1, py - 1, pz - 4, 1, py + 1, pz + 4, "steelDark");
  const wheel = new PixelVox();
  const ang = Math.PI - (38 * Math.PI) / 180;
  const ends: [number, number][] = [
    [Math.round(-Math.cos(ang) * R), Math.round(-Math.sin(ang) * R)],
    [Math.round(Math.cos(ang) * R), Math.round(Math.sin(ang) * R)],
  ];
  for (const az of [-3, 2]) {
    for (let t = -R; t <= R; t++) {
      const dx = Math.round(Math.cos(ang) * t),
        dy = Math.round(Math.sin(ang) * t);
      const bow = Math.round(Math.sin(((t + R) / (2 * R)) * Math.PI) * 3) * (t < 0 ? 1 : -1);
      wheel.box(dx - 1, dy - 2 + bow, az, dx + 2, dy + 2 + bow, az + 1, armCol);
    }
    for (let a = 0; a < 16; a++) {
      const an = (a / 16) * Math.PI * 2;
      wheel.put(Math.round(Math.cos(an) * 3), Math.round(Math.sin(an) * 3), az, "steelDark");
    }
  }
  for (const [dx, dy] of ends) {
    wheel.box(dx - 5, dy - 3, -3, dx + 6, dy + 2, 3, k === 1 ? "#dfe8e6" : s.metal);
    wheel.box(dx - 4, dy - 2, -2, dx + 5, dy + 2, 2, "water", 0.15);
    wheel.box(dx - 5, dy + 2, -3, dx + 6, dy + 3, -2, "hazard");
    wheel.box(dx - 1, dy + 1, -1, dx + 3, dy + 3, 1, "cream");
    wheel.box(dx - 2, dy + 1, -1, dx - 1, dy + 2, 1, s.livery);
  }
  c.addRotor({ vox: wheel, pivot: [0, py, pz], axis: "z", speed: 0.12 });
  // the aqueduct leaves from the high gondola toward the street
  aqueduct(c, ends[1][0] - 2, ends[1][0] + 4, pz + 4, hz, py + ends[1][1] - 1);
  sbldg(c, 14, qz + 8, hx - 2, hz - 1, 6, { axis: "x" });
  crowd(c, -4, hz - 6, 12, hz - 1, 6);
  for (let x = -2; x < 12; x += 5) K.tree(v, x, 1, qz + 4, "round", 0.8);
  canalBoat(c, 22, 1, -hz + 4, "x");
  canalBoat(c, ends[1][0], py + ends[1][1] + 1, hz - 6, "z");
}

// MARITIME COLLEGE — a sailing school around a practice basin at the back. Lv1 boathouse, slipway &
// dinghies → Lv2 launch basin with pontoon, buoys and a motor launch → Lv3 harbour workshops: sawtooth
// shed, hull on a cradle, jib crane → Lv4 nautical academy with clock tower and signal-flag yardarm,
// training sloop → Lv5 college quad with a lighthouse (rotating beam), tall ship and navigation dome.
function dinghy(c: Ctx, x: number, z: number, sail: string) {
  const { v } = c;
  v.box(x - 2, 0, z, x + 3, 1, z + 2, "white");
  v.box(x, 1, z, x + 1, 6, z + 1, "woodDark");
  for (let i = 0; i < 4; i++) v.box(x + 1, 2 + i, z, x + 4 - i, 3 + i, z + 1, sail);
}
function tallShip(c: Ctx, x0: number, x1: number, z: number, masts: number) {
  const { v } = c,
    s = ps(c);
  for (let x = x0; x < x1; x++) {
    const t = Math.min(x - x0, x1 - 1 - x);
    const w = t < 3 ? 1 : 2;
    v.box(x, 0, z - w, x + 1, 3, z + w + 1, x - x0 < 2 ? "woodDark" : "#3b2a1f");
    v.put(x, 3, z - w, "gold");
  }
  v.box(x1, 2, z, x1 + 4, 3, z + 1, "woodDark");
  v.box(x0, 3, z - 2, x0 + 4, 5, z + 3, "#5a3a26");
  for (let m = 0; m < masts; m++) {
    const mx = x0 + Math.round(((m + 1) * (x1 - x0)) / (masts + 1));
    const h = m === Math.floor(masts / 2) ? 18 : 15;
    v.box(mx, 3, z, mx + 1, 3 + h, z + 1, "woodDark");
    for (let y = 6; y < 3 + h - 2; y += 4) v.box(mx, y, z - 3, mx + 1, y + 3, z + 4, "white");
    v.put(mx, 3 + h, z, s.livery);
  }
}
function maritimeCollege(c: Ctx) {
  const { v, lv, hx, hz } = c,
    s = ps(c),
    k = c.variant & 3;
  lot(c, s.ground);
  const depth = lvPick(c, [6, 11, 11, 13, 14]);
  const qz = -hz + depth;
  v.box(-hx, 0, -hz, hx, 1, qz, "water", 0.08);
  v.box(-hx, 1, qz, hx, 2, qz + 1, "stone");
  v.box(-hx, 1, -hz, -hx + 1, 2, qz, "stone");
  v.box(hx - 1, 1, -hz, hx, 2, qz, "stone");
  const sails = [s.livery, "red", "yellow", "white", s.accent, "orange"];
  if (lv === 1) {
    sbldg(c, -hx + 2, qz + 2, -2, hz - 1, 5, { axis: "z" });
    for (let i = 0; i < 4; i++) v.box(-hx + 5, 0, qz + 1 - i, -hx + 9, 1 + (i === 0 ? 0 : 0), qz + 2 - i, "concrete");
    for (let i = 0; i < 2; i++) dinghy(c, -2 + i * 9, -hz + 1 + i, sails[i]);
    v.box(4, 1, qz + 3, 11, 2, qz + 5, "woodLight");
    dinghy(c, 6, qz + 3, sails[2]);
    person(v, 2, 1, qz + 3, "orange");
    return;
  }
  // pontoon and dinghy fleet
  v.box(-hx + 4, 1, qz - 6, hx - 4, 2, qz - 4, "woodLight");
  const nd = lvPick(c, [2, 4, 4, 3, 2]);
  for (let i = 0; i < nd; i++) dinghy(c, -hx + 6 + i * 7, -hz + 1 + (i % 2) * 2, sails[i % sails.length]);
  for (let x = -hx + 3; x < hx - 3; x += 7) v.put(x, 1, -hz + 1, "orange");
  if (lv === 2) {
    sbldg(c, -hx + 2, qz + 2, -2, hz - 1, 6, { axis: "z" });
    v.box(6, 0, qz - 3, 11, 1, qz - 1, "white");
    v.box(8, 1, qz - 3, 10, 3, qz - 1, s.livery);
    flag(v, 10, 1, qz + 3, 10, [s.livery, "white"]);
    crowd(c, 2, qz + 2, hx - 2, hz - 1, 4);
    return;
  }
  // Lv3+ workshops
  const wx0 = lv === 3 ? -hx + 2 : -hx + 2;
  const wshop = sbldg(c, wx0, qz + 3, wx0 + 16, qz + 15, 7, { axis: "x" });
  void wshop;
  // hull on a cradle + jib crane
  const hx0 = wx0 + 19;
  for (let x = hx0; x < hx0 + 10; x++) {
    const t = Math.min(x - hx0, hx0 + 9 - x);
    v.box(x, 2, qz + 6 - Math.min(2, t), x + 1, 6, qz + 7 + Math.min(2, t), x % 2 ? s.livery : "#7a2a22");
  }
  v.box(hx0 + 1, 1, qz + 5, hx0 + 2, 2, qz + 9, "woodDark");
  v.box(hx0 + 7, 1, qz + 5, hx0 + 8, 2, qz + 9, "woodDark");
  K.crane(v, hx0 + 12, 1, qz + 2, 13, 8, ["terracotta", "teal", "#2f6b3e", "brass"][k], "x");
  if (lv === 3) return;
  // academy + clock tower + signal yardarm
  const ax0 = lv === 4 ? -hx + 2 : -hx + 2,
    az0 = qz + 18;
  const atop = sbldg(c, ax0, az0, lv === 4 ? hx - 2 : 10, hz - 1, 9, { axis: "x" });
  const tx = lv === 4 ? hx - 8 : 4,
    tz = az0 + 2;
  v.box(tx - 2, atop - 2, tz - 2, tx + 3, atop + 8, tz + 3, s.wall);
  K.clockFace(v, tx, atop + 5, tz + 3, 2);
  sroof(c, tx - 2, atop + 8, tz - 2, tx + 3, tz + 3);
  const mx = lv === 4 ? -hx + 3 : -6,
    mz = qz + 16;
  v.box(mx, 1, mz, mx + 1, 20, mz + 1, "white");
  v.box(mx - 5, 16, mz, mx + 6, 17, mz + 1, "white");
  const fl = ["red", "yellow", "blue", "white", "leaf", "orange"];
  for (let i = 0; i < 4; i++) {
    v.put(mx - 4 + i, 15 - i, mz, fl[i]);
    v.put(mx + 5 - i, 15 - i, mz, fl[i + 2]);
  }
  if (lv === 4) {
    tallShip(c, 2, 20, -hz + 5, 2);
    return;
  }
  // Lv5: tall ship, lighthouse, navigation dome
  tallShip(c, -18, 14, -hz + 6, 3);
  const lx = hx - 6,
    lz = qz + 6;
  for (let y = 1; y < 26; y += 3) v.cylinderY(lx + 0.5, lz + 0.5, y, y + 3, 2.5 - y * 0.03, (y / 3) % 2 < 1 ? "white" : k === 2 ? "#2f6b3e" : k === 3 ? "#1f2a44" : "red");
  v.cylinderY(lx + 0.5, lz + 0.5, 26, 27, 3.2, s.trim);
  v.cylinderY(lx + 0.5, lz + 0.5, 27, 30, 2, "warmGlow", 1.4);
  v.cone(lx + 0.5, 30, 33, lz + 0.5, 2.6, 0.3, k === 3 ? "brass" : "red");
  const beam = new PixelVox();
  beam.box(1, 0, 0, 7, 1, 1, "#fff6c8", 1.5);
  beam.box(-7, 0, 0, -1, 1, 1, "#fff6c8", 1.5);
  c.addRotor({ vox: beam, pivot: [lx, 28, lz], axis: "y", speed: 1.2 });
  c.blink(lx, 34, lz, "red");
  v.cylinderY(hx - 14, hz - 7, 1, 6, 6, s.wall);
  v.dome(hx - 14, 6, hz - 7, 6, k === 3 ? "brass" : k === 2 ? "#2f5d3a" : "white");
  v.put(hx - 14, 12, hz - 7, "warmGlow", 1);
  v.box(hx - 26, 0, az0, hx - 21, 1, hz - 1, "grass");
  K.tree(v, hx - 24, 1, hz - 4, "round", 1);
  crowd(c, -hx + 3, qz + 16, hx - 10, qz + 18, 6);
}

const REDESIGNED: Record<string, { growth: string; build: (c: Ctx) => void }> = {
  growers_exchange: {
    growth: "A fruit cart sprouts a three-stall court, a round auction ring, an arcaded market hall and finally a clock-towered exchange — the giant fruit mascot climbs higher every level.",
    build: growersExchange,
  },
  bakery_coop: {
    growth: "One smoking dome oven becomes a bakehouse, a row of chimneyed shopfronts, an arched bread arcade, then a co-op court around a spinning flour windmill under a giant bread sign.",
    build: bakeryCoop,
  },
};
REDESIGNED.open_pit_mine = {
  growth: "A shallow test cut deepens into a stepped crater: more benches, a haul ramp, dump trucks, a conveyor to the ore pile, a rail load-out and finally a pit lake with a spinning bucket-wheel excavator.",
  build: openPitMine,
};
REDESIGNED.regional_airport = {
  growth: "A grass airstrip with a prop plane paves into a runway with a village terminal, then gains jet bridges, a radar tower and runway lights, a long concourse and finally a curved crescent terminal with four jets.",
  build: regionalAirport,
};
REDESIGNED.freight_rail_terminal = {
  growth: "A single siding with boxcars adds a gantry crane, then a four-track switchyard with a signal box and locomotive, a stacked container yard and finally towering rail-mounted gantries over a long train.",
  build: freightTerminal,
};
REDESIGNED.district_heat_works = {
  growth: "An exchanger hut with an insulated pipe loop grows a pipe court, a round hall of spinning heat-pump fans, a towering thermal accumulator with a glowing thermometer and finally twin tanks and a rainbow pipe bundle.",
  build: heatWorks,
};
REDESIGNED.water_reuse_works = {
  growth: "A reed filter pond adds a clarifier with a rotating skimmer bridge, then cascading reed terraces, a steaming cooling channel and finally rotating drum filters and a glowing clean-water tower.",
  build: waterReuse,
};
REDESIGNED.terraced_glasshouses = {
  growth: "One glass cloche becomes twin ferneries, a petal-shaped dome hothouse, then glasshouses climbing three and four terraces crowned by a great glowing dome.",
  build: terracedGlasshouses,
};
REDESIGNED.ferry_exchange = {
  growth: "A timber pier and launch grow into twin berths, a covered transfer pier, a canopy concourse along the whole quay and finally a clock-towered harbour hall with four ferries.",
  build: ferryExchange,
};
REDESIGNED.canal_boat_lift = {
  growth: "A balance-beam lock becomes a hoisted caisson between towers, twin counterweighted caissons, a glass viewing gallery and finally a rotating wheel that swaps boats between basin and aqueduct.",
  build: canalBoatLift,
};
REDESIGNED.maritime_college = {
  growth: "A boathouse and dinghies add a launch basin, workshops with a hull on the cradle, a clock-towered academy with signal flags and finally a lighthouse, a tall ship and a navigation dome.",
  build: maritimeCollege,
};
// ==== ROUND2 END

const builders: Record<string, (c: Ctx) => void> = {
  pumped_storage_station: storage,
  flying_car_depot: (c) => skyDepot(c),
  solar_canopy_orchard: solarOrchard,
  floodplain_park: floodpark,
  hanging_garden_arcology: arcology,
  teleportation_depot: (c) => skyDepot(c, true),
  materials_foundry: foundry,
  rainwater_cathedral: rainvault,
  spaceport,
  skybridge_university: university,
  ocean_habitat_ring: oceanRing,
};
defineDesigns(
  Object.fromEntries(
    WEALTH_PROJECTS.map((p) => [
      p.id,
      {
        footprints: p.footprints,
        levels: p.levels,
        growth: REDESIGNED[p.id]?.growth ?? p.description,
        build:
          REDESIGNED[p.id]?.build ??
          ((c: Ctx) => {
            builders[p.id](c);
            projectDetail(p.id, c);
          }),
      },
    ]),
  ),
);
