import type { SignatureBuilder } from "../../periodArtCatalog";
import {
  barrel,
  bronze,
  court,
  marble,
  parchment,
  reader,
  rounds,
  shade,
  steps,
  tile,
  torch,
} from "./civicMasonry";

/** Locked drum, adjacent treasury vaults, ashlar counting chest, and a folded strongroom enclosure. */
export const bank: SignatureBuilder = (c, p, active) => {
  const { lv, variant, hx, hz } = c,
    l = -hx + 2,
    r = hx - 2,
    b = -hz + 2,
    f = hz - 2;
  court(c, p, l, b, r + 1, f + 1);
  const h = 5 + Math.floor(lv * 1.2),
    middle = Math.min(f - 2, Math.max(2, Math.round(hz * 0.4)));
  const lock = (x: number, y: number, z: number) => {
    c.v.box(x - 2, y, z, x + 3, y + 5, z + 1, marble);
    c.v.box(x - 1, y, z + 1, x + 2, y + 4, z + 2, shade);
    c.v.box(x - 1, y + 1, z + 2, x + 1, y + 4, z + 3, bronze);
    c.v.put(x, y + 2, z + 3, parchment, 0.45);
  };
  if (variant === 0) {
    const rad = Math.max(4, Math.min(hx - 3, hz - 4)),
      cx = lv === 2 ? -4 : 0,
      cz = b + rad;
    rounds(c, cx, 1, cz, rad, h, p.wall);
    rounds(c, cx, h - 1, cz, rad + 1, h + 1, p.rim);
    rounds(c, cx, h + 1, cz, rad - 1, h + 2, tile);
    lock(cx, 1, cz + rad - 1);
    if (lv >= 2) {
      c.v.hollowBox(
        cx + rad - 1,
        1,
        cz - 3,
        r + 1,
        h - 1,
        cz + 2,
        p.shade,
        marble,
      );
    }
    if (lv >= 3) {
      for (let a = 0; a < 8; a++) {
        const angle = (a * Math.PI) / 4;
        const x = cx + Math.round(rad * Math.cos(angle)),
          z = cz + Math.round(rad * Math.sin(angle));
        c.v.box(x - 1, 1, z - 1, x + 2, h, z + 2, p.frame);
      }
    }
    if (lv >= 4) {
      rounds(c, cx, h + 2, cz, Math.ceil(rad * 0.56), h + 4, bronze);
      c.v.box(cx - 2, h + 4, cz, cx + 3, h + 5, cz + 1, parchment);
    }
    if (lv >= 5) {
      barrel(c, p, l, b, r, b + 4, 1, 4, "x");
      for (const s of [-1, 1]) {
        c.v.box(s * 6, 1, f - 5, s * 6 + 2, 5, f - 2, p.wall);
      }
    }
  } else if (variant === 1) {
    const span = Math.max(4, Math.floor(hx * 0.83));
    const vault = (
      x: number,
      w: number,
      z0: number,
      z1: number,
      top: number,
    ) => {
      c.v.hollowBox(x, 1, z0, x + w, top, z1, p.shade, p.rim);
      barrel(c, p, x - 1, z0 - 1, x + w + 1, z1, 1, top - 1, "z", 0.7);
      c.v.box(x - 1, 1, z1 - 1, x + w + 1, top, z1 + 1, p.wall);
      c.v.box(x, top - 1, z1 - 1, x + w, top + 1, z1 + 1, p.rim);
    };
    vault(l, span, b, middle, h);
    if (lv >= 2) vault(1, Math.max(4, r - 1), b + 2, middle - 3, h - 1);
    lock(l + Math.floor(span / 2), 1, middle);
    if (lv === 1) {
      rounds(c, 3, 1, -2, 2, 5, p.frame);
      rounds(c, 3, 5, -2, 2, 6, bronze);
    }
    if (lv >= 3) {
      c.v.box(l + 1, 1, b - 1, r, 6, b + 1, p.wall);
      torch(c, r - 1, 1, middle);
    }
    if (lv >= 4) {
      barrel(c, p, -6, b + 2, 7, middle, h, h + 3, "z");
    }
    if (lv >= 5) {
      for (const x of [l + 2, r - 2]) rounds(c, x, 1, f - 4, 2, 6, p.rim);
      steps(c, p, l + 3, -2, middle + 3, 1, 2);
    }
  } else if (variant === 2) {
    const lw = Math.max(4, Math.floor(hx * 0.67)),
      front = lv <= 2 ? middle - 1 : Math.floor(f * 0.2);
    c.v.hollowBox(l, 1, b, r, h, front, p.wall, p.frame);
    c.v.box(l - 1, h, b - 1, r + 1, h + 2, front + 1, marble);
    c.v.hollowBox(l, 1, front, l + lw, h + 1, f - 2, p.shade, p.rim);
    c.v.box(l - 1, h + 1, front, l + lw + 1, h + 3, f - 1, bronze);
    lock(Math.floor(r * 0.5), 1, front - 1);
    if (lv >= 2) {
      for (let x = l + 1; x < r; x += 4)
        c.v.box(x, h + 2, b, x + 1, h + 3, front, p.frame);
    }
    if (lv >= 3) {
      c.v.box(l + lw + 2, 1, f - 4, r - 2, 3, f - 2, p.frame);
      for (let x = l + lw + 3; x < r - 2; x += 3)
        c.v.put(x, 3, f - 3, parchment);
    }
    if (lv >= 4) {
      rounds(c, r - 4, h + 2, b + 4, 3, h + 4, bronze);
      rounds(c, r - 4, h + 4, b + 4, 2, h + 5, parchment);
    }
    if (lv >= 5) {
      c.v.box(l + lw + 2, 1, f - 2, r, 6, f, p.shade);
      c.v.box(l + lw + 2, 5, f - 2, r, 7, f, p.rim);
    }
  } else {
    // A faceted, low stone treasury encloses a narrow tallying court, with a single guard portal.
    const cz = -1,
      rx = Math.max(4, hx - 2),
      rz = Math.max(3, hz - 4);
    for (let x = -rx; x <= rx; x++)
      for (let z = -rz; z <= rz; z++) {
        const a = Math.abs(x / rx),
          d = Math.abs(z / rz),
          outer = a + 0.7 * d;
        if (outer > 1.3) continue;
        const inside = a < 0.4 && d < 0.45;
        const height = inside ? 2 : z < 0 ? h + 2 : h - 1;
        c.v.box(x, 1, z + cz, x + 1, height, z + cz + 1, p.wall);
        c.v.put(x, height, z + cz, inside ? p.floor : z < 0 ? p.rim : p.frame);
        if (!inside && z < -rz * 0.65 && lv >= 2)
          c.v.put(x, height + 1, z + cz, bronze);
      }
    lock(0, 1, cz + rz - 1);
    if (lv >= 3) {
      c.v.box(-3, 4, -2, 4, 5, 0, p.frame);
      reader(c, 1, 5, -1);
    }
    if (lv >= 4) {
      for (const s of [-1, 1])
        rounds(c, s * (rx - 4), h - 1, cz - 3, 4, h + 5, p.rim);
    }
    if (lv >= 5) {
      barrel(c, p, -6, b + 2, 7, b + 6, h + 1, h + 3, "x");
    }
  }
  if (variant === 2) {
    // The fourth treasury gains a sheltered metal assay table in the counting court.
    if (lv >= 4) {
      barrel(c, p, 1, f - 7, r - 1, f - 2, 1, 6, "x");
      reader(c, Math.max(3, r - 5), 1, f - 4, p.cloth);
    }
    // A beveled bronze strongbox lid lifts just enough to see the golden tally bars inside.
    const front = lv <= 2 ? middle - 1 : Math.floor(f * 0.2),
      width = Math.max(4, Math.floor(hx * 0.67));
    c.v.clear(l - 1, h + 1, front, l + width + 1, h + 4, f - 1);
    for (let x = l - 1; x <= l + width; x++) {
      const height = h + 2 + Math.floor((x - l + 1) / 2);
      c.v.box(
        x,
        height,
        front - 1,
        x + 1,
        height + 2,
        f - 2,
        (x - l) % 4 === 0 ? parchment : bronze,
      );
    }
    for (let z = front + 1; z < f - 3; z += 3)
      c.v.box(l + 1, h + 1, z, l + width - 1, h + 3, z + 1, parchment);
    c.v.box(l - 1, h - 1, front, l + width + 1, h, f - 1, p.rim);
  }
  if (variant === 3 && lv >= 2) {
    const rx = Math.max(4, hx - 2),
      rz = Math.max(3, hz - 4);
    // Travertine ties pick out the corners in the solid wall, with red-brick courses between the piers.
    for (let x = -rx; x <= rx; x += 3)
      for (let z = rz; z >= 0; z--) {
        if (Math.abs(x / rx) + (0.7 * z) / rz > 1.3) continue;
        c.v.box(x, 2, z - 1, x + 1, h - 1, z, p.rim);
        c.v.put(x, h - 1, z, bronze);
        break;
      }
    for (let z = -rz; z <= rz; z += 3)
      for (let x = rx; x >= 1; x--) {
        if (x / rx + 0.7 * Math.abs(z / rz) > 1.3) continue;
        c.v.box(x, 2, z - 1, x + 1, h - 1, z + 1, p.frame);
        c.v.put(x, h - 1, z, marble);
        break;
      }
  }
  reader(c, Math.max(l + 1, -3), 1, f - 1, "#945444");
  torch(c, r - 1, 1, f - 1);
  if (active) reader(c, 3, 1, f - 2, marble);
};
