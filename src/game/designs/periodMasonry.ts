import { type PixelVox, packVoxKey } from "../voxelCore";
import type { Ink } from "./periodArtCatalog";

type Rect = { x:number; z:number; X:number; Z:number };
const box = (v:PixelVox, r:Rect, a:number, b:number, col:string) => v.box(r.x,a,r.z,r.X,b,r.Z,col);
const mid = (a:number,b:number) => Math.floor((a+b-1)/2);

function pitch(v:PixelVox,p:Ink,r:Rect,top:number,steep:number,upturn=false) {
  const {x,z,X,Z}=r;
  for (let k=z-1;k<=Z;k++) {
    const depth=Math.min(k-z+1,Z-k);
    const y=top+Math.floor(depth*steep);
    v.box(x-1,y,k,X+1,y+1,k+1,depth===0?p.frame:p.roof);
    if(depth%3===0)for(let xx=x+2;xx<X;xx+=6)v.put(xx,y,k,p.era==="ancient-china"?p.glass:p.shade);
    if (upturn && depth<2) {
      for (const e of [x-1,X-1]) v.box(e,y+1,k,e+2,y+2,k+1,p.roof);
      for (const e of [x-1,X]) v.put(e,y+2,k,p.sign);
    }
    if (k>=z && k<Z && y>top) {
      for (const e of [x,X-1]) v.box(e,top,k,e+1,y,k+1,p.wall);
    }
  }
}
function drum(v:PixelVox,p:Ink,r:Rect,top:number,scale=1) {
  const cx=mid(r.x,r.X),cz=mid(r.z,r.Z),radius=Math.max(2,Math.min(9,(r.X-r.x)/2-1,(r.Z-r.z)/2-1)*scale);
  v.cylinderY(cx+.5,cz+.5,top,top+2,radius,p.rim);
  for(let h=0;h<=radius;h++){
    const ring=Math.max(.55,Math.sqrt(Math.max(0,radius**2-h**2)));
    v.cylinderY(cx+.5,cz+.5,top+2+h,top+3+h,ring,h%4===0?p.rim:p.roof);
  }
  v.box(cx,top+2+radius,cz,cx+1,top+6+radius,cz+1,p.sign);
}
function setbacks(v:PixelVox,p:Ink,r:Rect,top:number,steps:number) {
  for(let k=0;k<steps;k++) {
    const inset=1+k*2;
    if (r.X-r.x<=2*inset || r.Z-r.z<=2*inset) break;
    v.box(r.x+inset,top+k*2,r.z+inset,r.X-inset,top+k*2+2,r.Z-inset,k%2?p.rim:p.wall);
    v.box(r.x+inset,top+k*2+1,r.Z-inset-1,r.X-inset,top+k*2+2,r.Z-inset,p.sign);
  }
}
function flatParapet(v:PixelVox,p:Ink,r:Rect,top:number) {
  box(v,r,top,top+1,p.roof);
  for(const z of [r.z,r.Z-1])v.box(r.x,top+1,z,r.X,top+2,z+1,p.rim);
  for(const x of [r.x,r.X-1])v.box(x,top+1,r.z,x+1,top+2,r.Z,p.rim);
}

