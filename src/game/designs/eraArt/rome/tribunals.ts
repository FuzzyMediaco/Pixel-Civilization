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
  steps,
  tile,
  torch,
} from "./civicMasonry";

/** A gabled basilica, an apsidal tribunal, a great judgment arch and a lantern over a cross hall. */
export const courthouse: SignatureBuilder = (c, p, active) => {
  const { lv, variant, hx, hz } = c,
    l = -hx + 2,
    r = hx - 2,
    b = -hz + 2,
    f = hz - 2;
  court(c, p, l, b, r + 1, f + 1);
  const base = 2 + lv,
    h = [11 + lv * 2, 12 + lv, 14 + lv * 2, 16 + lv * 2][variant],
    z0 = b + 1,
    center = Math.round(
      variant === 2
        ? 0.23 * hz
        : variant === 3
          ? lv === 1
            ? 0.65 * b
            : 0.12 * hz
          : 0.34 * b,
    ),
    w = Math.max(3, Math.round(hx * 0.49));
  const throne = (z: number, y: number) => {
    c.v.box(-2, y, z - 1, 3, y + 1, z + 2, bronze);
    c.v.box(-2, y + 1, z - 1, 3, y + 3, z, parchment);
    reader(c, 0, y + 1, z, p.cloth);
  };
  const stairZ = Math.min(f - base, center + 2);
  steps(c, p, -w, w + 1, stairZ, 1, base);
  c.v.box(-w, 1, z0, w + 1, base + 1, stairZ + 1, p.wall);
  // Recessed listening bays let citizens through the podium from each side street.
  if (lv >= 2)
    for (const side of [-1, 1]) {
      const edge = side * w;
      for (let z = z0 + 2; z < stairZ - 1; z += 5) {
        c.v.clear(
          side < 0 ? edge : edge - 2,
          2,
          z,
          side < 0 ? edge + 3 : edge + 1,
          base,
          z + 2,
        );
        c.v.box(edge, base, z - 1, edge + 1, base + 1, z + 3, marble);
        c.v.put(edge - side * 2, 2, z + 1, p.lamp, 0.58);
      }
    }
  if (lv >= 3) {
    for (let z = stairZ + base + 1; z <= f; z += 3)
      c.v.box(-2, 1, z, 3, 2, z + 1, p.rim);
    for (const side of [-1, 1]) {
      const x = side * (r - 3);
      c.v.box(x - 2, 1, f - 5, x + 3, 3, f - 4, p.frame);
      reader(c, x, 1, f - 3, p.cloth);
      torch(c, x, 1, Math.max(1, f - 9));
    }
  }
  for (const s of [-1, 1]) {
    torch(c, s * w, base, stairZ - 1);
    reader(c, s * Math.max(2, w - 2), 1, f - 1, marble);
  }
  if (variant === 0) {
    // A deep prostyle nave and an open axial hearing bench beneath the single pediment.
    for (const s of [-1, 1]) {
      c.v.box(s * w, base + 1, z0, s * w + 1, h - 1, center, p.wall);
      for (let z = z0; z <= center; z += 4) pier(c, p, s * w, base, z, h - 1);
      if (lv >= 2) {
        const x = s * (w + 2);
        pier(c, p, x, 1, center, base + 4);
        c.v.box(x, base + 3, z0, x + 1, base + 4, center + 2, p.rim);
      }
    }
    c.v.box(-w, base + 1, z0, w + 1, h - 1, z0 + 1, p.wall);
    throne(z0 + 2, base + 1);
    c.v.roofGable(
      -w - 1,
      h - 1,
      z0 - 1,
      w + 2,
      center + 2,
      w + 2,
      "z",
      p.roof,
      marble,
    );
    if (lv >= 3)
      for (const s of [-1, 1]) {
        const x = s * (w + 3);
        barrel(c, p, x - 2, z0, x + 3, center + 3, 1, base + 3, "z");
      }
    if (lv >= 4) {
      pergola(c, p, -w + 1, center - 2, w, center + 3, base + 1, h - 2, false);
    }
    if (lv >= 5) {
      for (const s of [-1, 1]) {
        const x = s * (w + 4);
        c.v.box(x - 1, 1, center + 6, x + 2, base + 1, center + 9, p.rim);
        reader(c, x, base + 1, center + 7);
      }
    }
  } else if (variant === 1) {
    const rad = Math.min(r - 1, hz - 2),
      cz = z0 + rad + (lv >= 4 ? Math.floor(hz * .48) : 0);
    // Half-round brick shell, open above the listeners; the apse rises in tiers behind the magistrate.
    for (let x = -rad; x <= rad; x++) {
      const rz = Math.floor(Math.sqrt(rad * rad - x * x));
      const z = cz - rz;
      c.v.box(x, base, z, x + 1, h + Math.round(rz * 0.4), z + 2, p.wall);
      c.v.box(
        x,
        h + Math.round(rz * 0.4) - 1,
        z,
        x + 1,
        h + 1 + Math.round(rz * 0.4),
        z + 2,
        marble,
      );
      if (x % 3 === 0) c.v.box(x, base + 2, z + 2, x + 1, h - 1, z + 3, p.rim);
      if (lv >= 2) c.v.box(x, base + 1, z + 2, x + 1, base + 3, z + 4, p.frame);
    }
    throne(cz, base + 1);
    if (lv >= 3) {
      for (const s of [-1, 1]) {
        const x = s * Math.min(r - 3, rad + 2);
        barrel(c, p, x - 2, z0, x + 3, cz + 3, 1, base + 3, "z");
      }
    }
    if (lv >= 4) {
      const sw = rad - 1;
      pergola(c, p, -sw, z0 + 1, sw + 1, z0 + 6, h - 2, h + 3, false);
    }
    if (lv >= 5) {
      for (const s of [-1, 1]) {
        const x = s * Math.min(r - 3, rad + 3);
        rounds(c, x, 1, cz + 5, 3, base + 1, p.rim);
        reader(c, x, base + 1, cz + 5);
      }
    }
  } else if (variant === 2) {
    torch(c, r - 1, 1, f - 1);
    const width = Math.max(3, Math.round(r * 0.7));
    const rear = center - Math.max(2, Math.ceil(lv * 0.8)),
      front = Math.max(rear + 3, center + 1);
    for (const s of [-1, 1]) {
      const x = s * (width - 1);
      c.v.box(x - 1, base, rear, x + 2, h, front, p.wall);
      pier(c, p, x - 1, base, front, h, 2);
      c.v.box(x - 1, h - 2, front, x + 2, h, front + 1, p.rim);
    }
    for (let x = -width; x <= width; x++) {
      const vault =
        base +
        4 +
        Math.round(
          Math.sqrt(Math.max(0, 1 - (x / width) ** 2)) * (h - base - 5),
        );
      c.v.box(x, vault, rear, x + 1, h + 1, front + 1, x % 3 ? p.roof : p.rim);
    }
    c.v.box(-width - 1, h + 1, rear - 1, width + 2, h + 3, front + 2, marble);
    throne(rear + 1, base + 1);
    if (lv >= 2) {
      c.v.box(-3, h + 3, rear, 4, h + 5, front, p.roof);
      c.v.put(0, h + 5, front - 1, bronze);
    }
    if (lv >= 3)
      for (const s of [-1, 1]) {
        const x = s * (width + 3);
        steps(c, p, x - 2, x + 2, center + 2, 1, base - 1);
      }
    if (lv >= 4)
      for (const s of [-1, 1]) {
        const x = s * (width + 3);
        pergola(c, p, x - 2, z0, x + 2, center + 1, 1, base + 4, false);
      }
    if (lv >= 5) {
      for (const side of [-1, 1])
        barrel(
          c,
          p,
          side * (width + 3) - 2,
          z0,
          side * (width + 3) + 3,
          center - 2,
          1,
          h - 9,
          "z",
        );
      c.v.box(-4, h + 4, rear, 5, h + 7, front, bronze);
      for (const x of [-3, 0, 3]) reader(c, x, h + 7, rear + 1, "#b6a377");
    }
  } else {
    // Two street-facing listening rooms flank the first tribunal's ceremonial approach.
    if (lv === 1)
      for (const side of [-1, 1]) {
        rounds(c, side * 4, 1, 2, 2, 8, p.wall, 1);
        barrel(c, p, side * 4 - 2, 1, side * 4 + 3, 4, 4, 8, "x");
      }
    // A crossing tower admits daylight above four short arms of the hearing hall.
    const rad = Math.max(2, Math.round(hx * 0.24)),
      cz = center;
    barrel(c, p, -w - 1, cz - 2, w + 2, cz + 3, base + 1, base + 4, "x");
    barrel(c, p, -rad, z0, rad + 1, cz + 1, base + 1, base + 5, "z");
    throne(z0 + 1, base + 1);
    for (const x of [-rad, rad])
      for (const z of [cz - rad + 1, cz + rad - 1])
        pier(c, p, x, base, z, h, 1);
    for (let layer = 0; layer <= rad; layer++)
      c.v.box(
        -rad + layer,
        h + layer,
        cz - rad + layer,
        rad - layer + 1,
        h + layer + 1,
        cz + rad - layer + 1,
        layer % 2 ? tile : p.roof,
      );
    if (lv >= 2)
      for (const s of [-1, 1]) {
        c.v.box(s * w, 1, cz - 2, s * w + 1, base + 2, cz + 3, p.rim);
      }
    if (lv >= 3)
      for (const s of [-1, 1]) {
        const x = s * (w + 2);
        rounds(c, x, 1, cz, 3, base + 2, p.wall, 2);
      }
    if (lv >= 4) {
      c.v.box(-rad, base + 1, b + 1, rad + 1, base + 9, b + 2, p.wall);
      for (let x = -rad + 1; x < rad; x += 2)
        c.v.put(x, base + 7, b + 2, parchment, 0.62);
    }
    if (lv >= 5) {
      pergola(
        c,
        p,
        -w + 1,
        stairZ - 3,
        w,
        stairZ + 1,
        base + 1,
        base + 8,
        false,
      );
    }
  }
  if (active) reader(c, 1, 1, Math.max(stairZ + base + 1, f - 2), "#a35244");
};
