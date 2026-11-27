// Civilian material and street furniture shared by the wartime municipal buildings.
import { lot, person, type Ctx, type PixelVox } from "../../kit";

export const brick="#a8664f", mortar="#c7a58a", cream="#e2d2ac", tan="#c9ac77", soot="#41494a";
export const iron="#59605b", tin="#858c83", steel="#687d80", sage="#748366", maroon="#855649";
export const glass="#a2b7ae", wood="#796748", black="#343839", amber="#edc184";
export function yard(c:Ctx,w=2) {
  lot(c,"#99988a",1);c.v.box(-w,0,1,w+1,1,c.hz,cream);
  for(let z=4;z<c.hz;z+=5)c.v.box(-w,0,z,w+1,1,z+1,"#aea48a");
}
export function citizen(v:PixelVox,x:number,y:number,z:number,active:boolean,coat=sage){
  person(v,x,y,z,active?coat:maroon,soot,"#bc9474");
  v.put(x,y+3,z,iron);
}
export function shadeLamp(v:PixelVox,x:number,y:number,z:number,active:boolean){
  v.box(x-1,y+2,z,x+2,y+3,z+1,iron);
  v.box(x-1,y+1,z,x+1,y+2,z+1,amber,active?.72:.43);v.put(x,y,z,wood);
}
export function counter(v:PixelVox,x:number,y:number,z:number,active:boolean){
  v.box(x-2,y,z-1,x+3,y+2,z+1,wood);v.box(x-2,y+2,z-1,x+3,y+3,z+1,cream);
  v.put(x-1,y+3,z,maroon);citizen(v,x+1,y,z-2,active);
  shadeLamp(v,x+2,y+1,z-1,active);
}
export function steps(v:PixelVox,x:number,z:number,half:number,h:number){
  for(let n=0;n<h;n++)v.box(x-half,1,z+n,x+half+1,h+1-n,z+n+1,n%2?cream:"#b0aa98");
}
export function beam(v:PixelVox, a:[number,number,number],b:[number,number,number],col:string,width=1){
  const n=Math.max(1,...a.map((value,k)=>Math.abs(value-b[k])));
  for(let i=0;i<=n;i++){
    const [x,y,z]=a.map((value,k)=>Math.round(value+(b[k]-value)*i/n));
    v.box(x,y,z,x+width,y+1,z+1,col);
  }
}
export function facade(v:PixelVox,x:number,z:number,X:number,Z:number,base:number,h:number) {
  v.hollowBox(x,base,z,X,base+h,Z,brick);
  v.box(x-1,base+h,z-1,X+1,base+h+1,Z+1,mortar);
  for(let px=x+2;px<X-2;px+=5)for(let y=base+2;y<base+h-1;y+=5){
    v.box(px,y,Z-1,px+2,y+2,Z,glass,.17);
    v.box(px,y+2,Z-1,px+3,y+3,Z,iron);
  }
  for(let pz=z+2;pz<Z-2;pz+=4) v.box(X-1,base+2,pz,X,base+4,pz+2,glass,.22);
}
export function platform(v:PixelVox,x:number,z:number,X:number,Z:number,h=2){
  v.box(x,1,z,X,h+1,Z,"#8d8d82");
  v.box(x,h,Z-1,X,h+1,Z,cream);
  for(let q=x+2;q<X-1;q+=5)v.put(q,h,Z-1,tan);
}
export function placard(v:PixelVox,x:number,z:number,active:boolean,y=1) {
  v.box(x-2,y,z,x-1,y+5,z+1,iron);v.box(x+2,y,z,x+3,y+5,z+1,iron);
  v.box(x-2,y+2,z,x+3,y+5,z+1,cream);v.put(x-1,y+3,z,maroon);v.put(x+1,y+3,z,soot);
  citizen(v,x,y,z+2,active);
}
export function parcel(v:PixelVox,x:number,y:number,z:number) {
  v.box(x,y,z,x+3,y+2,z+2,tan);v.box(x+1,y,z,x+2,y+2,z+2,cream);v.put(x+2,y+2,z,maroon);
}
