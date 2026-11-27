import {type Ctx, type PixelVox} from "../../kit";
import {beam, oval, slab} from "../../sculpturalKit";
import {clerk, courtPath, ink, lantern, stairs, streetLamp, timberBay} from "./civicParts";

const dyes=["#3e716a","#aa5343","#d4ae69","#54788b"];
function scroll(v:PixelVox,x:number,y:number,z:number,side=0) {
  v.box(x,y,z,x+2,y+2,z+4,side%2?ink.inside:ink.paper);
  v.box(x-1,y+1,z+2,x+3,y+2,z+3,dyes[side%4]);
  v.put(x,y,z+3,ink.sill);
}
function saleCounter(v:PixelVox,x:number,y:number,z:number,wide:number) {
  v.box(x-wide,y,z,x+wide+1,y+2,z+2,ink.sill);
  for(let off=-wide+1;off<wide;off+=3) scroll(v,x+off,y+2,z-1,Math.abs(off)%4);
  v.box(x+wide-1,y+1,z+2,x+wide+1,y+3,z+3,ink.paper);
  v.put(x+wide,y+2,z+2,ink.cord);
}
function printStudio(c:Ctx) {
  const {v,lv,hx,hz}=c, z=-Math.floor(hz*.25), r=Math.min(hx-3,3+lv*2), sheets=2+lv;
  // A magnified carved woodblock leans towards the ink roller. Its underside shelters the book counter.
  for(let row=0;row<2+lv;row++) {
    const height=4+row, zz=z+2-row;
    v.box(-r,height,zz,r+1,height+2,zz+2,ink.sill);
    for(let i=-r+1;i<r;i+=3) {
      v.box(i,height+2,zz,i+2,height+3,zz+1,(i+row)%3?ink.bamboo:ink.paper);
      if((i+row)%2===0)v.put(i,height+3,zz,ink.sill);
    }
  }
  for(const x of [-r,r]) v.box(x,1,z-1-lv,x+1,5+lv,z-lv,ink.post);
  saleCounter(v,0,1,z+4,Math.min(5,r)); courtPath(c,0,z+5);
  if(lv>=2) { v.box(-r,5,z+4,-r+2,6,z+8,ink.bronze); clerk(v,-r+1,1,z+2); }
  if(lv>=3) {
    const line=-hz+4;
    beam(v,[-hx+3,6,line],[hx-3,6,line],ink.cord);
    for(let i=0;i<sheets;i++) {
      const x=Math.round(-hx+4+i*(2*hx-10)/(sheets-1));
      v.box(x,3,line,x+2,6,line+1,ink.paper); v.put(x,4,line,ink.sill);
    }
  }
  if(lv>=4) timberBay(v,-hx+5,hz-5,4,3,1,4);
  if(lv===5) { timberBay(v,hx-6,-hz+5,4,3,1,6); saleCounter(v,hx-6,2,-hz+7,2); }
}
function silkScroll(c:Ctx) {
  const {v,lv,hx,hz}=c, r=Math.min(hx-4,4+lv*2), z=-Math.floor(hz*.2);
  // Illustrated silk unrolls from two rollers in a standing S. Its lowest sweep is the market canopy.
  const steps=r*2;
  for(let i=0;i<=steps;i++) {
    const t=i/steps, x=i-r, zz=z+Math.round(Math.sin(t*2*Math.PI)*Math.min(hz*.3,2+lv));
    const h=4+Math.round((.5+.5*Math.cos(t*2*Math.PI))*(2+lv));
    for(let y=0;y<3+lv;y++) v.put(x,h+y,zz,y===0 || y===lv+2?ink.cord:(i+y*3)%7===2?dyes[3]:ink.paper);
    if(i===0 || i===steps || i===r) v.box(x,1,zz,x+2,h+lv+4,zz+2,ink.sill);
  }
  saleCounter(v,0,1,z+3,3);courtPath(c,0,z+4);
  if(lv>=2) { clerk(v,-r+1,1,z+1); scroll(v,r-2,1,z+1); }
  if(lv>=3) { timberBay(v,-hx+5,hz-5,4,3,1,3); saleCounter(v,-hx+5,2,hz-5,2); }
  if(lv>=4) timberBay(v,hx-5,-hz+6,4,5,1,5);
  if(lv===5) { timberBay(v,0,-hz+5,5,3,1,5); saleCounter(v,0,2,-hz+4,3); }
}
function revolvingShelf(c:Ctx) {
  const {v,hx,hz,lv}=c,x=-Math.floor(hx*.17),z=-Math.floor(hz*.20);
  const tiers=lv+1, r=Math.min(hx-3,4+lv);
  // Rotating octagonal bookcases have protruding corners and several open display levels.
  v.box(x-1,1,z-1,x+2,3+tiers*3,z+2,ink.post);
  for(let t=0;t<tiers;t++) {
    const rad=Math.max(3,r-Math.floor(t/2)),y=2+t*3,turn=t*.31;
    slab(v,oval(x,z,rad,rad*.78,8,turn),y,1,ink.sill);
    for(let k=0;k<4;k++) {
      const a=turn+k*Math.PI/2, xx=x+Math.round(Math.cos(a)*(rad-2)), zz=z+Math.round(Math.sin(a)*(rad-2)*.62);
      v.box(xx,y+1,zz,xx+2,y+3,zz+2,dyes[(k+t)%4]);
      v.put(xx,y+2,zz+2,ink.paper);
    }
  }
  courtPath(c,x,z+3);saleCounter(v,x,1,z+r,2);
  if(lv>=2) clerk(v,x+3,1,z+r);
  if(lv>=3) timberBay(v,hx-5,hz-5,4,3,1,4);
  if(lv>=4) { timberBay(v,-hx+6,-hz+5,4,3,1,5); lantern(v,-hx+6,4,-hz+3); }
  if(lv===5) { stairs(v,hx-7,1,2,6,5); timberBay(v,hx-7,-3,4,3,6,4); }
}
function paintedFolio(c:Ctx) {
  const {v,hx,hz,lv}=c, z=-Math.floor(hz*.25),panels=2+lv;
  // An inhabited folding screen opens around a street seller. Painted leaves face the service court.
  let x=-hx+3;
  for(let i=0;i<panels;i++) {
    const end=Math.round(-hx+3+(2*hx-7)*(i+1)/panels),high=6+lv+(i%3);
    const a=z+(i%2?3:0),b=z+(i%2?0:3);
    for(let y=2;y<=high;y++) {
      beam(v,[x,y,a],[end,y,b],y===2 || y===high?ink.cord:ink.bamboo);
    }
    const mid=Math.floor((x+end)/2);
    beam(v,[mid-1,3,a+2],[mid,high-2,b+1],dyes[(i+1)%4]);
    v.box(x,1,a,x+1,high+1,a+1,ink.sill);
    x=end;
  }
  saleCounter(v,0,1,z+6,Math.min(4,hx-3)); courtPath(c,0,z+6);
  if(lv>=2) { clerk(v,-3,1,z+4); scroll(v,3,1,z+2,1); }
  if(lv>=3) { timberBay(v,-hx+5,-hz+5,4,3,1,4); saleCounter(v,-hx+5,1,-hz+5,3); }
  if(lv>=4) timberBay(v,hx-5,hz-5,4,3,1,5);
  if(lv===5) { timberBay(v,hx-6,-hz+6,5,4,1,6); stairs(v,0,z+2,3,3,3); }
}
export function buildBookMarket(c:Ctx) {
  [printStudio,silkScroll,revolvingShelf,paintedFolio][c.variant](c);
  streetLamp(c.v,-c.hx+4,c.hz-3,4+Number(c.lv>=3));
}
