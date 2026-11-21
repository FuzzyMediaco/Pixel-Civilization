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
import { defineDesigns } from "./registry";
import { WEALTH_PROJECTS } from "../wealthProjects";

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
function market(c: Ctx) {
  const { v, lv, hx, hz } = c;
  foundation(c);
  const r = Math.min(hx, hz) - 4;
  arc(c, 0, 0, r, 2.8, 6.1, 1, 2, "woodLight", 1.5);
  v.cylinderY(0, 0, 1, 3, 2 + lv * 0.4, "brick");
  cart(c, 0, 0, Math.max(2, r - 2), 1, "wood");
  for (let i = 0; i < lv + 2; i++) {
    const a = 3 + (i * 3) / (lv + 1),
      x = Math.round(Math.cos(a) * r),
      z = Math.round(Math.sin(a) * r);
    canopy(
      c,
      x,
      z,
      Math.max(2, Math.min(4, (r / 3) | 0)),
      4 + lv / 2,
      ["crimson", "teal", "amber", "leaf"][(i + c.variant) % 4],
    );
    v.box(x - 2, 2, z + 1, x + 2, 3, z + 3, "wood");
    v.put(x, 3, z + 2, "red");
  }
  if (lv > 2) hall(c, -hx + 2, hz - 8, 7, 5, 4);
  if (lv === 5) flag(v, 0, 3, 0, 8, ["red", "cream", "leaf"]);
}
function bakery(c: Ctx) {
  foundation(c);
  const { v, hx, hz, lv } = c;
  const z = -hz + 5;
  for (let i = 0; i < lv + 1; i++) {
    const x = Math.round(-hx + 4 + (i * (2 * hx - 8)) / lv);
    v.cylinderY(x, z, 1, 4, 2.7, "brickDark");
    v.dome(x, 4, z, 3, "terracotta");
    v.box(x - 1, 1, z + 2, x + 2, 4, z + 3, "charcoal");
    v.put(x, 2, z + 3, "fire", 1.2);
    v.box(x, 5, z - 1, x + 1, 7 + lv, z, "brickDark");
    if (i === 0) c.smoke(x, 7 + lv, z, "smoke");
  }
  if (lv >= 2) hall(c, -hx + 2, z + 5, Math.min(13, 2 * hx - 5), 5, 4 + lv);
  cart(c, hx - 5, hz - 5, 3, 1, "gold");
  canopy(c, 0, hz - 4, 2 + Math.floor(lv / 3), 4 + lv, "cream");
}
function ferry(c: Ctx) {
  foundation(c, true);
  const { v, hx, hz, lv } = c;
  const radius = Math.min(hx, hz) - 4;
  arc(c, 0, 0, radius, 0.2, 3.55, 1, 2, "woodLight", 2);
  for (let i = 0; i < lv + 1; i++) {
    const x = Math.round(-hx + 3 + (i * (2 * hx - 7)) / lv);
    v.box(x, 1, -hz + 3, x + 2, 3, 1, "wood");
    v.put(x, 3, -hz + 3, "warmGlow", 0.7);
  }
  hall(c, -hx + 3, hz - 7, Math.min(14, 2 * hx - 6), 5, 3 + lv);
  cart(c, 0, -2, Math.max(2, radius - 3), 1, "white", true);
}
function reuse(c: Ctx) {
  foundation(c);
  const { v, hx, hz, lv } = c;
  for (let i = 0; i < lv + 1; i++) {
    const x = -hx + 2 + (i * (2 * hx - 4)) / (lv + 1),
      w = (2 * hx - 4) / (lv + 1) - 1;
    v.box(x, 1, -hz + 2, x + w, 2 + (i % 3), hz - 3, "soil");
    v.box(x, 2 + (i % 3), -hz + 2, x + w, 3 + (i % 3), hz - 3, "#78b6ac");
    for (let z = -hz + 3; z < hz - 3; z += 3) v.box(x, 3 + (i % 3), z, x + 1, 5 + (i % 3), z + 1, "olive");
  }
  const z = hz - 5;
  v.box(-hx + 2, 1, z, hx - 2, 2, z + 2, "water");
  hall(c, -3, -2, 7, 6, 4 + lv);
  machine(c, 2, 4 + lv, 5, 2 + Math.floor(lv / 2), "z", "steelLight");
}
function mine(c: Ctx) {
  foundation(c);
  const { v, hx, hz, lv } = c,
    r = Math.min(hx, hz) - 2;
  for (let j = 0; j < lv + 1; j++) {
    const rr = r * (1 - j / (lv + 1));
    arc(
      c,
      0,
      0,
      rr,
      (j * 0.6 + 0.8) % (Math.PI * 2),
      (j * 0.6 + 0.2) % (Math.PI * 2),
      1,
      (lv + 1 - j) * 2,
      ["#b98552", "#c79465", "#946c52"][j % 3],
      1.8,
    );
  }
  const x = -hx + 4,
    z = -hz + 4;
  v.box(x - 1, 1, z, x + 1, 7 + lv * 2, z + 2, "steelDark");
  v.box(x - 1, 7 + lv * 2, z, x + 6, 8 + lv * 2, z + 2, "hazard");
  machine(c, x + 4, 7 + lv * 2, z + 1, 2, "z", "steelLight");
  cart(c, 0, 0, Math.max(2, r - 1), 2 * lv + 4, "busYellow");
}
function glasshouses(c: Ctx) {
  foundation(c);
  const { v, hx, hz, lv } = c;
  for (let i = 0; i < lv + 1; i++) {
    const x = Math.round(-hx + 3 + (i * (2 * hx - 7)) / lv),
      r = Math.max(2, Math.floor((2 * hx - 5) / (lv + 1) / 2));
    const by = 1 + (i % 3);
    v.box(x - r, 1, -hz + 3, x + r + 1, by + 1, hz - 4, "stone");
    for (let z = -hz + 3; z < hz - 4; z++) {
      for (let d = -r; d <= r; d++) {
        const h = Math.round(Math.sqrt(Math.max(0, r * r - d * d))) + by + 2;
        v.put(x + d, h, z, z % 4 === 0 ? trim[c.variant] : "glass", 0.1);
        if (Math.abs(d) === r) v.box(x + d, by + 1, z, x + d + 1, h, z + 1, "glassDark", 0.2);
      }
    }
    v.box(x, by + 2, -hz + 2, x + 1, by + 3, hz - 4, "leaf");
  }
  cart(c, 0, hz - 4, 3, 1, "leaf");
  machine(c, 0, 4 + lv, 0, 2, "x", "steelLight");
}
function freight(c: Ctx) {
  foundation(c);
  const { v, hx, hz, lv } = c;
  for (let i = 0; i < lv + 1; i++) {
    const x = -hx + 3 + (i * (2 * hx - 7)) / lv;
    v.box(x, 0, -hz, x + 1, 1, hz, "steel");
    v.box(x + 2, 0, -hz, x + 3, 1, hz, "steel");
    for (let z = -hz + 1; z < hz; z += 4) v.box(x - 1, 0, z, x + 4, 1, z + 1, "woodDark");
  }
  const h = 6 + lv * 2;
  for (const x of [-hx + 3, hx - 4]) for (const z of [-2, 3]) v.box(x, 1, z, x + 2, h, z + 1, "orange");
  v.box(-hx + 3, h, -2, hx - 2, h + 2, 4, "hazard");
  for (let i = 0; i < lv; i++)
    container(v, -hx + 3 + i * 4, 1, hz - 8, "z", ["crimson", "cyan", "indigo", "orange"][(i + c.variant) % 4]);
  machine(c, 0, h, -2, 2, "z", "steelDark");
  cart(c, 0, 0, (Math.min(hx, hz) * 0.45) | 0, 1, "crimson");
}
function heatworks(c: Ctx) {
  foundation(c);
  const { v, hx, hz, lv } = c,
    r = Math.min(hx, hz) - 4;
  for (let i = 0; i < lv + 3; i++) {
    const a = (i * 2 * Math.PI) / (lv + 3),
      x = Math.cos(a) * r,
      z = Math.sin(a) * r;
    v.cylinderY(x, z, 1, 5 + lv, 2.3, "copper");
    for (let y = 2; y <= 5 + lv; y += 2) ring(v, x, z, y, y + 1, 2.8, 1.7, "brass");
  }
  ring(v, 0, 0, 2, 4, r + 1, r - 1, "copper");
  hall(c, -4, -3, 8, 6, 3 + lv);
  machine(c, 0, 5 + lv, 0, (3 + lv / 2) | 0, "y", "steelLight");
  c.smoke(1, 5 + lv, 0, "steam");
}
function airport(c: Ctx) {
  foundation(c);
  const { v, hx, hz, lv } = c;
  v.box(-hx + 1, 0, 1, hx - 1, 1, hz - 2, "asphalt");
  for (let x = -hx + 2; x < hx - 2; x += 4)
    v.box(x, 0, Math.round(hz / 2), x + 2, 1, Math.round(hz / 2) + 1, "white");
  for (let i = 0; i < lv + 1; i++) {
    const x = -hx + 3 + (i * (2 * hx - 8)) / lv;
    canopy(c, x, -hz + 5, 3, 4 + lv, ["white", "glass", "steelLight", "amber"][c.variant]);
    v.box(x, 1, -hz + 5, x + 2, 4, 1, "glassDark", 0.25);
  }
  const x = hx - 5,
    z = -3;
  v.box(x, 1, z, x + 2, 6 + lv * 2, z + 2, "cream");
  v.box(x - 1, 6 + lv * 2, z - 1, x + 3, 8 + lv * 2, z + 3, "glassDark", 0.3);
  machine(c, x, 9 + lv * 2, z, 2, "y", "steel");
  c.blink(x, 10 + lv * 2, z, "red");
}
function boatlift(c: Ctx) {
  foundation(c, true);
  const { v, lv, hx, hz } = c;
  const h = 5 + lv * 3;
  for (const x of [-hx + 3, hx - 4]) {
    v.box(x, 1, -hz + 3, x + 2, h, hz - 3, "steelDark");
    v.box(x - 1, h - 1, -hz + 2, x + 3, h + 1, hz - 2, trim[c.variant]);
    for (let z = -hz + 4; z < hz - 3; z += 5) v.box(x, h / 2, z, x + 1, h - 1, z + 2, "hazard");
  }
  const y = 2 + lv;
  v.box(-hx + 5, y, -hz + 4, hx - 4, y + 1, hz - 4, "woodLight");
  v.box(-hx + 5, y + 1, -hz + 4, hx - 4, y + 2, hz - 4, "water", 0.25);
  v.box(-hx + 3, h, 0, hx - 2, h + 2, 2, "steel");
  machine(c, 0, h, 2, (2 + lv / 2) | 0, "z", "brass");
}
function college(c: Ctx) {
  foundation(c);
  const { v, lv, hx, hz } = c,
    r = Math.min(hx, hz) - 5;
  pool(c, 0, 0, r);
  for (let i = 0; i < lv + 1; i++) {
    const a = 2.7 + (i * 3) / lv;
    const x = Math.round(Math.cos(a) * r),
      z = Math.round(Math.sin(a) * r);
    hall(c, x - 2, z - 2, 5, 5, 3 + (i % 3) + Math.floor(lv / 2));
  }
  cart(c, 0, 0, Math.max(2, r - 2), 1, "white", true);
  flag(v, hx - 5, 1, hz - 4, 4 + lv, ["sky", "cream", "blue"]);
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
    case "growers_exchange": {
      const r = Math.max(2, Math.min(hx, hz) * 0.24);
      v.cylinderY(0, 0, 1, 3, r, "woodDark");
      v.cylinderY(0, 0, 3, 4, r - 1, "woodLight");
      for (let i = 0; i < lv + 1; i++) {
        const x = Math.round((i / lv - 0.5) * hx),
          z = Math.round(hz * 0.55);
        v.box(x, 1, z, x + 3, 3, z + 2, "crate");
        v.box(x, 3, z, x + 2, 4, z + 1, i % 2 ? "orange" : "leaf");
      }
      if (lv >= 3) {
        canopy(c, 0, 0, Math.round(r), 5 + lv, ["cream", "brick", "teal", "gold"][s]);
        flag(v, hx - 4, 1, hz - 4, 5 + lv, ["green", "cream", "orange"]);
      }
      break;
    }
    case "bakery_coop": {
      const h = 3 + lv;
      v.box(-hx + 2, 1, hz - 5, hx - 2, 2, hz - 2, "#a99b88");
      if (lv >= 2) {
        const x = Math.round(-hx * 0.2),
          z = Math.round(-hz * 0.05);
        for (let i = 0; i < lv - 1; i++) {
          const px = x + i * 4;
          v.cylinderY(px, z, 1, h, 2, "cream");
          v.cone(px, h, h + 3, z, 2.5, 0.5, "terracotta");
          v.box(px, 2, z + 2, px + 1, h, z + 3, "woodDark");
        }
        hall(c, -hx + 2, 1, Math.round(hx * 0.7), Math.round(hz * 0.48), 3 + lv);
        pipe(-hx + 3, 0, x, z, h - 2, "steelDark");
      }
      for (let i = 0; i < lv; i++) {
        const x = -hx + 3 + i * 3;
        v.box(x, 2, hz - 4, x + 3, 3, hz - 2, "wood");
        v.put(x + 1, 3, hz - 3, "gold");
      }
      break;
    }
    case "ferry_exchange": {
      if (lv >= 2) {
        const w = Math.round(hx * 0.73);
        v.box(-w, 2, hz - 6, w, 3, hz - 3, "woodLight");
        for (let i = -w; i < w; i += 5) {
          v.box(i, 3, hz - 6, i + 1, 7 + lv, hz - 5, metal);
          v.box(i, 3, hz - 4, i + 1, 7 + lv, hz - 3, metal);
        }
        if (s % 2) v.box(-w, 7 + lv, hz - 6, w, 8 + lv, hz - 2, "cream");
        else gable(v, -w, 7 + lv, hz - 7, w, hz - 2, "x", edge, "cream");
      }
      v.box(hx - 4, 1, 1, hx - 2, 3, 5, "white");
      v.put(hx - 3, 3, 2, "red");
      break;
    }
    case "water_reuse_works": {
      const r = Math.max(2, Math.min(hx, hz) * 0.19);
      for (let i = 0; i < Math.min(3, lv); i++) {
        const x = Math.round(-hx * 0.48 + i * hx * 0.45),
          z = Math.round(hz * 0.45);
        v.cylinderY(x, z, 1, 3 + lv / 2, r + 1, "concrete");
        v.cylinderY(x, z, 3 + lv / 2, 4 + lv / 2, r, "#689e96");
        machine(c, x, 5 + Math.floor(lv / 2), z, Math.floor(r), "y", metal);
      }
      if (lv >= 3) pipe(-hx + 3, hz * 0.45, hx - 3, hz * 0.45, 3, edge);
      break;
    }
    case "open_pit_mine": {
      const h = 4 + lv * 2,
        x = Math.round(hx * 0.65) * side,
        z = Math.round(-hz * 0.48);
      v.box(x - 2, h, z - 2, x + 2, h + 3, z + 2, "hazard");
      for (let i = 0; i < 5 + lv; i++) {
        v.box(
          x + i * side,
          h + 3 + Math.floor(i / 2),
          z,
          x + i * side + 2,
          h + 5 + Math.floor(i / 2),
          z + 2,
          metal,
        );
      }
      const end = x + (4 + lv) * side;
      v.box(end, h, z, end + 1, h + 6 + lv / 2, z + 1, "steelDark");
      v.box(end - 1, h - 1, z, end + 2, h + 1, z + 2, "hazard");
      if (lv >= 3) {
        for (let i = 0; i < 3; i++)
          v.cone(-cx + i * 2, 1, 4 + i, cz, 3 + i, 0, ["#a47159", "charcoal", "stone"][i]);
      }
      break;
    }
    case "terraced_glasshouses": {
      const x = side * (hx - 4),
        z = -hz + 4;
      if (s === 0 || s === 2) v.dome(x, 3, z, 3 + s, "glass", 0.25);
      else canopy(c, x, z, 3, 5, edge);
      for (let i = 0; i < lv * 2; i++) {
        const px = Math.round(-hx + 3 + ((i + 0.5) * (2 * hx - 6)) / (lv * 2));
        v.box(px, 1, hz - 3, px + 2, 2, hz - 1, "wood");
        v.put(px, 2, hz - 2, ["#ca7484", "orange", "gold", "leaf"][s]);
      }
      break;
    }
    case "freight_rail_terminal": {
      for (let i = 0; i < lv + 1; i++) {
        const x = Math.round(-hx + 3 + (i * (2 * hx - 9)) / (lv + 1));
        container(v, x, 1, -hz + 3, "z", ["blue", "crimson", "teal", "orange"][(i + s) % 4]);
        if (lv > 2 && i % 2 === s % 2) container(v, x, 4, -hz + 3, "z", edge);
      }
      const x = Math.round(hx * 0.32) * side;
      v.box(x, 4, -1, x + 1, 6 + lv * 2, 0, "steelDark");
      v.box(x - 1, 3, -1, x + 3, 5, 2, "hazard");
      break;
    }
    case "district_heat_works": {
      const r = Math.max(2, Math.floor(Math.min(hx, hz) * 0.16));
      for (let i = 0; i < Math.min(3, lv); i++) {
        const x = Math.round(-hx * 0.38 + i * hx * 0.38);
        v.cylinderY(x, 0, 1, 4 + lv, r, "stone");
        v.cylinderY(x, 0, 4 + lv, 5 + lv, r, edge);
        pipe(x, 0, x, cz, 2, metal);
      }
      if (lv >= 3) {
        v.cylinderY(-cx, -cz, 1, 6 + lv * 2, 2, "brick");
        c.smoke(-cx, 6 + lv * 2, -cz, "smoke");
      }
      break;
    }
    case "regional_airport": {
      const w = Math.floor(hx * 0.69);
      v.box(-w, 1, -hz + 2, w, 4 + lv, -hz + 5, "glassDark", 0.2);
      v.box(-w - 1, 4 + lv, -hz + 1, w + 1, 5 + lv, -hz + 6, edge);
      for (let i = -w; i < w; i += 4) v.box(i, 1, -hz + 5, i + 1, 4 + lv, -hz + 6, "cream");
      for (let i = -hx + 2; i < hx - 1; i += 4) {
        v.put(i, 1, hz - 2, "warmGlow", 0.8);
        v.put(i, 1, 1, "green", 0.65);
      }
      break;
    }
    case "canal_boat_lift": {
      const h = 7 + lv * 3,
        z = (s % 2 ? 1 : -1) * Math.round(hz * 0.58);
      for (const x of [-hx + 3, hx - 4]) {
        v.box(x - 1, 1, z - 2, x + 2, h + 5, z + 2, metal);
        v.box(x - 2, h + 5, z - 3, x + 3, h + 7, z + 3, edge);
        machine(c, x, h + 3, z + 2, 2, "z", "brass");
      }
      pipe(-hx + 3, z, hx - 4, z, h + 5, edge);
      if (lv >= 3) {
        for (let i = -hx + 4; i < hx - 3; i += 3) v.box(i, h + 4, z - 1, i + 1, h + 7, z, "hazard");
      }
      break;
    }
    case "maritime_college": {
      for (let i = 0; i < Math.min(4, lv); i++) {
        const x = Math.round(-hx * 0.45 + i * hx * 0.27),
          z = Math.round(hz * 0.2) + (i % 2) * 3;
        v.box(x - 2, 2, z - 1, x + 2, 3, z + 1, "woodDark");
        v.box(x, 3, z, x + 1, 8, z + 1, metal);
        for (let h = 0; h < 4; h++) v.box(x + 1, 3 + h, z, x + 4 - h, 4 + h, z + 1, i % 2 ? "cream" : edge);
      }
      if (lv >= 3) hall(c, -hx + 3, hz - 9, Math.round(hx * 0.65), 6, 5 + lv);
      break;
    }
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

const builders: Record<string, (c: Ctx) => void> = {
  growers_exchange: market,
  bakery_coop: bakery,
  ferry_exchange: ferry,
  water_reuse_works: reuse,
  open_pit_mine: mine,
  terraced_glasshouses: glasshouses,
  freight_rail_terminal: freight,
  district_heat_works: heatworks,
  regional_airport: airport,
  canal_boat_lift: boatlift,
  maritime_college: college,
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
        growth: p.description,
        build: (c: Ctx) => {
          builders[p.id](c);
          projectDetail(p.id, c);
        },
      },
    ]),
  ),
);
