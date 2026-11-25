// Run after production-art.mjs, period-city-matrix.mjs and period-tours.mjs.
import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import assert from "node:assert/strict";
import {createCanvas,loadImage} from "@napi-rs/canvas";
import {PRODUCTION_ERAS,PERIODS} from "../../src/game/periods.ts";

const root=path.resolve("docs/review/period-production");
const art=path.join(root,"art"),cities=path.join(root,"cities");
const read=file=>JSON.parse(fs.readFileSync(file,"utf8"));
const entries=PRODUCTION_ERAS.map(era=>read(path.join(art,era,"coverage.json")));
const versions=new Set(entries.map(({sourceSha256})=>sourceSha256));
assert.equal(versions.size,1,"Rebuild outdated era sheets");
assert.match(entries[0].sourceSha256,/^[a-f0-9]{64}$/);
for(const row of entries){
  assert.equal(row.cells,6136);assert.equal(row.types,294);assert.equal(row.levels,1534);
  for(const field of ["empty","identicalVariants","identicalLevels"])assert.equal(row[field].length,0,row.era+" "+field);
}
const summary={sourceSha256:entries[0].sourceSha256,eras:entries.length,baseTypes:294,levelsPerEra:1534,
  reviewCells:entries.reduce((s,row)=>s+row.cells,0),empty:0,identicalVariantGroups:0,identicalAdjacentLevels:0,
  sheets:entries.reduce((s,row)=>s+row.pages.length,0)};
fs.writeFileSync(path.join(art,"coverage-summary.json"),JSON.stringify(summary,null,2)+"\n");
const copy=["# The ten era art packs","","[Compare fifty representative models](flagships.webp), inspect [fifty working facilities](working-civilization.webp), or select an era below. Each contact sheet shows six elements. For each element, columns progress from level one on the left, and rows show its four variants. Roads and bridges have as many as eleven levels. A bus stop has three.","",
  "All 61,360 catalog cells were built and rasterized through the game’s shared voxel model path. Every render has visible geometry. Within an era, the complete voxel signatures differ at every adjacent level and across all four variants of each level. The [machine-readable results](coverage-summary.json) record these checks. They measure coverage and exact duplicates. Judging visual recognition and gameplay clarity also requires the city views and human review.","",
  "The ten packs share the same 294 canonical IDs. Housing, civic halls, markets, stations and utilities use the period’s structural grammar. Boats, heavy machinery, animal pens and special-purpose structures keep their working pivots, routes and readable canonical features, with period materials, equipment and frontages. Default custom designs keep their own appearance.","","## Design revisions","","The [first comparison](initial-directions.webp) exposed repeated rectangular profiles and broad roof stripes. The [first revision](first-revision.webp) adds period courtyards, pylon gates, a working mill wheel, a stone loggia, signal equipment, glazed garden pods and patched cisterns. The [final comparison](flagships.webp) shows public entrances, parcel-scale trade fixtures and more exposed turf. A full street view also caught high-contrast paving seams and a modern-looking solar-panel face in the historical starter village. The final paving keeps a softer value range, and each period receives its own working solar collector. Full-catalog checks also caught duplicated adjacent shelter and stop levels. Waiting amenities and changes in roof and service levels resolve them.",""];
for(const row of entries){
  copy.push("## "+PERIODS[row.era].label,"","[Full per-era coverage]("+row.era+"/coverage.json) · [Matched city views](../cities/index.md) · [Freight, passenger and water operations](../operations/"+row.era+".webp)","","| Sheet | First element | Last element |","| --- | --- | --- |");
  row.pages.forEach((part,i)=>copy.push("| ["+(i+1)+"]("+row.era+"/"+part.file+") | "+part.first.replaceAll("_"," ")+" | "+part.last.replaceAll("_"," ")+" |"));
  copy.push("");
}
fs.writeFileSync(path.join(art,"index.md"),copy.join("\n").trimEnd()+"\n");

