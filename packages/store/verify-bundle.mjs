import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { verifyStoreFolder } from "./verify-folder.mjs";

const archive = process.argv[2] && path.resolve(process.argv[2]);
if (!archive || !/\.(aab|apk)$/i.test(archive)) throw Error("Pass a Play AAB or Android APK path.");
const appBundle = /\.aab$/i.test(archive);
const assets = appBundle ? "base/assets" : "assets";
const jdk = process.env.JAVA_HOME;
const jar = jdk ? path.join(jdk,"bin",process.platform === "win32" ? "jar.exe" : "jar") : "jar";
const entries = new Set(execFileSync(jar,["tf",archive],{encoding:"utf8"}).trim().split(/\r?\n/));
const expectedNative = appBundle ? ["BundleConfig.pb","base/manifest/AndroidManifest.xml","base/dex/classes.dex"] : ["AndroidManifest.xml","classes.dex"];
for (const entry of expectedNative) assert.ok(entries.has(entry),entry);
for (const entry of entries) {
  if (entry.startsWith("/") || entry.includes("\\") || entry.split("/").includes("..")) throw Error("Invalid archive entry");
}
const temporary = await mkdtemp(path.join(tmpdir(),"pixel-store-verification-"));
try {
  execFileSync(jar,["xf",archive,assets],{cwd:temporary});
  const folder = path.join(temporary,assets);
  const edition = await verifyStoreFolder(folder);
  console.log(`${path.basename(archive)} matches all ${edition.files} game files, reviewed HTML and native billing bridge for web edition ${edition.release}.`);
} finally {
  await rm(temporary,{recursive:true,force:true});
}
