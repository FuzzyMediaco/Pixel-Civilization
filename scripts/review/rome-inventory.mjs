// node --import tsx scripts/review/rome-inventory.mjs
import fs from "node:fs";
import path from "node:path";
import {ELEMENTS, STAGES, getMaxElementLevel, getStandardFootprintForLevel} from "../../src/game/catalog.ts";
import {eraElementSpec, ROME_PILOT_IDS} from "../../src/game/eraStyles.ts";
import {eraStageTreatment} from "../../src/game/eraStage.ts";
import "../../src/game/designs/index.ts";

const variants=[0,1,2,3];
const directions=["rome-forum","rome-aqueduct"];
const out=path.resolve("docs/review/rome-pilot/coverage.json");
const catalog=ELEMENTS.map(def=>{
  const max=getMaxElementLevel(def.id),spec=eraElementSpec(def.id,"rome-forum");
  const row={id:def.id,original:def.name,stage:def.stage,domain:def.domain,maxLevel:max,
    footprints:Array.from({length:max},(_,i)=>getStandardFootprintForLevel(def,i+1)),
    variantSlots:variants,implementation:spec?"pilot-model":"original-fallback"};
  if(spec) Object.assign(row,{
    family:spec.family,name:spec.name,levelNames:spec.levels,variantDesigns:spec.variants,activity:spec.activity,
    owner:"Rome art",review:"awaiting player review",
    evidence:directions.map(era=>"/handbook/era-pilot/models/"+era+"/"+def.id+".webp"),
  });
  return row;
});
const levels=catalog.reduce((n,row)=>n+row.maxLevel,0);
const authored=catalog.filter(r=>r.implementation==="pilot-model");
const pilotLevels=authored.reduce((n,row)=>n+row.maxLevel,0);
const stages=STAGES.map(stage=>({stage:stage.stage,original:stage.name, ...eraStageTreatment("rome-forum",stage.stage)}));
const output=[
  "{",
  '  "variantNumbering":"Stored variants use 0–3. Atlas presents them as 1–4.",',
  '  "customDesigns":"Player-authored designs keep their original presentation and are excluded from the base catalog totals.",',
  '  "summary":'+JSON.stringify({baseElements:catalog.length,levels,combinationsPerEra:levels*variants.length,customDesignsIncluded:0,stages:stages.length,pilotElements:ROME_PILOT_IDS.length,pilotLevels,authoredCombinationsPerDirection:pilotLevels*variants.length,directions})+',',
  '  "stages":[',stages.map(s=>"    "+JSON.stringify(s)).join(",\n"),'  ],',
  '  "catalog":[',catalog.map(row=>"    "+JSON.stringify(row)).join(",\n"),'  ]','}',
];
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,output.join("\n")+"\n");
console.log(JSON.parse(fs.readFileSync(out,"utf8")).summary);
