import { SKYLINE_STYLES } from "../skylineCatalog";
import type { CivElementDef } from "../catalog";
import { PixelVox, packVoxKey } from "../voxelCore";
import { type Ctx, hashStr, stairs } from "./kit";
import { type ArtFamily, type Ink, productionArtFamily } from "./periodArtCatalog";
import { canopy, frontage, surfaceAt, wing } from "./periodMasonry";
import { periodSolar } from "./periodSolar";
import { parcelFront } from "./periodFronts";
import { worksCourt } from "./periodWorks";
import { districtCraft } from "./periodDistricts";
import { periodFinish, pavePeriod } from "./periodMaterials";
export { pavePeriod } from "./periodMaterials";

const retained = new Set((
  "cheesesteak_restaurants retro_diner bowling_alley jazz_club coffee_roastery flower_shop neighborhood_pharmacy "+
  "atms blacksmiths gas_stations auto_dealership retro_arcade hardware_store indie_bookstore boutique_hotel "+
  "civic_observatory solar_spire_arcology open_pit_mine terraced_glasshouses freight_rail_terminal "+
  "district_heat_works regional_airport canal_boat_lift pumped_storage_station flying_car_depot "+
  "solar_canopy_orchard floodplain_park hanging_garden_arcology teleportation_depot materials_foundry "+
  "rainwater_cathedral skybridge_university ocean_habitat_ring fire_department police_precinct "+
  "windmills wind_turbines wind_farms tidal_turbine_array tidal_sluice hydro_electric_power_plants "+
  "data_centers").split(/\s+/));
const edge = (c:Ctx) => ({x:-c.hx+2,z:-c.hz+2,X:c.hx-2,Z:c.hz-2});
const isTransitStop = (id:string) => ["bus_stops","train_stops","tram_station","taxi_ranks"].includes(id);

function ground(c:Ctx,p:Ink) {
  const {v,hx,hz}=c;
  // A wheel rutted path and a threshold leave the rest of the parcel open to the underlying land.
  v.box(-2,0,0,2,1,hz,p.floor);
  const reach=Math.min(hx-2,2+Math.floor(hx*.35));
  v.box(-reach,0,-1,reach+1,1,Math.min(hz-1,4),p.floor);
  for(let x=-reach;x<=reach;x+=4)v.put(x,0,1,p.rim);
}

function residential(c:Ctx,p:Ink,family:ArtFamily) {
  const {v,lv,variant:s,hx,hz}=c,{x,z,X,Z}=edge(c),seed=hashStr(c.id);
  const high=family==="tower",dense=family==="apartment";
  const storeys=high?lv*2+2:dense?1+lv:1+Math.floor((lv-1)/2);
  const wallTop=2+storeys*p.storey+(dense||high?0:lv%2===0?2:0);
  const front=lv>=3 && hz>=14 ? Math.min(hz-7,3+Math.floor(lv/2)) : Math.min(Z-3,3);
  const cut=seed%3;
  ground(c,p);
  if(high){
    let y=1;
    const tiers=Math.min(5,2+Math.floor(lv/2));
    for(let tier=0;tier<tiers;tier++){
      const top=y+Math.floor(wallTop/tiers);
      const inset=Math.min(tier*2,Math.floor(hx*.36));
      wing(v,p,{x:x+inset+cut,z:z+inset,X:X-inset,Z:Z-inset-2},y,top,tier===tiers-1);
      y=top+1;
    }
  }else{
    const backWing=lv>=3 && hx>11;
    const left=dense && lv>2?x+1:x+cut;
    const terrace=p.era==="ancient-greece"||p.era==="future-3027";
    const base=terrace && lv>=2 ? 2+Math.floor(lv/2) : 1;
    if(base>1){v.box(left,1,z,X,base,front,p.rim);stairs(v,-2,2,1,front+1,Math.min(3,base-1),p.rim);}
    wing(v,p,{x:left,z,X:backWing?Math.max(5,Math.floor(X*.6)):X,Z:front},base,base+wallTop);
    if(backWing){
      wing(v,p,{x:X-7-cut,z:z+2,X,Z:Z-1},1,Math.max(6,wallTop-p.storey),false);
      if(lv>=4)wing(v,p,{x,z:front,X:Math.min(x+7,X-4),Z:Z-1},1,Math.max(6,wallTop-p.storey));
    }
    const yardX=Math.max(x+2,Math.min(X-3,(seed%2?1:-1)*Math.floor(hx*.3)));
    frontage(v,p,yardX,1,Math.min(Z-1,front+4),s,lv);
    if(lv>=3 && hz>8){
      for(let zz=z+2;zz<0;zz+=5)v.box(x,1,zz,x+2,2,zz+2,p.leaf);
    }
  }
  if(high)frontage(v,p,-hx+4,1,Z-1,s,lv);
}

