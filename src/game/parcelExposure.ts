import { getTerrainCell } from "./terrain";
import { ELEMENT_BY_ID } from "./catalog";
import type { GameState, PlacedElement } from "./simulation";

const treeHeight: Record<string,number> = { trees:1.6, pine_trees:2.1, redwood_trees:3.5 };
const towers = new Set(["skyscrapers","buildings","banks","apartments","apartment_buildings","condos","hanging_garden_arcology","skybridge_university"]);
const turbines = new Set(["wind_turbines","wind_farms","windmills"]);
function height(e: PlacedElement) {
  if (treeHeight[e.defId]) return treeHeight[e.defId] * (1 + e.level * 0.6);
  if(towers.has(e.defId)) return 3 + e.level * (e.defId==="skyscrapers" ? 5 : 2.3);
  if(turbines.has(e.defId)) return 2.5 + e.level * 1.6;
  const d=ELEMENT_BY_ID[e.defId];
  return !d || d.isNetwork || d.passiveNature ? 0 : 1 + e.level * 0.75;
}

/** The renderer's sun follows this east-to-west arc. Each generating tile gets its own shadow. */
export function generationExposure(kind: string, state: GameState, el: PlacedElement, occupancy: ReadonlyMap<string,PlacedElement>) {
  if(kind!=="solar" && kind!=="wind") return 1;
  const wind=kind==="wind", angle=((state.timeOfDay??12)-6)*Math.PI/12;
  if(!wind && Math.sin(angle)<=0) return 1;
  const sunX=Math.cos(angle)*125, sunZ=72, horizon=Math.hypot(sunX,sunZ);
  const dx=wind ? -0.89 : sunX/horizon, dz=wind ? -0.45 : sunZ/horizon;
  const rise=wind ? .18 : Math.max(18,Math.sin(angle)*135)/horizon;
  let exposure=0;
  for(let x=el.gx; x<el.gx+el.spanX; x++) for(let z=el.gz;z<el.gz+el.spanZ;z++) {
    const ground=getTerrainCell(state,x,z);
    const panel=ground.elevation+(wind ? height(el)*.72 : .65);
    let open=1;
    for(let distance=1;distance<=6;distance++) {
      const tx=Math.round(x+dx*distance),tz=Math.round(z+dz*distance);
      const neighbor=occupancy.get(tx+","+tz);
      if(neighbor?.id===el.id) continue;
      const terrain=getTerrainCell(state,tx,tz);
      const obstacle=terrain.elevation+(neighbor ? height(neighbor) : 0);
      if(obstacle<=panel+rise*distance*4) continue;
      open=wind ? .75 : .36;
      break;
    }
    if(wind && (ground.elevation>1.5 || ground.kind==="coast")) open*=1.1;
    exposure+=open;
  }
  return exposure/(el.spanX*el.spanZ);
}
