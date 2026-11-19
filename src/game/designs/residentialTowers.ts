import { type Ctx, bench, bush, door, flag, lamp, lot, ring, tree, windows } from "./kit";

function lobby(c: Ctx, r: number, depth: number, wall: string): void {
  const v = c.v;
  lot(c, "path2");
  v.hollowBox(-r, 1, -depth, r, 5, depth, "glass", wall);
  v.box(-r, 5, -depth, r, 6, depth + 1, wall);
  door(v, -1, 1, depth - 1, "glassDark", 2, 3);
  for (const x of [-r + 1, r - 2]) bush(v, x, 1, depth + 1, 1, "leafDark", "pink");
}

// A perimeter plus roof keeps deep, tall glass shafts cheap to render.
function facade(
  c: Ctx,
  x: number,
  z: number,
  rx: number,
  rz: number,
  bottom: number,
  top: number,
  wall: string,
  glass: string,
  step = 4,
): void {
  const { v } = c;
  const x0 = x - rx,
    x1 = x + rx + 1,
    z0 = z - rz,
    z1 = z + rz + 1;
  v.box(x0, bottom, z0, x1, top, z0 + 1, wall);
  v.box(x0, bottom, z1 - 1, x1, top, z1, wall);
  v.box(x0, bottom, z0, x0 + 1, top, z1, wall);
  v.box(x1 - 1, bottom, z0, x1, top, z1, wall);
  v.box(x0, top - 1, z0, x1, top, z1, wall);
  windows(c, x0, bottom, z0, x1, top, z1, {
    col: glass,
    w: 2,
    h: 2,
    stepH: 3,
    stepV: step,
    emit: 0.42,
    darkCol: "glassDark",
  });
}

// Brutalist wedge balconies, mural-panel slab, candy-coloured modular homes, woodland balconies.
export function buildApartmentBlock(c: Ctx): void {
  const { v, lv, variant: style, hx, hz } = c;
  const floors = [3, 4, 6, 8, 11][lv - 1];
  const wall = ["concreteDark", "#e9d4b2", "#f8ede2", "woodDark"][style];
  const front = lv >= 4 ? -2 : 1;
  const back = -hz + 3;
  const left = -hx + 3,
    right = hx - 3;
  lot(c, "grass2");
  v.box(left, 0, front, right, 1, hz, "path2");
  const drawWing = (x0: number, x1: number, z0: number, z1: number, storeys: number) => {
    for (let f = 0; f < storeys; f++) {
      const y = 1 + f * 4;
      const recess = style === 0 ? Math.floor(f / 3) : 0;
      const shift = style === 2 && f % 2 === 1 ? 1 : 0;
      const edge = Math.max(z0 + 4, z1 - recess);
      v.hollowBox(x0 + shift, y, z0, x1 + shift, y + 4, edge, wall);
      windows(c, x0 + shift, y, z0, x1 + shift, y + 4, edge, { col: "glass", w: 2, h: 2, stepH: 4 });
      for (let x = x0 + 1; x < x1 - 2; x += 4) {
        const bay = Math.floor((x - x0) / 4);
        if (style === 1) {
          // A sun rising over a coast, drawn across storeys like one mural.
          const dx = (x - x0) / (x1 - x0),
            dy = f / storeys;
          const pigment =
            Math.hypot(dx - 0.65, dy - 0.72) < 0.24
              ? "amber"
              : dy < 0.36 + Math.sin(dx * 6) * 0.14
                ? "teal"
                : "blue";
          v.box(x, y + 1, z0, x + 3, y + 4, z0 + 1, pigment);
          v.box(x, y + 1, edge - 1, x + 1, y + 4, edge, pigment);
          v.box(x1 - 1, y + 1, z0 + 1, x1, y + 4, z0 + 4, pigment);
        } else {
          const width = style === 3 ? 3 : 4;
          const rail =
            style === 2
              ? ["crimson", "sky", "amber", "teal"][(bay + f) % 4]
              : style === 3
                ? "woodLight"
                : "limestone";
          v.box(x, y, edge, x + width, y + 1, edge + 2, wall);
          v.box(x, y + 1, edge + 1, x + width, y + 2, edge + 2, rail);
          if (style === 3) bush(v, x + 1, y + 1, edge + 1, 1, (f + bay) % 2 ? "leafDark" : "leafLight");
        }
      }
    }
    const roof = 1 + storeys * 4;
    v.box(x0, roof, z0, x1, roof + 1, z1 - Math.floor(style === 0 ? (storeys - 1) / 3 : 0), "slateLight");
    if (lv >= 3) {
      v.box(x0 + 2, roof + 1, z0 + 1, x0 + 5, roof + 4, z0 + 4, wall);
      tree(v, x1 - 3, roof + 1, z0 + 3, "round", 0.8);
    }
  };
  drawWing(left, right, back, front, floors);
  door(v, left + 2, 1, front - 1);
  if (lv >= 2) bench(v, -3, 1, hz - 3);
  if (lv >= 4) {
    const wingX = left + 7;
    drawWing(left, wingX, 2, hz - 4, floors - 3);
    tree(v, right - 1, 1, hz - 5, "blossom", 1.4);
    if (lv === 5) {
      const y = (floors - 4) * 4;
      v.box(left + 2, y, front, wingX - 1, y + 1, 3, "steelDark");
      for (const x of [left + 2, wingX - 2]) v.box(x, y + 1, front, x + 1, y + 3, 3, "glass", 0.4);
    }
  }
}