type Goods = "grain"|"textile"|"books"|"metal"|"food"|"plants";
function merchandise(id:string):Goods {
  if(/clothing|shoe|thrift|department|furniture/.test(id))return "textile";
  if(/book|school|loft/.test(id))return "books";
  if(/smith|hardware|auto|tech/.test(id))return "metal";
  if(/flower|grower/.test(id))return "plants";
  if(/grocery|bakery|bar|restaurant|cafe|roast|diner/.test(id))return "food";
  return "grain";
}
function display(c:Ctx,p:Ink,x:number,z:number,goods:Goods,active:boolean) {
  const v=c.v;
  v.box(x,1,z,x+3,3,z+2,p.frame);
  if(goods==="textile"){
    v.box(x,3,z,x+3,4,z+2,p.cloth);v.box(x+2,3,z+1,x+3,5,z+2,p.sign);
  }else if(goods==="books"){
    for(let k=0;k<3;k++)v.box(x+k,3,z,x+k+1,4+(k%2),z+2,k%2?p.roof:p.sign);
  }else if(goods==="metal"){
    v.box(x,3,z,x+3,4,z+1,p.rim);v.put(x+1,4,z,p.frame);
  }else if(goods==="plants"){
    v.cylinderY(x+1,z+1,3,5,1.5,p.roof);v.sphere(x+1,5,z+1,1.6,1.5,1.4,p.leaf);
  }else if(active || c.id!=="grocery_store"){
    for(let k=0;k<2;k++)v.cylinderY(x+.5+k*1.5,z+.5,3,4+(k%2),.8,goods==="food"?p.cloth:p.sign);
  }
}
function market(c:Ctx,p:Ink,active:boolean) {
  const {v,lv,variant:s,hx}=c,{x,z,X,Z}=edge(c),seed=hashStr(c.id),goods=merchandise(c.id);
  ground(c,p);
  const depth=Math.min(Z-5,Math.max(z+4,1)),height=5+Math.min(5,lv)+(seed%3);
  if(lv>1||c.id!=="night_market")wing(v,p,{x:x+seed%2,z,X,Z:depth},1,height);
  const bays=Math.max(1,Math.min(lv+1,Math.floor((X-x)/5)));
  const pitch=(X-x)/bays;
  for(let b=0;b<bays;b++){
    const a=Math.round(x+b*pitch),B=Math.round(x+(b+1)*pitch);
    const front=Math.min(Z-1,depth+3+(b%2));
    canopy(v,p,a,depth,B-1,front,height-1+(b%2));
    display(c,p,a+1,front+1,goods,active);
  }
  if(lv>=3 && hx>12){
    wing(v,p,{x,z:depth+1,X:x+5,Z:Z-1},1,height+2);
    if(lv>=4)wing(v,p,{x:X-5,z:depth+1,X,Z:Z-1},1,height+3);
  }
  frontage(v,p,s%2===0?x+2:X-3,1,Z-1,s,lv);
}
function institution(c:Ctx,p:Ink,family:ArtFamily) {
  const {v,lv,variant:s,hx,hz}=c,{x,z,X,Z}=edge(c),seed=hashStr(c.id);
  ground(c,p);
  const large=hx>=14,centerWidth=large?Math.floor(hx*.62):hx-2;
  const front=Math.max(z+5,Math.min(Z-3,Math.floor(hz*.13)));
  const y=5+lv+Math.floor(p.storey*lv*.42)+(family==="faith"?3:seed%3);
  wing(v,p,{x:-centerWidth,z:z+1,X:centerWidth+1,Z:front},1,y,true);
  if(large){
    for(const a of [x,X-6]){
      const forward=family==="school" && lv>2?Z-3:front+3;
      wing(v,p,{x:a,z:z+(s%2),X:a+6,Z:Math.min(Z-1,forward)},1,Math.max(5,y-(seed%3+2)));
    }
    if(lv>=4 && family==="school")v.box(-4,0,front+2,5,1,Math.min(Z,front+8),p.leaf);
  }
  stairs(v,-2,3,1,front+1,Math.min(3,lv),p.rim);
  if(family==="faith"){
    const tx=large?x+3:Math.max(x+1,-2), tz=z+3;
    v.box(tx-1,1,tz-1,tx+2,y+4+lv,tz+2,p.wall);
    v.box(tx-2,y+3+lv,tz-2,tx+3,y+4+lv,tz+3,p.rim);
    v.put(tx,y+5+lv,tz,p.sign);
  }else if(family==="school"){
    v.box(x+1,1,Z-2,x+2,5,Z-1,p.frame);v.box(x,4,Z-2,x+4,6,Z-1,p.shade);
  }else{
    v.box(-2,Math.max(3,y-2),front,3,Math.max(4,y-1),front+1,p.sign);
  }
  frontage(v,p,Math.min(X-3,Math.max(x+2,Math.floor(hx*.42))),1,Z-1,s,lv);
}
function station(c:Ctx,p:Ink,active:boolean) {
  const {v,lv,variant:s,hx}=c,{x,z,X,Z}=edge(c);
  const small=isTransitStop(c.id),height=small?4+Math.min(lv,3):6+lv;
  const edgeZ=Z-2;
  v.box(x-1,0,edgeZ-1,X+1,1,Z+2,p.floor);
  v.box(x-1,1,edgeZ,X+1,2,edgeZ+1,p.rim);
  if(!small){
    wing(v,p,{x,z,X,Z:Math.min(0,edgeZ-3)},1,height,lv>=3);
    if(lv>=3 && hx>10)wing(v,p,{x,z:0,X:x+5,Z:edgeZ-1},1,height-1);
  }
  const reach=small?Math.min(5,Math.floor((X-x)/2)):hx-3;
  canopy(v,p,-reach,edgeZ-4,reach,edgeZ-1,height);
  v.box(-2,2,edgeZ-1,2,3,edgeZ,p.frame);
  if(active)for(let i=0;i<Math.min(3,lv+1);i++){
    v.box(-2+i*2,2,edgeZ,-1+i*2,4,edgeZ+1,i%2?p.cloth:p.sign);
    v.put(-2+i*2,4,edgeZ,"#bb9072");
  }
  if(small){
    if(lv>=4){
      const posts=Math.min(3,lv-3);
      for(let i=0;i<posts;i++){
        const a=Math.min(X-2,x+3+i*3);
        v.box(a,1,edgeZ-1,a+2,2,edgeZ,p.rim);v.put(a,2,edgeZ-1,p.frame);
      }
      v.box(X-1,1,edgeZ-3,X,lv+1,edgeZ-2,p.frame);
      v.put(X-1,lv+1,edgeZ-3,p.lamp,.28);
    }
    const a=x+s;
    v.box(a,1,edgeZ-2,a+1,4+s,edgeZ-1,p.frame);
    v.box(a,3+s,edgeZ-2,a+2,4+s,edgeZ-1,p.sign);
    if(s===1||s===3)v.box(-2,3,edgeZ-2,2,4,edgeZ-1,p.cloth);
  }else frontage(v,p,X-3,1,z+2,s,lv);
}

