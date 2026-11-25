import { periodCabin } from "./periodTransit";
import { productionPeriod } from "./periods";
import type { EraKey } from "./eraStyles";
import { buildRailModel, isRollingStock } from "./railModels";
import { railBodies, parkedBodies, type RailBody } from "./railMovement";
import { lineColor } from "./railOperations";
import { cargoByCar } from "./railOperations";
import { solidVoxels } from "./designs/kit";
import * as THREE from "three";
import { PixelVox, buildVoxelGeometry, getPixelVoxelMaterial, TILE_SIZE } from "./voxelCore";
import type { GameState } from "./simulation";
import { getTerrainCell, surfaceTravelHeight } from "./terrain";
import { marine, type Point, type TravelNetwork } from "./travelNetwork";
import { getProjectActors } from "./projectOperations";

type ModelKind =
  | "ferry"
  | "freight"
  | "gondola"
  | "plane"
  | "airTaxi"
  | "teleport"
  | "rocket"
  | "engine"
  | "fireboat"
  | "volunteer"
  | "passenger"
  | "wake"
  | "bubbles";
type RoadMesh = (kind: "bus" | "taxi", seed: number, era?: EraKey) => THREE.BufferGeometry;
function model(kind: ModelKind) {
  const v = new PixelVox(51);
  const box = solidVoxels(v);
  if (kind === "wake" || kind === "bubbles") {
    // Stepped crests extend aft; a diving hull leaves a narrower trail of surface bubbles.
    for (let step = 0; step < 4; step++) {
      const width = kind === "wake" ? 2 + step * 2 : 1 + (step % 2);
      const z = -2 - 3 * step;
      for (const side of [-1, 1]) {
        box(side * width, 0, z, side * width, 0, z + (kind === "wake" ? 2 : 0),
          step % 2 === 0 ? "#a9e1d8" : "#81c7c3", 0.12);
      }
    }
    if (kind === "bubbles") box(0, 0, 4, 0, 1, 4, "#b7ddd6");
  } else if (["ferry", "freight", "gondola", "fireboat"].includes(kind)) {
    const wide = kind !== "gondola",
      length = wide ? 10 : 7,
      w = wide ? 3 : 1;
    for (let z = -length; z <= length; z++) {
      const beam = Math.max(0, Math.min(w, length - Math.abs(z)));
      box(-beam, 0, z, beam, 1, z, kind === "gondola" ? "#493325" : "#204354");
      box(-beam, 2, z, beam, 2, z, "#ba9460");
    }
    if (kind === "freight") {
      for (const z of [-5, 1]) box(-2, 3, z, 2, 5, z + 3, z < 0 ? "#b36240" : "#377878");
    }
    if (kind === "ferry" || kind === "fireboat") {
      box(-2, 3, -5, 2, 5, 4, kind === "ferry" ? "#e6d6a6" : "#ca4a3c");
      box(-2, 4, -4, 2, 5, 3, "#517a87", 0.28);
      box(-3, 6, -5, 3, 6, 4, "#faf1d9");
      box(0, 7, -3, 1, 8, -2, "#c65f40");
      v.put(0, 5, 5, "warmGlow", 0.8);
      if (kind === "fireboat") box(0, 5, 6, 0, 6, 9, "#afc5ba");
    }
    if (kind === "gondola") {
      box(0, 3, 6, 0, 4, 7, "#dac990");
      v.put(0, 4, -4, "#f4b987");
      box(1, 2, -5, 2, 2, -2, "#9d753c");
    }
  } else if (kind === "plane" || kind === "airTaxi") {
    const length = kind === "plane" ? 10 : 4;
    for (let z = -length; z <= length; z++) {
      const w = Math.min(2, length - Math.abs(z));
      box(-w, 1, z, w, 3, z, "#f6e9cf");
    }
    box(-1, 3, length - 4, 1, 4, length - 2, "#315a66");
    for (let x = -length; x <= length; x++) {
      const z = -Math.round(Math.abs(x) * 0.36);
      box(x, 2, z - 1, x, 2, z + 1, "#55999a");
    }
    box(0, 4, -length + 1, 0, 6, -length + 3, "#bd6440");
    box(-3, 3, -length + 1, 3, 3, -length + 2, "#276f78");
    if (kind === "airTaxi")
      for (const x of [-4, 4]) for (const z of [-3, 3]) box(x - 1, 4, z, x + 1, 4, z, "#b7eff1", 0.6);
  } else if (kind === "rocket") {
    for (let y = 0; y <= 16; y++) {
      const w = y > 12 ? Math.floor((17 - y) / 2) : 2;
      box(-w, y, -w, w, y, w, y < 3 || y > 13 ? "#a94f39" : "#f1e6d1");
    }
    for (const x of [-1, 1]) box(2 * x, 0, -1, 3 * x, 4, 1, "#be6b43");
    box(-1, -3, -1, 1, -1, 1, "#ffd77c", 1);
  } else if (kind === "engine") {
    box(-2, 1, -5, 2, 4, 5, "#b43d31");
    box(-2, 3, 2, 2, 4, 4, "#609299");
    box(-1, 5, -5, 1, 5, 0, "#beb6a0");
    for (const x of [-2, 2]) for (const z of [-3, 3]) box(x, 0, z - 1, x, 1, z, "#363832");
    v.put(0, 5, 3, "#79bce7", 1);
  } else {
    box(-1, 0, 0, 1, 1, 0, "#424d59");
    box(-1, 2, 0, 1, 4, 0, kind === "teleport" ? "#31c8c7" : kind === "volunteer" ? "#c65b3e" : "#517e77");
    box(0, 5, 0, 1, 6, 0, "#cd996e");
    if (kind === "teleport") for (const x of [-2, 2]) box(x, 3, -1, x, 4, 1, "#78efff", 1.4);
  }
  return buildVoxelGeometry(
    v,
    kind === "passenger" || kind === "volunteer" ? 0.095 : kind === "gondola" ? 0.16 : 0.2,
  );
}
export class MobilityVisuals {
  readonly root = new THREE.Group();
  private objects = new Map<string, THREE.Mesh>();
  private geometries = new Map<string, THREE.BufferGeometry>();
  private target = new THREE.Vector3();
  private used = new Set<string>();
  private trackMap?:TravelNetwork;
  private switches:{gx:number;gz:number;id:string}[]=[];
  constructor(
    scene: THREE.Scene,
    private road: RoadMesh,
  ) {
    scene.add(this.root);
  }
  private appearanceEra: EraKey = "original";
  setAppearanceEra(era: EraKey) { this.appearanceEra = era; }
  private draw(
    id: string,
    kind: string,
    source: string | undefined,
    x: number,
    y: number,
    z: number,
    angle: number,
    dt: number,
  ) {
    this.used.add(id);
    const era = this.appearanceEra;
    const key = era + "|" + kind;
    let mesh = this.objects.get(id);
    if (!mesh || mesh.userData.appearanceKey !== key) {
      if (mesh) this.root.remove(mesh);
      let geo = this.geometries.get(key);
      if (!geo) {
        geo = kind.startsWith("rolling:") ? buildRailModel(kind.slice(8)) : ["bus", "taxi"].includes(kind)
          ? this.road(kind as "bus" | "taxi", 1, era)
          : model(kind as ModelKind);
        if (era !== "original" && ((kind.startsWith("rolling:") && isRollingStock(kind.slice(8))) || ["ferry","freight","gondola"].includes(kind))) {
          const old = geo;
          geo = periodVehicle(old,kind,era);
          old.dispose();
        }
        this.geometries.set(key, geo);
      }
      mesh = new THREE.Mesh(geo, getPixelVoxelMaterial());
      mesh.userData.kind = kind;
      mesh.userData.appearanceKey = key;
      mesh.castShadow = true;
      this.root.add(mesh);
      this.objects.set(id, mesh);
      mesh.position.set(x, y, z);
      mesh.rotation.y = angle;
    }
    mesh.userData.elementId = source;
    this.target.set(x, y, z);
    if (mesh.position.distanceToSquared(this.target) > 120) mesh.position.copy(this.target);
    else mesh.position.lerp(this.target, 1 - Math.exp(-dt * 14));
    const delta = angle - mesh.rotation.y;
    mesh.rotation.y += Math.atan2(Math.sin(delta), Math.cos(delta)) * (1 - Math.exp(-dt * 16));
    return mesh;
  }
  private trail(id: string, source: string, x: number, z: number, height: number, heading: number,
    stern: number, submerged: boolean, dt: number, clock: number) {
    const offset = stern + Math.sin(clock * 2.5) * 0.09;
    const mesh = this.draw(id + "-wake", submerged ? "bubbles" : "wake", source,
      x - Math.sin(heading) * offset, height + 0.065, z - Math.cos(heading) * offset, heading, dt);
    mesh.castShadow = false;
    mesh.scale.setScalar(submerged ? 0.9 : 0.92 + 0.12 * Math.sin(clock * 2.5));
    return mesh;
  }
  update(s: GameState, dt: number, nav?: TravelNetwork) {
    this.used.clear();
    if(nav&&nav!==this.trackMap){
      this.trackMap=nav;this.switches=s.elements.filter(e=>nav.canUse(e.gx,e.gz,"rail")&&[[0,1],[0,-1],[1,0],[-1,0]].filter(([dx,dz])=>nav.canUse(e.gx+dx,e.gz+dz,"rail")).length>=3);
    }
    const railLines=s.mobility?.lines.filter(l=>l.mode==="rail"&&l.enabled)??[];
    for(const e of this.switches){
      const k=e.gx+","+e.gz,setting=s.railYard?.turnouts[k]??"auto",active=railLines.find(l=>l.rail?.reservation?.includes(k)),
        n=active?.path.findIndex(p=>p[0]===e.gx&&p[1]===e.gz)??-1,next=n>=0?active?.path[n+1]:undefined;
      const x=(e.gx+.5)*TILE_SIZE,z=(e.gz+.5)*TILE_SIZE,y=surfaceTravelHeight(s,e.gx,e.gz,"x",.5);
      const angle=setting==="east-west"?Math.PI/2:setting!=="auto"||!next?0:Math.atan2(next[0]-e.gx,next[1]-e.gz);
      this.draw("points-"+e.id,"rolling:points",e.id,x,y+.17,z,angle,dt);
      this.draw("signal-"+e.id,setting==="closed"||active?"rolling:signal-red":"rolling:signal-green",e.id,x+1.35,y,z+1.15,0,dt);
    }
    for (const l of s.mobility?.lines ?? []) {
      if (!l.position || !l.enabled) continue;
      const [fx, fz] = l.position,
        x = Math.round(fx),
        z = Math.round(fz),
        water = marine(l.mode);
      const axis = Math.abs(Math.sin(l.heading)) > 0.5 ? "x" : "z";
      const y = water
        ? (nav?.water.cell(x, z).waterLevel ?? getTerrainCell(s, x, z).waterLevel)
        : surfaceTravelHeight(s, x, z, axis, 0.5 + (axis === "x" ? fx - x : fz - z));
      const curb = water || l.mode === "rail" ? 0 : 0.38;
      const xx = (fx + 0.5) * TILE_SIZE - curb * Math.cos(l.heading),
        zz = (fz + 0.5) * TILE_SIZE + curb * Math.sin(l.heading);
      if(l.mode==="rail"){
        const bodies=railBodies(l),r=l.rail!,t=s.activePlaySec;
        if(r.contract)for(const id of [r.contract.pickup,r.contract.drop]){
          const site=nav?.byId.get(id);if(!site)continue;
          const fx=site.gx+site.spanX*.35,fz=site.gz+site.spanZ*.60;
          const yard=this.draw("loading-"+site.id,"rolling:loader-"+r.contract.type,site.id,fx*TILE_SIZE,getTerrainCell(s,site.gx,site.gz).elevation+.12,fz*TILE_SIZE,site.rotation*Math.PI/2,dt);
          if(l.at===id)yard.position.y+=Math.abs(Math.sin(t*2))*.035;
        }
        const loads=cargoByCar(r),colour=lineColor(l);
        const place=(p:RailBody,i:number,parkedY?:number)=>{
          const [gx,gz]=p.point,axis=Math.abs(Math.sin(p.heading))>.5?"x":"z",ix=Math.round(gx),iz=Math.round(gz);
          const y=parkedY??surfaceTravelHeight(s,ix,iz,axis,.5+(axis==="x"?gx-ix:gz-iz))+.1;
          const fullness=p.index>0?loads[p.index-1]??0:0;
          const kind="rolling:"+p.model+(fullness>=.8?"/full":fullness>0?"/partial":"")+"/"+colour;
          const flip=r.rearCab&&parkedY===undefined?Math.PI:0;
          const mesh=this.draw(i===0?l.id:l.id+"-car-"+i,kind,l.depot,(gx+.5)*TILE_SIZE,y,(gz+.5)*TILE_SIZE,p.heading+flip,dt);
          mesh.userData.serviceId=l.id;
          // A little sway while running; still at platforms and in the shed.
          mesh.rotation.z=parkedY===undefined&&(r.speed??0)>.2?Math.sin(t*7+i*1.7)*.012*(r.speed??0):0;
          return mesh;
        };
        if(l.at===l.depot&&!r.trail.length){
          const depot=nav?.byId.get(l.depot);
          if(depot){
            const slot=(s.mobility?.lines??[]).filter(o=>o.mode==="rail"&&o.depot===l.depot&&o.at===o.depot&&!o.rail?.trail.length).indexOf(l);
            const floor=getTerrainCell(s,depot.gx,depot.gz).elevation+.5;
            parkedBodies(depot,l,Math.max(0,slot)).forEach((p,i)=>place(p,i,floor));
          }
          continue;
        }
        for(const [i,p] of bodies.entries()){
          const mesh=place(p,i);
          if(p.model==="steam"&&!l.at&&!l.blocked){
            const phase=(t*(0.6+(r.speed??0)*.8))%1;
            const fx=Math.sin(p.heading)*(r.rearCab?-1:1),fz=Math.cos(p.heading)*(r.rearCab?-1:1);
            const puff=this.draw(l.id+"-steam","rolling:steam-puff",l.depot,mesh.position.x+fx*1.0,mesh.position.y+2.3+phase*1.1,mesh.position.z+fz*1.0,.2,dt);
            puff.scale.setScalar(.7+phase*.9);puff.castShadow=false;
          }
        }
        if(l.blocked||l.rail?.waitingSince!==undefined||l.at){
          const red=l.blocked||l.rail?.waitingSince!==undefined;
          const signal=this.draw(l.id+"-signal","rolling:signal-"+(red?"red":"green"),l.depot,xx+1.16,y+.02,zz,0,dt);signal.userData.serviceId=l.id;
        }
      }else this.draw(l.id, l.mode, l.depot, xx, y + 0.12, zz, l.heading, dt).userData.serviceId = l.id;
      if (water && l.path.length > 1 && l.dwell <= 0 && !l.blocked && !/waiting|following/i.test(l.status)) {
        this.trail(l.id, l.depot, xx, zz, y, l.heading, l.mode === "gondola" ? 1 : 1.85, false, dt, s.activePlaySec).userData.serviceId = l.id;
      }
      if (l.at && l.dwell > 0 && l.mode !== "freight" && l.rail?.service!=="freight") {
        const stop = s.elements.find((e) => e.id === l.at);
        if (!stop) continue;
        const cx = (stop.gx + stop.spanX * 0.5) * TILE_SIZE,
          cz = (stop.gz + stop.spanZ * 0.5) * TILE_SIZE;
        const n = Math.min(4, l.riders.reduce((m, r) => m + r.count, 0) + Number(l.delivered > 0));
        for (let i = 0; i < n; i++) {
          const t = (s.activePlaySec * 0.75 + i * 0.23) % 1;
          this.draw(
            l.id + "-rider" + i,
            "passenger",
            stop.id,
            cx + (xx - cx) * t + i * 0.18,
            y + 0.15 + Math.sin(t * 10) * 0.045,
            cz + (zz - cz) * t,
            l.heading,
            dt,
          );
        }
      }
    }
    for (const voyage of Object.values(s.mobility?.voyages ?? {})) {
      if (voyage.dwell > 0 || !voyage.path.length || !["Under way", "Submerged"].includes(voyage.status)) continue;
      const point = voyagePlacement(s, voyage.position, false, nav);
      this.trail(voyage.origin, voyage.origin, point.x, point.z, point.y, voyage.heading, 2.0,
        voyage.status === "Submerged", dt, s.activePlaySec);
    }
    for (const a of getProjectActors(s)) {
      const cell = getTerrainCell(s, Math.floor(a.gx), Math.floor(a.gz));
      const axis=Math.abs(Math.sin(a.heading))>.5?"x":"z";
      const y =
        a.kind === "fireboat"
          ? (nav?.water.cell(Math.floor(a.gx), Math.floor(a.gz)).waterLevel ?? cell.waterLevel)
          : a.kind === "engine"
            ? surfaceTravelHeight(
                s,
                Math.floor(a.gx),
                Math.floor(a.gz),
                axis,
                axis==="x"?a.gx-Math.floor(a.gx):a.gz-Math.floor(a.gz),
              )
            : Math.max(cell.elevation, cell.waterLevel);
      const mesh = this.draw(
        a.id,
        a.kind,
        a.siteId,
        a.gx * TILE_SIZE,
        y + a.height + 0.07,
        a.gz * TILE_SIZE,
        a.heading,
        dt,
      );
      if (a.kind === "teleport") mesh.scale.setScalar(0.7 + 0.35 * Math.sin(a.progress * Math.PI));
    }
    for (const [id, o] of this.objects)
      if (!this.used.has(id)) {
        this.root.remove(o);
        this.objects.delete(id);
      }
  }
  position(id: string): THREE.Vector3 | undefined {
    return this.objects.get(id)?.position;
  }
  dispose() {
    this.root.removeFromParent();
    for (const [kind, g] of this.geometries) if (!["bus", "rail", "taxi"].includes(kind)) g.dispose();
    this.geometries.clear();
    this.objects.clear();
  }
}
export function voyagePlacement(s: GameState, position: Point, submerged: boolean, nav?: TravelNetwork) {
  const x = Math.round(position[0]),
    z = Math.round(position[1]);
  const cell = nav?.water.cell(x, z) ?? getTerrainCell(s, x, z);
  return {
    x: (position[0] + 0.5) * TILE_SIZE,
    y: cell.waterLevel - (submerged ? Math.min(cell.depth * 0.42, 1.65) : 0),
    z: (position[1] + 0.5) * TILE_SIZE,
  };
}

