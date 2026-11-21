import { CAMPUS_FARM_ART } from "../campusFarmArt";
import { EXPANSION_ELEMENTS, FARM_MODULE_IDS } from "../expansionCatalog";
import { defineDesigns } from "./registry";
import {
  lot,
  gable,
  hip,
  cyl,
  ring,
  barrelRoof,
  tree,
  lamp,
  person,
  fence,
  flag,
  PixelVox,
  type Ctx,
} from "./kit";

const animals = new Set([
  "dairy_farm",
  "cattle_ranch",
  "horse_ranch",
  "poultry_farm",
  "livestock_pen",
  "grazing_pasture",
  "chicken_coop",
]);
const crops = new Set([
  "grain_farm",
  "grain_fields",
  "vegetable_farm",
  "vegetable_fields",
  "vineyard",
  "rice_farm",
]);
function barn(c: Ctx, x: number, z: number, w: number, d: number, h: number, wall: string, roof: string) {
  const v = c.v;
  v.box(x, 1, z, x + w, h, z + d, wall);
  v.box(x, 1, z, x + w, 2, z + d, "stone");
  for (let i = 2; i < w - 1; i += 4) {
    v.box(x + i, 3, z, x + i + 2, 5, z + 1, "glassDark");
    v.box(x + i, 3, z + d - 1, x + i + 2, 5, z + d, "glass");
  }
  const mx = x + Math.floor(w / 2);
  v.box(mx - 2, 1, z + d - 1, mx + 2, Math.min(6, h), z + d, "woodDark");
  for (let i = 0; i < 4; i++) {
    v.put(mx - 2 + i, 2 + (i % 3), z + d - 1, "woodLight");
    v.put(mx - 2 + i, 4 - (i % 3), z + d - 1, "woodLight");
  }
  if (c.variant === 2) {
    hip(v, x - 1, h, z - 1, x + w + 1, z + d + 1, roof, "cream", 4);
  } else if (c.variant === 3) {
    barrelRoof(v, x - 1, h, z - 1, x + w + 1, z + d + 1, "x", roof, "steel");
  } else {
    gable(v, x - 1, h, z - 1, x + w + 1, z + d + 1, "x", roof, "cream", wall);
  }
}
function silo(c: Ctx, x: number, z: number, r: number, h: number, col: string) {
  const v = c.v;
  cyl(v, x, z, 1, h, r, col);
  for (let y = 2; y < h; y += 3) ring(v, x, z, y, y + 1, r + 0.15, r - 0.65, "steelDark");
  for (let i = 0; i <= r; i++)
    cyl(
      v,
      x,
      z,
      h + i,
      h + i + 1,
      Math.max(0.35, r - i),
      c.vpick(["steelLight", "redDark", "cream", "tealDark"]),
    );
  for (let y = 2; y < h; y += 2) v.put(x + r, y, z, "silver");
}
export function farmAnimal(
  v: PixelVox,
  x: number,
  y: number,
  z: number,
  kind: "cow" | "horse" | "hen",
  variant: number,
) {
  const p = variant % 4;
  if (kind === "hen") {
    v.box(x, y + 1, z, x + 2, y + 3, z + 2, ["cream", "wood", "crimson", "charcoal"][p]);
    v.put(x + 1, y + 3, z + 1, "red");
    v.put(x + 2, y + 2, z + 1, "gold");
    v.put(x, y, z, "orange");
    v.put(x - 1, y + 2, z, "white");
    return;
  }
  const col =
    kind === "horse"
      ? ["woodDark", "sandDark", "stone", "leather"][p]
      : ["cream", "woodDark", "charcoal", "copper"][p];
  for (const xx of [0, 3])
    for (const zz of [0, 2])
      v.box(x + xx, y, z + zz, x + xx + 1, y + 2, z + zz + 1, kind === "horse" ? "woodDark" : "slate");
  v.box(x, y + 2, z, x + 4, y + 4, z + 3, col);
  v.box(x + 3, y + 3, z, x + 5, y + (kind === "horse" ? 6 : 5), z + 2, col);
  v.put(x + 4, y + (kind === "horse" ? 5 : 4), z, "charcoal");
  v.put(x + 4, y + 3, z + 1, kind === "cow" ? "pink" : "leather");
  v.put(x, y + 2, z + 2, "charcoal");
  if (kind === "cow") {
    v.put(x + 1, y + 3, z, "slate");
    v.put(x + 1, y + 2, z, "slate");
    v.put(x + 3, y + 4, z + 2, "cream");
  } else for (let j = 0; j < 2; j++) v.put(x + 3, y + 4 + j, z - 1, "leather");
}
function greenhouse(c: Ctx, x: number, z: number, w: number, d: number, h: number) {
  const v = c.v,
    frame = c.vpick(["cream", "tealDark", "steelLight", "copper"]);
  v.box(x, 1, z, x + w, 2, z + d, "stone");
  for (let xx = x + 1; xx < x + w - 1; xx += 3)
    for (let zz = z + 1; zz < z + d - 1; zz += 2)
      v.box(xx, 2, zz, xx + 2, 3 + (c.lv % 3), zz + 1, c.vpick(["leaf", "lime", "pink", "red"]));
  for (let j = 0; j < d; j++) {
    const rib = j === 0 || j === d - 1 || j % 4 === 0;
    for (let i = 0; i < w; i++) {
      const edge = Math.min(i, w - 1 - i);
      const rise =
        c.variant === 2
          ? i % 5
          : c.variant === 3
            ? Math.round(Math.sin((Math.PI * (i + 0.5)) / w) * 4)
            : Math.min(4, edge);
      if (rib || i === 0 || i === w - 1 || i === Math.floor(w / 2) || j % 4 === 1)
        v.put(x + i, h + rise, z + j, rib ? frame : "glass", 0.22);
    }
    for (const ix of [x, x + w - 1]) {
      if (rib) v.box(ix, 2, z + j, ix + 1, h + 1, z + j + 1, frame);
      else v.put(ix, h - 1, z + j, "glassDark", 0.25);
    }
  }
}
function irrigation(c: Ctx, x: number, z: number, w: number, d: number) {
  const v = c.v;
  for (let i = 0; i < w; i++)
    for (let j = 0; j < d; j++) {
      const nx = (i - (w - 1) / 2) / (w / 2),
        nz = (j - (d - 1) / 2) / (d / 2),
        a = nx * nx + nz * nz;
      if (a > 1) continue;
      v.put(
        x + i,
        0,
        z + j,
        a > 0.76 ? c.vpick(["terracotta", "stone", "moss", "woodDark"]) : a > 0.51 ? "water" : "waterDeep",
      );
      if (a < 0.65 && (i * 7 + j * 13) % 21 === 0) v.put(x + i, 0, z + j, "sky");
      if (a > 0.7 && a < 0.88 && (i + j) % 5 === 0) v.box(x + i, 1, z + j, x + i + 1, 3, z + j + 1, "olive");
    }
}
function equipment(c: Ctx, x: number, z: number, kind: "tractor" | "crate" | "hay" | "press") {
  const v = c.v;
  if (kind === "crate" || kind === "hay") {
    v.box(x, 1, z, x + 3, 3, z + 2, kind === "crate" ? "crate" : "goldDark");
    v.box(x + 1, 1, z, x + 2, 3, z + 2, kind === "crate" ? "woodDark" : "sand");
    return;
  }
  if (kind === "press") {
    cyl(v, x, z, 1, 4, 2, "wood");
    v.box(x - 2, 5, z, x + 3, 6, z + 1, "woodDark");
    v.box(x, 3, z, x + 1, 7, z + 1, "iron");
    return;
  }
  for (const ox of [0, 3])
    for (const oz of [0, 2]) v.box(x + ox, 1, z + oz, x + ox + 1, 3, z + oz + 1, "rubber");
  v.box(x, 2, z + 1, x + 5, 4, z + 3, c.vpick(["leafDark", "crimson", "gold", "teal"]));
  v.put(x + 1, 4, z + 1, "slate");
  v.put(x + 4, 4, z + 1, "iron");
}
function cropField(c: Ctx, x: number, z: number, w: number, d: number) {
  const { v, id, lv, variant } = c;
  const grain = id.includes("grain"),
    vines = id === "vineyard",
    rice = id === "rice_farm";
  const color = grain
    ? c.vpick(["gold", "goldDark", "sand", "brass"])
    : rice
      ? c.vpick(["leafLight", "gold", "purpleDark", "brickDark"])
      : vines
        ? c.vpick(["purpleDark", "lime", "pink", "indigo"])
        : c.vpick(["orange", "red", "goldDark", "leafLight"]);
  for (let ix = 0; ix < w; ix++)
    for (let iz = 0; iz < d; iz++) {
      const xx = x + ix,
        zz = z + iz;
      const row = variant === 1 ? iz : ix,
        along = variant === 1 ? ix : iz;
      if (ix === Math.floor(w / 2) || (iz === Math.floor(d / 2) && lv >= 3)) {
        v.put(xx, 0, zz, "path2");
        continue;
      }
      v.put(xx, 0, zz, rice ? (row % 6 === 0 ? "soil" : "water") : row % 3 === 0 ? "soilDark" : "soil");
      if (row % (vines ? 4 : 3) !== 1 || along % 2) continue;
      if (vines) {
        v.box(xx, 1, zz, xx + 1, 3, zz + 1, "woodDark");
        v.box(xx, 3, zz, xx + 1, 4, Math.min(z + d, zz + 2), "leafDark");
        v.put(xx, 2, zz, color);
      } else if (grain) {
        const h = 1 + Math.min(3, lv - 1) + ((ix + iz) % 5 === 0 ? 1 : 0);
        v.box(xx, 1, zz, xx + 1, h + 1, zz + 1, lv < 2 ? "olive" : "sandDark");
        v.put(xx, h, zz, color);
        if (lv >= 3) v.put(xx + 1, h - 1, zz, color);
      } else if (rice) {
        v.box(xx, 1, zz, xx + 1, 2 + Math.min(2, lv >> 1), zz + 1, "leafDark");
        v.put(xx, 1 + Math.min(2, lv >> 1), zz, color);
      } else {
        v.put(xx, 1, zz, "leafDark");
        v.put(xx, 2, zz, color);
        if (lv >= 3) v.put(xx + 1, 1, zz, color);
        if (lv >= 4 && along % 4 === 0) v.put(xx, 3, zz, "leafLight");
      }
    }
}
function farmstead(c: Ctx) {
  const { v, lv, id, hx, hz } = c,
    X = -hx + 1,
    Z = -hz + 1,
    W = hx * 2 - 2,
    D = hz * 2 - 2;
  const farm = !FARM_MODULE_IDS.has(id),
    roof = c.vpick(["redDark", "tealDark", "slate", "terracotta"]),
    wall = c.vpick(["wood", "cream", "brick2", "woodLight"]);
  lot(c, c.vpick(["grass", "grass2", "grass3", "olive"]));
  if (crops.has(id)) {
    cropField(c, X, Z, W, D);
    if (farm && id !== "rice_farm") {
      const bw = Math.min(13, 5 + lv * 2),
        bd = Math.min(8, 4 + lv);
      barn(c, X, Z, bw, bd, 3 + lv, wall, roof);
    }
    if (id === "grain_farm" && lv >= 2) {
      silo(c, X + W - 4, Z + 4, 2, 6 + lv * 2, "steelLight");
      if (lv >= 4) silo(c, X + W - 9, Z + 4, 2, 10, "cream");
    }
    if (id === "vineyard" && lv >= 2) {
      equipment(c, X + W - 4, Z + 4, "press");
      if (lv >= 4) for (let i = 0; i < 3; i++) cyl(v, X + 4 + i * 4, hz - 4, 1, 4, 1.5, "oak");
    }
    if (id === "rice_farm") {
      if (lv >= 2) {
        v.box(X, 1, Z, X + W, 2, Z + 1, "wood");
        v.box(X + 1, 1, Z + 1, X + 2, 4, Z + 3, "woodDark");
      }
      if (lv >= 3) {
        const wheel = new PixelVox();
        for (let i = 0; i < 12; i++) {
          const a = (i * Math.PI) / 6;
          wheel.box(
            -1,
            Math.round(3 * Math.sin(a)),
            Math.round(3 * Math.cos(a)),
            1,
            Math.round(3 * Math.sin(a)) + 1,
            Math.round(3 * Math.cos(a)) + 2,
            "wood",
          );
        }
        c.addRotor({ vox: wheel, axis: "x", pivot: [X + 3, 4, Z + 5], speed: 0.65 });
      }
      if (lv >= 4) barn(c, X + W - 11, Z + 2, 9, 6, 6, wall, roof);
    }
    if (lv >= 2 && !farm) equipment(c, X + 1, Z + 1, id === "grain_fields" ? "hay" : "crate");
    if (lv >= 3) equipment(c, X + W - 5, hz - 5, farm ? "tractor" : id === "grain_fields" ? "hay" : "crate");
    if (lv === 5) {
      for (let j = 0; j < 3; j++) equipment(c, X + 2 + j * 4, hz - 5, id.includes("grain") ? "hay" : "crate");
    }
  } else if (animals.has(id)) {
    const poultry = id === "poultry_farm" || id === "chicken_coop",
      horse = id === "horse_ranch",
      dairy = id === "dairy_farm",
      grazing = id === "grazing_pasture";
    const wood = c.vpick(["woodLight", "stone", "steelLight", "woodDark"]);
    if ((!grazing && (farm || poultry)) || (grazing && lv >= 3))
      barn(
        c,
        X + 1,
        Z + 1,
        Math.min(Math.floor(W * 0.55), 8 + lv),
        Math.min(Math.floor(D * 0.48), 6 + lv),
        poultry ? 4 + Math.floor(lv / 2) : 5 + Math.floor(lv / 2),
        dairy ? "crimson" : wall,
        roof,
      );
    fence(v, X, Z, X + W, Z + D, 1, poultry ? 2 : 3, wood, [-1, 2]);
    for (let i = 0; i < Math.min(lv + 1, Math.floor((W - 4) / 5)); i++) {
      const xx = X + 2 + i * 5,
        zz = Z + Math.floor(D * 0.6) + (i % 2) * 2;
      farmAnimal(v, xx, 1, zz, poultry ? "hen" : horse ? "horse" : "cow", c.variant + i);
    }
    if (lv >= 2) {
      v.box(X + W - 4, 1, Z + 2, X + W - 2, 3, Z + 7, wood);
      v.box(X + W - 4, 3, Z + 2, X + W - 2, 4, Z + 7, "water");
    }
    if (lv >= 3 && !grazing) {
      if (dairy || poultry) silo(c, X + W - 5, Z + 5, 2, 7 + lv, dairy ? "silver" : "cream");
      else {
        v.box(X + W - 9, 1, Z + 4, X + W - 8, 5, Z + 5, wood);
        v.box(X + W - 3, 1, Z + 4, X + W - 2, 5, Z + 5, wood);
        v.box(X + W - 9, 4, Z + 4, X + W - 2, 5, Z + 5, horse ? "red" : "woodDark");
      }
    }
    if (lv >= 4) {
      fence(v, X + 1, Z + Math.floor(D * 0.48), X + Math.floor(W * 0.44), Z + D - 1, 1, 2, wood, [
        X + 4,
        X + 7,
      ]);
      if (poultry) barn(c, X + Math.floor(W * 0.47), Z + 3, 7, 5, 4, wall, roof);
    }
    if (horse) {
      const x = X + Math.floor(W * 0.62),
        z = Z + Math.floor(D * 0.57);
      v.box(x - 2, 0, z - 2, X + W - 3, 1, Z + D - 2, "sand");
      for (let i = 0; i < Math.min(lv, Math.floor((D * 0.4 - 2) / 3)); i++) {
        const zz = z + i * 3;
        v.box(x - 1, 1, zz, x, 5, zz + 1, "cream");
        v.box(x + 4, 1, zz, x + 5, 5, zz + 1, "cream");
        for (let j = 0; j < 4; j++) v.put(x + j, 3, zz, j % 2 ? "cream" : roof);
      }
    } else if (dairy && lv >= 3) {
      const w = Math.min(15, Math.floor(W * 0.35)),
        x = X + Math.floor(W * 0.54),
        z = Z + Math.floor(D * 0.51);
      barn(c, x, z, w, Math.min(8, Math.floor(D * 0.27)), 5, "cream", lv >= 4 ? "tealDark" : roof);
      for (let j = 0; j < Math.min(lv, 4); j++) {
        v.box(x + 1 + j * 3, 1, z - 3, x + 2 + j * 3, 5, z - 2, "steel");
        v.put(x + 1 + j * 3, 3, z - 2, "silver");
      }
      v.box(x, 5, z - 3, x + w, 6, z - 1, "silver");
      if (lv >= 4) equipment(c, x + w - 5, hz - 5, "tractor");
    } else if (id === "cattle_ranch" || id === "livestock_pen") {
      const x = X + Math.floor(W * 0.64),
        z = Z + Math.floor(D * 0.43);
      for (let i = 0; i < Math.min(lv, 4); i++) {
        const zz = z + i * 3;
        v.box(x, 1, zz, x + 5, 3, zz + 1, wood);
        v.box(x, 2, zz, x + 1, 5, zz + 1, "woodDark");
      }
      if (lv >= 4) {
        v.box(x + 6, 1, z, x + 7, 4, hz - 4, "woodDark");
        v.box(x + 8, 1, z, x + 9, 4, hz - 4, wood);
        equipment(c, x + 2, hz - 8, "hay");
      }
    } else if (poultry && lv >= 3) {
      for (let i = 0; i < Math.min(lv - 1, Math.floor(W / 7)); i++) {
        const x = X + 4 + i * 6,
          z = Z + D - 5;
        v.box(x, 1, z, x + 3, 3, z + 3, "woodLight");
        gable(v, x - 1, 3, z - 1, x + 4, z + 3, "x", roof);
        v.put(x + 1, 2, z + 2, "woodDark");
      }
    }
    if (grazing || id === "cattle_ranch" || horse) {
      for (let x = X + 2; x < X + W - 2; x += 4)
        for (let z = Z + 2; z < Z + D - 2; z += 5) {
          if (c.rand() > 0.52) continue;
          v.put(x, 0, z, "leafDark");
          v.put(x + 1, 0, z, c.rand() > 0.5 ? "grass3" : "moss");
        }
    }
    if (lv === 5) {
      if (dairy) for (const x of [X + W - 10, X + W - 16]) silo(c, x, Z + 5, 2, 8, "silver");
      else if (farm) barn(c, X + W - 16, Z + Math.floor(D * 0.46), 11, 7, 6, wall, roof);
      else equipment(c, X + W - 6, hz - 4, "hay");
    }
  } else if (id === "orchard_block") {
    for (let x = X + 3; x < X + W - 1; x += lv <= 2 ? 7 : 8)
      for (let z = Z + 3; z < Z + D - 1; z += 8) {
        tree(
          v,
          x,
          1,
          z,
          lv === 2 ? "blossom" : c.variant === 1 ? "cypress" : "fruit",
          0.67 + lv * 0.1,
          c.variant + z,
        );
        if (lv >= 3) {
          v.put(x + 1, 4, z + 1, c.vpick(["red", "lime", "orange", "purple"]));
          v.put(x - 1, 5, z, c.vpick(["red", "lime", "orange", "purple"]));
        }
      }
    if (lv >= 4) equipment(c, X + 1, hz - 4, "crate");
    if (lv === 5) for (let j = 0; j < 3; j++) equipment(c, X + 6 + j * 4, hz - 4, "crate");
  } else if (id === "apiary") {
    for (let x = X + 2; x < X + W - 2; x += 6)
      for (let z = Z + 2; z < Z + D - 2; z += 7) {
        v.box(x, 1, z, x + 3, 2, z + 3, "woodDark");
        const n = 1 + Math.min(3, lv - 1);
        for (let i = 0; i < n; i++)
          v.box(
            x,
            2 + i,
            z,
            x + 3,
            3 + i,
            z + 3,
            (x + z + i) % 2 === 0 ? "cream" : c.vpick(["gold", "teal", "lime", "purple"]),
          );
        v.box(x - 1, 2 + n, z - 1, x + 4, 3 + n, z + 4, "slateLight");
        v.put(x + 1, 2, z + 3, "iron");
        v.put(x + 4, 1, z + 2, "yellow");
      }
    if (lv >= 3) barn(c, X + 1, Z + 1, 8, 6, 5, wall, roof);
    if (lv === 5) pollen(c, X + W - 7, hz - 6);
  } else if (id === "feed_silo") {
    for (let i = 0; i < Math.min(lv, Math.floor(W / 6)); i++)
      silo(
        c,
        X + 4 + i * 6,
        Z + Math.floor(D * 0.42),
        lv >= 3 ? 3 : 2,
        6 + lv * 2,
        c.vpick(["silver", "brickDark", "cream", "tealDark"]),
      );
    if (lv >= 2)
      v.box(X + 3, 1, Z + Math.floor(D * 0.42) + 2, X + 5, 5, Z + Math.floor(D * 0.42) + 5, "steelDark");
    if (lv >= 4) {
      v.box(X + W - 6, 1, Z + 4, X + W - 4, 20, Z + 6, "iron");
      v.box(X + 3, 16, Z + 4, X + W - 4, 17, Z + 6, "steelLight");
    }
    if (lv === 5) barn(c, X + 2, hz - 10, 12, 7, 5, wall, roof);
  } else if (id === "irrigation_pond") {
    irrigation(c, X, Z, W, D);
    if (lv >= 2) {
      v.box(X + 1, 1, -1, X + 6, 2, 1, "woodDark");
      v.box(X + 3, 1, -1, X + 4, 4, 1, "tealDark");
    }
    if (lv >= 3) barn(c, X + 1, Z + 1, 6, 5, 4, "stone", roof);
    if (lv >= 4) irrigation(c, X + W - 9, Z + 1, 8, 7);
    if (lv === 5) {
      v.box(X + 2, 1, hz - 5, X + W - 3, 2, hz - 3, "woodLight");
      lamp(v, X + W - 4, 2, hz - 5, 4);
    }
  } else if (id === "vertical_farm") {
    const x = X + 1,
      z = Z + 2,
      w = Math.min(W - 3, 11 + lv),
      depth = Math.min(D - 4, 8 + lv);
    for (let floor = 0; floor < lv + 1; floor++) {
      const y = 1 + floor * 4,
        shift = c.variant === 1 ? floor % 3 : 0;
      v.box(x + 2, y, z + 2, x + w - 2, y + 4, z + depth - 2, "glassDark", 0.35);
      v.box(x + shift, y, z, x + w + shift, y + 1, z + depth, "cream");
      for (let i = 1; i < w - 1; i += 3)
        v.box(x + i + shift, y + 1, z + depth - 2, x + i + 2 + shift, y + 3, z + depth, "leafLight");
      if (c.variant === 2) v.box(x, y + 2, z, x + w, y + 3, z + 1, "magenta", 0.7);
    }
    if (lv >= 3) silo(c, X + W - 5, Z + 3, 2, 7 + lv, "tealDark");
    if (lv >= 4) greenhouse(c, X + W - 12, hz - 12, 10, 8, 4);
    if (lv === 5)
      for (let j = 0; j < 3; j++)
        v.box(X + 3 + j * 3, 4 * (lv + 1) + 1, Z + 3, X + 5 + j * 3, 4 * (lv + 1) + 2, Z + 8, "solarBlue");
  } else {
    const rows = Math.min(Math.ceil(lv / 2), Math.max(1, Math.floor(W / 8)));
    const width = Math.min(13, Math.floor((W - 2) / rows) - 1);
    for (let i = 0; i < rows; i++)
      greenhouse(
        c,
        X + 1 + i * (width + 1),
        Z + 2,
        width,
        Math.max(7, D - (farm ? 5 : 3)),
        3 + Math.floor(lv / 2),
      );
    if (lv >= 2) equipment(c, X + 1, hz - 4, "crate");
    if (lv >= 4) silo(c, X + W - 4, Z + 3, 2, 6 + lv, "silver");
    if (lv === 5) {
      barn(c, X + W - 10, hz - 9, 8, 6, 5, "steelLight", roof);
      c.smoke(X + W - 6, 8, hz - 6, "steam");
    }
  }
  if (farm && lv >= 3) person(v, 0, 1, hz - 3, "blueDark");
  if (farm && lv === 5) flag(v, X + 1, 1, hz - 4, 5, [roof, "cream"]);
}
function pollen(c: Ctx, x: number, z: number) {
  for (let i = 0; i < 6; i++)
    for (let j = 0; j < 4; j++) {
      c.v.put(x + i, 1, z + j, "leafDark");
      if ((i + j) % 2 === 0) c.v.put(x + i, 2, z + j, c.vpick(["yellow", "pink", "cream", "purple"]));
    }
}
defineDesigns(
  Object.fromEntries(
    EXPANSION_ELEMENTS.filter((d) => d.category === "agriculture").map((d) => [
      d.id,
      { ...CAMPUS_FARM_ART[d.id], growth: CAMPUS_FARM_ART[d.id].levels.join(" → "), build: farmstead },
    ]),
  ),
);