// Ocean-liner curves, planted setbacks, scalloped round balconies, dark-glass cantilevers.
export function buildCondo(c: Ctx): void {
  const { v, lv, variant: style } = c;
  const r = Math.min(c.hx, c.hz) - 3;
  const floors = [3, 5, 7, 10, 14][lv - 1];
  lobby(c, c.hx - 2, c.hz - 3, style === 3 ? "charcoal" : "marble");
  const wide = c.hx > c.hz ? -5 : 0;
  for (let f = 0; f < floors; f++) {
    const y = 6 + f * 4;
    if (style === 2 || style === 0) {
      const radius = Math.max(3, r * (style === 0 ? 0.7 : 0.64) - Math.floor(f / 6));
      ring(v, wide, -1, y, y + 4, radius, radius - 1.4, "glassDark", 0.3);
      v.cylinderY(wide, -1, y, y + 1, radius + 1, style === 0 ? "white" : "limestone");
      if (f === floors - 1) v.cylinderY(wide, -1, y + 3, y + 4, radius + 1, "marble");
      if (style === 2) {
        for (let i = 0; i < 7; i++) {
          const a = (i * Math.PI * 2) / 7;
          const x = wide + Math.cos(a) * radius,
            z = -1 + Math.sin(a) * radius;
          v.cylinderY(x, z, y, y + 1, Math.max(1.5, radius * 0.42), "cream");
          ring(
            v,
            x,
            z,
            y + 1,
            y + 2,
            Math.max(1.5, radius * 0.42),
            Math.max(0.4, radius * 0.42 - 1),
            "limestone",
          );
        }
      } else {
        facade(c, wide, -3, Math.ceil(radius), 2, y, y + 4, "white", "teal");
        v.box(wide - radius, y, -5, wide + radius + 1, y + 1, 1, "pink");
      }
    } else {
      const shift = style === 3 ? [0, 2, 0, -2][Math.floor(f / 2) % 4] : 0;
      const rz =
        style === 1 ? Math.max(2, r - 1 - Math.floor((f * Math.max(1, r - 4)) / floors)) : Math.max(2, r - 3);
      const rx = Math.max(2, r - (style === 3 ? 2 : 1));
      facade(
        c,
        wide + shift,
        -2,
        rx,
        rz,
        y,
        y + 4,
        style === 3 ? "#263a50" : "cream",
        style === 3 ? "#679aba" : "glass",
      );
      v.box(
        wide + shift - rx - 1,
        y,
        -2 - rz,
        wide + shift + rx + 2,
        y + 1,
        rz + 1,
        style === 3 ? "copper" : "white",
      );
      if (style === 1) {
        bush(v, wide - rx + 1, y + 1, rz, 1, "leafLight");
        bush(v, wide + rx - 1, y + 1, rz, 1, "leaf");
      }
    }
  }
  const top = 6 + floors * 4;
  const cap = Math.max(2, Math.round(r * 0.4));
  v.cylinderY(wide, -2, top, top + 1, cap + 1, "marble");
  v.cylinderY(wide, -2, top + 1, top + (lv >= 2 ? 5 : 3), cap, style === 3 ? "copper" : "glassDark", 0.3);
  if (lv >= 3) {
    const x = c.hx - 6,
      z = c.hz - 6;
    facade(c, x, z, 3, 3, 6, 12, "plaster", "teal");
    v.box(x - 3, 12, z - 3, x + 4, 13, z + 4, "marble");
    if (lv >= 4) v.box(x - 2, 12, z - 2, x + 3, 13, z + 2, "water", 0.3);
  }
  if (lv === 5) {
    if (style === 0) {
      // A marina sail shades the lap pool. Its stepped leading edge reads from the street.
      v.box(wide - 3, top + 4, -5, wide + 3, top + 5, 1, "white");
      v.box(wide - 2, top + 4, -4, wide + 2, top + 5, 0, "water", 0.3);
      for (let n = 0; n < 7; n++) {
        v.box(wide - 3 + Math.floor(n / 2), top + 5 + n, -5, wide + 2, top + 6 + n, -4, n % 2 ? "glass" : "white");
      }
      tree(v, wide + 3, top + 5, 0, "palm", 0.85);
    } else {
      tree(v, wide, top + 5, -2, style === 3 ? "blossom" : "palm", 1.25);
      for (const x of [-3, 3]) v.box(wide + x, top + 5, -5, wide + x + 1, top + 10, -4, "woodDark");
      for (let z = -5; z <= 1; z += 2) v.box(wide - 3, top + 10, z, wide + 4, top + 11, z + 1, "woodLight");
      for (const x of [-3, 3]) v.box(wide + x, top + 5, 1, wide + x + 1, top + 10, 2, "woodDark");
    }
  }
}

