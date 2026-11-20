import {roadPortalWidth} from "./roadTopology";
import { ELEMENT_BY_ID } from "./catalog";
import { type Ctx } from "./designs/kit";
import { PixelVox, packVoxKey } from "./voxelCore";
import { type JoinKind, type LocalSide, type ParcelEdge, type ParcelPose } from "./parcelEdges";
import { getTerrainCell, type Material } from "./terrain";
import type { GameState } from "./simulation";

export interface ParcelAppearance {
  edges?: readonly ParcelEdge[];
  /** Local row-major tile materials, blank when the entire site uses default grass. */
  soils?: readonly Material[];
  lighting?: "auto" | "dark" | "lit";
}

export function getParcelSoils(state: GameState, el: ParcelPose): Material[] | undefined {
  const soils: Material[] = [];
  const {rotation: r, gx, gz, spanX, spanZ} = el;
  const w = r % 2 ? spanZ : spanX, h = r % 2 ? spanX : spanZ;
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
    const dx = [x, z, w - 1 - x, h - 1 - z][r];
    const dz = [z, w - 1 - x, h - 1 - z, x][r];
    soils.push(getTerrainCell(state, gx + dx, gz + dz).material);
  }
  return soils.some(m => m !== "grass") ? soils : undefined;
}

const turf = new Set<number>();
const fenceStyles = new Set<number>();
const probe = new PixelVox();
function addStyles(set: Set<number>, colors: string[]) {
  for (const color of colors) {
    probe.put(0,0,0,color);
    set.add(probe.v.get(packVoxKey(0,0,0))!);
  }
}
addStyles(turf, ["grass","grass2","grass3"]);
addStyles(fenceStyles, ["woodLight","wood","woodDark","oak","white","plaster","iron","steelDark","stone",
  "brick","brickDark","limestone","marble","granite","leaf","leafDark","leafLight","moss","olive","terracotta","cream"]);

function localPoint(c: Ctx, side: LocalSide, t: number, d: number): [number,number] {
  if (side === "front") return [-c.hx+t,c.hz-1-d];
  if (side === "back") return [-c.hx+t,-c.hz+d];
  if (side === "left") return [-c.hx+d,-c.hz+t];
  return [c.hx-1-d,-c.hz+t];
}

const soilColor: Record<Material, readonly [string,string]> = {
  grass: ["grass","grass2"], sand: ["sand","sandDark"], clay: ["#bd8866","#cc9673"],
  rock: ["#999994","#abab9e"], wetland: ["#82995e","#768c59"], snow: ["snow","#dbe5e5"],
};

const lane: Partial<Record<JoinKind, [number, number, string]>> = {
  drive: [roadPortalWidth.drive,6,"concreteDark"], walk:[3,5,"path"], garden:[3,5,"path2"], farm:[2,4,"soil"],
  freight:[roadPortalWidth.freight,5,"asphaltDark"], arcade:[9,4,"limestone"], cloister:[4,5,"limestone"],
  ceremonial:[5,5,"marbleShade"], dock:[5,3,"wood"], quay:[6,3,"granite"],
  transfer:[4,4,"path"], service:[3,4,"concreteDark"], beach:[5,3,"sand"], bus:[roadPortalWidth.bus,1,"concrete"],
};
const floraIds = new Set(["trees","pine_trees","redwood_trees","shrubs","plants","bushes","alligators","swamps","ponds","lakes"]);
const waterIds = new Set(["canals","rivers","wide_rivers","water_tile","lakes","ponds","swamps"]);

