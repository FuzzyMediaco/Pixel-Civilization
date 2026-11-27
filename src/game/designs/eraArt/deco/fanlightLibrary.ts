import type { Ctx } from "../../kit";
import { awning, blade, books, brass, coral, ebony, entry, fanlight, glass, guest, ivory, jade, lamp, limestone, mint, plum, porcelain, steel, streamline } from "./craft";

function fanRooms(c:Ctx) {
 const {v,hx,hz,lv}=c, center=Math.round(hz*.28), reach=hz-2+center;
 // A pair of broad, scalloped reading bays unfolds behind the central street lobby.
 for(const side of [-1,1]){
  const maxWidth=hx-3, h=3+Math.floor(lv/2);
  for(let i=0;i<reach;i++){
   const t=i/reach, inner=Math.round(t*(maxWidth*.28)), edge=Math.max(2,Math.round(maxWidth*Math.sin(t*Math.PI*.75))), z=center-i, y=h+Math.floor(t*2);
   for(let j=inner;j<=edge;j++){
    const x=side*j;v.put(x,y,z,j===edge?brass:(j+3)%5===0?mint:jade);
    if(j===edge || i===reach-1){
     v.box(x,1,z,x+1,y,z+1,ivory);v.put(x,Math.max(2,y-2),z,glass,.18);
    }
   }
  }
  books(c,side<0?-hx+3:Math.max(1,hx-8),1,-hz+3,Math.min(4,hx-3));
 }
 streamline(c,0,center,Math.min(5,hx-3),Math.min(3,hz-3),1,3,"full",mint);
 fanlight(c,0,4,center+2,Math.min(4,lv+1),"z",true);
 if(lv>=2) blade(c,-hx+3,1,-hz+3,6+lv);
 if(lv>=3) {blade(c,hx-3,1,-hz+3,6+lv);guest(c,-3,1,center+3,coral);}
 if(lv>=4) awning(c,-5,-hz+2,6,-hz+6,7,porcelain);
 if(lv===5) {
  streamline(c,-hx+8,hz-8,6,4,1,3,"full",plum);
  streamline(c,hx-8,hz-8,6,4,1,3,"full",mint);
 }
}
function bookends(c:Ctx){
 const {v,hx,hz,lv}=c, back=-hz+3, gap=lv<3?2:4, h=5+lv;
 for(const side of [-1,1]){
  const x=side<0?-hx+2:gap,end=side<0?-gap:hx-2;
  v.hollowBox(x,1,back,end,h,2,ivory);
  for(let i=x;i<end;i+=2) {
   const top=h+Math.floor((side<0?i-x:end-1-i)/3);
   v.box(i,1,1,i+1,top+1,3,porcelain);v.put(i,top+1,2,brass);
   v.box(i,h,back,i+1,top+1,2,mint);
  }
  books(c,x,1,2,Math.max(2,end-x));
 }
 v.box(-gap-1,4,back,gap+1,5,-1,brass);
 v.box(-gap,5,back,gap,6,-1,glass,.35);
 if(lv>=2) awning(c,-hx+2,3,-gap+1,hz-2,4,coral);
 if(lv>=3) {
  streamline(c,0,hz-6,4,3,1,2,"back",plum);
  guest(c,1,3,hz-7);
 }
 if(lv>=4) {
  v.box(-gap-2,h,back-1,gap+2,h+1,back+3,brass);
  fanlight(c,0,h+1,back+2,4,"z",true);
 }
 if(lv===5) streamline(c,hx-9,8,6,8,1,4,"right",jade);
}
function ribbonCourt(c:Ctx){
 const {v,hx,hz,lv}=c, left=-hx+2,right=hx-3, back=-hz+3, front=hz-4;
 const n=lv+2, tread=Math.max(1,Math.floor((right-left)/n));
 for(let i=0;i<n;i++){
  const x=left+i*tread, z=back+Math.round((front-back)*i/n), width=Math.max(3,Math.floor(hx*.4));
  v.box(x,1,z,x+tread+1,i+2,Math.min(front+1,z+width),limestone);
  v.box(x,i+2,z,x+tread+1,i+3,Math.min(front+1,z+width),i%2===0?mint:ivory);
  v.put(x,i+3,z,brass);
  if(i%2===0) books(c,x,i+3,z,Math.min(tread,4));
 }
 streamline(c,right-2,front-2,Math.min(4,hx-4),3,n+1,2,"back",coral);
 if(lv>=2) {awning(c,left,back,left+7,back+4,5,jade);guest(c,left+3,1,back+3);}
 if(lv>=3) {
  v.box(left,1,2,left+3,4,hz-3,plum);v.box(left,4,2,left+5,5,hz-3,brass);
 }
 if(lv>=4) {
  const x=Math.floor(hx*.45);
  v.box(x,1,back,x+4,7,back+7,ivory);fanlight(c,x+2,7,back+6,3,"z",true);
 }
 if(lv===5) {
  streamline(c,0,hz-8,7,4,1,3,"back",mint);
  books(c,-4,4,hz-9,7);
 }
}
function stagePavilion(c:Ctx){
 const {v,hx,hz,lv}=c, back=-hz+2, z=-Math.floor(hz*.27), radius=Math.min(hx-3,Math.max(4,Math.floor(hx*.67)));
 streamline(c,0,z,radius,Math.min(hz-3,radius),1,2,"back",plum);
 for(let x=-radius;x<=radius;x++){
  const h=3+Math.round((1-Math.abs(x)/radius)*(3+lv));
  v.box(x,2,back,x+1,h,back+2,ivory);
  v.box(x,h,back-1,x+1,h+1,back+3,Math.abs(x)%3===0?brass:coral);
  if(Math.abs(x)%2===0) v.put(x,h-1,back+2,brass);
 }
 fanlight(c,0,3,back+2,Math.min(4,lv+1),"z",true);
 books(c,-Math.floor(radius*.8),3,z-1,Math.max(3,radius-1));guest(c,1,3,z-1);
 if(lv>=2) awning(c,-hx+2,back,-radius+2,Math.min(hz-2,z+5),5,mint);
 if(lv>=3) {
  for(let i=0;i<3;i++) v.box(-radius+i,1,z+3+i*2,radius-i+1,i+2,z+4+i*2,limestone);
 }
 if(lv>=4) {
  const x=hx-6;streamline(c,x,z,4,6,1,4,"full",jade);
  blade(c,x+1,1,z-3,9);
 }
 if(lv===5) {awning(c,-hx+2,hz-7,-1,hz-3,4,porcelain);books(c,-hx+4,1,hz-6,7);}
}

export function buildFanlightLibrary(c:Ctx) {
 [fanRooms,bookends,ribbonCourt,stagePavilion][c.variant](c);
 entry(c,0,c.hz-3);lamp(c,2,1,c.hz-4,2);
}
