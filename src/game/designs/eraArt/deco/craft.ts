import type { Ctx } from "../../kit";

export const ivory="#e8d4a8", porcelain="#f5e5c8", limestone="#c4ac93", stone="#9e8e84";
export const jade="#377879", mint="#86aba1", glass="#2b545f", brass="#cc9c52", gilt="#f3c97a";
export const umber="#6e4d42", coral="#bd6651", plum="#6a505c", steel="#758784", ebony="#333f43";

/** A standing radial screen, made of alternating stepped brass and glass blades. */
export function fanlight(c: Ctx,x: number,y: number,z: number,r: number,axis:"x"|"z"="z",lit=false){
 const v=c.v;
 for(let dx=-r;dx<=r;dx++)for(let dy=0;dy<=r;dy++){
   if(Math.hypot(dx,dy)>r+.15)continue;
   const a=Math.atan2(dy,dx), ray=Math.min(...Array.from({length:7},(_,i)=>Math.abs(Math.sin(a-i*Math.PI/6))*Math.hypot(dx,dy)));
   const edge=Math.hypot(dx,dy)>r-.8, color=edge || ray<.55 ? brass : glass;
   v.put(x+(axis==="z"?dx:0),y+dy,z+(axis==="x"?dx:0),color,color===glass && lit ? .34 : 0);
 }
 v.put(x,y,z,gilt,.45);
}

export function blade(c: Ctx,x: number,y: number,z: number,h: number,axis:"x"|"z"="z",metal=brass) {
 const v=c.v;
 for(const i of [-1,0,1]) {
   const dx=axis==="x"?i:0, dz=axis==="z"?i:0;
   v.box(x+dx,y,z+dz,x+dx+1,y+h-Math.abs(i)*2,z+dz+1,i===0?metal:limestone);
 }
}

export function lamp(c: Ctx,x: number,y: number,z: number,h=3) {
 c.v.box(x,y,z,x+1,y+h-1,z+1,steel);
 c.v.put(x,y+h-1,z,gilt,1.1);
}

export function guest(c: Ctx,x: number,y: number,z: number,coat=jade) {
 c.v.put(x,y,z,ebony).put(x,y+1,z,coat).put(x,y+2,z,"#bd876b");
}

export function books(c: Ctx,x: number,y: number,z: number,w: number) {
 c.v.box(x,y,z,x+w,y+3,z+1,umber);
 for(let i=0;i<w;i++) c.v.put(x+i,y+1,z+1,[jade,gilt,coral,ivory][i%4]);
 c.v.box(x,y+2,z+1,x+w,y+3,z+2,brass);
}

export function stripe(c: Ctx,x0: number,y: number,z0: number,x1: number,z1: number,metal=brass) {
 c.v.box(x0,y,z0,x1,y+1,z1,metal);
}

/** Continuous ribbon walls around an ellipse or intercepted prow; lid and windows follow the same curve. */
export function streamline(c: Ctx,cx: number,cz: number,rx: number,rz: number,base: number,height: number,side:"full"|"back"|"right"="full",lid=jade) {
 const v=c.v;
 for(let x=-rx;x<=rx;x++) for(let z=-rz;z<=rz;z++){
   const r=Math.hypot(x/rx,z/rz);
   if(r>1 || (side==="back" && z>0) || (side==="right" && x<0))continue;
   const wall=Math.hypot(x/Math.max(.6,rx-1),z/Math.max(.6,rz-1))>1 || (side==="back" && z===0) || (side==="right" && x===0);
   v.put(cx+x,base,cz+z,limestone);
   if(wall){
    v.box(cx+x,base+1,cz+z,cx+x+1,base+height,cz+z+1,ivory);
    if(height>=4) v.put(cx+x,base+height-2,cz+z,(x+z)%5===0?brass:glass);
   }
   v.put(cx+x,base+height,cz+z,wall?porcelain:lid);
 }
}

export function entry(c:Ctx,x:number,z:number){
 c.v.box(x-2,0,z-1,x+2,1,c.hz-1,limestone);
 lamp(c,x-2,1,z,3);
 guest(c,x+1,1,z);
}

export function awning(c:Ctx,x0:number,z0:number,x1:number,z1:number,y:number,roof=jade) {
 c.v.box(x0,y,z0,x1,y+1,z1,roof);
 c.v.box(x0,y,z1-1,x1,y+1,z1,brass);
 for(const x of [x0+1,x1-2]) c.v.box(x,1,z1-2,x+1,y,z1-1,steel);
}

export function steps(c: Ctx,z:number,wide:number,count:number){
 for(let i=0;i<count;i++) {
  c.v.box(-wide,1,z-i,wide+1,i+2,z-i+1,limestone);
  c.v.box(-wide,i+1,z-i,wide+1,i+2,z-i+1,i%3===0?porcelain:ivory);
 }
}
