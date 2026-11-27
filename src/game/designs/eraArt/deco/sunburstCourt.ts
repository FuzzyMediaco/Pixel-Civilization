import type {Ctx} from "../../kit";
import {blade,brass,coral,ebony,fanlight,glass,guest,ivory,jade,lamp,limestone,mint,plum,porcelain,steel,steps,streamline} from "./craft";

function judge(c:Ctx,y:number,z:number){
 c.v.box(-2,y,z-1,3,y+1,z+2,plum);c.v.box(-1,y+1,z-1,2,y+3,z,brass);
 guest(c,0,y+1,z,ebony);lamp(c,-2,y+1,z,2);
}
function sunshine(c:Ctx){
 const {v,hx,hz,lv}=c, b=-hz+2, w=Math.min(hx-2,4+lv*2), z=lv===1?0:-2, base=3+lv;
 for(let x=-w;x<=w;x++){
  const top=base+3+Math.max(0,Math.floor((w-Math.abs(x))*.45));
  v.box(x,1,b,x+1,top,z,ivory);v.put(x,top,z-1,brass);
  if(x%3===0) {v.box(x,base,z-1,x+1,top+1,z+1,porcelain);v.put(x,top+1,z,brass);}
 }
 const radius=Math.min(6,2+lv);
 fanlight(c,0,base+4,z,radius,"z",true);
 v.box(-w+1,base-1,z,w,base,z+2,jade);
 judge(c,base,z);steps(c,Math.min(hz-2,z+base+1),2+Math.floor(lv/2),base);
 if(lv>=2) for(const s of [-1,1]) {const x=s*(hx-4);v.box(x-1,1,b,x+2,4,z+2,limestone);blade(c,x,4,z,4);}
 if(lv>=3) for(const s of [-1,1]) {const x=s*(w-2);v.box(x-2,1,z+3,x+3,3,hz-4,plum);lamp(c,x,3,hz-6);}
 if(lv>=4) for(const s of [-1,1]) {const x=s*(w-1);v.box(x-2,3,z-1,x+3,6,hz-8,ivory);v.box(x-2,6,z-2,x+3,7,hz-8,mint);}
 if(lv===5){v.box(-5,base+6,b-1,6,base+7,z-1,plum);blade(c,0,base+6,b+1,7,"x");}
}
function prows(c:Ctx){
 const {v,hx,hz,lv}=c, z=-Math.round(hz*.26),w=Math.max(3,Math.round(hx*.39)),rad=Math.min(5,2+lv), h=4+lv;
 for(const side of [-1,1]){
  const x=side*w;
  streamline(c,x,z,Math.min(w-1,rad),Math.min(hz-3,rad+2),1,h,"full",jade);
  streamline(c,x,z-1,Math.min(w-1,rad-1),rad,h+1,2,"back",mint);
 }
 v.box(-w,4,z-2,w+1,5,z+1,ivory);
 judge(c,5,z-1);
 v.box(-2,1,z-3,3,h+5,z-1,plum);fanlight(c,0,h+4,z-1,rad,"z",true);
 steps(c,Math.min(hz-2,z+7),2,5);
 if(lv>=2) for(const s of [-1,1]) blade(c,s*(w+1),h+2,z-2,4+lv);
 if(lv>=3) for(const s of [-1,1]) {
  const x=s*(hx-5);
  streamline(c,x,hz-6,3,4,1,2,"full",coral);guest(c,x,4,hz-6);
 }
 if(lv>=4){v.box(-w+1,h+1,-hz+2,w,h+2,z-3,brass);v.box(-w+1,h+2,-hz+2,w,h+3,-hz+4,glass,.3);}
 if(lv===5) for(const s of [-1,1])streamline(c,s*(hx-7),-hz+6,4,5,1,h,"back",plum);
}
function chevrons(c:Ctx){
 const {v,hx,hz,lv}=c,w=Math.min(hx-2,5+lv*2),b=-hz+2,n=2+Math.floor(lv/2),top=3*n+3;
 for(let i=0;i<n;i++){
  const width=w-i*2,d=3+lv-i;
  for(let x=-width;x<=width;x++){
   const bend=Math.floor((width-Math.abs(x))*.5), zz=b+i*2+bend, y=1+i*3;
   v.box(x,y,zz,x+1,y+3,zz+d,ivory); v.box(x,y+2,zz,x+1,y+3,zz+d+1,i%2?plum:jade);
   if(x%4===0)v.put(x,y+1,zz+d,brass);
  }
 }
 const crown=b+n*2+Math.floor(w*.42);
 fanlight(c,0,top-2,crown,3+Math.floor(lv/2),"z",true);
 blade(c,0,top,b+n,4+lv);
 const landing=Math.min(hz-5,crown+2);
 v.box(-3,1,landing-3,4,4,landing,plum);judge(c,4,landing-1);
 steps(c,Math.min(hz-2,landing+4),2,4);
 if(lv>=2) for(const s of [-1,1])blade(c,s*(hx-3),1,-hz+4,6);
 if(lv>=3) for(const s of [-1,1]){const x=s*(hx-6);v.box(x-2,1,1,x+3,3,hz-4,limestone);guest(c,x,3,hz-6);}
 if(lv>=4)for(const s of [-1,1]){const x=s*(hx-4);v.box(x-1,1,b,x+2,8,2,porcelain);v.put(x,8,1,brass);}
 if(lv===5) for(const s of [-1,1])streamline(c,s*12,hz-9,4,5,1,4,"full",mint);
}
function fluteOrgan(c:Ctx){
 const {v,hx,hz,lv}=c,n=2+Math.floor(lv/2), back=-hz+3, z=Math.min(0,back+6);
 for(let i=-n;i<=n;i++){
  const x=i*2, top=8+lv*2-Math.abs(i)*2, front=z-Math.abs(i);
  v.box(x-1,1,back,x+1,top,front+1,i%2?ivory:limestone);
  blade(c,x,2,front+1,top-1,"z",i%2?steel:brass);
 }
 fanlight(c,0,7+lv*2,z+2,2+Math.floor(lv/2),"z",true);
 v.box(-4,1,z+1,5,4,z+4,plum);judge(c,4,z+3);
 steps(c,Math.min(hz-2,z+8),Math.min(4,lv+1),4);
 if(lv>=2)for(const s of [-1,1]){const x=s*(hx-5);streamline(c,x,back+3,3,3,1,4,"full",jade);}
 if(lv>=3)for(const s of [-1,1]){const x=s*(hx-5);v.box(x-2,1,0,x+3,3,hz-4,limestone);v.box(x-2,3,0,x+3,4,hz-5,coral);}
 if(lv>=4)for(const s of [-1,1]){const x=s*(n*2+3);blade(c,x,1,back+1,10+lv,"x",brass);}
 if(lv===5){v.box(-7,7,back+1,8,8,z+1,ivory);for(const s of [-1,1])streamline(c,s*11,0,4,6,1,6,"back",jade);}
}
export function buildSunburstCourt(c:Ctx){
 [sunshine,prows,chevrons,fluteOrgan][c.variant](c);
 for(const x of [-3,3])lamp(c,x,1,c.hz-2,3);
 c.v.box(-2,0,c.hz-4,3,1,c.hz-1,limestone);
}
