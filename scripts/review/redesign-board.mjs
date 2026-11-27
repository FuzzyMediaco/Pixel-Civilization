// Comparison boards for the illustrated-catalog redesign (docs/redesign).
//   node --import tsx scripts/review/redesign-board.mjs <board> <out.webp|png> [options]
// Boards
//   civic            rows = Original + ten eras, columns = ids (default: the five civic lookalikes)
//   matrix           rows = variants A–D, columns = levels for one id in one style
//   eras             rows = Original + ten eras, columns = variants A–D for one id at one level
// Options (key=value)
//   ids=a,b,c  id=public_library  era=original|<production era>  lv=3  variant=0  cell=150
//   look=color|gray|silhouette   eras=original,ancient-egypt   (limits rows)
// The raster is the same orthographic illustration the Handbook and production-art sheets use, and each
// row shares one scale so neighbouring sizes compare honestly.
import fs from "node:fs";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import "../../src/game/designs/index.ts";
import { ELEMENT_BY_ID, getMaxElementLevel } from "../../src/game/catalog.ts";
import { loadEraArt } from "../../src/game/eraArtLoader.ts";
import { PRODUCTION_ERAS } from "../../src/game/designs/periodArtCatalog.ts";
import { eraElementName, eraLevelName, eraElementSpec, ERA_LABELS } from "../../src/game/eraStyles.ts";
import { DESIGNS } from "../../src/game/designs/registry.ts";
import names from "../../src/game/designStyles.json" with { type: "json" };
import { BALANCED_EXPANSION_BY_ID } from "../../src/game/expansionBalancedCatalog.ts";
import { voxels, faces, raster } from "../voxel-illustration.mjs";

const [board = "civic", out = "board.png", ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => a.split("=")));
const CELL = Number(opt.cell ?? 150);
const look = opt.look ?? "color";
const lv = Number(opt.lv ?? 3);
const variant = Number(opt.variant ?? 0);
const styles = (opt.eras ? opt.eras.split(",") : ["original", ...PRODUCTION_ERAS]);
for (const era of styles) if (era !== "original") await loadEraArt(era);

const variantNames = (id, era) =>
  eraElementSpec(id, era)?.variants ?? names[id] ?? BALANCED_EXPANSION_BY_ID[id]?.styleNames ?? ["A", "B", "C", "D"];
const levelName = (id, level, era) =>
  era === "original" ? DESIGNS[id]?.levels?.[level - 1] ?? `L${level}` : eraLevelName(id, level, era);

/** rows: [{label, cells:[{id, lv, variant, era, caption}]}] */
let rows = [];
if (board === "civic") {
  const ids = (opt.ids ?? "public_library,post_offices,courthouses,city_offices,banks").split(",");
  rows = styles.map((era) => ({
    label: ERA_LABELS[era] ?? era,
    cells: ids.map((id) => ({ id, lv: Math.min(lv, getMaxElementLevel(id)), variant, era, caption: era === "original" ? ELEMENT_BY_ID[id].name : eraElementName(id, era) })),
  }));
} else if (board === "matrix") {
  const id = opt.id ?? "public_library", era = opt.era ?? "original";
  const levels = getMaxElementLevel(id);
  rows = [0, 1, 2, 3].map((s) => ({
    label: `${"ABCD"[s]} · ${variantNames(id, era)[s]}`,
    cells: Array.from({ length: levels }, (_, i) => ({ id, lv: i + 1, variant: s, era, caption: levelName(id, i + 1, era) })),
  }));
} else if (board === "eras") {
  const id = opt.id ?? "public_library";
  rows = styles.map((era) => ({
    label: ERA_LABELS[era] ?? era,
    cells: [0, 1, 2, 3].map((s) => ({ id, lv: Math.min(lv, getMaxElementLevel(id)), variant: s, era, caption: variantNames(id, era)[s] })),
  }));
} else throw new Error("unknown board " + board);

const labelW = 150, capH = 30, cols = Math.max(...rows.map((r) => r.cells.length));
const canvas = createCanvas(labelW + cols * CELL, rows.length * (CELL + capH) + 8);
const ctx = canvas.getContext("2d");
ctx.fillStyle = "#f6f2e7";
ctx.fillRect(0, 0, canvas.width, canvas.height);
for (const [r, row] of rows.entries()) {
  const meshes = row.cells.map((cell) => {
    const appearance = cell.era === "original" ? {} : { era: cell.era, eraActivity: "active" };
    return faces(voxels(cell.id, cell.lv, cell.variant, undefined, [], appearance));
  });
  // Shared scale within the row; the largest model fills its cell.
  const common = Math.min(...meshes.map((m) => Math.min((CELL - 10) / (m.maxU - m.minU), (CELL - 12) / (m.maxV - m.minV))));
  const y = 4 + r * (CELL + capH);
  ctx.fillStyle = "#273c34";
  ctx.font = "bold 13px sans-serif";
  wrap(ctx, row.label, 6, y + CELL / 2, labelW - 10, 15);
  for (const [c, m] of meshes.entries()) {
    const img = raster(m, common, CELL, false, CELL);
    const x = labelW + c * CELL;
    if (look !== "color") recolor(img, look);
    ctx.drawImage(img, x, y);
    ctx.fillStyle = "#273c34";
    ctx.font = "11px sans-serif";
    const cell = row.cells[c];
    ctx.fillText(`${cell.id} L${cell.lv} ${"ABCD"[cell.variant]}`.slice(0, 30), x + 4, y + CELL + 11);
    ctx.fillStyle = "#6b5a3a";
    ctx.fillText(String(cell.caption ?? "").slice(0, 28), x + 4, y + CELL + 24);
  }
}
function wrap(ctx, text, x, y, width, lh) {
  const words = String(text).split(" ");
  let line = "", yy = y;
  for (const w of words) {
    if (ctx.measureText(line + w).width > width && line) { ctx.fillText(line, x, yy); line = ""; yy += lh; }
    line += w + " ";
  }
  ctx.fillText(line, x, yy);
}
function recolor(img, mode) {
  const c = img.getContext("2d"), d = c.getImageData(0, 0, img.width, img.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const bg = p[i] === 0xeb && p[i + 1] === 0xed && p[i + 2] === 0xe3;
    if (mode === "silhouette") { const v = bg ? 235 : 40; p[i] = p[i + 1] = p[i + 2] = v; }
    else { const g = Math.round(0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]); p[i] = p[i + 1] = p[i + 2] = g; }
  }
  c.putImageData(d, 0, 0);
}
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, out.endsWith(".webp") ? canvas.encodeSync("webp", 86) : canvas.encodeSync("png"));
console.log("saved", out);
