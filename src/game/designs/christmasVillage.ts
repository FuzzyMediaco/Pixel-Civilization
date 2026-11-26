import type { Ctx } from "./kit";
import {berry,blackSanta,bulbs,butter,cabin,cream,dark,deer,fir,frost,gable,gift,gold,leaf,pad,pine,red,snow,star,strand,stroke,tau,wood,wreath} from "./christmasKit";

export function christmasTree(c:Ctx) {
  const {v,lv,variant:k}=c; pad(c);
  const top=fir(v,0,1,0,Math.min(c.hx-2,c.hz-2,4+lv*2),9+lv*4+k,k,true);
  star(v,0,top+1,0,lv>2?3:2);
  for(let i=0;i<lv+2;i++) {
    const a=(i+0.5)*tau/(lv+2);
    gift(v,Math.cos(a)*(c.hx-4)-1,1,Math.sin(a)*(c.hz-4)-1,2+i%2,bulbs[i%5]);
  }
}
function snowFigure(c:Ctx,x:number,z:number,r:number,k:number) {
  const v=c.v;
  v.sphere(x,1+r,z,r,r,r,snow).sphere(x,1+2.38*r,z,r*.8,r*.8,r*.8,snow)
    .sphere(x,1+3.54*r,z,r*.66,r*.66,r*.66,snow);
  const face=Math.round(1+3.55*r), front=z+Math.round(r*.6)-1, top=Math.round(1+4.08*r);
  v.put(x-1,face+1,front+1,dark).put(x+1,face+1,front+1,dark)
    .box(x,face,front,x+1,face+1,front+3,"#e98d3c");
  v.cylinderY(x,z,1+2.94*r,2+2.94*r,r*.65,bulbs[k]).box(x+1,1+2.25*r,z+r*.63,x+2,2+3*r,z+r*.63+1,bulbs[k]);
  for(let i=0;i<2;i++)v.put(x,2+2*r+i,z+r*.75,dark);
  for(const sign of [-1,1])stroke(v,[x+sign*r*.7,2+2.4*r,z],[x+sign*(r+2),3+2.5*r+(sign===1?k:0),z-1],wood);
  if(k===0) v.cylinderY(x,z,top,top+1,r*.85,dark).cylinderY(x,z,top+1,top+4,r*.58,dark);
  if(k===1) {v.cylinderY(x,z,top,top+2,r*.66,"#aa5941");for(const dx of [-1,1])v.box(x+dx*r*.58,face,z-1,x+dx*r*.58+1,top+1,z+2,wood);}
  if(k===2) v.cone(x,top,top+3,z,r*.76,.6,red).put(x,top+3,z,cream);
  if(k===3) {v.cylinderY(x,z,top,top+2,r*.76,gold);for(const dx of [-1,0,1])v.put(x+dx*r*.5,top+2,z,gold);}
}
export function snowman(c:Ctx) {
  pad(c); snowFigure(c,0,0,2.6+c.lv*.6,c.variant);
  for(let i=0;i<c.lv-2;i++) snowFigure(c,[-1,1,0][i]*(c.hx-5),[2,-3,c.hz-4][i],2+i*.2,(c.variant+i+1)%4);
}
export function sleigh(c:Ctx) {
  const {v,lv,variant:k}=c; pad(c);
  const x=-Math.min(c.hx-8,5+lv*1.9), z=0, len=6+lv;
  for(const lane of [-3,3]) {
    v.box(x-len,1,lane,x+len+1,2,lane+1,gold);
    stroke(v,[x+len,1,lane],[x+len+2,3+k,lane],gold);
    v.put(x+len+1,3+k,lane,gold);
    for(const dx of [-len+2,len-2])v.box(x+dx,2,lane,x+dx+1,5,lane+1,wood);
  }
  v.box(x-len,4,-4,x+len,6,5,berry).box(x-len,5,-4,x-len+2,9+k,5,red);
  for(const lane of [-4,4]) for(let i=-len;i<len;i++){
    const wall=6+Math.round(2*((i+1)/len)**2)+(k===3?1:0);
    v.box(x+i,5,lane,x+i+1,wall,lane+1,red).put(x+i,wall,lane,gold);
  }
  blackSanta(v,x+1,6,z);
  for(let j=0;j<lv;j++)gift(v,x-len+1+j%2*3,6+Math.floor(j/4)*3,-3+Math.floor(j%4/2)*3,3,bulbs[(j+k)%5]);
  const start=x+len+5;
  for(let i=0;i<Math.min(4,lv);i++){
    const dx=Math.min(c.hx-6,start+Math.floor(i/2)*9), dz=i===0&&lv===1?0:(i%2===0?-1:1)*Math.min(c.hz-5,5);
    deer(v,dx,1,dz,i%2?wood:"#a76c3e");
    stroke(v,[x+len,6,Math.sign(dz)*3],[dx,5,dz],berry);
  }
}
export function santaHouse(c:Ctx) {
  const {v,lv,variant:k}=c;pad(c);
  const w=Math.min(c.hx-2,5+lv*1.85),d=Math.min(c.hz-2,4+lv),h=5+lv;
  const z=-Math.max(0,Math.round((c.hz-d)/3)),rise=3+lv+(k===1?4:0);
  cabin(v,0,z,w,d,h,red,k===1?pine:berry,rise);
  for(let y=2;y<h;y+=3)v.box(-w+1,y,z+d-1,-w+3,y+1,z+d,cream).box(w-2,y,z+d-1,w,y+1,z+d,cream);
  const chimney=(x:number)=>{v.box(x,h+1,z-2,x+2,h+rise+3,z,wood).box(x-1,h+rise+2,z-3,x+3,h+rise+3,z+1,snow);c.smoke(x,h+rise+3,z-1,"smoke");};
  chimney(Math.round(-w/2));if(k===2)chimney(Math.round(w/2));
  if(k===3||lv>=4)cabin(v,-w*.73,z+d*.22,Math.max(3,Math.round(w*.48)),Math.max(3,Math.round(d*.95)),h-1,red,pine,3+k%2);
  wreath(v,0,h+1,z+d,1.5);strand(v,-Math.floor(w)+1,Math.floor(w)-1,h,z+d);
  if(lv>=3)blackSanta(v,Math.min(c.hx-5,Math.ceil(w*.72)),1,Math.min(c.hz-4,Math.ceil(z+d+2)));
}
export function elfCottages(c:Ctx) {
  const {v,lv,variant:k}=c;pad(c);
  const sites=lv<2?[[0,0]]:lv===2?[[-6,0],[6,0]]:lv===3?[[-6,-4],[6,-4],[0,6]]:
    [[-7,-6],[6,-6],[-6,6],[7,6],...(lv===5?[[0,-15],[-15,0],[14,1]]:[])];
  for(const [i,[x,z]] of sites.entries()){
    const r=i===0?4+lv*.36:3.7,h=4+lv%3;
    v.cylinderY(x,z,1,h+1,r,[cream,"#e6ba86","#aad1ba"][i%3]);
    v.box(x-1,1,z+r-1,x+1,4,z+r,wood).put(x+2,3,z+r-2,butter,.6);
    const cap=[pine,"#96535a","#2a8293","#b43243"][(k+i)%4],height=6+k+(i===0?lv:0);
    for(let j=0;j<height;j++){
      const t=j/(height-1), bend=[2,-2,4,-1][k]*t*t;
      v.cylinderY(x+bend,z+(k===2?2*t:0),h+j,h+j+1,Math.max(.8,(r+1)*(1-t)),j===0?snow:cap);
    }
    const tip=x+[2,-2,4,-1][k];
    v.sphere(tip,h+height,z+(k===2?2:0),k===3?2:1.2,1.4,1.4,gold);
  }
}
export function workshop(c:Ctx) {
  const {v,hx,hz,lv,variant:k}=c;pad(c);
  const w=Math.min(hx-3,7+lv*2),d=Math.min(hz-4,3+lv),h=5+lv;
  v.hollowBox(-w,1,-d,w,h,d,red,wood);
  for(let x=-w;x<w;x++) {
    const y=h+((x+w)%5);
    v.box(x,h,-d,x+1,y+1,d,pine).box(x,y,-d,x+1,y+1,d,snow);
    if((x+w)%5===0)v.box(x,h,-d,x+1,h+3,d,butter,.38);
  }
  const y=h+5;
  if(k===0){v.box(-4,y,-1,4,y+2,2,"#478e82").box(-4,y+2,-1,-2,y+5,2,red).box(1,y+2,-1,3,y+4,1,dark);for(const x of [-3,0,3])v.put(x,y-1,2,dark);}
  if(k===1)v.sphere(0,y+2,0,4,3,2,gold).box(1,y+3,-1,4,y+6,2,gold).box(4,y+3,-1,6,y+4,2,"#d57b36");
  if(k===2)v.cone(0,y,y+4,0,1,5,bulbs[3]).cone(0,y+4,y+7,0,5,1,red).put(0,y+7,0,gold);
  if(k===3)v.box(-3,y,-2,3,y+5,2,"#699aa6").box(-2,y+5,-2,2,y+8,2,cream).put(0,y+8,0,red).put(1,y+6,2,dark);
  for(let i=0;i<lv;i++){const x=-w+2+i*3;v.box(x,2,d,x+3,3,d+3,dark);gift(v,x,3,d,2,bulbs[i%5]);}
  v.box(-w+1,h,-d,-w+3,h+5+lv,-d+2,wood);c.smoke(-w+2,h+5+lv,-d+1,"steam");
}
export function stable(c:Ctx) {
  const {v,hx,hz,lv,variant:k}=c;pad(c);
  const w=Math.min(hx-3,6+lv*2),d=Math.max(3,Math.floor(hz*.4)),z=-Math.floor(hz*.44),h=6+lv;
  for(const x of [-w+1,w-1])for(const dz of [-d+1,d-1])v.box(x,1,z+dz,x+1,h+1,z+dz+1,wood);
  v.box(-w+1,1,z-d+1,w,h,z-d+2,wood);
  gable(v,0,z,w,d,h,2+k, k===2?berry:pine,snow);
  if(k===2)v.box(-w+1,h-2,z-d,w,h,z+d,gold);
  for(let i=0;i<lv;i++){
    const x=(i+.5)*2*(hx-5)/lv-hx+4, zz=i%2===0?Math.max(0,Math.floor(hz*.25)):Math.max(2,Math.floor(hz*.56));
    deer(v,x,1,zz,i%2?"#ae7951":wood);
  }
  for(let x=-w;x<=w;x+=4){v.box(x,1,hz-2,x+1,4+(k===3?1:0),hz-1,wood);if(k===3)v.put(x,4,hz-2,gold);}
  v.box(-w,2,hz-2,w,3,hz-1,k===0?"#ba9466":wood);
}
export function grotto(c:Ctx) {
  const {v,lv,variant:k}=c;pad(c);
  const scale=lv>=4?1.5:1, reach=Math.min(c.hx-2,5+lv*2),back=-Math.min(7,2+lv);
  v.box(-4*scale,1,back,4*scale,4,2,wood).box(-4*scale,3,back,4*scale,9*scale,back+2,berry);
  for(const side of [-1,1]) {
    const x=side*reach;
    for(let y=1;y<13+lv*2;y++)v.box(x-1,y,back-1,x+1,y+1,back+1,k===1?(y%5<2?red:snow):k===3?wood:pine);
    if(k===3)v.box(x-2,2,back,x+2,7,back+2,berry).put(x,4,back+2,gold,1);
    star(v,x,13+lv*2,back,k===0?2:1);
  }
  const crown=14+lv*2;
  if(k===2){stroke(v,[-reach,crown-1,back],[0,crown+5,back],gold);stroke(v,[0,crown+5,back],[reach,crown-1,back],gold);star(v,0,crown+6,back);}
  else if(k!==3 || lv>=3)strand(v,-reach,reach,crown-1,back,k===1?1:3);
  blackSanta(v,0,2,Math.max(0,back+4),scale);
  for(let i=0;i<lv+1;i++)gift(v,(i%2?-1:1)*(Math.min(c.hx-5,5+Math.floor(i/2)*3))-1,1,Math.min(c.hz-5,2+Math.floor(i/2)*3),2+i%2,bulbs[i%5]);
}