/** Modify only the part of a lot that actually touches the neighboring parcel. */
export function applyParcelAppearance(c: Ctx, opts: ParcelAppearance, siteX=c.spanX, siteZ=c.spanZ) {
  const v = c.v;
  // The complete current model is centered and scaled uniformly onto its saved plot.
  // Map painted cells and neighbor offsets through the same transform as its mesh.
  const fit=Math.min(1,siteX/c.spanX,siteZ/c.spanZ);
  if (opts.soils) {
    for (let z=-c.hz; z<c.hz; z++) for (let x=-c.hx; x<c.hx; x++) {
      const tileX=Math.floor(siteX/2+(x+.5)*fit/16);
      const tileZ=Math.floor(siteZ/2+(z+.5)*fit/16);
      const material = opts.soils[tileZ*siteX+tileX];
      if (!material || material === "grass") continue;
      const key = packVoxKey(x,0,z);
      if (turf.has(v.v.get(key)!)) {
        // Exposed lawn gives way to the actual sculpted island. Keep support under planted beds.
        if (v.v.has(packVoxKey(x,1,z))) v.put(x,0,z,soilColor[material][(x*3+z)&1]);
        else v.v.delete(key);
      }
    }
  }
  for (const edge of opts.edges ?? []) {
    const { side, slot, kind } = edge;
    if (kind==="rail" || kind==="road" || kind==="channel" || (kind==="walk" && ELEMENT_BY_ID[c.id]?.isNetwork && !edge.stairRise)) continue;
    const alongX=side==="front" || side==="back";
    const origin=(alongX ? c.hx : c.hz) + (slot*16-(alongX ? siteX : siteZ)*8)/fit;
    const at = (t:number,d:number) => localPoint(c,side,Math.floor(origin+(t+.5)/fit),d);
    // Several authored voxels can fit into one saved frontage pixel. Paint the
    // whole interval so a compressed driveway or fence remains continuous.
    const start=(t:number)=>Math.ceil(origin+t/fit-.5);
    const put = (t:number,d:number,y:number,col:string,em=0) => {
      for(let i=start(t);i<start(t+1);i++) {
        const [x,z]=localPoint(c,side,i,d); v.put(x,y,z,col,em);
      }
    };
    const unbuilt = (t:number,d:number) => {
      const [x,z]=at(t,d);
      return ![4,5,6].some(y=>v.v.has(packVoxKey(x,y,z)));
    };
    const clearFence = (t:number,d:number) => {
      for(let i=start(t);i<start(t+1);i++) {
        const [x,z]=localPoint(c,side,i,d);
        if ([4,5,6].some(y=>v.v.has(packVoxKey(x,y,z)))) continue;
        for (let y=1;y<=3;y++) {
          const k=packVoxKey(x,y,z);
          if (fenceStyles.has(v.v.get(k)!)) v.v.delete(k);
        }
      }
    };
    // Exterior walls and trees rise above the fence and survive this pass.
    if (["yard","garden","farm","cloister","party","orchard"].includes(kind)) {
      for (let t=0;t<16;t++) for (let d=0;d<3;d++) clearFence(t,d);
    }
    if (kind==="yard" || kind==="party") continue;
    if (c.id==="train_tracks" || (waterIds.has(c.id) && kind!=="beach")) continue;
    // The street mesh already lowered its own kerb and tapered into the lot.
    if(ELEMENT_BY_ID[c.id]?.isRoadNetwork && (kind==="drive" || kind==="freight" || kind==="bus")) continue;
    const strip=lane[kind];
    if (strip && !(c.id==="bus_stops" && kind==="drive")) {
      const [width,depth,paving]=strip, lo=Math.floor((16-width)/2);
      for (let t=lo;t<lo+width;t++) for (let d=0;d<depth;d++) {
        clearFence(t,d);
        if (unbuilt(t,d)) put(t,d,0,paving);
      }
    }
    if(kind==="walk" && edge.stairRise && edge.stairRise>0){
      const rise=Math.max(1,Math.round(edge.stairRise/.25));
      const run=Math.min(10,rise+2);
      for(let d=0;d<run;d++)for(let t=6;t<10;t++)if(unbuilt(t,d)){
        const high=Math.round(rise*(run-d)/run);
        for(let y=1;y<=high;y++)put(t,d,y,y===high?"limestone":"concreteDark");
      }
    }
    if(kind==="skywalk") {
      // A glazed enclosed landing meets its counterpart at the same occupied storey.
      const floor = 4 + c.lv * 2;
      const halfDepth = side==="front" || side==="back" ? c.hz : c.hx;
      let wall=0;
      while (wall < halfDepth) {
        const [x,z]=at(8,wall);
        if(v.v.has(packVoxKey(x,floor+1,z))) break;
        wall++;
      }
      if(wall===halfDepth) continue;
      for(let t=6;t<10;t++) for(let d=0;d<=wall;d++) {
        put(t,d,floor,"steelDark"); put(t,d,floor+4,"steel");
        if(t===6 || t===9) for(let y=floor+1;y<floor+4;y++) put(t,d,y,d%3 ? "glass" : "steelDark",d%3 ? 0.22:0);
      }
    } else if (kind==="garden" || kind==="orchard") {
      // Edible beds continue beyond the private gate, with fruit visible among the leaves.
      for (const t of [3,4,11,12]) for (let d=1;d<5;d++) if (unbuilt(t,d)) {
        put(t,d,0,"soilDark"); put(t,d,1,(t+d)%3 ? "leafDark" : "leaf");
        if ((t+d)%4===0) put(t,d,2,t<8 ? "orange" : "red");
      }
    } else if (kind==="farm") {
      for (let t=1;t<16;t++) for (let d=0;d<3;d++) if (unbuilt(t,d) && (t<6 || t>9)) {
        put(t,d,0,t%4<2 ? "soilDark" : "soil");
        if (c.id==="fields" && t%4===1) put(t,d,1,c.variant%2 ? "gold" : "leafLight");
      }
    } else if (kind==="cloister") {
      // The church keeps the common wall; the burial ground opens fully onto its gate.
      if(c.id!=="graveyards") for(let t=0;t<16;t++) if((t<6 || t>9) && unbuilt(t,0)) {
        put(t,0,1,"stone"); put(t,0,2,t===5||t===10 ? "limestone":"granite");
      }
    } else if (kind==="arcade") {
      for(const t of [3,12]) if (unbuilt(t,2)) {
        put(t,2,1,"granite"); put(t,2,2,"iron"); put(t,2,3,"warmGlow",1.1);
      }
    } else if (kind==="platform" && c.id==="train_stops") {
      for(let t=0;t<16;t++) put(t,0,2,t%4 ? "hazard":"goldDark");
    } else if (kind==="bus") {
      for(let t=2;t<14;t++) if(t%4!==0) put(t,0,0,c.id==="bus_stops" ? "goldDark" : "busYellow");
    } else if (kind==="irrigation" || kind==="intake" || kind==="power" || kind==="service" || kind==="heat") {
      const pipe=kind==="heat" ? "copper" : kind==="power" ? "steelDark" : "tealDark";
      for(let d=0;d<5;d++) if(unbuilt(8,d)) put(8,d,0,pipe);
      if(unbuilt(8,3)) { put(8,3,1,"silver"); put(8,3,2,kind==="heat" ? "red" : kind==="power" ? "amber" : "teal"); }
    } else if(kind==="dock" || kind==="quay") {
      for(const t of [4,11]) if(unbuilt(t,1)) { put(t,1,1,"iron"); put(t,1,2,"brass"); }
    } else if(kind==="habitat" || kind==="buffer") {
      if(!waterIds.has(c.id)) for(let t=1;t<15;t+=3) if(unbuilt(t,1)) {
        put(t,1,1,floraIds.has(c.id) ? "leafDark" : "olive");
        if (t%2) put(t,1,2,"leaf");
      }
    }
  }
}
