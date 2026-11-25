import {createHash} from "node:crypto";
import {mkdir,mkdtemp,readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=fileURLToPath(new URL("../../",import.meta.url));
const source=path.resolve(process.argv[2] || "dist");
const gameCommit=process.argv[3] || null;
if(gameCommit && !/^[0-9a-f]{40}$/.test(gameCommit)) throw Error("Supply the complete game build commit.");
const raw=await readFile(path.join(source,"offline-index.json"));
const manifest=JSON.parse(raw);
const hash=bytes=>createHash("sha256").update(bytes).digest("hex");
if(manifest.format!==1 || !manifest.files.length || hash(JSON.stringify(manifest.files))!==manifest.release)
  throw Error("The source offline manifest is invalid.");
const tmp=path.join(root,".wrangler");
await mkdir(tmp,{recursive:true});
const staged=await mkdtemp(path.join(tmp,"device-review-"));
const assets=path.join(staged,"assets");
const extras=["device-review.html","device-review.mjs","device-review-build.json","period-orbit.mjs"];
for(const entry of manifest.files) {
  const parts=entry.path.split("/");
  if(parts.some(p=>!p || p==="." || p===".." || /[:\\]/.test(p)) || extras.includes(entry.path))
    throw Error("Invalid or conflicting release path: "+entry.path);
  const bytes=await readFile(path.join(source,...parts));
  if(bytes.length!==entry.size || hash(bytes)!==entry.sha256)throw Error("Release file differs from the index: "+entry.path);
  const dest=path.join(assets,...parts);
  await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,bytes);
}
await writeFile(path.join(assets,"offline-index.json"),raw);
const sw=await readFile(path.join(assets,"sw.js"),"utf8");
const edition=sw.match(/pixel-civ-shell-[a-f0-9]{16}/)?.[0];
if(!edition)throw Error("The game build has no production offline shell.");
for(const file of ["device-review.html","device-review.mjs"])
  await writeFile(path.join(assets,file),await readFile(new URL("./device/"+file,import.meta.url)));
await writeFile(path.join(assets,"period-orbit.mjs"),await readFile(new URL("./period-orbit.mjs",import.meta.url)));
await writeFile(path.join(assets,"device-review-build.json"),JSON.stringify({release:manifest.release,edition,gameCommit}));
await writeFile(path.join(staged,"preview.mjs"),await readFile(path.join(root,"worker","era-preview.mjs")));
const config={name:"pixel-civilization-device-review",main:"preview.mjs",compatibility_date:"2026-11-22",
  workers_dev:true,preview_urls:false,observability:{enabled:false},vars:{SOURCE_COMMIT:gameCommit||manifest.release},
  assets:{directory:"./assets",binding:"ASSETS",run_worker_first:["/api/*"]}};
await writeFile(path.join(staged,"wrangler.json"),JSON.stringify(config,null,2));
console.log(JSON.stringify({config:path.join(staged,"wrangler.json"),release:manifest.release,edition,files:manifest.files.length,gameCommit}));
