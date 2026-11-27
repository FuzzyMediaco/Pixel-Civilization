import type {Ctx} from "../../kit";
import {awning,blade,brass,coral,ebony,entry,fanlight,glass,guest,ivory,jade,lamp,limestone,mint,plum,porcelain,steel,streamline} from "./craft";
const top=[20,26,33,40,48];

function mast(c:Ctx,x:number,z:number,y:number,h:number){
 c.v.box(x,y,z,x+1,y+h,z+1,brass);c.v.put(x,y+h,z,"#ffe4a4",1.1);
}
function flutedNeedle(c:Ctx){
 const {v,hx,hz,lv}=c, x=-hx+4+Math.floor(lv/3),z=-hz+4+Math.floor(lv/3),h=top[lv-1],r=2+Math.floor(lv/3);
 v.hollowBox(x-r,1,z-r,x+r+1,h-5,z+r+1,ivory);
 for(let i=-r;i<=r;i+=2) {
  const end=h-5-Math.abs(i)*2;v.box(x+i,1,z+r,x+i+1,end,z+r+2,steel);
  v.box(x+r,2,z+i,x+r+2,end,z+i+1,i===0?glass:brass);v.put(x+i,end,z+r+1,brass);
 }
 v.box(x-r,Math.floor(h*.58),z-r,x+r+1,Math.floor(h*.58)+1,z+r+2,jade);
 mast(c,x,z,h-5,5);
 if(lv>=2)streamline(c,-hx+5,3,3,Math.max(4,Math.floor(hz*.5)),1,3,"right",jade);
 if(lv>=3)streamline(c,3,z,Math.min(9,hx-5),4,1,5,"full",mint);
 if(lv>=4){const y=Math.floor(h*.52);awning(c,x+r-1,z-2,7,z+4,y,ivory);v.box(4,1,z,7,y,z+2,steel);guest(c,4,y+1,z+1);}
 if(lv===5)streamline(c,6,hz-8,6,4,1,4,"back",coral);
}
function clockPortal(c:Ctx){
 const {v,hx,hz,lv}=c, left=-hx+2,right=lv===1?0:2,z=-hz+4,h=top[lv-1],clock=h-4;
 for(const x of [left,right]){
  v.box(x,1,z-1,x+2,clock-1,z+2,x===left?jade:ivory);
  blade(c,x,1,z+2,clock,"x",brass);
 }
 const mid=Math.floor((left+right+1)/2);
 v.box(left-1,clock-3,z-2,right+3,clock+2,z+3,ivory);
 v.ringZ(mid+.5,clock-.5,z+2,z+3,2.6,1.75,brass);
 v.box(mid-1,clock-1,z+2,mid+2,clock+1,z+3,glass,.22);
 v.put(mid,clock,z+3,giltColor).put(mid+1,clock-1,z+3,giltColor);
 v.box(left,clock+2,z-1,right+2,clock+3,z+2,mint);mast(c,mid,z,clock+2,3);
 if(lv>=2) {streamline(c,0,3,4,Math.floor(hz*.39),1,3,"right",coral);guest(c,3,1,0);}
 if(lv>=3)awning(c,right+2,-hz+2,hx-2,-hz+8,5,plum);
 if(lv>=4){const y=Math.floor(h*.5);v.box(left-1,y,z-2,hx-3,y+1,z+3,jade);blade(c,hx-6,1,z+1,y+1,"x",steel);}
 if(lv===5)streamline(c,-hx+7,hz-7,5,4,1,4,"full",mint);
}
const giltColor="#ffd891";
function broadcastRibs(c:Ctx){
 const {v,hx,hz,lv}=c,x=hx-5,z=-hz+4,h=top[lv-1]+1,n=lv>=3?4:3;
 for(let i=0;i<n;i++){
  const xx=x-i*2,hh=h-i*(3+Math.floor(lv/2));v.box(xx-1,1,z+i,xx+1,hh-4,z+i+3,i%2?plum:mint);
  blade(c,xx,2,z+i+2,hh-3,"z",brass);mast(c,xx,z+i+1,hh-4,3);
 }
 const reach=lv===1?3:Math.min(7,hx-4);
 streamline(c,0,1,reach,3,1,2,"back",plum);
 if(lv>=2)awning(c,-hx+1,-hz+1,-hx+6,0,4,jade);
 if(lv>=3) {streamline(c,-hx+5,6,4,4,1,3,"full",coral);fanlight(c,-hx+5,3,8,2);}
 if(lv>=4){const y=Math.floor(h*.42);v.box(-hx+3,y,z+1,x,y+1,z+5,steel);blade(c,-hx+5,1,z+3,y,"x",brass);}
 if(lv===5)awning(c,-2,hz-8,hx-1,hz-4,5,mint);
}
function stairLantern(c:Ctx){
 const {v,hx,hz,lv}=c,x=-hx+3,z=-Math.floor(hz*.12),h=top[lv-1],n=lv<3?3:4;
 for(let i=0;i<n;i++){
  const xx=x+i,zz=z-i*2,y=1+Math.floor(i*(h-5)/n),end=1+Math.floor((i+1)*(h-5)/n);
  v.hollowBox(xx,y,zz-2,xx+5,end,zz+4,i%2?limestone:ivory);
  v.box(xx-1,end-1,zz-3,xx+6,end,zz+5,coral);v.box(xx+1,y+1,zz+3,xx+4,y+3,zz+4,glass,.2);
 }
 const bx=x+n+1,bz=z-(n-1)*2;
 v.cylinderY(bx+.5,bz+.5,h-4,h-1,2.45,glass,.32);
 v.cylinderY(bx+.5,bz+.5,h-1,h,2.8,brass);mast(c,bx,bz,h,2);
 if(lv>=2)streamline(c,0,-hz+5,Math.min(5,hx-3),3,1,4,"back",jade);
 if(lv>=3) {streamline(c,5,1,5,4,1,3,"right",mint);guest(c,5,5,1);}
 if(lv>=4){awning(c,x+4,z-2,hx-3,z+3,Math.floor(h*.35),plum);blade(c,hx-6,1,z,Math.floor(h*.35)+1);}
 if(lv===5){streamline(c,-hx+7,hz-7,5,4,1,3,"full",jade);awning(c,5,-hz+1,hx-1,-hz+6,7,ivory);}
}
export function buildSignalHall(c:Ctx){
 [flutedNeedle,clockPortal,broadcastRibs,stairLantern][c.variant](c);
 const x=Math.min(3,c.hx-4),z=c.hz-5;
 streamline(c,x,z,3,2,1,1,"back",jade);guest(c,x,3,z-1,coral);
 entry(c,x-2,c.hz-3);lamp(c,x+2,1,z+1,3);
}
