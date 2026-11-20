/**
 * Rebuild the game's static illustrated catalog without a browser or GPU.
 * From the repository root, install the export-only native encoder with
 * npm install --no-save --package-lock=false @napi-rs/canvas@1.1.1
 * and run node --import tsx scripts/render-handbook.mjs.
 * Set ATLAS_IDS to a comma-separated list for focused artwork changes.
 */
import fs from "node:fs";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import "../src/game/designs/index.ts";
import { DESIGNS } from "../src/game/designs/registry.ts";
import { ELEMENT_BY_ID, ELEMENTS, CATEGORY_META, getMaxElementLevel } from "../src/game/catalog.ts";
import { getGuidePartner, getNeighborPreview, getGuideVariant } from "../src/game/connectionPreview.ts";
import { getGuideUsage } from "../src/game/guideUsage.ts";
import { buildDesignVoxels } from "../src/game/voxelArchitect.ts";
import { getVoxelStyleColor, packVoxKey } from "../src/game/voxelCore.ts";
import { handbookLayout, sheetSize } from "../src/game/handbookLayout.ts";
import names from "../src/game/designStyles.json" with { type: "json" };
const out = path.resolve(import.meta.dirname, "../public/handbook/catalog");
const thumb = path.join(out, "thumbs");
const content = path.resolve(import.meta.dirname, "../src/handbook");
const near = path.resolve(out, "../neighbors");
for (const dir of [out, thumb, content, near]) fs.mkdirSync(dir, { recursive: true });
const CELL = handbookLayout.cell;
function voxels(id, level, variant, mask, edges = []) {
  const def = ELEMENT_BY_ID[id],
    lv = Math.min(level, getMaxElementLevel(id));
  const [width, depth] = DESIGNS[id].footprints[lv - 1];
  const c = buildDesignVoxels(def, lv, variant, width, depth, mask ?? (def.isNetwork ? 5 : 0), { edges });
  const map = c.v.v;
  for (const r of c.rotors)
    for (const [k, s] of r.vox.v)
      map.set(
        packVoxKey(
          ((k >>> 20) & 1023) - 512 + Math.round(r.pivot[0]),
          ((k >>> 10) & 1023) - 512 + Math.round(r.pivot[1]),
          (k & 1023) - 512 + Math.round(r.pivot[2]),
        ),
        s,
      );
  return map;
}
function faces(map) {
  let xs = [],
    minU = 1e6,
    minV = 1e6,
    maxU = -1e6,
    maxV = -1e6;
  for (const [k, style] of map) {
    const mask = (map.has(k + 1) ? 0 : 1) | (map.has(k + 1048576) ? 0 : 2) | (map.has(k + 1024) ? 0 : 4);
    if (!mask) continue;
    const x = ((k >>> 20) & 1023) - 512,
      y = ((k >>> 10) & 1023) - 512,
      z = (k & 1023) - 512;
    const u = 0.84 * (x - z),
      t = 0.42 * (x + z) - y;
    xs.push([u, t, x + y + z, mask, style]);
    minU = Math.min(minU, u - 0.84);
    maxU = Math.max(maxU, u + 0.84);
    minV = Math.min(minV, t - 1);
    maxV = Math.max(maxV, t + 0.84);
  }
  xs.sort((a, b) => a[2] - b[2]);
  return { xs, minU, minV, maxU, maxV, count: map.size };
}
function raster(m, common, CELL = 192, centered = false, HEIGHT = CELL) {
  const canvas = createCanvas(CELL, HEIGHT);
  const ctx = canvas.getContext("2d");
  const im = ctx.createImageData(CELL, HEIGHT);
  const buf = new Uint32Array(im.data.buffer);
  // Packed native RGBA on little-endian platforms.
  const bg = 0xffe3edeb;
  buf.fill(bg);
  const scale = Math.min((CELL - 10) / (m.maxU - m.minU), (HEIGHT - 12) / (m.maxV - m.minV), common);
  const ox = CELL / 2 - ((m.maxU + m.minU) * scale) / 2,
    oy = centered ? HEIGHT * 0.5 - (m.maxV + m.minV) * scale * 0.5 : HEIGHT - 8 - m.maxV * scale,
    dx = 0.84 * scale,
    dy = 0.42 * scale;
  const shades = new Map();
  for (const [u, t, depth, mask, s] of m.xs) {
    let rgb = shades.get(s);
    if (!rgb) {
      const [r, g, b] = getVoxelStyleColor(s).map(
        (value) => 255 * (value < 0.0031308 ? value * 12.92 : 1.055 * Math.pow(value, 1 / 2.4) - 0.055),
      );
      rgb = [0.88, 0.7, 1.04].map(
        (f) =>
          (255 << 24) |
          (Math.min(255, Math.round(b * f)) << 16) |
          (Math.min(255, Math.round(g * f)) << 8) |
          Math.min(255, Math.round(r * f)),
      );
      shades.set(s, rgb);
    }
    // Project the three exposed cube faces into vertical pixel spans.
    const cx = ox + u * scale,
      cy = oy + t * scale;
    const xlo = Math.max(0, Math.ceil(cx - dx - 0.5)),
      xhi = Math.min(CELL, Math.ceil(cx + dx - 0.5));
    for (let px = xlo; px < xhi; px++) {
      const rel = (px + 0.5 - cx) / dx,
        corner = 1 - Math.abs(rel);
      const top = cy - scale + dy * (1 - corner),
        mid = cy - scale + dy * (1 + corner),
        bottom = mid + scale;
      const ylo = Math.max(0, Math.ceil(top - 0.5)),
        ymid = Math.max(0, Math.ceil(mid - 0.5)),
        yhi = Math.min(HEIGHT, Math.ceil(bottom - 0.5));
      if (mask & 4) for (let py = ylo; py < ymid; py++) buf[py * CELL + px] = rgb[2];
      const axis = rel < 0 ? 0 : 1;
      if (mask & (axis + 1)) for (let py = ymid; py < yhi; py++) buf[py * CELL + px] = rgb[axis];
    }
  }
  ctx.putImageData(im, 0, 0);
  return canvas;
}

