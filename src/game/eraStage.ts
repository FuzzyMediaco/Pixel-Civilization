import * as THREE from "three";
import { productionPeriod } from "./periods";
import { STAGES } from "./catalog";
import { normalizeEra } from "./eraStyles";
import { PixelVox, buildVoxelGeometry, getPixelVoxelMaterial, TILE_SIZE } from "./voxelCore";

const phases = [
  ["First Hearth","A clay marker stands beside the selling court."],["River Hamlet","Limewash picks out the entrance stone."],
  ["Crossroads","A painted route stripe appears."],["Market Vicus","A second stripe marks trading rights."],
  ["Walled Village","Brick shoulders flank the post."],["Market Town","A raised plinth faces the street."],
  ["Civic Quarter","A banded column marks the public entrance."],["River Port","A bronze unloading mark faces the quay."],
  ["Municipium","A dressed capital completes the column."],["Bath District","A painted panel commemorates the baths."],
  ["Road Capital","An inscribed crossbeam joins two uprights."],["Chartered Colony","Bronze tips mark the new gate."],
  ["Provincial Seat","A long pennant hangs beneath the beam."],["City of Fountains","A stepped cornice shades the plaque."],
  ["Great Forum","Two civic pennants frame the public walk."],["Metropolitan Courts","A central tablet marks the district."],
  ["Imperial Port","An amber finial catches light at dusk."],["Imperial Capital","A pair of finials flank the inscription."],
  ["Seat of the Senate","A gilded crest crowns the district gate."],["Eternal City","A laurel crown stands above the pennants."],
] as const;
export function eraStageTreatment(value:unknown, stage:number) {
  const era=normalizeEra(value), level=Math.max(1,Math.min(20,Math.trunc(stage)||1));
  if (era === "original") return {era,level,name:STAGES[level-1].name,cue:STAGES[level-1].note};
  if (era === "rome-forum" || era === "rome-aqueduct") {
    const [name,cue] = phases[level-1]; return {era,level,name,cue};
  }
  const period=productionPeriod(era);
  const phasesOfMarker=["sets out the district’s first marker","frames the market entrance","marks the growing transit quarter","crowns the mature district gateway"];
  return {era,level,name:period.stages[level-1],cue:`The ${period.emblem} ${phasesOfMarker[Math.floor((level-1)/5)]}.`};
}
const geometries = new Map<string,THREE.BufferGeometry>();
/** Street furniture belongs to the district. It stays inside the parcel corner, clear of the centerline. */
export function drawStageMarker(group:THREE.Group, style:ReturnType<typeof eraStageTreatment>, xSpan:number, zSpan:number) {
  const {level,era}=style;
  if (era === "original") return;
  const key=era + ":" + level;
  let geometry=geometries.get(key);
  if (!geometry) {
    const period=productionPeriod(era);
    const [stone,metal,paint]=era==="rome-forum" ? ["#dbcda6","#987547","#a23e39"] : period.materials;
    const v=new PixelVox(level);
    v.box(-1,0,-1,1,1,1,stone);v.box(0,1,0,0,level<6?3:6,0,stone);
    if(level>=2)v.put(0,3,0,"#ede1bf");
    if(level>=3)v.put(0,2,1,paint);
    if(level>=4)v.put(0,1,1,paint);
    if(level>=5)v.box(-1,1,0,1,1,0,"#a26d54");
    if(level>=6)v.box(-2,0,-1,2,0,1,stone);
    if(level>=7)v.put(0,4,1,paint);
    if(level>=8)v.put(0,5,1,metal);
    if(level>=9)v.box(-1,6,0,1,6,0,stone);
    if(level>=10)v.box(-1,4,0,0,5,0,paint);
    if(level>=11){v.box(-3,0,0,-3,6,0,stone);v.box(-4,7,0,1,7,0,stone);}
    if(level>=12){v.put(-4,8,0,metal);v.put(1,8,0,metal);}
    if(level>=13)v.box(-2,3,0,-2,6,0,paint);
    if(level>=14)v.box(-4,8,-1,1,8,0,stone);
    if(level>=15)v.box(1,4,0,1,7,0,paint);
    if(level>=16)v.box(-2,6,1,0,7,1,metal);
    if(level>=17)v.put(-3,9,0,"#cca85c");
    if(level>=18)v.put(0,9,0,"#cca85c");
    if(level>=19)v.box(-2,9,0,-1,10,0,metal);
    if(level>=20){v.put(-3,11,0,"#879648");v.put(0,11,0,"#879648");}
    const top=level<6 ? 4 : level<11 ? 7 : 11;
    switch(period.emblem) {
      case "lantern": v.box(-2,top,0,2,top,0,metal);v.box(-2,top-2,0,-1,top-1,1,paint);v.put(2,top+1,0,metal);break;
      case "obelisk": v.box(-1,top-3,-1,1,top,1,stone);v.put(0,top+1,0,metal);break;
      case "lyre": for(const x of [-2,2])v.box(x,top-1,0,x,top+1,0,metal);v.box(-1,top-2,0,1,top-2,0,paint);break;
      case "pennon": v.box(0,top-2,0,0,top+2,0,metal);v.box(1,top,0,3,top+1,0,paint);break;
      case "dome": v.box(-2,top,-1,2,top,1,stone);v.box(-1,top+1,-1,1,top+1,1,paint);v.put(0,top+2,0,metal);break;
      case "signal": for(const y of [top-1,top+1])v.box(-2,y,0,1,y,0,paint);v.put(0,top+2,0,metal);break;
      case "fan": for(let x=-2;x<=2;x++)v.box(x,top-1,0,x,top+2-Math.abs(x),0,paint);break;
      case "orbit": for(const x of [-2,2])v.put(x,top+1,0,paint);v.box(-1,top,0,1,top,0,metal);v.box(-1,top+2,0,1,top+2,0,metal);break;
      case "windmill": for(const n of [-2,-1,1,2]){v.put(n,top+n,0,metal);v.put(n,top-n,0,paint);}break;
    }
    geometry=buildVoxelGeometry(v,.105);geometries.set(key,geometry);
  }
  const mesh=new THREE.Mesh(geometry,getPixelVoxelMaterial());
  mesh.position.set(xSpan*TILE_SIZE/2-.49,.08,zSpan*TILE_SIZE/2-.35);
  group.add(mesh);
}
