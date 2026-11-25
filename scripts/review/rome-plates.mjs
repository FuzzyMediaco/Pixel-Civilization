// node --import tsx scripts/review/rome-plates.mjs [full|pass-0|pass-1|pass-2]
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import "../../src/game/designs/index.ts";
import { getMaxElementLevel } from "../../src/game/catalog.ts";
import { ROME_PILOT_IDS, eraElementName } from "../../src/game/eraStyles.ts";
import { loadEraArt } from "../../src/game/eraArtLoader.ts";
import { faces, raster, voxels } from "../voxel-illustration.mjs";

const phase=process.argv[2] || "full";
const review=path.resolve("docs/review/rome-pilot");
const modelPath=path.resolve("public/handbook/era-pilot/models");
const cell=96;
const eras=["rome-forum","rome-aqueduct"];
const focus=["house","apartments","grocery_store","water_treatment_plant","train_stops","spaceport"];
await loadEraArt(eras[0]);
if (phase==="full") {
  let cells=0;
  for (const era of eras) {
    const dir=path.join(modelPath,era);
    fs.mkdirSync(dir,{recursive:true});
    for (const id of ROME_PILOT_IDS) {
      const count=getMaxElementLevel(id), sheet=createCanvas(cell*count,cell*4), ctx=sheet.getContext("2d");
      for(let variant=0;variant<4;variant++) {
        const meshes=Array.from({length:count},(_,i)=>faces(voxels(id,i+1,variant,undefined,[],{era})));
        // Fit the tallest tier once: scaling up must remain visible within a row.
        const scale=Math.min(...meshes.map(m=>Math.min((cell-10)/(m.maxU-m.minU),(cell-12)/(m.maxV-m.minV))));
        for(const [index,mesh] of meshes.entries()) {
          assert.ok(mesh.count>0, id+" has no voxels");
          ctx.drawImage(raster(mesh,scale,cell,true),index*cell,variant*cell);cells++;
        }
      }
      fs.writeFileSync(path.join(dir,id+".webp"),sheet.encodeSync("webp",85));
    }
  }
  console.log(cells+" cells generated across "+ROME_PILOT_IDS.length+" base IDs and two directions");
} else {
  assert.match(phase,/^pass-[012]$/);
  fs.mkdirSync(review,{recursive:true});
  const qc=createCanvas(860,94+4*162);
  const ctx=qc.getContext("2d");
  ctx.fillStyle="#fcf8ed";ctx.fillRect(0,0,qc.width,qc.height);
  ctx.font="bold 24px Arial";ctx.fillStyle="#26392d";ctx.fillText("Rome · same six parcels",18,31);
  ctx.font="13px Arial";ctx.fillText("Left to right: house, apartments, market, waterworks, passenger platform, observatory",18,56);
  for(let row=0;row<4;row++) {
    const era=eras[row>>1], level=row%2?4:1,variant=row%2?2:0;
    ctx.fillStyle="#26392d";ctx.font="bold 13px Arial";ctx.fillText((row<2?"Forum City":"Aqueduct City")+"   ·   level "+level+"   ·   variant "+(variant+1),18,87+row*162);
    for(let i=0;i<focus.length;i++) {
      const id=focus[i],mesh=faces(voxels(id,level,variant,undefined,[],{era}));
      ctx.drawImage(raster(mesh,Infinity,133,true,108),16+140*i,95+row*162);
      ctx.fillStyle="#26392d";ctx.font="11px Arial";ctx.fillText(eraElementName(id,era),17+140*i,220+row*162,132);
    }
  }
  fs.writeFileSync(path.join(review,phase+".webp"),qc.encodeSync("webp",91));
}