function metadata(def) {
  const d = DESIGNS[def.id],
    maxLevel = getMaxElementLevel(def.id),
    peer = getGuidePartner(def.id);
  const kind = getNeighborPreview(def.id, Math.min(3, maxLevel))[0]?.edges.find((e) => e.neighbor === peer)?.kind;
  return {
    id: def.id,
    name: def.name,
    category: def.category,
    categoryName: CATEGORY_META.find((c) => c.id === def.category).label,
    cost: def.cost,
    stage: def.stage,
    domain: def.domain,
    isStarter: Boolean(def.isStarter),
    wealthThreshold: def.wealthThreshold,
    stats: Object.fromEntries(
      [
        "popBase",
        "jobs",
        "power",
        "water",
        "waste",
        "food",
        "education",
        "recreation",
        "government",
        "police",
        "policeRadius",
        "fireRadius",
        "military",
        "nuisanceRadius",
        "income",
      ]
        .filter((key) => typeof def[key] === "number")
        .map((key) => [key === "popBase" ? "population" : key, def[key]]),
    ),
    description: def.description,
    usage: getGuideUsage(def.id, kind, def.description),
    growth: d.growth,
    maxLevel,
    levels: d.levels.map((name, i) => ({
      level: i + 1,
      name,
      dimensions: d.footprints[Math.min(maxLevel, i + 1) - 1],
      legacy: i >= maxLevel,
    })),
    styles: names[def.id].map((name, index) => ({ index, name })),
    partner: { id: peer, name: ELEMENT_BY_ID[peer].name },
    image: "/handbook/catalog/" + def.id + ".webp",
    thumbnail: "/handbook/catalog/thumbs/" + def.id + ".webp",
  };
}
const rows = ELEMENTS.map(metadata);
fs.writeFileSync(path.join(content, "catalog.json"), JSON.stringify(rows, null, 2) + "\n");
function label(ctx, str, x, y, width, size, weight = "normal", limit = 2) {
  ctx.font = weight + " " + size + "px Arial";
  const words = str.split(" ");
  let line = "",
    k = 0;
  for (let i = 0; i < words.length; i++) {
    const n = line ? line + " " + words[i] : words[i];
    if (line && ctx.measureText(n).width > width && k < limit - 1) {
      ctx.fillText(line, x, y + k * (size + 3));
      line = words[i];
      k++;
    } else line = n;
  }
  ctx.fillText(line, x, y + k * (size + 3), width);
}
const only = process.env.ATLAS_IDS?.split(",");
function sheets() {
  for (const row of rows) {
    if (only && !only.includes(row.id)) continue;
    const { gap, left, top, cell } = handbookLayout,
      { width: sw, height: sh } = sheetSize;
    const sheet = createCanvas(sw, sh);
    const ctx = sheet.getContext("2d");
    ctx.fillStyle = "#f8f6ed";
    ctx.fillRect(0, 0, sw, sh);
    ctx.fillStyle = "#233d38";
    ctx.font = "bold 26px Arial";
    ctx.fillText(row.name, 13, 33, sw - 240);
    ctx.font = "14px Arial";
    ctx.textAlign = "right";
    ctx.fillText(row.categoryName, sw - 11, 30);
    ctx.textAlign = "left";
    for (let i = 0; i < 5; i++) {
      const l = row.levels[i],
        x = left + i * (cell + gap);
      ctx.fillStyle = l.legacy ? "#93482e" : "#376451";
      ctx.font = "bold 13px Arial";
      ctx.fillText("LEVEL " + (i + 1) + (l.legacy ? "  /  LEGACY" : ""), x, 57);
      ctx.fillStyle = "#283a36";
      label(ctx, l.name, x, 75, cell - 4, 13, "bold");
    }
    const modelRows = Array.from({ length: 4 }, (_, v) =>
      Array.from({ length: row.maxLevel }, (_, i) => faces(voxels(row.id, i + 1, v))),
    );
    const largest = Math.max(...modelRows.flat().map((m) => Math.max(m.maxU - m.minU, m.maxV - m.minV)));
    if (!Number.isFinite(largest) || largest <= 0) throw Error(row.id + " empty");
    for (let v = 0; v < 4; v++) {
      const y = top + v * (cell + gap);
      ctx.fillStyle = "#40735c";
      ctx.font = "bold 15px Arial";
      ctx.fillText("STYLE " + String.fromCharCode(65 + v), 12, y + cell / 2 - 10);
      ctx.fillStyle = "#233b35";
      label(ctx, row.styles[v].name, 12, y + cell / 2 + 12, left - 20, 13, "normal", 5);
      for (let j = 0; j < 5; j++) {
        const m = modelRows[v][Math.min(row.maxLevel, j + 1) - 1];
        if (!m.count) throw Error(row.id + " blank");
        ctx.drawImage(raster(m, (1.7 * (cell - 12)) / largest, cell, true), left + j * (cell + gap), y);
      }
    }
    fs.writeFileSync(path.join(out, row.id + ".webp"), sheet.encodeSync("webp", 86));
    const thumbIndex =
      {
        townhomes: 2,
        ferry_landings: 0,
        taxi_ranks: 2,
        the_london_eye: 0,
        the_great_pyramids: 0,
        skyscrapers: 3,
        solar_panels: 2,
        blacksmiths: 1,
        cheesesteak_restaurants: 0,
      }[row.id] ?? 0;
    fs.writeFileSync(
      path.join(thumb, row.id + ".webp"),
      raster(modelRows[thumbIndex].at(-1), Infinity, 256, true).encodeSync("webp", 89),
    );
  }
}
sheets();
console.log(rows.length + " catalog entries");

