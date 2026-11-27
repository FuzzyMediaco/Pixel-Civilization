/** Original workspaces built out of an old mill, a computer, terraces, a tree, or the inventions inside them. */
import { bench, byLv, door, person, PixelVox, tree, windows, type Ctx } from "./kit";
import { cafeTable, disc, glassFront, sculpt } from "./commerceKit";

function desk(v: PixelVox, x: number, y: number, z: number) {
  v.box(x, y, z, x + 1, y + 2, z + 2, "woodDark");
  v.box(x + 3, y, z, x + 4, y + 2, z + 2, "woodDark");
  v.box(x, y + 2, z, x + 4, y + 3, z + 2, "woodLight");
  v.box(x + 1, y + 3, z, x + 3, y + 4, z + 1, "screenCyan", 0.4);
}

function room(c: Ctx, x: number, y: number, z: number, w: number, h: number, d: number, wall: string, rim: string) {
  const v = c.v;
  v.hollowBox(x, y, z, x + w, y + h, z + d, wall);
  windows(c, x, y, z, x + w, y + h, z + d, { w: 2, h: 2, stepH: 4, stepV: 4, col: "#e9cca3", emit: 0.5 });
  v.box(x - 1, y + h - 1, z - 1, x + w + 1, y + h, z + d + 1, rim);
  door(v, x + 2, y, z + d - 1, "#35494b");
}

function greenhouse(v: PixelVox, x0: number, x1: number, z0: number, z1: number, y: number) {
  const cz = (z0 + z1 - 1) / 2;
  for (let z = z0; z < z1; z++) {
    const h = y + 2 + Math.round((cz - z0 - Math.abs(z - cz)) * 0.65);
    for (let x = x0; x < x1; x++) {
      if (z === z0 || z === z1 - 1) v.put(x, y + 1, z, "#74aca7", 0.2);
      if ((x - x0) % 4 === 0 || x === x1 - 1) v.box(x, y, z, x + 1, h + 1, z + 1, "#577779");
      else if ((z - z0) % 3 === 0) v.put(x, h, z, "#bbe3db", 0.15);
      else if (x % 3 === 0) v.put(x, y + 1, z, "leaf");
    }
  }
}

function millLoft(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const x = -hx + 3,
    z = -hz + 3,
    d = Math.min(hz + 1, 19),
    w = byLv(c, [17, 23, 29, 32, 32]);
  const h = byLv(c, [6, 8, 10, 13, 16]);
  room(c, x, 1, z, w, h, d, "#b76546", "#536663");
  greenhouse(v, x + 2, x + w - 2, z + 1, z + Math.min(11, d - 1), h + 1);
  v.box(x + 1, 0, z + d, x + 6, 1, hz, "path");
  person(v, x + 4, 1, z + d + 1, "tealDark");
  if (lv >= 2) {
    v.box(x + w - 3, 1, z + d + 1, x + w, h + 4, z + d + 4, "brickDark");
    for (let y = 2; y < h; y++) v.box(x + w - 1 - y, 1, z + d + 1, x + w - y, y, z + d + 4, "steelDark");
    desk(v, x + 4, h + 1, z + d - 3);
  }
  if (lv >= 3) {
    room(c, hx - 10, 1, -3, 7, 6, 12, "#b76546", "#526864");
    v.box(x + w - 1, 5, 0, hx - 8, 6, 3, "steelDark");
    cafeTable(c, 2, hz - 5);
  }
  if (lv >= 4) {
    greenhouse(v, hx - 12, hx - 2, -9, 8, 8);
    v.box(x + 2, 1, z + 1, x + 5, h + 11, z + 4, "brickDark");
    v.box(x + 1, h + 10, z, x + 6, h + 12, z + 5, "slate");
  }
  if (lv === 5) {
    room(c, -hx + 3, 1, 7, 15, 8, 11, "#a55942", "#627a73");
    greenhouse(v, -hx + 3, -hx + 19, 7, 18, 9);
    v.box(-hx + 7, 8, z + d, -hx + 11, 9, 8, "wood");
    for (let i = 0; i < 3; i++) tree(v, 3 + i * 4, 1, hz - 6, "birch", 0.85, i);
  }
}