/** Period silhouettes share door orientation (+z) and clear the path ahead of the threshold. */
export function wing(v:PixelVox,p:Ink,r:Rect,base:number,top:number,ceremonial=false) {
  const {x,z,X,Z}=r, width=X-x,depth=Z-z;
  if(width<3 || depth<3 || top<=base)return;
  top=Math.floor(top);
  box(v,r,Math.max(0,base-1),base,p.shade);
  const cx=mid(x,X),cz=mid(z,Z);
  const floating=p.era==="future-3027" && top-base>=9;
  const wallBase=floating?base+3:base;
  if(floating) {
    v.box(cx-1,base,cz-1,cx+2,wallBase,cz+2,p.frame);
    v.box(x+1,wallBase-1,z+1,X-1,wallBase,Z-1,p.glass);
  }
  v.hollowBox(x,wallBase,z,X,top,Z,p.wall);
  for(let y=wallBase+2;y<top-1;y+=p.storey){
    for(let xx=x+1;xx<X-2;xx+=p.bay){
      const cols=p.era==="art-deco"||p.era==="future-3027"?p.bay-1:2;
      for(const zz of [z,Z-1])v.box(xx,y,zz,Math.min(xx+cols,X-1),Math.min(top,y+2),zz+1,p.glass);
      v.put(xx,y,Z-1,p.lamp,p.era==="world-war-ii"?.12:.32);
    }
    for(let zz=z+1;zz<Z-2;zz+=p.bay)for(const xx of [x,X-1]){
      v.box(xx,y,zz,xx+1,Math.min(y+2,top),Math.min(zz+2,Z-1),p.glass);
    }
    if(p.era==="renaissance-italy"||p.era==="art-deco"||p.era==="future-3027"){
      for(const zz of [z,Z-1])v.box(x,y-1,zz,X,y,zz+1,p.rim);
    }
  }
  v.box(cx,base,Z-1,Math.min(X,cx+2),Math.min(top,base+3),Z,p.shade);
  switch(p.era) {
    case "ancient-china":
      for(const xx of [x,X-1])for(const zz of [z,Z-1])v.box(xx,wallBase,zz,xx+1,top,zz+1,p.frame);
      v.box(x-1,top-1,z,X+1,top,Z,p.frame);pitch(v,p,r,top,.55,true);
      if(ceremonial && width>=11 && depth>=9) {
        const ridge={x:x+3,z:z+2,X:X-3,Z:Z-2};const y=top+Math.floor(depth*.22)+1;
        box(v,ridge,y,y+2,p.wall);pitch(v,p,ridge,y+2,.6,true);
      }
      break;
    case "ancient-egypt":
      flatParapet(v,p,r,top);
      if(ceremonial){
        const w=Math.max(2,Math.floor(width/4));
        for(const xx of [x,X-w])for(let k=0;k<3;k++) v.box(xx+k*.4,base+k*3,Z-2,xx+w-k*.4,base+(k+1)*3,Z+1-k*.4,k===2?p.sign:p.wall);
      }else{
        v.box(x+1,top+1,z+1,Math.min(x+4,X-1),top+3,Math.min(z+3,Z-1),p.wall);
      }
      break;
    case "rome-aqueduct":
      pitch(v,p,r,top,.52);
      for(let xx=x+1;xx<X-2;xx+=5){
        v.box(xx,base,Z,xx+1,Math.min(top,base+5),Z+1,p.rim);
        if(xx+2<X)v.put(xx+1,Math.min(top-1,base+4),Z,p.rim);
      }
      break;
    case "ancient-greece":
      pitch(v,p,r,top,.27);
      for(let xx=x;xx<X;xx+=Math.max(3,Math.floor(width/4))) {
        v.box(xx,base,Z,xx+1,top,Z+1,p.rim);v.box(xx-1,top-1,Z,xx+2,top,Z+1,p.wall);
      }
      v.box(x-1,top,Z,X+1,top+1,Z+1,p.sign);
      break;
    case "medieval-europe":
      for(let xx=x;xx<X;xx+=4){
        v.box(xx,base,Z-1,xx+1,top,Z,p.frame);
        for(let y=base+1;y<top-1;y++)v.put(Math.min(X-1,xx+(y-base)%4),y,Z-1,p.frame);
      }
      v.box(x,top-2,z,X,top-1,Z,p.frame);pitch(v,p,r,top,.96);
      v.box(x,top,cz,x+2,top+Math.floor(depth*.45)+3,cz+2,p.shade);
      break;
    case "renaissance-italy":
      v.box(x-1,top-1,z-1,X+1,top,Z+1,p.rim);
      if(ceremonial)drum(v,p,r,top);else pitch(v,p,r,top,.4);
      break;
    case "world-war-ii":
      if(ceremonial){
        for(let xx=x;xx<X;xx++){
          const yy=top+(xx-x)%4;v.box(xx,top,z,xx+1,yy+1,Z,(xx-x)%4===3?p.glass:p.roof);
        }
      }else{
        pitch(v,p,r,top,.43);v.box(x+1,top,cz,x+3,top+Math.floor(depth*.2)+3,cz+2,p.wall);
      }
      break;
    case "art-deco":
      flatParapet(v,p,r,top);setbacks(v,p,r,top+1,ceremonial?5:3);
      for(const xx of [cx-1,cx+1])v.box(xx,base+2,Z-1,xx+1,top+3,Z,p.rim);
      break;
    case "future-3027":
      v.box(x-1,top-1,z,X+1,top,Z,p.frame);
      v.box(x,top,z-1,X,top+1,Z+1,p.rim);
      v.box(x+1,top+1,z+1,X-1,top+2,Z-1,p.leaf);
      for(const xx of [x,X-1])v.box(xx,wallBase,z,xx+1,top+2,z+1,p.sign);
      if(ceremonial)v.box(cx-1,top+1,cz,cx+1,top+6,cz+1,p.glass,.36);
      break;
    case "post-apocalyptic":
      for(let xx=x-1;xx<=X;xx++){
        const yy=top+Math.floor((xx-x+1)/4);
        v.box(xx,yy,z-1,xx+1,yy+1,Z+1,(xx-x+4)%5<2?p.frame:p.roof);
        if(xx>=x && xx<X)v.box(xx,top,z,xx+1,Math.max(top+1,yy),z+1,p.wall);
      }
      v.box(x,base,Z-1,x+1,top+1,Z,p.frame);
      v.box(X-3,top,Z-3,X-1,top+2,Z-1,p.leaf);
      break;
  }
}

