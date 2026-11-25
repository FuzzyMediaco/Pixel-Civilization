import fs from "node:fs";
import path from "node:path";
import {createCanvas} from "@napi-rs/canvas";
import "../../src/game/designs/index.ts";
import {loadEraArt} from "../../src/game/eraArtLoader.ts";
import {faces,raster,voxels} from "../voxel-illustration.mjs";
import {PRODUCTION_ERAS} from "../../src/game/designs/periodArtCatalog.ts";
import {ERA_LABELS} from "../../src/game/eraStyles.ts";
const dir=path.resolve(process.env.ERA_ART_OUTPUT || "docs/review/period-production/art");
fs.mkdirSync(dir,{recursive:true});
const plates=[
  {file:"flagships",sites:[["house",3],["grocery_store",3],["water_treatment_plant",3],["train_depots",3],["spaceport",5]]},
  {file:"working-civilization",sites:[["solar_panels",2],["farms",3],["aqueduct",3],["banks",4],["freeways",7]]},
];
for(const {file,sites} of plates){
  const canvas=createCanvas(930,176*PRODUCTION_ERAS.length),ctx=canvas.getContext("2d");
  ctx.fillStyle="#f4efe4";ctx.fillRect(0,0,canvas.width,canvas.height);
  for(const [row,era] of PRODUCTION_ERAS.entries()){
    await loadEraArt(era);const y=row*176;
    ctx.font="bold 15px sans-serif";ctx.fillStyle="#293d35";ctx.fillText(ERA_LABELS[era],10,y+18);
    for(const [i,[id,level]] of sites.entries()){
      const model=faces(voxels(id,level,2,undefined,[],{era,eraActivity:"active"}));
      ctx.drawImage(raster(model,Math.min(166/(model.maxU-model.minU),117/(model.maxV-model.minV)),182,true,127,true),i*186,y+23);
      ctx.font="13px sans-serif";ctx.fillStyle="#394c43";ctx.fillText(id.replaceAll("_"," "),i*186+10,y+166);
    }
  }
  fs.writeFileSync(path.join(dir,file+".webp"),canvas.encodeSync("webp",93));
}