function laptopLoft(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const w = byLv(c, [9, 12, 15, 17, 19]),
    depth = byLv(c, [5, 8, 10, 13, 14]);
  const base = lv < 3 ? 3 : 6,
    height = byLv(c, [9, 13, 16, 19, 23]);
  const hinge = -depth + 1;
  v.hollowBox(-w, 1, hinge, w, base + 1, depth, "#547382");
  v.box(-w, base, hinge, w, base + 1, depth + 1, "#c9c7bb");
  for (let x = -w + 2; x < w - 1; x += 3)
    for (let z = hinge + 2; z < depth - 2; z += 3) {
      v.box(x, base + 1, z, x + 2, base + 2, z + 2, "#455968");
    }
  v.box(-3, base + 1, depth - 2, 3, base + 2, depth, "#88a6ae");
  for (let row = 0; row < height; row++) {
    const z = hinge - Math.floor(row / 6),
      y = base + row + 1;
    v.box(-w, y, z - 1, w, y + 1, z + 1, "#364956");
    if (row === 0 || row === height - 1) continue;
    for (let x = -w + 1; x < w - 1; x++) {
      const ridge = height * (0.37 + 0.17 * Math.sin(x * 0.21) + 0.12 * Math.sin(x * 0.48));
      const color =
        row < ridge - 2
          ? "#28787a"
          : row < ridge
            ? "#62bca7"
            : row > height * 0.68 && x > w * 0.24 && x < w * 0.58
              ? "#f5cf86"
              : "#78bac5";
      v.put(x, y, z, color, 0.26);
    }
  }
  door(v, -1, 1, depth - 1, "#253944", 3, base - 1);
  v.box(-2, 0, depth, 3, 1, hz, "path");
  if (lv >= 2) {
    v.box(-w + 1, 1, depth, w - 1, 2, depth + 2, "concrete2");
    person(v, -2, 2, depth + 1, "crimson");
  }
  if (lv >= 3) {
    v.box(-w - 3, 1, -5, -w, base + 4, 4, "#488c8d");
    for (let z = -4; z < 4; z += 2) v.box(-w - 3, base + 4, z, -w, base + 5, z + 1, "steelDark");
    v.box(-w + 2, 2, depth - 1, -4, 4, depth, "warmGlow", 0.55);
  }
  if (lv >= 4) {
    // A second monitor folds forward at the side; its graph shows through the dark studio frame.
    const x = w - 1;
    v.box(x, base + 3, hinge, x + 2, base + height - 2, -2, "#384c59");
    for (let z = hinge + 1; z < -3; z++)
      v.box(x + 1, base + 5, z, x + 2, base + 6 + ((z - hinge) % 6), z + 1, "screenCyan", 0.6);
  }
  if (lv === 5) {
    const z = Math.min(hz - 4, depth + 4);
    for (let x = -13; x < 14; x += 9) {
      desk(v, x, 1, z);
      v.box(x, 1, z - 2, x + 1, 8, z - 1, "steelDark");
    }
    v.box(-14, 8, z - 3, 11, 9, z + 2, "#8faab4");
    v.box(-3, base, depth - 1, 1, base + 1, z - 1, "steel");
  }
}

function studioTerraces(c: Ctx) {
  const { v, lv, hx, hz } = c;
  // Alternating long and short studio wings leave a usable deck on the roof underneath each one.
  const levels = [
    [-9, -5, 15, 8, "#e9a96d"],
    [1, -7, 10, 14, "#739599"],
    [-15, -2, 20, 8, "#cf7959"],
    [1, -12, 10, 20, "#bba17a"],
    [-10, -9, 24, 9, "#588585"],
  ] as const;
  for (let i = 0; i < lv; i++) {
    const [x, z, w, d, color] = levels[i],
      y = 1 + i * 6;
    room(c, x, y, z, w, 6, d, color, "#e5d7b9");
    glassFront(v, x + 1, x + w - 1, y + 1, y + 4, z + d - 1, "#536352", 4);
    desk(v, x, y + 6, z + 2);
    v.box(x + w - 4, y + 6, z + d - 3, x + w - 1, y + 7, z + d - 1, "leafDark");
  }
  v.box(-2, 1, -4, 3, lv * 6, 0, "#6c5548");
  if (lv >= 3) {
    room(c, hx - 10, 1, 4, 8, 5, 8, "#6c9b94", "cream");
    v.box(6, 5, 6, hx - 6, 6, 9, "wood");
  }
  if (lv >= 4) for (let x = -12; x <= 0; x++) v.box(x, 4 + (x + 12), -1, x + 1, 6 + (x + 12), 1, "#ac5a46");
  if (lv === 5) {
    for (let z = -5; z < 4; z += 4) v.box(-13, 24, z, -12, 34, z + 1, "woodDark");
    v.box(-15, 34, -6, 3, 35, 4, "#db9976");
    cafeTable(c, -7, -2, "cream", 31);
  }
  v.box(-9, 0, 3, -4, 1, hz, "path");
  person(v, -5, 1, Math.min(hz - 2, 5), "blue");
}