export function canopy(v:PixelVox,p:Ink,x:number,z:number,X:number,Z:number,y:number) {
  if(X-x<3||Z-z<2)return;
  for(const xx of [x,X-1])for(const zz of [z,Z-1])v.box(xx,1,zz,xx+1,y,zz+1,p.frame);
  for(let xx=x-1;xx<=X;xx++){
    const lift=p.era==="ancient-china" && (xx<=x || xx>=X-1)?1:p.era==="post-apocalyptic"?Math.floor((xx-x+1)/5):0;
    v.box(xx,y+lift,z-1,xx+1,y+lift+1,Z+1,(xx-x+4)%4<2?p.cloth:p.rim);
  }
}

/** Four readable additions, reused at parcel scale on the appropriate service side. */
export function frontage(v:PixelVox,p:Ink,x:number,y:number,z:number,s:number,level:number) {
  if(s===0){
    for(const px of [x-2,x+2])v.box(px,y,z,px+1,y+4,z+1,p.frame);
    v.box(x-2,y+3,z,x+3,y+4,z+1,p.rim);
    v.put(x,y+4,z,p.sign);v.put(x+2,y+2,z,p.lamp,.36);
  }else if(s===1){
    const rise=3+Math.min(2,Math.floor(level/2));
    for(const px of [x-2,x+2])v.box(px,y,z,px+1,y+rise,z+1,p.frame);
    v.box(x-2,y+rise,z-1,x+3,y+rise+1,z+2,p.cloth);
    v.box(x-2,y+1,z-1,x+3,y+2,z,p.rim);
  }else if(s===2){
    v.box(x-2,y,z-1,x+3,y+1,z+2,p.rim);
    v.box(x,y+1,z,x+1,y+4,z+1,p.frame);
    v.sphere(x,y+4,z,1.8,2+level*.12,1.5,p.leaf);
  }else{
    v.box(x-1,y,z-1,x+2,y+4,z+2,p.wall);
    v.box(x-2,y+3,z-2,x+3,y+4,z+3,p.rim);
    if(p.era==="future-3027"||p.era==="art-deco")v.box(x,y+4,z,x+1,y+7,z+1,p.sign,.3);
    else v.box(x-1,y+4,z-1,x+2,y+5,z+2,p.roof);
  }
}

export function surfaceAt(v:PixelVox,x:number,z:number,maxHeight:number) {
  for(let y=maxHeight;y>=0;y--)if(v.v.has(packVoxKey(x,y,z)))return y+1;
  return 0;
}