function waterWorks(c:Ctx,p:Ink,active:boolean) {
  const {v,lv,variant:s,hx,hz}=c,{x,z,X,Z}=edge(c);
  ground(c,p);
  const side=Math.min(-1,x+4+Math.floor(hx*.38)),centerZ=Math.floor(hz*.15);
  wing(v,p,{x,z,X:side+1,Z:Math.max(z+5,centerZ)},1,4+lv*2,lv>=4);
  const rimY=c.id==="water_towers"?5+lv*2:1+Math.floor(lv/2);
  const water=active?p.glass:p.floor;
  if(c.id==="water_towers"){
    for(const a of [0,3])for(const b of [-4,-1])v.box(a,1,b,a+1,rimY,b+1,p.frame);
    v.cylinderY(2,-2,rimY,rimY+4,3+Math.min(2,lv),p.wall);
    v.cylinderY(2,-2,rimY+4,rimY+5,3+Math.min(2,lv),water);
  }else{
    const count=lv>=3 && hz>10?2:1;
    const portion=(Z-z)/count;
    for(let i=0;i<count;i++){
      const a=Math.round(z+i*portion),b=Math.round(z+(i+1)*portion)-1;
      v.box(side+2,1,a,X,rimY+1,b,p.rim);
      v.box(side+3,rimY,a+1,X-1,rimY+1,b-1,water);
    }
  }
  v.box(-1,0,centerZ,2,1,hz,p.rim);
  v.box(0,0,centerZ,1,1,hz,water);
  frontage(v,p,x+2,1,Z-2,s,lv);
}
function landmark(c:Ctx,p:Ink,active:boolean) {
  const {v,hx,hz,lv,variant:s}=c,{x,z,X,Z}=edge(c);
  ground(c,p);
  const base=1+lv,half=Math.max(3,Math.floor(Math.min(hx,hz)*.58));
  for(let n=0;n<Math.min(4,lv);n++)v.box(-half-2+n,n,z+2+n,half+3-n,n+1,Math.min(Z,half+2-n),p.rim);
  const hall={x:-half,z:-half,X:half+1,Z:half+1};
  switch(p.era) {
    case "ancient-china":{
      const tiers=Math.min(5,2+lv);let y=base;
      for(let n=0;n<tiers;n++){const a=Math.max(3,half-n*2);wing(v,p,{x:-a,z:-a,X:a+1,Z:a+1},y,y+4+n,false);y+=5+n+Math.floor(a*.55);}
      break;
    }
    case "ancient-egypt":{
      const layers=Math.max(4,half+lv);
      for(let k=0;k<layers;k++){const a=Math.max(1,Math.floor(half*(1-k/layers)));v.box(-a,base+k,-a,a+1,base+k+1,a+1,k===layers-1?p.sign:k%4?p.wall:p.rim);}
      for(const a of [x+2,X-3]){v.box(a-1,1,Z-4,a+2,5+lv,Z-1,p.wall);v.put(a,5+lv,Z-3,p.sign);}break;
    }
    case "ancient-greece":{
      const roof=base+6+lv;
      for(const zz of [-half,half])for(let xx=-half;xx<=half;xx+=4)v.cylinderY(xx+.5,zz+.5,base,roof,1.2,p.rim);
      for(const xx of [-half,half])for(let zz=-half+4;zz<half;zz+=4)v.cylinderY(xx+.5,zz+.5,base,roof,1.2,p.rim);
      v.box(-half-1,roof,-half-1,half+2,roof+1,half+2,p.sign);
      for(let xx=-half-1;xx<=half+1;xx++){const y=roof+1+Math.floor((half+1-Math.abs(xx))*.48);v.box(xx,roof+1,-half-1,xx+1,y+1,half+2,p.rim);}
      break;
    }
    case "medieval-europe":
      wing(v,p,hall,base,base+7+lv*2,true);
      for(const xx of [-half,half-1])for(const zz of [-half,half-1]){
        const h=base+13+lv*3;v.cylinderY(xx+.5,zz+.5,base,h,3.5,p.wall);
        for(const d of [-1,1])v.box(xx+d,h,zz-1,xx+d+1,h+2,zz+2,p.rim);
      }break;
    case "world-war-ii":{
      wing(v,p,hall,base,base+4+lv,false);
      const h=base+Math.floor(half*.55)+18+lv*4;
      for(let y=base;y<h;y++){
        const d=Math.max(0,Math.round(half*.46*(1-(y-base)/(h-base))));for(const xx of [-d,d])for(const zz of [-d,d])v.put(xx,y,zz,p.frame);
        if(y%3===0)v.box(-d,y,-d,d+1,y+1,d+1,p.rim);
      }
      v.box(0,h,0,1,h+5,1,p.frame);v.put(0,h+5,0,p.lamp,.48);break;
    }
    case "future-3027":{
      const h=base+10+lv*3;
      for(const xx of [-half,half]){v.box(xx-1,base,-2,xx+2,h,2,p.frame);v.box(xx,base,-3,xx+1,h,-2,p.sign,.35);}
      const ring=new PixelVox();ring.ringZ(0,0,-1,2,half,Math.max(2,half-2),p.rim);
      c.addRotor({vox:ring,pivot:[0,h,0],axis:"y",speed:active?.21:0});
      v.box(-half,base+2,-2,half+1,base+5,3,p.wall);break;
    }
    case "post-apocalyptic":{
      for(const xx of [-half,half-1])v.box(xx,base,-3,xx+2,base+10+lv*2,1,p.frame);
      const y=base+6+lv;v.box(-half-1,y,-4,half+2,y+1,3,p.rim);
      wing(v,p,{x:-half+1,z:-3,X:half,Z:2},y+1,y+5,true);
      for(let k=-half;k<=half;k+=3)v.box(k,y+2,2,k+2,y+3,4,p.leaf);
      break;
    }
    case "art-deco":{
      let y=base;
      for(let n=0;n<3+Math.floor(lv/2);n++){
        const a=Math.max(2,half-n*2);wing(v,p,{x:-a,z:-a,X:a+1,Z:a+1},y,y+5+n,true);y+=5+n;
      }
      v.box(0,y,0,1,y+7,1,p.sign);break;
    }
    case "renaissance-italy":{
      const h=base+5+lv;
      wing(v,p,{x:-half,z:-Math.floor(half*.65),X:half+1,Z:Math.floor(half*.65)+1},base,h,false);
      const r=Math.max(4,Math.floor(half*.7));
      v.cylinderY(.5,.5,h,h+5,r,p.wall);
      for(let k=0;k<=r;k++){
        const radius=Math.max(1,r*Math.cos(k/r*Math.PI/2));
        v.cylinderY(.5,.5,h+5+k,h+6+k,radius,k%5===0?p.rim:p.roof);
      }
      v.cylinderY(.5,.5,h+6+r,h+9+r,2,p.rim);v.put(0,h+10+r,0,p.sign);
      break;
    }
    default: wing(v,p,hall,base,base+8+lv*2,true);break;
  }
  frontage(v,p,x+3,1,Z-2,s,lv);
}