// Match the original coupling pitch, ground contact and hull envelope so routes stay legible.
function periodVehicle(original:THREE.BufferGeometry, kind:string, era:EraKey) {
  original.computeBoundingBox();
  const bounds=original.boundingBox!, v=new PixelVox(17);
  const materials=productionPeriod(era).materials;
  const stone=era==="rome-forum" ? "#dfcc9e" : materials[0];
  const canopy=era==="rome-forum" ? "#ae4e46" : materials[2];
  const engine=/^rolling:(steam|diesel|electric|express|commuter)/.test(kind);
  const hull=kind === "ferry" || kind === "freight" || kind === "gondola";
  if (hull) {
    v.box(-2,0,-7,2,1,7,"#85583c");v.box(-1,1,-9,1,2,9,"#694630");
    for(const x of [-3,3])v.box(x,1,-6,x,2,6,"#bd9869");
  } else {
    v.box(-3,1,-8,3,2,8,"#9e714d");
    for(const x of [-3,3])for(const z of [-6,6])v.box(x,0,z-1,x,2,z+1,"#494941");
  }
  for(const x of [-2,2])for(const z of [-5,0,5])v.box(x,2,z,x,5,z,stone);
  for(const x of [-3,3]) {
    v.box(x,2,-6,x,2,6,stone);
    for(const z of [-5,0,5]) v.put(x,2,z,"#b28d4c");
  }
  if (engine) {
    v.box(-2,3,-7,2,5,-5,"#986443");v.box(-2,5,-7,2,5,-6,stone);
    v.box(-1,3,3,1,5,5,"#b98347");v.put(0,6,5,"#c5aa67");
  } else if (/freight|wagon|hopper|boxcar|container|tanker|livestock/.test(kind)) {
    for(const z of [-4,1,5])v.box(-1,2,z-1,1,4,z+1,"#bd8355");
  } else {
    v.box(-3,6,-6,3,6,6,canopy);v.box(-2,7,-6,2,7,6,canopy);
    for(const z of [-5,-1,3])v.box(-3,6,z,3,6,z,stone);
    for(const z of [-3,2])v.box(-2,3,z,2,3,z,"#a46c44");
  }
  periodCabin(v,era,hull,/freight|hopper|boxcar|tanker/.test(kind));
  const out=buildVoxelGeometry(v,.13);out.computeBoundingBox();
  const own=out.boundingBox!, a=own.getSize(new THREE.Vector3()), b=bounds.getSize(new THREE.Vector3());
  out.translate(-own.min.x,-own.min.y,-own.min.z);
  out.scale(b.x/a.x,b.y/a.y,b.z/a.z);out.translate(bounds.min.x,bounds.min.y,bounds.min.z);
  return out;
}
