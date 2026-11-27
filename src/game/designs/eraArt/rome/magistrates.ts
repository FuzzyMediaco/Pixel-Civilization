import type { SignatureBuilder } from "../../periodArtCatalog";
import {
  banner,
  barrel,
  bronze,
  court,
  marble,
  parchment,
  pergola,
  pier,
  reader,
  rounds,
  seat,
  steps,
  tile,
  torch,
  water,
} from "./civicMasonry";

/** A clepsydra, beacon, paired meridian towers and an octagonal sundial all overlook an occupied civic square. */
export const cityOffices: SignatureBuilder = (c, p, active) => {
  const { lv, variant, hx, hz } = c,
    l = -hx + 2,
    r = hx - 2,
    b = -hz + 2,
    f = hz - 2;
  const w = lv <= 2 ? 3 : 4,
    tall = 24 + lv * 5 + (lv === 5 ? 3 : 0);
  const x = variant % 2 === 0 ? l + w : r - w,
    z = variant === 3 ? Math.round(hz * 0.25) : b + w + 1;
  court(c, p, l, b, r + 1, f + 1);
  const galleryX = x > 0 ? l : 0,
    galleryR = x > 0 ? -1 : r;
  const tower = (radius: number, y0: number, y1: number, ink: string) => {
    c.v.hollowBox(
      x - radius,
      y0,
      z - radius,
      x + radius + 1,
      y1,
      z + radius + 1,
      ink,
    );
    for (let h = y0 + 3; h < y1 - 1; h += 5) {
      c.v.box(
        x - 1,
        h,
        z + radius,
        x + 1,
        h + 2,
        z + radius + 1,
        "warmGlow",
        0.55,
      );
      c.v.put(x + radius, h, z, p.lamp, 0.58);
    }
  };
  if (variant === 0) {
    // An exposed bronze water column drops through the middle of an open brick clock frame.
    tower(w, 1, 7, p.wall);
    for (const dx of [-w, w])
      for (const dz of [-w, w])
        c.v.box(x + dx, 6, z + dz, x + dx + 1, tall - 3, z + dz + 1, p.wall);
    c.v.box(x - 1, 6, z, x + 1, tall - 3, z + 1, water, 0.27);
    for (let y = 8; y < tall - 3; y += 5) {
      c.v.box(x - w, y, z - w, x + w + 1, y + 1, z + w + 1, p.rim);
      c.v.put(x, y, z + w + 1, bronze);
    }
    rounds(c, x, tall - 4, z, w + 1, tall - 2, bronze);
    rounds(c, x, tall - 2, z, w, tall - 1, water);
    c.v.box(x, tall - 1, z, x + 1, tall + 2, z + 1, bronze);
    if (lv >= 2) {
      c.v.box(x + 1, 6, z + 1, x + 3, 7, 1, p.rim);
      c.v.box(x + 1, 7, z + 1, x + 2, 8, 1, water);
    }
    if (lv >= 3) {
      rounds(c, 2, 1, Math.floor(f * 0.4), 3, 2, marble);
      rounds(c, 2, 2, Math.floor(f * 0.4), 2, 3, water);
    }
    if (lv >= 4) {
      barrel(c, p, 1, b, r, b + 6, 6, 10, "x");
    }
    if (lv >= 5) {
      pergola(c, p, l + 1, z + 4, l + 6, f - 2, 1, 7, false);
      reader(c, l + 3, 1, f - 4);
    }
  } else if (variant === 1) {
    tower(w, 1, Math.round(tall * 0.5), p.wall);
    tower(w - 1, Math.round(tall * 0.5), tall - 8, p.shade);
    for (const dx of [-w + 1, w - 1])
      for (const dz of [-w + 1, w - 1])
        pier(c, p, x + dx, tall - 9, z + dz, tall - 2);
    c.v.roofGable(
      x - w - 1,
      tall - 2,
      z - w - 1,
      x + w + 2,
      z + w + 2,
      w + 2,
      "x",
      p.roof,
      tile,
    );
    for (let story = 7; story < tall - 9; story += 7) {
      const rad = story < tall * 0.5 ? w : w - 1;
      c.v.box(
        x - rad - 1,
        story,
        z - rad - 1,
        x + rad + 2,
        story + 1,
        z + rad + 2,
        p.rim,
      );
      c.v.box(
        x - 1,
        story + 1,
        z + rad,
        x + 1,
        story + 4,
        z + rad + 1,
        p.lamp,
        0.42,
      );
    }
    c.v.put(x, tall - 5, z, "warmGlow", 0.9);
    banner(c, p, x + 1, Math.floor(tall * 0.5), z + w, 8);
    if (lv >= 2) {
      c.v.box(l + 1, 1, 3, x, 3, 6, p.wall);
      reader(c, l + 2, 3, 4, p.cloth);
    }
    if (lv >= 3) {
      for (let q = 1; q <= 3; q++) {
        const a = x - q * 3;
        c.v.box(a, 5 + q, z + 2, a + 3, 6 + q, z + 6, p.cloth);
      }
    }
    if (lv >= 4) {
      pergola(c, p, l + 1, z + 5, l + 6, 6, 1, 9, true);
    }
    if (lv >= 5) {
      barrel(c, p, x - 3, z + 7, x + 3, f - 3, 1, 7, "z");
      steps(c, p, l + 2, -1, 8, 1, 3);
    }
  } else if (variant === 2) {
    const x2 = Math.min(r - 2, x + w + 5 + Math.floor(lv / 2));
    const fork = lv === 1 ? 3 : 4;
    const z2 = z + Math.min(lv + 1, 5);
    for (const [dx, dz, end] of [
      [x, z, tall - 2],
      [x2, z2, tall - 8],
    ]) {
      const rad = dx === x ? 2 : 1;
      c.v.hollowBox(
        dx - rad,
        1,
        dz - rad,
        dx + rad + 1,
        end,
        dz + rad + 1,
        p.wall,
      );
      for (let h = 6; h < end; h += 6) {
        c.v.box(
          dx - rad - 1,
          h,
          dz - rad - 1,
          dx + rad + 2,
          h + 1,
          dz + rad + 2,
          p.rim,
        );
        c.v.put(dx, h + 2, dz + rad, p.lamp, 0.5);
      }
      c.v.box(dx, end, dz, dx + 1, end + 3, dz + 1, bronze);
    }
    const spanY = Math.round(tall * 0.56);
    for (let dx = x; dx <= x2; dx++) {
      const dz = z + Math.round(((dx - x) / (x2 - x)) * (z2 - z));
      c.v.box(dx, spanY, dz - 1, dx + 1, spanY + 2, dz + 2, marble);
    }
    if (lv >= 2)
      for (let i = 0; i < 6; i++)
        c.v.put(0, 1, Math.min(f - 1, z + 4 + i * 2), bronze);
    if (lv >= 3) {
      barrel(c, p, l, 1, -2, 5, 1, 6, "x");
      reader(c, l + 2, 1, 2);
    }
    if (lv >= 4) {
      c.v.box(x - 1, tall - 5, z - 1, x2 + 1, tall - 4, z + 2, p.frame);
      c.v.put(x2 - 1, tall - 3, z, bronze);
    }
    if (lv >= 5) {
      for (const s of [-1, 1]) pier(c, p, s * fork, 1, f - 2, 8);
      c.v.box(-fork - 1, 8, f - 3, fork + 2, 9, f - 1, marble);
    }
  } else {
    // The cut corners of the horologium step back to an open octagonal dial. Its shadow-hand faces the forum.
    for (let y = 1; y < tall - 5; y++) {
      const rad = y < tall * 0.32 ? w + 1 : y < tall * 0.67 ? w : w - 1;
      const ring = Math.abs(y - Math.round(tall * 0.32)) <= 1 || y % 8 === 0;
      rounds(c, x, y, z, rad, y + 1, ring ? p.rim : p.shade, 1);
      if (y % 6 === 3) c.v.put(x, y, z + rad, p.lamp, 0.75);
    }
    rounds(c, x, tall - 5, z, w + 1, tall - 3, p.rim);
    for (let i = -w; i <= w; i++)
      for (let j = -w; j <= w; j++)
        if (Math.abs(i * i + j * j - w * w) < w + 1)
          c.v.put(x + i, tall - 3, z + j, bronze);
    for (let u = 0; u <= w; u++)
      c.v.box(x + u, tall - 3, z, x + u + 1, tall + w - u, z + 1, parchment);
    if (lv >= 2) {
      steps(c, p, l + 1, 0, 1, 1, 3);
      banner(c, p, l + 1, 1, 0, 8);
    }
    if (lv >= 3) {
      c.v.box(l + 2, 1, 0, 2, 4, 5, p.wall);
      c.v.box(l + 1, 4, 0, 2, 5, 5, marble);
      reader(c, l + 4, 5, 2);
    }
    if (lv >= 4) {
      barrel(c, p, l + 1, b, l + 8, -4, 1, 7, "z");
    }
    if (lv >= 5) {
      pergola(c, p, x - 3, 0, x + 2, f - 2, 1, 8, false);
      for (let a = 1; a < f - 2; a += 6) seat(c, x, 1, a);
    }
  }
  if (lv >= 4 && variant === 0) {
    for (let z0 = 0; z0 < f - 2; z0 += 4) pier(c, p, r - 3, 1, z0, 12, 2);
    c.v.box(r - 4, 12, 0, r, 14, f - 1, p.rim);
    c.v.box(r - 3, 14, 0, r - 1, 15, f - 2, water);
  }
  if (lv >= 4 && variant === 2) {
    barrel(c, p, 1, b + 4, r, b + 12, 1, 10, "z");
    c.v.box(2, 1, b + 5, r - 1, 3, b + 8, p.frame);
    reader(c, 3, 3, b + 6);
  }
  if (lv >= 4 && variant === 3) {
    pergola(c, p, l + 1, 1, -2, Math.min(f - 2, 7), 3, 12, true);
    steps(c, p, l + 2, -3, 4, 1, 3);
  }
  if (galleryR - galleryX >= 4)
    pergola(
      c,
      p,
      galleryX,
      b + 1,
      galleryR,
      b + 5,
      1,
      4 + Math.floor(lv / 2),
      variant !== 0,
    );
  c.v.box(l + 2, 1, f - 4, l + 6, 3, f - 3, p.frame);
  c.v.box(l + 2, 3, f - 4, l + 6, 5, f - 3, parchment);
  reader(c, l + 4, 1, f - 1, p.cloth);
  reader(c, 1, 1, f - 2);
  if (active) reader(c, -1, 1, f - 4, "#6c8e90");
  torch(c, r - 1, 1, f - 1);
};