// Stepped brass Deco crown, twisting sail, offset sky gardens, paired skybridge needles.
export function buildSkyscraper(c: Ctx): void {
  const { v, lv, variant: style } = c;
  const r = Math.min(c.hx, c.hz) - 2;
  const height = [26, 39, 58, 80, 112][lv - 1];
  const crown = ["gold", "chrome", "copper", "screenCyan"][style];
  lobby(c, r, r - 1, ["limestone", "chrome", "copper", "steelDark"][style]);
  let tipX = 0,
    tipZ = 0;
  if (style === 0) {
    for (let tier = 0; tier < 4; tier++) {
      const bottom = 6 + Math.floor(height * [0, 0.48, 0.71, 0.87][tier]);
      const top = 6 + Math.floor(height * [0.48, 0.71, 0.87, 1][tier]);
      const width = Math.max(2, Math.floor(r * [0.88, 0.72, 0.54, 0.34][tier]));
      facade(c, 0, 0, width, width, bottom, top, "limestone", "#48919e");
      for (const sign of [-1, 1]) {
        v.box(sign * width, bottom, -1, sign * width + 1, top + 1, 2, "brass");
        v.box(-1, bottom, sign * width, 2, top + 1, sign * width + 1, "brass");
      }
    }
    v.cone(0.5, 6 + height, height + 11 + lv, 0.5, Math.max(2, r * 0.37), 0.7, "gold");
  } else if (style === 1) {
    // Each floor rotates an elliptical plan. Track the shell of adjacent floors to seal each ledge.
    const radius = r * 0.91;
    for (let y = 6; y <= 6 + height; y++) {
      const t = (y - 6) / height;
      const ang = t * (1.5 + lv * 0.45),
        co = Math.cos(ang),
        si = Math.sin(ang);
      const major = Math.max(1.2, radius * (1 - 0.68 * t ** 2)),
        minor = Math.max(1, major * 0.56);
      for (let x = -r; x <= r; x++)
        for (let z = -r; z <= r; z++) {
          const a = x * co + z * si,
            b = -x * si + z * co;
          if ((a / major) ** 2 + (b / minor) ** 2 > 1) continue;
          if (y % 4 && (a / Math.max(0.6, major - 1.4)) ** 2 + (b / Math.max(0.6, minor - 1.4)) ** 2 < 1)
            continue;
          const edge = Math.abs(a) > major * 0.83;
          v.put(x, y, z, edge ? "chrome" : y % 4 ? "#46a8bd" : "#236477", edge ? 0.35 : 0.12);
        }
    }
  } else if (style === 2) {
    const count = lv + 3;
    for (let i = 0; i < count; i++) {
      const y = 6 + Math.floor((height * i) / count),
        top = 6 + Math.floor((height * (i + 1)) / count);
      const phase = i % 4;
      const dx = Math.round([0.24, 0, -0.24, 0][phase] * r);
      const dz = Math.round([0, 0.24, 0, -0.24][phase] * r);
      const span = Math.max(2, Math.floor(r * (0.63 - (i / count) * 0.14)));
      facade(c, dx, dz, span, span, y, top, "#29566c", "glass", 3);
      v.box(dx - span - 1, top - 1, dz - span - 1, dx + span + 2, top, dz + span + 2, "copper");
      bush(v, dx + span, top, dz + span, 1.3, "leafLight");
      tipX = dx;
      tipZ = dz;
    }
  } else {
    const offset = Math.round(r * 0.57),
      width = Math.max(1, Math.floor(r * 0.27));
    const stagger = Math.max(1, Math.round(r * 0.37));
    for (const sign of [-1, 1]) {
      const x = sign * offset,
        z = -sign * stagger;
      const top = 6 + height - (sign < 0 ? 0 : 4 + 2 * lv);
      facade(c, x, z, width, Math.max(2, Math.round(r * 0.35)), 6, top, "#355f78", "glass");
      v.cone(x, top, top + 8, z, width + 0.5, 0.65, "chrome");
      v.box(x, top + 6, z, x + 1, top + 10, z + 1, "steelDark");
    }
    for (const fraction of lv >= 4 ? [0.34, 0.67] : [0.53]) {
      const y = Math.floor(height * fraction) + 5;
      for (let x = -offset; x <= offset; x++) {
        const z = Math.round((-x * stagger) / offset);
        v.box(x, y, z - 1, x + 1, y + 1, z + 2, "chrome");
        v.box(x, y + 1, z - 1, x + 1, y + 3, z + 2, "tealDark", 0.35);
        v.box(x, y + 3, z - 1, x + 1, y + 4, z + 2, "screenCyan", 0.45);
      }
    }
    tipX = -offset;
    tipZ = stagger;
  }
  const mast = style === 0 ? 11 + lv : style === 3 ? 10 : 6;
  const roof = 6 + height;
  v.box(tipX, roof + (style === 0 ? 4 : 0), tipZ, tipX + 1, roof + mast + lv, tipZ + 1, crown);
  v.put(tipX, roof + mast + lv, tipZ, "red", 0.65);
  c.blink(tipX, roof + mast + lv + 1, tipZ, "red");
  if (lv >= 4) {
    lamp(v, -c.hx + 2, 1, c.hz - 3);
    flag(v, c.hx - 5, 1, c.hz - 3, 8, ["teal", "white", "gold"]);
  }
}