function pod(c: Ctx, x: number, z: number, floor: number, r: number) {
  const v = c.v;
  disc(v, x, z, floor, floor + 1, r + 1, "woodLight");
  disc(v, x, z, floor + 1, floor + 5, r, (xx, y, zz, d) =>
    d < r - 1.3 || (zz > z && Math.abs(xx - x) < 2) ? null : y === floor + 3 ? ["#a3d4c6", 0.45] : "wood",
  );
  v.cone(x, floor + 5, floor + 9, z, r + 0.5, 1, "#669264");
  person(v, x, floor + 1, z + 1, "amber");
}

function treeStudios(c: Ctx) {
  const { v, lv } = c;
  const floor = 4 + lv;
  tree(v, -2, 1, -2, "oak", 1.2 + lv * 0.28);
  v.box(-3, 1, -3, 1, floor + 6, 0, "woodDark");
  for (let i = 0; i < lv; i++) {
    const [x, z, rise] = [
      [-7, 0, 0],
      [6, -5, 3],
      [4, 6, 7],
      [-10, -10, 10],
      [11, 4, 15],
    ][i];
    for (let j = 0; j <= 10; j++)
      v.box(
        -2 + ((x + 2) * j) / 10,
        floor - 2 + (rise * j) / 10,
        -2 + ((z + 2) * j) / 10,
        ((x + 2) * j) / 10,
        floor + 1 + (rise * j) / 10,
        ((z + 2) * j) / 10,
        "woodDark",
      );
    pod(c, x, z, floor + rise, i === 4 ? 6 : 4);
  }
  for (let y = 1; y < floor + 1; y++) v.box(-4, y, 2 + floor - y, 0, y + 1, 4 + floor - y, "wood");
  v.box(-5, 0, floor + 2, 1, 1, c.hz, "woodLight");
  if (lv >= 3) {
    tree(v, 12, 1, -9, "birch", 1.4);
    cafeTable(c, -7, 8);
  }
  if (lv >= 4) {
    v.box(-11, floor + 8, -8, -9, floor + 9, 3, "woodLight");
    for (let z = -8; z <= 2; z++) v.put(-11, floor + 11 - Math.round(2 * Math.sin((Math.PI * (z + 8)) / 10)), z, "leather");
  }
  if (lv === 5) {
    tree(v, 11, 1, 4, "oak", 2);
    v.box(2, floor + 8, 5, 10, floor + 9, 8, "wood");
  }
}

export function buildCoworkingLoft(c: Ctx) {
  c.vpick([millLoft, laptopLoft, studioTerraces, treeStudios])(c);
}

function rocketStudio(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const r = 3 + lv,
    tall = 9 + 4 * lv,
    bx = lv <= 2 ? -2 : -4,
    bz = -3;
  // A civilian space-science exhibit has porthole workrooms, four swept feet and a public demonstration gantry.
  sculpt(v, bx - r, 3, bz - r, bx + r, tall + 9, bz + r, (u, h, w) => {
    const radius = Math.hypot(2 * u - 1, 2 * w - 1),
      outline = h < 0.12 ? 0.62 + h * 2 : h < 0.67 ? 0.89 : Math.max(0.09, 0.89 * (1 - (h - 0.67) / 0.34));
    if (radius > outline) return null;
    if (h > 0.78 || (h > 0.22 && h < 0.28)) return "#ce684c";
    if (Math.abs(u - 0.52) < 0.16 && w > 0.5 && Math.abs(h - 0.49) < 0.075) return ["#79bfd0", 0.5];
    return "#f2e7d5";
  });
  for (let y = 1; y < 4 + lv * 2; y++) {
    const spread = r + 3 - Math.floor(y / 2);
    v.box(bx - spread, y, bz - 1, bx + spread + 1, y + 1, bz + 1, "#bb5947");
    v.box(bx - 1, y, bz - spread, bx + 1, y + 1, bz + spread + 1, "#bb5947");
  }
  // A low arc of ticket desks below the craft makes this a science building at street level.
  disc(v, bx, bz, 0, 1, r + 4, "concrete2");
  v.box(bx - 2, 0, bz + r, bx + 3, 1, hz, "path");
  v.box(bx + 2, 1, bz + r - 1, bx + 7, 4, bz + r + 1, "#547478");
  v.box(bx + 2, 4, bz + r - 1, bx + 7, 5, bz + r + 2, "cream");
  person(v, bx + 2, 1, bz + r + 1, "blue");
  if (lv >= 2) {
    const gx = bx + r + 2;
    v.box(gx, 1, bz - 2, gx + 1, tall - 1, bz - 1, "steelDark");
    v.box(gx + 3, 1, bz - 2, gx + 4, tall - 1, bz - 1, "steelDark");
    for (let y = 2; y < tall - 1; y++) v.put(gx + Math.abs((y % 6) - 3), y, bz - 2, "orange");
    v.box(bx + r - 1, tall - 3, bz - 3, gx + 4, tall - 2, bz + 1, "steel");
  }
  if (lv >= 3) {
    room(c, hx - 14, 1, -8, 11, 7, 12, "#567d81", "cream");
    desk(v, hx - 12, 8, -6);
  }
  if (lv >= 4) {
    for (const x of [hx - 12, hx - 6]) {
      v.cylinderY(x, -hz + 7, 1, 8, 2.5, "silver");
      v.dome(x, 8, -hz + 7, 2.5, "copper");
    }
    v.box(bx + r, 7, -6, hx - 6, 8, -3, "steelDark");
  }
  if (lv === 5) {
    room(c, -hx + 3, 1, 6, 17, 8, 11, "#547778", "cream");
    greenhouse(v, -hx + 4, -hx + 17, 7, 15, 9);
  }
}

