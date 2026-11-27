// Fingerprint every original, regional and nested signature builder used by the production render.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function productionArtSourceHash(root = process.cwd()) {
  const sources = [
    "src/game/voxelArchitect.ts",
    "src/game/voxelCore.ts",
    "src/game/critterModels.ts",
    "src/game/catalog.ts",
    "src/game/levelSpans.ts",
    "src/game/parcelGeometry.ts",
    "scripts/voxel-illustration.mjs",
    "scripts/review/parkedVoxels.ts",
    "scripts/review/production-art.mjs",
    "scripts/review/production-sources.mjs",
  ];
  function collect(dir) {
    for (const item of fs.readdirSync(path.join(root, dir), {
      withFileTypes: true,
    })) {
      const file = `${dir}/${item.name}`;
      if (item.isDirectory()) collect(file);
      else if (item.isFile() && item.name.endsWith(".ts")) sources.push(file);
    }
  }
  collect("src/game/designs");
  const hash = createHash("sha256");
  for (const file of sources.sort()) {
    hash.update(file).update("\0");
    hash
      .update(
        fs.readFileSync(path.join(root, file), "utf8").replaceAll("\r\n", "\n"),
      )
      .update("\0");
  }
  return hash.digest("hex");
}
