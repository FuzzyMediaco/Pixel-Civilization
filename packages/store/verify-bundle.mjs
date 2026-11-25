import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { storePage } from "./bundle-content.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const source = path.resolve(process.env.PIXEL_WEB_DIST || path.join(root, "dist"));
const archive = process.argv[2] && path.resolve(process.argv[2]);
if (!archive || !/\.(aab|apk)$/i.test(archive)) throw Error("Pass a Play AAB or Android APK path.");
const appBundle = /\.aab$/i.test(archive);
const assets = appBundle ? "base/assets" : "assets";
const jdk = process.env.JAVA_HOME;
const jar = jdk ? path.join(jdk,"bin",process.platform === "win32" ? "jar.exe" : "jar") : "jar";
const entries = new Set(execFileSync(jar,["tf",archive],{encoding:"utf8"}).trim().split(/\r?\n/));
const manifest = JSON.parse(await readFile(path.join(source,"offline-index.json"),"utf8"));
const expectedNative = appBundle ? ["BundleConfig.pb","base/manifest/AndroidManifest.xml","base/dex/classes.dex"] : ["AndroidManifest.xml","classes.dex"];
for (const entry of expectedNative) assert.ok(entries.has(entry),entry);
for (const entry of entries) {
  if (entry.startsWith("/") || entry.includes("\\") || entry.split("/").includes("..")) throw Error("Invalid archive entry");
}
const temporary = await mkdtemp(path.join(tmpdir(),"pixel-store-verification-"));
try {
  execFileSync(jar,["xf",archive,assets],{cwd:temporary});
  const folder = path.join(temporary,assets);
  const edition = JSON.parse(await readFile(path.join(folder,"store-edition.json"),"utf8"));
  assert.deepEqual(edition,{release:manifest.release,files:manifest.files.length});
  assert.deepEqual(await readFile(path.join(folder,"store-bridge.js")),await readFile(path.join(here,"bridge.js")));
  for (const file of manifest.files) {
    const bundled = await readFile(path.join(folder,file.path));
    if (file.path.endsWith(".html")) {
      const web = await readFile(path.join(source,file.path),"utf8");
      assert.equal(bundled.toString("utf8"),storePage(web),file.path);
    } else {
      assert.equal(createHash("sha256").update(bundled).digest("hex"),file.sha256,file.path);
    }
  }
  console.log(`${path.basename(archive)} matches all ${manifest.files.length} game files, reviewed HTML and native billing bridge for web edition ${edition.release}.`);
} finally {
  await rm(temporary,{recursive:true,force:true});
}
