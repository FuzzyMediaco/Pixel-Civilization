import {execFileSync} from "node:child_process";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const archive = process.argv[2];
if (!archive) throw Error("Pass a Google Play App Bundle path.");
const jdk = process.env.JAVA_HOME;
const jar = jdk ? path.join(jdk,"bin",process.platform==="win32"?"jar.exe":"jar") : "jar";
const entries = new Set(execFileSync(jar,["tf",archive],{encoding:"utf8"}).trim().split(/\r?\n/));
const manifest=JSON.parse(await readFile(path.join(root,"dist/offline-index.json"),"utf8"));
for(const name of ["BundleConfig.pb","base/manifest/AndroidManifest.xml","base/dex/classes.dex","base/assets/store-bridge.js",
                   ...manifest.files.map(f=>"base/assets/"+f.path)]) {
  if (!entries.has(name)) throw Error("App Bundle is missing " + name);
}
console.log(`App Bundle contains its native code, billing bridge and all ${manifest.files.length} files in web edition ${manifest.release}.`);
