/** Produce the manifest used by installed Android and Windows copies to verify updates. */
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
export async function writeOfflineIndex(directory) {
  const entries = [];
  async function scan(relative) {
    for (const item of await readdir(path.join(directory, relative), { withFileTypes:true })) {
      const id = relative ? relative + "/" + item.name : item.name;
      if (item.isDirectory()) await scan(id);
      else if (item.isFile() && id !== "offline-index.json") {
        const bytes = await readFile(path.join(directory, id));
        entries.push({path:id, size:bytes.length, sha256:hash(bytes)});
      }
    }
  }
  await scan("");
  entries.sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  for (const required of ["index.html", "field-guide.html", "handbook.html"]) {
    if (!entries.some(e => e.path === required)) throw Error("Missing offline entry point: " + required);
  }
  const release = hash(JSON.stringify(entries));
  const generation = Number(process.env.SOURCE_DATE_EPOCH ?? Math.floor(Date.now()/1000));
  if (!Number.isSafeInteger(generation) || generation < 1) throw Error("Invalid offline release generation");
  const index = {format:1, release, generation, files:entries};
  await writeFile(path.join(directory,"offline-index.json"), JSON.stringify(index));
  return index;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const index = await writeOfflineIndex(path.resolve(process.argv[2] ?? "dist"));
  console.log("Offline edition " + index.release.slice(0,12) + " · " + index.files.length + " verified files");
}