function lightbulbStudio(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const r = byLv(c, [5, 6, 7, 9, 10]),
    cx = lv >= 3 ? -4 : 0,
    cz = -2,
    neck = 5 + lv * 2;
  const mid = neck + r + 1;
  for (let y = 1; y <= neck; y++)
    disc(v, cx, cz, y, y + 1, r * (0.5 + (y % 3 === 0 ? 0.08 : 0)), y % 3 === 0 ? "brass" : "#687882", r * 0.5 - 1);
  // Glass ribs leave the looped amber filament legible, even with the light off.
  for (let y = -r; y <= r; y++) {
    const radius = Math.max(1, r * Math.sqrt(1 - (y / r) ** 2));
    for (let i = 0; i < 24; i++) {
      const angle = (i * Math.PI) / 12;
      if (i % 3 && Math.abs(y) < r - 1 && y !== 0) continue;
      v.put(
        cx + radius * Math.cos(angle),
        mid + y,
        cz + radius * Math.sin(angle),
        Math.abs(y) < 2 ? "#e4ba72" : "#c2decb",
        0.4,
      );
    }
  }
  for (let i = 0; i < r * 2; i++) {
    const x = cx - r / 2 + i / 2;
    v.put(x, mid - 1 + 2 * Math.cos(i * 1.25), cz, "amber", 1.1);
  }
  for (const side of [-1, 1])
    v.box(cx + side * Math.floor(r / 2), neck - 1, cz, cx + side * Math.floor(r / 2) + 1, mid + 1, cz + 1, "copper");
  v.box(cx - 1, 1, cz + r * 0.5, cx + 2, 4, cz + r * 0.5 + 1, "glassDark");
  v.box(cx - 2, 0, cz + r * 0.5, cx + 3, 1, hz, "path");
  desk(v, cx + 4, 1, cz + r * 0.5 + 2);
  person(v, cx + 7, 1, cz + r * 0.5 + 5, "orange");
  if (lv >= 2) {
    room(c, 4, 1, -hz + 3, 8, 5, 9, "#adbca8", "#50666a");
    desk(v, 6, 6, -hz + 7);
  }
  if (lv >= 3) {
    v.box(cx, 4, cz - 1, hx - 4, 5, cz + 2, "brass");
    room(c, hx - 13, 1, -2, 10, 9, 11, "#547478", "cream");
  }
  if (lv >= 4) {
    disc(v, cx, cz, neck - 1, neck + 1, r + 4, "#b67556", r + 1);
    v.box(cx, neck - 1, cz + 2, cx + 3, neck, cz + r + 4, "wood");
  }
  if (lv === 5) {
    for (let j = 0; j < 3; j++) {
      const x = 6 + 8 * j;
      v.cylinderY(x, hz - 9, 1, 5 + j, 2, "brass");
      v.sphere(x, 8 + j, hz - 9, 3, 4, 3, "#ffe5a8", 0.6);
    }
  }
}

function chip(v: PixelVox, x: number, z: number, size: number, y: number, h: number) {
  v.hollowBox(x - size, y, z - size, x + size, y + h, z + size, "#33424d");
  for (let i = -size + 1; i < size; i += 3) {
    v.box(x + i, y, z - size - 2, x + i + 1, y + 1, z + size + 2, "brass");
    v.box(x - size - 2, y, z + i, x + size + 2, y + 1, z + i + 1, "brass");
  }
  v.box(x - size + 1, y + h - 1, z + size - 1, x + size - 1, y + h, z + size, "screenCyan", 0.45);
}

