// node --import tsx scripts/review/production-art.mjs [era] [comma-separated element IDs]
// Complete catalog run renders every valid cell into labeled contact sheets and compares neighboring cells.
import fs from "node:fs";
import path from "node:path";
import {productionArtSourceHash} from "./production-sources.mjs";
import assert from "node:assert/strict";
import {createCanvas} from "@napi-rs/canvas";
import "../../src/game/designs/index.ts";
import {ELEMENT_BY_ID,getMaxElementLevel} from "../../src/game/catalog.ts";
import {loadEraArt} from "../../src/game/eraArtLoader.ts";
import {PRODUCTION_ART_IDS,PRODUCTION_ERAS,productionArtFamily} from "../../src/game/designs/periodArtCatalog.ts";
import {voxels} from "../voxel-illustration.mjs";
import {getVoxelStyleColor} from "../../src/game/voxelCore.ts";

const selected=process.argv[2]?[process.argv[2]]:PRODUCTION_ERAS;
const subset=process.argv[3]?.split(",");
const out=path.resolve(process.env.ERA_ART_OUTPUT || "docs/review/period-production/art");
const ids=subset || PRODUCTION_ART_IDS;
const cell=42,rowHeight=cell*4+24,rowsPerPage=6, maxLevels=Math.max(...ids.map(getMaxElementLevel));
const bg="#f6f2e7",rgb=new Map();
const sourceSha256 = productionArtSourceHash();
const color=(style,shade)=>{
  const index=style*4+shade;if(rgb.has(index))return rgb.get(index);
  const values=getVoxelStyleColor(style),light=[.71,1,.84][shade];
  const result=values.map(n=>Math.floor(Math.min(1,(n<=.0031308?n*12.92:1.055*n**(1/2.4)-.055)*light)*255));
  rgb.set(index,result);return result;
};
function drawCell(map,canvas){
  let loU=1e6,hiU=-1e6,loV=1e6,hiV=-1e6,h1=0,h2=0;
  for(const [k,s] of map){
    const x=((k>>>20)&1023)-512,y=((k>>>10)&1023)-512,z=(k&1023)-512;
    const u=x-z,v=(x+z)*.5-y;
    loU=Math.min(loU,u);hiU=Math.max(hiU,u);loV=Math.min(loV,v);hiV=Math.max(hiV,v);
    const t=Math.imul(k^Math.imul(s,2654435761),2246822519);
    h1=(h1+t)|0;h2^=Math.imul(t^(t>>>16),3266489917);
  }
  const scale=Math.min((cell-4)/(hiU-loU+2),(cell-4)/(hiV-loV+2)),offset=(cell-(hiU-loU)*scale)/2;
  const ctx=canvas.getContext("2d"),img=ctx.createImageData(cell,cell);
  const depth=new Int32Array(cell*cell).fill(-99999);
  const pixels=img.data;
  for(const [k,style] of map){
    const x=((k>>>20)&1023)-512,y=((k>>>10)&1023)-512,z=(k&1023)-512;
    const xx=Math.floor(offset+(x-z-loU)*scale), yy=Math.floor(2+((x+z)*.5-y-loV)*scale);
    const surface=!map.has(k+1024)?1:!map.has(k+1)?2:!map.has(k+1048576)?0:-1;
    if(surface<0)continue;
    const d=x+z+y*2, [r,g,b]=color(style,surface);
    const radius=Math.max(1,Math.ceil(scale));
    for(let py=Math.max(0,yy);py<Math.min(cell,yy+radius+1);py++){
      for(let px=Math.max(0,xx-radius+1);px<Math.min(cell,xx+radius);px++){
        const idx=py*cell+px;if(depth[idx]>d)continue;
        depth[idx]=d;pixels.set([r,g,b,255],idx*4);
      }
    }
  }
  ctx.putImageData(img,0,0);return map.size+"/"+(h1>>>0).toString(16)+"/"+(h2>>>0).toString(16);
}
function makeSheet(count){
  const canvas=createCanvas(maxLevels*cell+8,count*rowHeight),ctx=canvas.getContext("2d");
  ctx.fillStyle=bg;ctx.fillRect(0,0,canvas.width,canvas.height);return {canvas,ctx};
}
for(const era of selected){
  assert.ok(PRODUCTION_ERAS.includes(era),era);await loadEraArt(era);
  const dir=path.join(out,era);fs.mkdirSync(dir,{recursive:true});
  const report={era,sourceSha256,types:ids.length,levels:0,cells:0,empty:[],identicalVariants:[],identicalLevels:[],pages:[]};
  const thumb=createCanvas(cell,cell);
  for(let row=0;row<ids.length;){
    const rows=ids.slice(row,row+rowsPerPage),{canvas,ctx}=makeSheet(rows.length);
    for(const [within,id] of rows.entries()){
      assert.ok(productionArtFamily(id),id);const def=ELEMENT_BY_ID[id],levels=getMaxElementLevel(id),grid=[];
      ctx.font="bold 12px sans-serif";ctx.fillStyle="#273c34";ctx.fillText(def.name+" · "+id,4,within*rowHeight+14);
      for(let lv=1;lv<=levels;lv++){
        const column=[];grid.push(column);report.levels++;
        for(let s=0;s<4;s++){
          const map=voxels(id,lv,s,undefined,[],{era,eraActivity:"active"});
          if(!map.size)report.empty.push([id,lv,s]);
          column.push(drawCell(map,thumb));report.cells++;
          ctx.drawImage(thumb,4+(lv-1)*cell,within*rowHeight+19+s*cell);
        }
        if(new Set(column).size<4)report.identicalVariants.push([id,lv,column.map((k,i)=>column.indexOf(k)!==i?i+1:0).filter(Boolean)]);
        if(lv>1){for(let s=0;s<4;s++)if(column[s]===grid[lv-2][s])report.identicalLevels.push([id,lv,s+1]);}
      }
    }
    const file=String(1+Math.floor(row/rowsPerPage)).padStart(2,"0")+".webp";
    fs.writeFileSync(path.join(dir,file),canvas.encodeSync("webp",80));report.pages.push({file,first:rows[0],last:rows.at(-1)});
    row+=rows.length;if(row%60===0)console.log(era,row+"/"+ids.length,report.cells);
  }
  fs.writeFileSync(path.join(dir,"coverage.json"),JSON.stringify(report,null,2)+"\n");
  console.log(era,report.types,report.levels,report.cells,report.empty.length+" empty",report.identicalVariants.length+" repeated variant groups",report.identicalLevels.length+" repeated levels");
}
