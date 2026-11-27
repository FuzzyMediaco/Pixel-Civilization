import type { PixelVox } from "../kit";
import { beam } from "../sculpturalKit";

export const oak = "#634437", bark = "#463735", honey = "#AC754A", lime = "#E8D2AA", stone = "#A89B8B";
export const ash = "#756F70", chalk = "#D2C4AC", slate = "#465A68", tile = "#945A44", moss = "#778955";
export const gold = "#CDA858", glow = "#FFD58B", vellum = "#F1DFB0", oxblood = "#91485C", ink = "#383D45";

export function candle(v: PixelVox, x: number, y: number, z: number) {
  v.put(x,y,z,gold);
  v.put(x,y+1,z,glow,.8);
}

/** Scalloped slate or clay courses over the beam ends, with a timber gable left open at the front. */
export function gable(v: PixelVox, x0: number, z0: number, x1: number, z1: number, eave: number,
  rise: number, acrossX: boolean, color = slate) {
  const lo = acrossX ? x0 : z0, hi = acrossX ? x1 : z1;
  if (hi - lo < 2) return;
  const roof = (a: number) => eave + Math.round(rise * Math.max(0,1 - Math.abs((2*a + 1 - lo - hi)/(hi-lo-1))));
  for (let a=lo; a<hi; a++) {
    const h=roof(a), previous=roof(a<=lo+(hi-lo)/2 ? Math.max(lo,a-1) : Math.min(hi-1,a+1));
    const wash = a===lo || a===hi-1 ? bark : h===eave+rise ? honey : color;
    if(acrossX) v.box(a,previous,z0,a+1,h+1,z1,wash);
    else v.box(x0,previous,a,x1,h+1,a+1,wash);
    if(h>eave && a>lo && a<hi-1) {
      if(acrossX) v.box(a,eave,z0,a+1,h,z0+1,lime);
      else v.box(x0,eave,a,x0+1,h,a+1,lime);
    }
    if(h>eave+1 && (a-lo)%4===0){
      if(acrossX) v.box(a,eave,z1-1,a+1,h,z1,bark);
      else v.box(x1-1,eave,a,x1,h,a+1,bark);
    }
  }
}

export function timber(v: PixelVox, x0: number, z0: number, x1: number, z1: number, base: number, height: number, infill = lime) {
  if (x1-x0 < 2 || z1-z0 < 2) return;
  const top=base+height;
  v.hollowBox(x0,base,z0,x1,top,z1,infill);
  v.box(x0,base,z0,x1,base+1,z1,stone);
  v.box(x0,top-1,z0,x1,top,z1,oak);
  for(const x of [x0,x1-1]) for(const z of [z0,z1-1])
    v.box(x,base,z,x+1,top,z+1,oak);
  for(let x=x0+2; x<x1-2; x+=4){
    v.box(x,base+1,z1-1,x+1,top,z1,oak);
    v.put(x+1,base+2,z1-1,glow,.36);
    v.put(x+2,base+3,z1-1,oak);
  }
  for(let z=z0+2; z<z1-2; z+=4){
    v.box(x1-1,base+1,z,x1,top,z+1,oak);
    v.put(x1-1,base+2,z+1,glow,.3);
  }
}

export function turret(v: PixelVox, x: number, z: number, base: number, radius: number, height: number, color=slate) {
  v.cone(x+.5,base,base+height,z+.5,radius+.2,.45,color);
  v.put(x,base+height,z,gold);
}

export function stair(v: PixelVox, x: number, fromZ: number, width: number, count: number, base=1) {
  for(let i=0;i<count;i++)
    v.box(x-width,base,fromZ-i,x+width+1,base+i+1,fromZ-i+1,i%3===0?chalk:stone);
}

export function book(v: PixelVox, x: number, y: number, z: number, color = oxblood) {
  v.box(x-1,y,z-1,x+2,y+1,z+2,color);
  v.box(x-1,y+1,z-1,x+2,y+2,z+1,vellum);
  v.box(x,y+1,z-1,x+1,y+2,z+2,honey);
}

export function bell(v: PixelVox, x: number, y: number, z: number, radius: number) {
  v.cylinderY(x+.5,z+.5,y,y+1,radius+.4,gold);
  v.cylinderY(x+.5,z+.5,y+1,y+radius+1,Math.max(1,radius-.6),"#B08A48");
  v.put(x,y-1,z,oak);
  v.box(x,y+radius+1,z,x+1,y+radius+3,z+1,bark);
}

export function banner(v:PixelVox,x:number,y:number,z:number,height:number,color:string) {
  v.box(x,y,z,x+1,y+height,z+1,oak);
  v.box(x+1,y+height-3,z,x+4,y+height,z+1,color);
  v.put(x+1,y+height-4,z,color);
}

export function brace(v:PixelVox,x:number,z:number,dx:number,dy:number,dz:number,y:number) {
  beam(v,[x,y,z],[x+dx,y+dy,z+dz],oak);
}