/** Place the period workshop alongside an object whose original machinery, pivot or geography is its identity. */
function retainWorkingModel(c:Ctx,p:Ink,def:CivElementDef,family:ArtFamily,active:boolean,original:()=>void) {
  original(); const {v,variant:s,lv,hx,hz}=c;
  if(family==="road"||family==="bridge"||family==="track"){pavePeriod(v,p,s,lv);return;}
  periodFinish(v,p,SKYLINE_STYLES.has(def.id));for(const rotor of c.rotors)periodFinish(rotor.vox,p);
  worksCourt(c,p,family,active);
  const x=-hx+3,z=hz-3;
  if(family==="vessel"){
    // Use the actual deck at the selected station. Keep both bow and stern unobstructed.
    const section=Math.max(-hz+2,Math.min(hz-3,Math.round((s-1.5)*hz*.19)));
    const y=surfaceAt(v,0,section,96);
    if(def.id==="submarines"){
      v.box(-1,y,section-1,2,y+2,section+2,p.shade);
      v.box(0,y+2,section,1,y+3+s,section+1,p.frame);
      v.put(1,y+2+s,section,p.glass);return;
    }
    if(p.era==="future-3027"){v.box(-2,y,section-1,3,y+1,section+2,p.rim);v.put(0,y+1,section,p.sign,.3);}
    else if(p.era==="post-apocalyptic"||p.era==="world-war-ii"){
      v.box(0,y,section,1,y+2+lv,section+1,p.frame);v.box(-1,y+1+lv,section,2,y+2+lv,section+1,p.sign);
    }else {
      const mast=3+lv+s;v.box(0,y,section,1,y+mast,section+1,p.frame);
      for(let n=1;n<mast-1;n++)v.box(1,y+n,section,2+Math.floor((mast-n)*.4),y+n+1,section+1,p.cloth);
    }
    return;
  }
  if(family==="landscape"){
    // Water tiles never gain dry buildings. Changes belong on their existing terrain or banks.
    if(def.archetype==="water_tile"){
      for(let i=0;i<2+lv;i++){
        const a=-hx+1+(i*5+s*2)%Math.max(2,hx*2-2),b=-hz+1+(3*i+s)%Math.max(2,hz*2-2);
        const key=packVoxKey(a,0,b);if(v.v.has(key))v.put(a,0,b,i%2?p.glass:p.rim);
      }
    }else if(!c.worldSculpted){
      const y=surfaceAt(v,x,z,100);
      if(def.archetype==="tree_broadleaf" || def.archetype==="tree_conifer" || def.archetype==="shrub_flora"){
        for(let i=0;i<3+s;i++)v.put(x+i%3,y+Math.floor(i/3),z+i%2,i%2?p.leaf:p.sign);
      }else if(def.archetype==="alligator"||def.archetype==="tumbleweed"){
        v.put(x,y,z,p.leaf);v.put(x+1,y,z-1,p.floor);
      }else{
        v.box(x,y,z,x+1,y+2+(s%2),z+1,p.frame);
        v.box(x-1,y+2+(s%2),z,x+1+(s%3),y+3+(s%2),z+1,p.rim);
      }
    }
    return;
  }
  // Low yard, berth or corner annex. If a crane or main building already fills the site,
  // apply a compact trim to the face instead of growing a second building on its roof.
  const y=surfaceAt(v,x,z,128), lane=def.domain==="water"||def.domain==="coast_or_water";
  if(lane && y===0)return;
  if(y>5){
    v.box(x-1,y-1,z,x+2,y,z+1,p.rim);v.put(x,y,z,p.sign);
  }else if(family==="farm"){
    if(def.archetype==="barn_farmhouse" && hx>9)wing(v,p,{x:x-1,z:z-4,X:x+5,Z:z},Math.max(1,y),Math.max(6,y+3+lv));
    else frontage(v,p,x,Math.max(1,y),z,s,lv);
  }else if((family==="landmark"||family==="defense"||family==="dock"||family==="workshop") && hx>9 && hz>9){
    wing(v,p,{x:x-1,z:z-5,X:x+5+s%2,Z:z},Math.max(1,y),Math.max(7,y+3+lv),family==="landmark");
    v.put(x+1,Math.max(3,y+2),z,p.lamp,active?.52:.06);
  }else frontage(v,p,x,Math.max(1,y),z,s,lv);
}
function aqueduct(c:Ctx,p:Ink,wet:boolean) {
  const {v,hx,lv,variant:s}=c,top=6+lv*2;
  const spacing=4+s;
  for(let x=-hx;x<hx;x++){
    const k=(x+hx)%spacing,d=Math.min(k,spacing-k);
    const low=d===0?0:Math.max(2,top-2-Math.max(0,2-d));
    v.box(x,low,-2,x+1,top,2,p.wall);
    if(k===0)v.box(x,Math.floor(top/2),-3,x+1,Math.floor(top/2)+1,3,p.rim);
  }
  v.box(-hx,top,-2,hx,top+1,3,p.rim);
  v.box(-hx,top,-1,hx,top+1,2,wet?p.glass:p.floor);
  for(const z of [-2,2])v.box(-hx,top+1,z,hx,top+2,z+1,p.frame);
  v.box(-hx+2+s,top+2,-2,-hx+3+s,top+4,3,p.sign);
}
export function buildProduction(c:Ctx,p:Ink,def:CivElementDef,active:boolean,original:()=>void) {
  const family=productionArtFamily(def.id);
  if(!family){original();return;}
  if(def.archetype==="solar_array"){periodSolar(c,p,active);return;}
  if(retained.has(def.id) || SKYLINE_STYLES.has(def.id)){retainWorkingModel(c,p,def,family,active,original);return;}
  switch(family) {
    case "house":case "apartment":case "tower":residential(c,p,family);break;
    case "market":market(c,p,active);break;
    case "school":case "hall":case "faith":institution(c,p,family);break;
    case "station":station(c,p,active);break;
    case "water":waterWorks(c,p,active);break;
    case "aqueduct":aqueduct(c,p,active);break;
    case "landmark":
      if(def.id==="spaceport")landmark(c,p,active);
      else retainWorkingModel(c,p,def,family,active,original);
      break;
    default:retainWorkingModel(c,p,def,family,active,original);break;
  }
  districtCraft(c,p,family,active);
  parcelFront(c,p,family);
}
