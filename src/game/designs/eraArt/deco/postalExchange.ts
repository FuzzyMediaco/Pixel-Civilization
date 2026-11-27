import type { Ctx } from "../../kit";
import { awning, blade, brass, coral, ebony, entry, glass, guest, ivory, jade, lamp, limestone, mint, plum, porcelain, steel, streamline } from "./craft";

function van(c:Ctx,x:number,z:number,direction:"x"|"z"="x"){
 const v=c.v;
 if(direction==="x"){
  v.box(x-2,2,z-1,x+3,4,z+2,mint);v.box(x-2,4,z-1,x+1,5,z+2,ivory);v.put(x+1,3,z+1,glass);
  for(const dx of [-1,1]) for(const dz of [-1,1])v.put(x+dx,1,z+dz,ebony);
 }else{
  v.box(x-1,2,z-2,x+2,4,z+3,coral);v.box(x-1,4,z-2,x+2,5,z+1,ivory);v.put(x+1,3,z+1,glass);
  for(const dx of [-1,1]) for(const dz of [-1,1])v.put(x+dx,1,z+dz,ebony);
 }
}
function belt(c:Ctx,x:number,z:number,end:number,dir:"x"|"z",y=2){
 const v=c.v;
 for(let i=0;i<end;i++){
  const xx=x+(dir==="x"?i:0),zz=z+(dir==="z"?i:0);
  v.box(xx,y,zz,xx+(dir==="x"?1:3),y+1,zz+(dir==="z"?1:3),i%3===0?steel:ebony);
  if(i%5===1) v.box(xx,y+1,zz,xx+2,y+2,zz+2,coral);
  if(i%4===0) v.put(xx,y-1,zz,steel);
 }
}
function zipper(c:Ctx){
 const {v,hx,hz,lv}=c, left=-hx+1,back=-hz+2, stop=hx-3;
 const h=4+Math.floor(lv/2),front=back+4+lv;
 v.hollowBox(left,1,back,stop+1,h,front,ivory);
 v.box(left,h-2,front-1,stop+1,h-1,front,glass,.22);
 v.box(left,h,back,stop+1,h+1,front+1,jade);
 for(let x=left+2;x<stop;x+=4) {
  v.box(x,h+1,back,x+1,h+2,front,mint);v.put(x,h-1,front,brass);
 }
 belt(c,left+2,front+1,stop-left-1,"x");
 van(c,hx-4,hz-4);
 if(lv>=2) {blade(c,left+2,1,back+2,7+lv,"x");guest(c,left+5,1,front+4);}
 if(lv>=3) awning(c,left,front+5,-2,hz-2,4,plum);
 if(lv>=4){belt(c,0,front+5,Math.max(5,hz-front-8),"z");van(c,hx-9,hz-5,"z");}
 if(lv===5) {streamline(c,stop-3,back+4,5,4,h+1,4,"full",mint);blade(c,stop-2,h+2,back+2,6);}
}
function corner(c:Ctx){
 const {v,hx,hz,lv}=c, left=-hx+2, back=-hz+2, h=4+Math.floor(lv/2), width=3+Math.floor(lv/2);
 v.hollowBox(left,1,back,1,h,back+width+1,ivory);
 v.box(left,h,back,2,h+1,back+width+2,mint);
 v.hollowBox(left,1,back,left+width,h,hz-4,ivory);
 v.box(left,h,back,left+width+1,h+1,hz-3,mint);
 streamline(c,left+width,back+width,width,width,1,h-1,"full",mint);
 belt(c,left+width+2,back+width+1,Math.max(5,hz-back-width-5),"z");
 van(c,hx-4,hz-4,"z");
 if(lv>=2) awning(c,1,back,hx-2,back+width+2,h,coral);
 if(lv>=3) {
  v.box(left+1,1,hz-6,left+width+1,8,hz-3,jade);
  for(let i=0;i<3;i++)v.put(left+2+i,8-i,hz-3,brass);
 }
 if(lv>=4){streamline(c,hx-7,back+6,5,5,1,4,"right",plum);van(c,5,hz-6);}
 if(lv===5) {
  v.box(left+width,h+2,back+2,hx-4,h+3,back+5,brass);blade(c,hx-5,1,back+3,h+3);
  guest(c,hx-7,h+3,back+3);
 }
}
function mailChutes(c:Ctx){
 const {v,lv,hx,hz}=c, left=-hx+2,back=-hz+2, cx=left+3, cz=back+3, h=5+lv;
 streamline(c,cx,cz,3,3,1,h,"full",plum);
 for(let y=3;y<=h;y+=3)v.box(cx-2,y,cz+2,cx+3,y+1,cz+4,brass);
 const end=hx-4;
 for(let x=cx+1;x<=end;x++){
  const t=(x-cx)/(end-cx), z=cz+Math.round(t*(lv>=3?5:2)), y=h-Math.round(t*(h-2));
  v.box(x,y,z,x+1,y+1,z+3,steel);v.put(x,y+1,z,brass);v.put(x,y+1,z+2,brass);
 }
 van(c,end,hz-4);
 if(lv>=2){belt(c,0,1,Math.max(5,hx-3),"x");guest(c,end,1,3);}
 if(lv>=3) {streamline(c,left+4,hz-6,4,3,1,h-1,"full",jade);awning(c,left+1,cz+2,left+6,hz-6,5,coral);}
 if(lv>=4){v.hollowBox(1,1,back,hx-3,5,back+4,ivory);blade(c,hx-6,1,back+1,10);}
 if(lv===5){van(c,2,hz-5,"z");awning(c,0,hz-9,hx-2,hz-4,7,plum);}
}
function monitorHalls(c:Ctx){
 const {v,hx,hz,lv}=c,left=-hx+2,back=-hz+1,width=5+lv,h=3+Math.floor(lv/2);
 const length=2*hz-(lv<3?6:5);
 for(let i=0;i<length;i++) {
  const z=back+i, y=h+Math.floor((i%5)/2);
  v.box(left,y,z,left+width,y+1,z+1,ivory);
  v.put(left+width-1,y,z,brass);
  if(i%5===4) v.box(left,y-2,z,left+width,y,z+1,glass,.33);
  if(i%5===0) for(const x of [left+1,left+width-2]) v.box(x,1,z,x+1,h,z+1,steel);
 }
 belt(c,left+width,back+2,Math.min(2*hz-8,length),"z");
 van(c,hx-4,lv>=3?Math.floor(hz*.4):0,"z");
 if(lv>=2) awning(c,left+width,back,hx-2,back+5,4,jade);
 if(lv>=3) {blade(c,left+2,1,back+2,h+6,"x",coral);van(c,hx-6,back+5);}
 if(lv>=4) {
  streamline(c,hx-7,2,5,3,1,4,"right",coral);belt(c,-2,0,Math.max(5,hx-7),"x");
 }
 if(lv===5) {
  awning(c,-3,back,hx-2,back+7,8,plum);
  v.box(0,5,back+2,3,8,back+5,mint);
 }
}
export function buildPostalExchange(c:Ctx){
 [zipper,corner,mailChutes,monitorHalls][c.variant](c);
 entry(c,-1,c.hz-3);lamp(c,1,1,c.hz-3,2);
}
