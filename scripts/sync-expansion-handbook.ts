import { CHRISTMAS_ELEMENTS } from "../src/game/christmasCatalog";
/**
 * Renders crisp isometric voxel .webp thumbnails and 5×4 level/style sheets for
 * the 58 new safety, military, and commercial elements directly from their real
 * voxel designs, and syncs src/game/designStyles.json and src/handbook/catalog.json.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import "../src/game/designs/index";
import {
  CATEGORY_META,
  ELEMENT_BY_ID,
  ELEMENTS,
  getElementLevelName,
  getMaxElementLevel,
  getStandardFootprintForLevel,
} from "../src/game/catalog";
import { DESIGNS } from "../src/game/designs/registry";
import { NEW_EXPANSION_BY_ID, NEW_SAFETY_MILITARY_COMMERCE_ELEMENTS } from "../src/game/expansionSafetyMilitaryCommerce";
import { BALANCED_EXPANSION_BY_ID, BALANCED_EXPANSION_ELEMENTS } from "../src/game/expansionBalancedCatalog";
import { getGuidePartner } from "../src/game/connectionPreview";
import { getGuideUsage } from "../src/game/guideUsage";
import { buildDesignVoxels } from "../src/game/voxelArchitect";
import { getVoxelStyleColor, packVoxKey } from "../src/game/voxelCore";
import { handbookLayout, sheetSize } from "../src/game/handbookLayout";

interface IsoFaceList {
  xs: [number, number, number, number, number][];
  minU: number;
  minV: number;
  maxU: number;
  maxV: number;
  count: number;
}

function buildVoxelMap(id: string, lv: number, variant: number): Map<number, number> {
  const def = ELEMENT_BY_ID[id];
  if (!def) return new Map();
  const clampedLv = Math.min(lv, getMaxElementLevel(id));
  const [width, depth] = getStandardFootprintForLevel(def, clampedLv);
  const c = buildDesignVoxels(def, clampedLv, variant, width, depth, def.isNetwork ? 5 : 0);
  const map = c.v.v;
  for (const r of c.rotors) {
    for (const [k, s] of r.vox.v) {
      map.set(
        packVoxKey(
          ((k >>> 20) & 1023) - 512 + Math.round(r.pivot[0]),
          ((k >>> 10) & 1023) - 512 + Math.round(r.pivot[1]),
          (k & 1023) - 512 + Math.round(r.pivot[2]),
        ),
        s,
      );
    }
  }
  return map;
}

function extractFaces(map: Map<number, number>): IsoFaceList {
  const xs: [number, number, number, number, number][] = [];
  let minU = 1e6;
  let minV = 1e6;
  let maxU = -1e6;
  let maxV = -1e6;
  for (const [k, style] of map) {
    const mask = (map.has(k + 1) ? 0 : 1) | (map.has(k + 1048576) ? 0 : 2) | (map.has(k + 1024) ? 0 : 4);
    if (!mask) continue;
    const x = ((k >>> 20) & 1023) - 512;
    const y = ((k >>> 10) & 1023) - 512;
    const z = (k & 1023) - 512;
    const u = 0.84 * (x - z);
    const t = 0.42 * (x + z) - y;
    xs.push([u, t, x + y + z, mask, style]);
    if (u - 0.84 < minU) minU = u - 0.84;
    if (u + 0.84 > maxU) maxU = u + 0.84;
    if (t - 1 < minV) minV = t - 1;
    if (t + 0.84 > maxV) maxV = t + 0.84;
  }
  xs.sort((a, b) => a[2] - b[2]);
  return { xs, minU, minV, maxU, maxV, count: map.size };
}

function linearToSrgb255(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return 255 * (clamped < 0.0031308 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055);
}

function rasterFacesToRgba(
  m: IsoFaceList,
  commonScale: number,
  width: number,
  height: number,
  bgRgba: [number, number, number, number],
  centered = true,
): Buffer {
  const buf = Buffer.alloc(width * height * 4);
  const u32 = new Uint32Array(buf.buffer, buf.byteOffset, width * height);
  const bgPacked =
    ((bgRgba[3] & 255) << 24) |
    ((bgRgba[2] & 255) << 16) |
    ((bgRgba[1] & 255) << 8) |
    (bgRgba[0] & 255);
  u32.fill(bgPacked >>> 0);
  if (!m.xs.length) return buf;

  const spanU = Math.max(1e-3, m.maxU - m.minU);
  const spanV = Math.max(1e-3, m.maxV - m.minV);
  const scale = Math.min((width - 10) / spanU, (height - 12) / spanV, commonScale);
  const ox = width / 2 - ((m.maxU + m.minU) * scale) / 2;
  const oy = centered ? height * 0.5 - (m.maxV + m.minV) * scale * 0.5 : height - 8 - m.maxV * scale;
  const dx = 0.84 * scale;
  const dy = 0.42 * scale;

  const shades = new Map<number, [number, number, number]>();
  for (const [u, t, , mask, s] of m.xs) {
    let rgb = shades.get(s);
    if (!rgb) {
      const [lr, lg, lb] = getVoxelStyleColor(s);
      const r = linearToSrgb255(lr);
      const g = linearToSrgb255(lg);
      const b = linearToSrgb255(lb);
      const pack = (f: number) =>
        ((255 << 24) |
          (Math.min(255, Math.round(b * f)) << 16) |
          (Math.min(255, Math.round(g * f)) << 8) |
          Math.min(255, Math.round(r * f))) >>>
        0;
      rgb = [pack(0.88), pack(0.7), pack(1.04)];
      shades.set(s, rgb);
    }
    const cx = ox + u * scale;
    const cy = oy + t * scale;
    const xlo = Math.max(0, Math.ceil(cx - dx - 0.5));
    const xhi = Math.min(width, Math.ceil(cx + dx - 0.5));
    for (let px = xlo; px < xhi; px++) {
      const rel = (px + 0.5 - cx) / dx;
      const corner = 1 - Math.abs(rel);
      const top = cy - scale + dy * (1 - corner);
      const mid = cy - scale + dy * (1 + corner);
      const bottom = mid + scale;
      const ylo = Math.max(0, Math.ceil(top - 0.5));
      const ymid = Math.max(0, Math.ceil(mid - 0.5));
      const yhi = Math.min(height, Math.ceil(bottom - 0.5));
      if (mask & 4) {
        for (let py = ylo; py < ymid; py++) u32[py * width + px] = rgb[2];
      }
      const axis = rel < 0 ? 0 : 1;
      if (mask & (axis + 1)) {
        for (let py = ymid; py < yhi; py++) u32[py * width + px] = rgb[axis];
      }
    }
  }
  return buf;
}

function writeWebp(rgba: Buffer, width: number, height: number, outFile: string, quality = 86): void {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgba",
      "-s",
      `${width}x${height}`,
      "-i",
      "pipe:0",
      "-c:v",
      "libwebp",
      "-quality",
      String(quality),
      outFile,
    ],
    { input: rgba },
  );
}

const root = process.cwd();
const stylesPath = path.join(root, "src/game/designStyles.json");
const catalogPath = path.join(root, "src/handbook/catalog.json");
const thumbsDir = path.join(root, "public/handbook/catalog/thumbs");
const sheetsDir = path.join(root, "public/handbook/catalog");

const designStyles: Record<string, string[]> = JSON.parse(fs.readFileSync(stylesPath, "utf8"));
const existingCatalog: any[] = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const existingById = new Map(existingCatalog.map((r) => [r.id, r]));
const catLabel = Object.fromEntries(CATEGORY_META.map((c) => [c.id, c.label]));

const { left, top, gap, cell } = handbookLayout;
// Use a compact 0.5x internal scale for the 5x4 sheet to keep each sheet light while matching aspect ratio
const sheetScale = 0.5;
const sw = Math.round((left + 5 * (cell + gap)) * sheetScale);
const sh = Math.round(sheetSize.height * sheetScale);
const sLeft = Math.round(left * sheetScale);
const sTop = Math.round(top * sheetScale);
const sCell = Math.round(cell * sheetScale);
const sGap = Math.round(gap * sheetScale);

const christmasOnly = process.argv.includes("--christmas");
const TARGET_ELEMENTS = christmasOnly ? CHRISTMAS_ELEMENTS : [
  ...BALANCED_EXPANSION_ELEMENTS,
  ELEMENT_BY_ID["spaceport"],
].filter(Boolean);

const christmasIds = new Set(CHRISTMAS_ELEMENTS.map(d => d.id));
let rendered = 0;
for (const def of TARGET_ELEMENTS) {
  if ("styleNames" in def && Array.isArray((def as any).styleNames)) {
    designStyles[def.id] = [...(def as any).styleNames];
  }

  const maxLv = getMaxElementLevel(def.id);
  const modelRows = Array.from({ length: 4 }, (_, style) =>
    Array.from({ length: maxLv }, (_, i) => extractFaces(buildVoxelMap(def.id, i + 1, style))),
  );
  const largest = Math.max(...modelRows.flat().map((m) => Math.max(m.maxU - m.minU, m.maxV - m.minV)));

  // 1. Render 256x256 crisp transparent full-color isometric thumbnail (max level, variant 0, matching render-handbook.mjs)
  const thumbFile = path.join(thumbsDir, `${def.id}.webp`);
  const thumbRgba = rasterFacesToRgba(modelRows[0][maxLv - 1], Infinity, 256, 256, [0, 0, 0, 0], true);
  writeWebp(thumbRgba, 256, 256, thumbFile, 89);

  // 2. Render 5x4 level/style comparison sheet
  const sheetFile = path.join(sheetsDir, `${def.id}.webp`);
  const sheetBuf = Buffer.alloc(sw * sh * 4);
  for (let i = 0; i < sw * sh; i++) {
    sheetBuf[i * 4] = 248;
    sheetBuf[i * 4 + 1] = 246;
    sheetBuf[i * 4 + 2] = 237;
    sheetBuf[i * 4 + 3] = 255;
  }
  const cellCommonScale = largest > 0 ? (1.7 * (sCell - 8)) / largest : Infinity;
  for (let style = 0; style < 4; style++) {
    for (let lv = 1; lv <= 5; lv++) {
      const m = modelRows[style][Math.min(maxLv, lv) - 1];
      const tile = rasterFacesToRgba(m, cellCommonScale, sCell, sCell, [235, 237, 227, 255], true);
      const ox = sLeft + (lv - 1) * (sCell + sGap);
      const oy = sTop + style * (sCell + sGap);
      for (let y = 0; y < sCell; y++) {
        const dstY = oy + y;
        if (dstY < 0 || dstY >= sh) continue;
        const srcRow = y * sCell * 4;
        const dstRow = (dstY * sw + ox) * 4;
        const copyCols = Math.min(sCell, sw - ox);
        if (copyCols > 0) tile.copy(sheetBuf, dstRow, srcRow, srcRow + copyCols * 4);
      }
    }
  }
  writeWebp(sheetBuf, sw, sh, sheetFile, 74);
  rendered++;
}

// Rebuild catalog.json in exact ELEMENTS order, preserving every existing entry verbatim
const finalCatalog = ELEMENTS.map((def) => {
  const prev = existingById.get(def.id);
  if (prev && (christmasOnly ? !christmasIds.has(def.id) : !NEW_EXPANSION_BY_ID[def.id] && !BALANCED_EXPANSION_BY_ID[def.id])) return prev;
  const design = DESIGNS[def.id];
  const max = getMaxElementLevel(def.id);
  const partnerId = getGuidePartner(def.id);
  const partnerDef = ELEMENT_BY_ID[partnerId];
  const stats: Record<string, number> = {};
  const statKeys = [
    ["population", "popBase"],
    ["jobs", "jobs"],
    ["power", "power"],
    ["water", "water"],
    ["waste", "waste"],
    ["food", "food"],
    ["education", "education"],
    ["recreation", "recreation"],
    ["government", "government"],
    ["police", "police"],
    ["policeRadius", "policeRadius"],
    ["fireRadius", "fireRadius"],
    ["military", "military"],
    ["income", "income"],
    ["nuisanceRadius", "nuisanceRadius"],
  ] as const;
  for (const [outKey, defKey] of statKeys) {
    const val = def[defKey as keyof typeof def];
    if (typeof val === "number" && val !== 0) stats[outKey] = val;
  }
  return {
    id: def.id,
    name: def.name,
    category: def.category,
    categoryName: catLabel[def.category] ?? def.category,
    cost: def.cost,
    stage: def.stage,
    domain: def.domain,
    isStarter: Boolean(def.isStarter),
    ...(def.wealthThreshold ? { wealthThreshold: def.wealthThreshold } : {}),
    stats,
    description: def.description,
    usage: getGuideUsage(def.id, undefined, def.description),
    growth: design.growth,
    maxLevel: max,
    levels: Array.from({ length: Math.max(5, max) }, (_, i) => ({
      level: i + 1,
      name: max > 5 ? getElementLevelName(def, i + 1) : design.levels[i],
      dimensions: getStandardFootprintForLevel(def, Math.min(i + 1, max)),
      legacy: i >= max,
    })),
    styles: (designStyles[def.id] ?? ["Style A", "Style B", "Style C", "Style D"]).map((name, index) => ({
      index,
      name,
    })),
    partner: {
      id: partnerId,
      name: partnerDef?.name ?? partnerId,
    },
    image: `/handbook/catalog/${def.id}.webp`,
    thumbnail: `/handbook/catalog/thumbs/${def.id}.webp`,
  };
});

fs.writeFileSync(stylesPath, JSON.stringify(designStyles, null, 2) + "\n");
fs.writeFileSync(catalogPath, JSON.stringify(finalCatalog, null, 2) + "\n");
console.log(`Synced ${rendered} new elements (total catalog: ${finalCatalog.length})`);