const captures=read(path.join(cities,"captures.json")),tours=read(path.join(cities,"tours.json"));
assert.equal(captures.length,66);assert.equal(tours.length,27);
const views=["street","district","crossing","dusk","skyline","silhouette"];
for(const view of views){
  const shots=captures.filter(row=>row.view===view);
  assert.equal(shots.length,11);
  assert.equal(new Set(shots.map(row=>createHash("sha256").update(fs.readFileSync(path.join(cities,row.file))).digest("hex"))).size,11,"Repeated rendered "+view);
  assert.equal(new Set(shots.map(({layout,camera,hour,stage,dimensions})=>JSON.stringify({layout,camera,hour,stage,dimensions}))).size,1);
}
const keys={};
for(const [shot,order] of [["street",[7,2,9,0,4,8,3,6,1,5]],["skyline",[3,6,1,5,8,4,9,2,7,0]]]){
  const board=createCanvas(1600,5*275),ctx=board.getContext("2d");ctx.fillStyle="#f6f3e9";ctx.fillRect(0,0,board.width,board.height);
  keys[shot]={};
  for(const [i,seed] of order.entries()){
    const id=PRODUCTION_ERAS[seed],letter=String.fromCharCode(65+i),img=await loadImage(path.join(cities,id,shot+".webp"));
    const x=i%2*800+8,y=Math.floor(i/2)*275+3,s=Math.min(780/img.width,249/img.height);
    ctx.font="bold 18px sans-serif";ctx.fillStyle="#243a32";ctx.fillText(letter,x,y+18);
    ctx.drawImage(img,x+(780-img.width*s)/2,y+22,img.width*s,img.height*s);keys[shot][letter]=id;
  }
  fs.writeFileSync(path.join(cities,"unlabeled-"+shot+".webp"),board.encodeSync("webp",94));
}
fs.writeFileSync(path.join(cities,"recognition-key.json"),JSON.stringify(keys,null,2)+"\n");
const guide=["# Matched island views","","The comparison uses one 15-site starter, one 93-site district and one 156-site skyline. Each of the ten production eras and Original renders the exact same named parcels, spans, rotations, levels and variants at the same stage, clock time, viewport and camera. See the [camera and layout receipts](captures.json) and [compiled renderer identifiers](render-build.json). The [tour receipts](tours.json) cover the additional 27 era-specific playable islands. Their local gardens, market sites and skyline accents make each tour distinct.","",
  "[Starter street](compare-street.webp) · [Market and service district](compare-district.webp) · [Shoreline crossing](compare-crossing.webp) · [Dusk](compare-dusk.webp) · [Mature skyline](compare-skyline.webp) · [Desaturated silhouette](compare-silhouette.webp)","",
  "| Era | Street | District | Crossing | Dusk | Skyline | Silhouette |","| --- | --- | --- | --- | --- | --- | --- |"];
for(const era of ["original",...PRODUCTION_ERAS])guide.push("| "+(era==="original"?"Original":PERIODS[era].label)+" | "+views.map(v=>"["+v+"]("+era+"/"+v+".webp)").join(" | ")+" |");
guide.push("","## Independent recognition exercise","","Give each of five reviewers the [street board](unlabeled-street.webp) and [skyline board](unlabeled-skyline.webp) independently. The orders differ. Ask them to name each era, then identify a home, market, utility, depot and landmark at normal gameplay zoom. Record the reviewed commit, device and responses before opening the [answer key](recognition-key.json). The design plan targets four correct reviewers out of five per view, plus four recognizable functions. Human ratings are pending.","","| Reviewer | Device and build | Street matches / 10 | Skyline matches / 10 | Functions / 5 | Confusing features |","| --- | --- | --- | --- | --- | --- |",...Array.from({length:5},(_,i)=>"| "+(i+1)+" | | | | | |"),"");
fs.writeFileSync(path.join(cities,"index.md"),guide.join("\n"));
console.log(summary);
