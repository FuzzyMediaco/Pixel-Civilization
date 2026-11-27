import { tree } from "../../kit";
import type { SignatureBuilder } from "../../periodArtCatalog";
import {
  barrel,
  bronze,
  court,
  marble,
  parchment,
  pergola,
  pier,
  reader,
  rounds,
  scrollRack,
  seat,
  steps,
  tile,
  torch,
  water,
} from "./civicMasonry";

/** Four public reading spaces — scroll vaults, unequal barrel rooms, deep niche alley and a recital cavea. */
export const library: SignatureBuilder = (c, p, active) => {
  const { hx, hz, lv, variant: v } = c,
    l = -hx + 2,
    r = hx - 2,
    b = -hz + 2,
    f = hz - 2;
  court(c, p, l, b, r + 1, f + 1);
  if (v === 0) {
    const right = lv === 1 ? 1 : Math.floor(r * 0.36);
    const zMid = lv === 1 ? 0 : Math.floor(b * 0.33);
    barrel(c, p, l, b, right, zMid + 2, 1, lv + 2, "z", 0.65);
    scrollRack(c, p, l + 2, 1, b + 1, Math.max(3, right - l - 4));
    steps(c, p, l, right, zMid + 2, 1, Math.min(lv + 1, 4));
    if (lv >= 2) {
      barrel(c, p, right + 2, b, r, b + 6, 1, 4, "z", 0.66);
      scrollRack(c, p, right + 3, 1, b + 1, r - right - 4);
    }
    if (lv >= 3) {
      barrel(c, p, l, zMid + 4, l + 5, f - 1, 1, 5, "z");
      seat(c, 2, 1, Math.floor(f * 0.48));
    }
    if (lv >= 4) {
      barrel(c, p, r - 6, zMid + 3, r, f - 2, 1, 6, "x");
      rounds(c, 2, 1, 0, 3, 2, water);
    }
    if (lv >= 5) {
      pergola(c, p, l + 2, b + 2, right - 1, b + 7, 7, 11, false);
      reader(c, l + 3, 8, b + 4);
    }
  } else if (v === 1) {
    const width = Math.max(4, Math.floor(hx * 0.4));
    const leftEnd = lv === 1 ? 0 : Math.floor(f * 0.5);
    barrel(c, p, l, b, l + width, leftEnd + 1, 1, lv + 1, "z");
    barrel(
      c,
      p,
      r - width,
      b + 2,
      r,
      f - 1,
      1,
      3 + Math.floor(lv / 2),
      "z",
      0.75,
    );
    scrollRack(c, p, l + 1, 1, b + 1, width - 2);
    seat(c, 0, 1, 0);
    if (lv >= 2) {
      steps(c, p, l + width + 1, r - width, 0, 1, 3);
      reader(c, 1, 3, 0);
    }
    if (lv >= 3) {
      barrel(c, p, l + width + 1, b + 1, r - width - 1, b + 6, 1, 4, "x");
      scrollRack(c, p, 0, 1, b + 3, 4);
    }
    if (lv >= 4) {
      court(c, p, l + width, 1, r - width, f, 1);
      for (let z = 1; z < f - 1; z += 4) c.v.box(-1, 2, z, 1, 3, z + 2, water);
    }
    if (lv >= 5) {
      barrel(c, p, l - 1, leftEnd + 3, l + width + 3, f, 1, 6, "x");
      pergola(c, p, r - width + 1, b + 5, r - 1, b + 10, 6, 9, false);
    }
  } else if (v === 2) {
    // The occupied route stays open between upright scroll racks. Narrow arched doors face each other.
    const gap = lv === 1 ? 2 : Math.max(3, Math.floor(hx * 0.27));
    for (const side of [-1, 1]) {
      const x = side < 0 ? l : gap + 1,
        end = side < 0 ? -gap : r;
      const z0 = side < 0 ? b : b + Math.min(4, lv),
        z1 = side < 0 ? f - 1 : f - 3;
      // Successive shelf bays step up from the street. Vaults and exposed scroll ends alternate overhead.
      for (let z = z0, shelf = 0; z < z1; z += 5, shelf++) {
        const h = lv + 2 + (shelf % 3) * 2 + (side < 0 ? 1 : 0);
        c.v.box(x, 1, z, end, h, Math.min(z + 2, z1), p.wall);
        const outside = side < 0 ? x : end - 1;
        c.v.box(outside, 2, z, outside + 1, h, Math.min(z + 4, z1), p.shade);
        if (shelf % 2 === 0) {
          barrel(c, p, x, z, end, Math.min(z + 4, z1), 1, h, "x", 0.9);
          scrollRack(c, p, x + 1, 1, z + 1, Math.max(2, end - x - 2));
        } else {
          c.v.box(x, h - 1, z, end, h + 1, Math.min(z + 2, z1), marble);
          c.v.put(side < 0 ? end - 1 : x, h - 2, z + 1, parchment, 0.48);
        }
      }
      if (lv >= 2) scrollRack(c, p, x, 1, z1 - 1, end - x);
    }
    if (lv >= 3) {
      c.v.box(-gap - 1, 7, b + 3, gap + 2, 9, b + 6, marble);
      reader(c, 0, 9, b + 4);
    }
    if (lv >= 4) {
      barrel(c, p, l, b, -gap, b + 5, 5, 9, "z");
    }
    if (lv >= 5) {
      pergola(c, p, -gap - 2, f - 5, gap + 2, f - 2, 1, 9, false);
      torch(c, 0, 1, b + 1);
    }
  } else {
    // A shell of curved seats faces the street; the awning stops over the reciter's platform.
    const rad = Math.max(4, Math.min(hx - 2, hz - 2)),
      cz = Math.floor(hz * 0.13);
    for (let ring = 0; ring < Math.min(4, lv + 1); ring++) {
      const rr = rad - ring * 2;
      if (rr < 2) break;
      for (let x = -rr; x <= rr; x++) {
        const z = cz - Math.round(Math.sqrt(rr * rr - x * x));
        c.v.box(
          x,
          1,
          z,
          x + 1,
          2 + Math.min(lv + 1, 4) - ring,
          z + 2,
          ring % 2 ? marble : p.rim,
        );
      }
    }
    const stage = Math.max(2, Math.floor(rad * 0.46));
    c.v.box(-stage, 1, cz - 1, stage + 1, 3, cz + 3, p.frame);
    reader(c, 0, 3, cz + 1, p.cloth);
    barrel(
      c,
      p,
      -stage - 1,
      b + 1,
      stage + 2,
      Math.min(cz, b + 4 + lv),
      2,
      4 + Math.floor(lv / 2),
      "z",
      0.8,
    );
    if (lv >= 2) {
      scrollRack(c, p, l, 1, cz, 4);
      pier(c, p, r - 1, 1, cz, 5);
    }
    if (lv >= 3) {
      pergola(c, p, l, b + 2, l + 6, b + 6, 1, 6, false);
      reader(c, l + 2, 2, b + 5);
    }
    if (lv >= 4) {
      barrel(c, p, r - 9, b + 2, r, b + 6, 1, 6, "x");
    }
    if (lv >= 5) {
      for (const x of [-1, 1]) {
        pier(c, p, x * (stage + 2), 2, cz, 11, 2);
        c.v.box(
          x * (stage + 2),
          10,
          cz,
          x * (stage + 2) + 2,
          11,
          cz + 3,
          p.cloth,
        );
      }
    }
  }
  if (lv >= 2) {
    const gx = v === 2 ? 0 : Math.max(2, Math.round(hx * 0.4)),
      gz = f - 3;
    rounds(c, gx, 1, gz, 2, 2, p.frame);
    rounds(c, gx, 2, gz, 1, 3, p.leaf);
    if (lv >= 3) {
      tree(c.v, gx, 2, gz, "cypress", 0.65, 3);
      seat(c, gx - 4, 1, gz - 2);
    }
    if (lv >= 4) {
      for (const dx of [-2, 2]) {
        c.v.box(dx, 1, gz - 5, dx + 1, 3, gz - 3, bronze);
        c.v.put(dx, 3, gz - 4, parchment);
      }
      reader(c, 1, 1, gz - 6);
    }
  }
  reader(c, 1, 1, f - 2, p.cloth);
  torch(c, l + 1, 1, f - 1);
  if (active) reader(c, -2, 1, f - 3);
  c.v.put(r - 1, 1, f - 1, bronze);
};