function circuitStudios(c: Ctx) {
  const { v, hx, hz, lv } = c;
  const w = hx - 5,
    d = hz - 5;
  v.box(-w, 1, -d, w, 3, d, "#325b54");
  for (let i = 0; i <= lv; i++) {
    const z = -d + 2 + i * 3,
      x = -w + 4 + i * 4;
    v.box(-w, 3, z, x, 4, z + 1, "copper");
    v.box(x, 3, z, x + 1, 4, d - 1, "#8cd5b4", 0.2);
  }
  chip(v, -4, -2, 4 + lv, 4, 4 + lv);
  door(v, -4, 4, -2 + 3 + lv, "tealDark");
  v.box(-5, 0, d, -1, 1, hz, "path");
  v.box(-5, 1, d - 1, -1, 2, d + 3, "copper");
  v.box(-5, 2, d - 1, -1, 3, d + 1, "steel");
  if (lv >= 2) {
    chip(v, w - 3, d - 3, 2, 4, 6);
    person(v, 1, 4, 6, "amber");
  }
  if (lv >= 3) for (let x = 3; x < w - 1; x += 4) v.box(x, 3, -d, x + 2, 8, -d + 5, "#b06848");
  if (lv >= 4) {
    v.hollowBox(-w + 2, 3, -d + 2, w - 3, 19, -d + 5, "#326e69");
    for (let y = 5; y < 18; y += 3) {
      v.box(-w + y, y, -d + 4, w - 7, y + 1, -d + 5, "brass");
      v.put(w - 6, y, -d + 4, "cyan", 0.6);
    }
    for (let x = 0; x < w - 6; x += 5) v.box(x, 7, -d + 4, x + 3, 13, -d + 7, "slate");
  }
  if (lv === 5) {
    chip(v, w - 6, 2, 5, 11, 6);
    v.box(2, 11, 0, w - 6, 12, 3, "brass");
    v.box(w - 9, 3, 0, w - 7, 11, 2, "copper");
  }
}

function orbitStudios(c: Ctx) {
  const { lv, v, hx } = c;
  const r = byLv(c, [7, 10, 12, 15, 17]),
    thick = 3 + Math.floor(lv / 2),
    h = 3 + lv * 2;
  function arc(radius: number, bottom: number, top: number, start: number, end: number, rim: string) {
    for (let x = -radius; x <= radius; x++)
      for (let z = -radius; z <= radius; z++) {
        const d = Math.hypot(x + 0.5, z + 0.5),
          a = Math.atan2(x + 0.5, z + 0.5);
        if (a < start || a > end || d < radius - thick || d > radius) continue;
        v.put(x, top, z, rim);
        if (d > radius - 1 || d < radius - thick + 1) {
          for (let y = bottom; y < top; y++) v.put(x, y, z, (y - bottom) % 4 === 2 ? "#80c2bb" : "#476a73", 0.18);
        }
      }
  }
  arc(r, 1, h, -Math.PI, 0.12, "#d5e5cf");
  arc(r, 1, lv === 1 ? 2 : h - 2, lv === 1 ? 1.7 : 0.7, Math.PI, "#9dbbac");
  desk(v, -2, 1, -2);
  v.box(2, 0, 0, 6, 1, c.hz, "path");
  if (lv >= 2) {
    tree(v, 2, 1, -1, "blossom", 0.9);
    bench(v, -4, 1, 3);
  }
  if (lv >= 3) {
    v.box(-r + 2, h, -2, r - 2, h + 1, 1, "wood");
    cafeTable(c, 0, 0, "amber", h + 1);
  }
  if (lv >= 4) {
    arc(r - 1, h, h + 5, -Math.PI, -1.2, "#badacc");
    arc(r - 1, h - 2, h + 2, 1.1, 2.4, "#d3c8a6");
  }
  if (lv === 5) {
    room(c, hx - 11, 1, -9, 8, 10, 17, "#527978", "cream");
    v.box(r - 2, h - 3, -3, hx - 6, h - 2, 1, "#dca86d");
    arc(r - 3, h + 4, h + 8, -Math.PI, -2.1, "#95bdab");
  }
}

export function buildTechStartupHub(c: Ctx) {
  c.vpick([rocketStudio, lightbulbStudio, circuitStudios, orbitStudios])(c);
}
