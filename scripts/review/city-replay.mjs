import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const source=path.resolve(process.env.PROFILE_SOURCE || ".");
const {stepSimulation,recomputeConnectivityAndMetrics}=await import(pathToFileURL(path.join(source,"src/game/simulation.ts")));
const data=JSON.parse(fs.readFileSync(process.env.PROFILE_FIXTURE,"utf8"));
let now=1800000000000,seed=0x5058474d;
Date.now=()=>now;
Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const marks=[];
function sample(tick){
  const sim=JSON.parse(JSON.stringify(data));
  for(const line of sim.mobility?.lines??[])delete line.version;
  marks.push({tick,hash:createHash("sha256").update(JSON.stringify(sim)).digest("hex")});
}
recomputeConnectivityAndMetrics(data);sample(0);
for(let i=1;i<=80;i++){
  now+=250;stepSimulation(data,.25,true);
  if(i%10===0)sample(i);
}
console.log(JSON.stringify({sites:data.elements.length,marks}));
