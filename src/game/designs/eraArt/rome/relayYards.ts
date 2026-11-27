import type { SignatureBuilder } from "../../periodArtCatalog";
import {
  banner,
  barrel,
  bronze,
  court,
  horse,
  marble,
  parcel,
  parchment,
  pergola,
  pier,
  reader,
  tile,
  torch,
} from "./civicMasonry";

/** Cursus publicus: through-stable, turning court, sawtooth remount bays and a gatehouse relay. */
export const postOffice: SignatureBuilder = (c, p, active) => {
  const { lv, hx, hz, variant } = c,
    l = -hx + 2,
    r = hx - 2,
    b = -hz + 2,
    f = hz - 2;
  court(c, p, l, b, r + 1, f + 1);
  const counter = (x: number, z: number) => {
    c.v.box(x, 1, z, x + 4, 3, z + 2, p.frame);
    parcel(c, x, 3, z);
    reader(c, x + 2, 1, z - 2, p.cloth);
  };
  const hurdle = (x: number, z: number, d: number) => {
    for (let i = 0; i < d; i += 3)
      c.v.box(x, 1, z + i, x + 1, 4, z + i + 1, p.frame);
    c.v.box(x, 2, z, x + 1, 3, z + d, p.frame);
  };
  const trough = (x: number, z: number, w: number) => {
    c.v.box(x, 1, z, x + w, 3, z + 3, bronze);
    c.v.box(x + 1, 2, z + 1, x + w - 1, 3, z + 2, "water");
  };
  if (variant === 0) {
    // A long tile roof, open on the public yard side. Every remount has its own gate.
    const roofZ = lv < 3 ? b + 6 : Math.floor(b * 0.15),
      top = lv >= 4 ? 7 : 5;
    pergola(c, p, l, b, r - 1, roofZ, 1, top);
    for (let x = l + 2; x < r - 3; x += 7) {
      hurdle(x, b + 1, Math.max(3, roofZ - b - 1));
      parcel(c, x + 2, 1, b + 1);
    }
    counter(l + 1, f - 2);
    horse(c, lv === 1 ? r - 3 : 0, 1, Math.min(f - 3, roofZ + 3), "#a77656");
    if (lv >= 2) {
      trough(r - 8, f - 4, 7);
      banner(c, p, l + 1, 1, b, top + 4);
    }
    if (lv >= 3) {
      barrel(c, p, l, roofZ + 2, l + 6, f - 3, 1, 4, "z");
      reader(c, l + 2, 1, roofZ + 3);
    }
    if (lv >= 4) {
      pergola(c, p, r - 8, roofZ + 3, r - 1, f - 2, 1, 6, false);
      horse(c, r - 5, 1, f - 5, "#d9b898");
    }
    if (lv >= 5) {
      barrel(c, p, l + 4, b + 1, l + 13, roofZ, top + 1, top + 4, "x");
      c.v.box(l + 4, top + 2, roofZ, l + 11, top + 3, roofZ + 2, p.frame);
    }
  } else if (variant === 1) {
    const x1 = lv === 1 ? l + 4 : l + Math.round(hx * 0.46),
      corner = b + Math.max(4, Math.round(hz * 0.68));
    barrel(c, p, l, b, x1, f - 2, 1, 4, "z");
    if (lv >= 2) {
      pergola(c, p, x1 + 1, b, r - 1, corner, 1, 4);
      horse(c, r - 4, 1, corner + 1, "#b88155");
    }
    if (lv >= 3) {
      for (let x = x1 + 3; x < r - 1; x += 5) {
        c.v.box(x, 1, corner + 1, x + 2, 3, corner + 3, p.frame);
        parcel(c, x, 3, corner + 1);
      }
    }
    if (lv >= 4) {
      barrel(c, p, r - 6, corner + 3, r + 1, f - 2, 1, 5, "z");
      trough(x1 + 3, f - 3, 7);
    }
    if (lv >= 5) {
      c.v.box(l + 1, 1, b, x1, 10, b + 4, p.wall);
      barrel(c, p, l, b, x1 + 1, b + 4, 7, 10, "z");
      banner(c, p, l + 2, 10, b + 2, 6);
    }
    horse(c, Math.max(1, x1 + 3), 1, Math.min(f - 3, corner + 2), "#70594c");
    counter(l + 1, f - 2);
    for (let z = corner; z < f - 2; z += 3)
      c.v.box(x1 + 1, 1, z, x1 + 3, 2, z + 1, marble);
  } else if (variant === 2) {
    // Short asymmetric shelters trace a diagonal so the dispatch aisle remains exposed from above.
    const bays = Math.min(2 + lv, Math.floor((r - l) / 5)),
      stride = Math.floor((r - l) / bays);
    for (let i = 0; i < bays; i++) {
      const x = l + i * stride,
        z = b + Math.floor((i / Math.max(1, bays - 1)) * Math.max(1, hz - 4)),
        h = 4 + (i % 2);
      pier(c, p, x + 1, 1, z, h);
      c.v.box(x, 1, z + 1, x + 1, h, z + 5, p.wall);
      for (let j = 0; j < stride - 1; j++)
        c.v.box(
          x + j,
          h + Math.floor(j / 2),
          z,
          x + j + 1,
          h + 1 + Math.floor(j / 2),
          z + 5,
          j % 3 ? tile : p.roof,
        );
      parcel(c, x + 2, 1, z + 1);
    }
    horse(c, Math.min(r - 3, l + 6), 1, f - 3, "#bc9870");
    counter(r - 4, f - 1);
    if (lv >= 2) {
      hurdle(l + 1, f - 5, 5);
      torch(c, r, 1, b);
    }
    if (lv >= 3) {
      trough(l + 6, f - 3, 7);
      reader(c, 0, 1, f - 2, marble);
    }
    if (lv >= 4) {
      barrel(c, p, l + 3, b, l + 12, b + 6, 3, 6, "z", 0.65);
    }
    if (lv >= 5) {
      pergola(c, p, r - 10, b, r - 1, b + 5, 1, 9, false);
      c.v.box(r - 8, 8, b + 1, r, 9, b + 5, p.frame);
      parcel(c, r - 5, 9, b + 2);
    }
  } else {
    const a = lv === 1 ? -1 : Math.floor(l * 0.4),
      gate = 4 + lv;
    const h = lv >= 3 ? 9 : 6;
    barrel(
      c,
      p,
      a - gate + 1,
      b,
      a + gate,
      Math.min(f - 5, b + 7),
      1,
      h - 3,
      "z",
    );
    counter(l, f - 2);
    horse(c, r - 3, 1, f - 4, "#ae7355");
    c.v.box(a - 1, 1, b + 2, a + 2, 2, f + 1, p.rim);
    if (lv >= 2) {
      pergola(c, p, a + gate + 1, b, r, b + 4, 1, 5);
      parcel(c, r - 4, 1, b + 2);
    }
    if (lv >= 3) {
      pergola(c, p, l, b + 3, a - gate - 1, 0, 1, 6, false);
      hurdle(r - 1, b + 6, hz);
    }
    if (lv >= 4) {
      c.v.box(a - gate + 2, h - 1, b + 1, a + gate - 1, h + 2, b + 5, p.wall);
      for (let x = a - gate + 3; x < a + gate - 2; x += 3)
        c.v.put(x, h, b + 5, p.shade);
    }
    if (lv >= 5) {
      barrel(c, p, a + gate + 2, b + 7, r, f - 3, 1, 6, "x");
      horse(c, 1, 1, f - 4, "#d1af8b");
      banner(c, p, l + 2, 1, b + 1, 11);
    }
  }
  if (lv === 5 && variant === 0) {
    pergola(c, p, -9, 3, 7, f - 1, 1, 8, true);
    horse(c, 3, 1, 7, "#cb9a6b");
    parcel(c, -6, 1, f - 4);
  }
  if (lv === 5 && variant === 1) {
    barrel(c, p, -8, 1, 2, f - 1, 1, 6, "z");
    hurdle(-6, 2, Math.max(4, f - 5));
    horse(c, -4, 1, f - 5, "#d2b697");
  }
  if (lv >= 3) {
    // A loaded two-wheeled cart waits beside the rack, off the central change-of-horse aisle.
    const cartX =
        variant === 0 ? 3 : variant === 1 ? 2 : variant === 2 ? 0 : r - 6,
      cartZ = f - 4;
    c.v.box(cartX - 2, 3, cartZ - 2, cartX + 3, 4, cartZ + 2, p.frame);
    for (const side of [-1, 1]) {
      const x = cartX + side * 2;
      c.v.box(x, 2, cartZ - 1, x + 1, 4, cartZ + 2, "#68483d");
      c.v.put(x, 1, cartZ, bronze);
      c.v.box(x, 4, cartZ - 2, x + 1, 5, cartZ + 2, p.rim);
    }
    parcel(c, cartX - 1, 4, cartZ - 1);
    c.v.box(cartX - 1, 3, cartZ - 5, cartX, 4, cartZ - 1, bronze);
    reader(c, cartX - 3, 1, cartZ, p.cloth);
  }
  if (variant === 2 && lv >= 2) {
    const zx = Math.floor(b * 0.35);
    c.v.box(l + 3, 1, zx, r - 3, 2, zx + 2, p.rim);
    if (lv >= 3) {
      for (let x = l + 3; x < r - 3; x += 5) {
        c.v.box(x, 1, zx + 1, x + 1, 5, zx + 2, p.frame);
        c.v.box(x, 4, zx, x + 3, 5, zx + 2, p.rim);
        parcel(c, x + 1, 5, zx);
      }
    }
  }
  if (variant === 3 && lv >= 3) {
    for (let z = 0; z < f - 2; z += 4)
      c.v.box(-2, 1, z, -2 + 4, 2, z + 1, p.rim);
    trough(r - 8, Math.max(1, f - 7), 6);
  }
  if (active) reader(c, r - 2, 1, f - 2, "#6b9694");
  torch(c, l + 1, 1, f - 1);
};
