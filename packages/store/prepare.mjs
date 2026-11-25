// Prepare an immutable store edition from the production web build.
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { storePage } from "./bundle-content.mjs";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const source = path.resolve(process.env.PIXEL_WEB_DIST || path.join(root, "dist"));
const target = path.join(here, "generated", "web");
const manifest = JSON.parse(await readFile(path.join(source, "offline-index.json"), "utf8"));
if (!manifest.files?.length) throw Error("Build the web game first.");
// Copy only this edition's manifest. An older build may have different hashed chunks.
const {rm} = await import("node:fs/promises");
await rm(target, {recursive:true, force:true});
await mkdir(target, {recursive:true});
for (const {path:relative} of manifest.files) {
  if (relative.startsWith("/") || relative.includes("..") || relative.includes("\\")) throw Error("Invalid manifest path");
  const dest = path.join(target, relative);
  await mkdir(path.dirname(dest), {recursive:true});
  if (relative.endsWith(".html")) {
    const html = await readFile(path.join(source,relative),"utf8");
    await writeFile(dest,storePage(html));
  } else await cp(path.join(source, relative), dest);
}
const marketingVersion = (await readFile(path.join(root,"packages/version.txt"),"utf8")).trim();
if (!/^\d+\.\d+\.\d+$/.test(marketingVersion)) throw Error("Invalid native marketing version");
await writeFile(path.join(here,"generated/version.xcconfig"), "MARKETING_VERSION = " + marketingVersion + "\n");
await cp(path.join(here,"bridge.js"),path.join(target,"store-bridge.js"));
await writeFile(path.join(target,"store-edition.json"), JSON.stringify({release:manifest.release, files:manifest.files.length})+"\n");
console.log(`Prepared ${manifest.files.length} files from web edition ${manifest.release}.`);
