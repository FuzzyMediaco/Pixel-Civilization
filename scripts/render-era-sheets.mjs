// Bake a deliberate production-era design into the same cells used by the Atlas and Build controls.
// node --import tsx scripts/render-era-sheets.mjs ancient-egypt [public_library,banks]
import fs from "node:fs";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import "../src/game/designs/index.ts";
import { ELEMENT_BY_ID, getMaxElementLevel } from "../src/game/catalog.ts";
import { currentProductionArt, loadEraArt } from "../src/game/eraArtLoader.ts";
import { ERA_SIGNATURE_NAMES } from "../src/game/eraNames/index.ts";
import { faces, raster, voxels } from "./voxel-illustration.mjs";

const [era, selection] = process.argv.slice(2);
if (!Object.hasOwn(ERA_SIGNATURE_NAMES, era)) throw Error("Supply a production era, for example ancient-egypt.");
await loadEraArt(era);
const registered = currentProductionArt(era)?.ink.signatures ?? {};
const ids = selection ? [...new Set(selection.split(","))] : Object.keys(registered).sort();
if (!ids.length) throw Error("No named signature models in " + era);
for (const id of ids) {
  if (!Object.hasOwn(registered, id) || !Object.hasOwn(ERA_SIGNATURE_NAMES[era], id) || !ELEMENT_BY_ID[id])
    throw Error("Missing catalog entry, signature or names for " + era + "/" + id);
}

const root = path.resolve(import.meta.dirname, "..");
const destination = path.join(root, "src/handbook/eraSheetArt", era);
fs.mkdirSync(destination, { recursive: true });
const cell = 96;
for (const id of ids) {
  const levels = getMaxElementLevel(id);
  const sheet = createCanvas(levels * cell, cell * 4);
  const ctx = sheet.getContext("2d");
  for (let variant = 0; variant < 4; variant++) {
    const meshes = Array.from({ length: levels }, (_, index) =>
      faces(voxels(id, index + 1, variant, undefined, [], { era })),
    );
    const scale = Math.min(
      ...meshes.map((m) => Math.min((cell - 10) / (m.maxU - m.minU), (cell - 12) / (m.maxV - m.minV))),
    );
    for (const [index, mesh] of meshes.entries()) {
      if (!mesh.count) throw Error("Empty model: " + [id, index + 1, variant].join("/"));
      ctx.drawImage(raster(mesh, scale, cell, true, cell, true), index * cell, variant * cell);
    }
  }
  const bytes = sheet.encodeSync("webp", 87);
  const filename = path.join(destination, "era-sheet-" + id + ".webp");
  const temp = filename + "." + process.pid;
  fs.writeFileSync(temp, bytes);
  fs.renameSync(temp, filename);
}
console.log("Baked " + ids.length + " sheets for " + era);
