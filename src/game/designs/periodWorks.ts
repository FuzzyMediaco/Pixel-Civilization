import { type Ctx, archway } from "./kit";
import type { ArtFamily, Ink } from "./periodArtCatalog";
import { canopy, surfaceAt, wing } from "./periodMasonry";

/** Framing for the canonical engine, pier, animal pen or landmark core. Machinery and access keep their original positions. */
export function worksCourt(c:Ctx,p:Ink,family:ArtFamily,active:boolean) {
  const {v,lv,hx,hz,variant:s}=c;
  if(hx<11 || hz<11)return;
  const x=-hx+3,X=hx-3,z=-hz+3,Z=hz-3;
  const width=Math.min(13,Math.max(6,Math.floor(hx*.55)));
  const side=s%2===0?x:X-width;
  if(family==="farm"){
    if(c.id==="grazing_pasture"||c.id==="livestock_pen")return;
    const y=surfaceAt(v,side+1,z+1,80);
    if(y>4)return;
    if(p.era==="ancient-egypt"||p.era==="ancient-china"||p.era==="ancient-greece"||p.era==="rome-aqueduct"){
      v.box(side,Math.max(0,y-1),z,side+width,Math.max(1,y),z+2,p.rim);
      v.box(side,Math.max(0,y-1),z,side+width,Math.max(1,y),z+1,active?p.glass:p.floor);
      v.box(side,Math.max(1,y),z-1,side+1,y+4,z+2,p.frame);
      v.box(side-1,y+3,z,side+2,y+4,z+1,p.rim);
    }else if(p.era==="future-3027"||p.era==="art-deco"){
      for(let a=side;a<side+width;a+=4){
        v.box(a,Math.max(0,y-1),z,a+1,y+4,z+1,p.frame);
        v.box(a-1,y+4,z-1,a+2,y+5,z+2,p.glass,.13);
      }
    }else canopy(v,p,side,z,side+width,z+3,Math.max(3,y+3));
    return;
  }
  if(family==="power"||family==="workshop"){
    const y=surfaceAt(v,side+2,Z-3,125);
    if(y>4)return;
    const historic=["ancient-egypt","ancient-greece","ancient-china","medieval-europe","rome-aqueduct","renaissance-italy"].includes(p.era);
    if(historic){
      const h=5+lv;
      v.cylinderY(side+2.5,Z-3.5,y,h,2.4,p.wall);
      v.cylinderY(side+2.5,Z-3.5,h,h+1,2.6,p.rim);
      v.box(side+2,y+1,Z-2,side+4,y+3,Z-1,active?p.lamp:p.shade,active?.38:0);
      v.box(side+5,y,Z-4,side+8,y+2,Z-2,p.frame);
      for(let i=0;i<3;i++)v.cylinderY(side+5+i+.5,Z-3,y+2,y+3,.7,p.sign);
    }else{
      const h=5+lv;for(const a of [side,side+width-2]){
        v.box(a,y,Z-4,a+1,h,Z-3,p.frame);
        v.box(a-1,h-2,Z-4,a+2,h-1,Z-3,p.rim);
      }
      v.box(side,h,Z-4,side+width-1,h+1,Z-2,p.frame);
      if(p.era==="future-3027")v.box(side+1,h+1,Z-4,side+width-2,h+2,Z-3,p.sign,active?.38:0);
      if(p.era==="post-apocalyptic")v.box(side+1,h-2,Z-3,side+width-3,h,Z-2,p.cloth);
    }
    return;
  }
  if(family==="landmark"||family==="defense"){
    const a=surfaceAt(v,side,Z-3,140),b=surfaceAt(v,side+width-2,Z-3,140);
    if(a>5||b>5)return;
    const high=Math.max(5,lv+3),base=Math.max(1,a,b);
    if(p.era==="medieval-europe"||p.era==="ancient-egypt"){
      for(const end of [side,side+width-2]){
        v.box(end-1,base,Z-4,end+2,base+high,Z-1,p.wall);
        v.box(end-2,base+high-1,Z-5,end+3,base+high,Z,p.rim);
        if(p.era==="medieval-europe")v.put(end+1,base+high,Z-2,p.wall);
      }
    }else if(p.era==="ancient-china"||p.era==="ancient-greece"||p.era==="rome-aqueduct"||p.era==="renaissance-italy"){
      v.box(side,base,Z-4,side+width,base+high,Z-2,p.wall);
      archway(v,side+Math.floor(width/2),base,Z-4,Z-2,Math.max(3,width-3),high-1);
      v.box(side-1,base+high-1,Z-5,side+width+1,base+high,Z-1,p.rim);
      if(p.era==="ancient-china") for(const end of [side-1,side+width])v.put(end,base+high,Z-3,p.sign);
    }else{
      wing(v,p,{x:side,z:Z-5,X:side+width,Z:Z-2},base,base+high,false);
    }
  }
  if(family==="dock"){
    // Annotate the pier edge already built at this point; never build a platform into open water.
    const a=surfaceAt(v,side,Z-4,16),b=surfaceAt(v,side+width-2,Z-4,16);
    if(a<1||a>5||b<1||b>5)return;
    for(const end of [side,side+width-2]){
      v.box(end,a,Z-4,end+1,a+3+lv,Z-3,p.frame);
      v.box(end-1,a+3+lv,Z-4,end+2,a+4+lv,Z-3,p.rim);
      v.put(end,a+4+lv,Z-4,p.lamp,active?.32:.08);
    }
  }
}