const examples = [
  [
    "backyard",
    "A kitchen garden behind the house",
    "Against the rear fence, the garden opens a gate and adds planted food beds along the shared boundary.",
    "house",
    2,
    0,
  ],
  [
    "driveway",
    "A driveway meets the front road",
    "A road beside the front garage slot opens the drive. A road against the rear fence leaves it closed.",
    "medium_sized_homes",
    3,
    2,
  ],
  [
    "townhouse-row",
    "A continuous townhouse row",
    "Both buildings face the same street. Side walls meet across the shared edge, with separate entrances along the front.",
    "townhomes",
    3,
    2,
  ],
  [
    "cashpoint",
    "An ATM facing the bank",
    "The cashpoint opens toward its neighbor. Paving and lamps mark the shared commercial frontage.",
    "atms",
    2,
    2,
  ],
  [
    "farmstead",
    "One farmhouse, five fields",
    "Five separate field plots open onto the farmhouse. Their tilled edges continue across former boundaries, and each shared edge contributes to the farm bonus.",
    "farm_houses",
    3,
    0,
  ],
  [
    "churchyard",
    "A gate between church and graveyard",
    "The cemetery opens onto the church grounds. The gate and shared path add recreation while protecting the buildings and headstones.",
    "churches",
    3,
    2,
  ],
  [
    "platform",
    "A platform beside the main line",
    "The station faces away from the continuous track. Its yellow boarding edge meets the rails along the back of the platform.",
    "train_stops",
    3,
    2,
  ],
  [
    "bus-curb",
    "A shelter on the curb",
    "The shelter leaves the carriageway free. A curb alone needs a depot and a route to carry passengers.",
    "bus_stops",
    3,
    0,
  ],
  [
    "taxi-rank",
    "Taxi dispatch beside a through street",
    "The covered waiting area opens toward the yellow pickup curb; the road continues on either side.",
    "taxi_ranks",
    5,
    1,
  ],
  [
    "ferry-pier",
    "A ferry landing and its berth",
    "Boats need a clear approach with enough water for their draft. A reachable landing at the other end completes the passenger route.",
    "ferry_landings",
    5,
    2,
  ],
];
function rotate(x, z, q) {
  if (q === 1) return [z, -x - 1];
  if (q === 2) return [-x - 1, -z - 1];
  if (q === 3) return [-z - 1, x];
  return [x, z];
}
const pairNotes = [];
for (const [id, title, description, el, level, variant] of examples) {
  const plots = getNeighborPreview(el, level);
  const side = plots[0].edges.find((e) => e.neighbor === plots[1].el.defId)?.side;
  const angle = side === "back" ? 3 : side === "left" ? 1 : 0;
  const combined = new Map();
  for (const [i, p] of plots.entries()) {
    const e = p.el,
      q = ELEMENT_BY_ID[e.defId].isNetwork ? 0 : e.rotation;
    const v = getGuideVariant(el, e.defId, variant, i);
    const map = voxels(e.defId, e.level, v, p.mask, p.edges);
    for (const [k, s] of map) {
      const [x, z] = rotate(((k >>> 20) & 1023) - 512, (k & 1023) - 512, q);
      const [wx, wz] = rotate(x + 16 * e.gx + 8 * e.spanX, z + 16 * e.gz + 8 * e.spanZ, angle);
      combined.set(packVoxKey(wx, ((k >>> 10) & 1023) - 512, wz), s);
    }
  }
  const pic = "/handbook/neighbors/" + id + ".webp";
  fs.writeFileSync(
    path.join(near, id + ".webp"),
    raster(faces(combined), Infinity, 690, true, 420).encodeSync("webp", 89),
  );
  pairNotes.push({ id, title, description, image: pic, ids: [...new Set(plots.map((p) => p.el.defId))] });
}
fs.writeFileSync(path.join(near, "index.json"), JSON.stringify(pairNotes, null, 2) + "\n");
