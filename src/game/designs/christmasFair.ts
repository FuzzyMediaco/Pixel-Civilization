import {PixelVox,type Ctx} from "./kit";
import {berry,bulbs,butter,cabin,cream,dark,deer,fir,frost,gable,gift,gold,leaf,pad,person,pine,red,snow,star,strand,stroke,tau,wood} from "./christmasKit";

export function bakery(c:Ctx) {
  const {v,hx,hz,lv,variant:k}=c;pad(c);
  const w=Math.min(hx-2,4+2*lv),d=Math.min(hz-2,4+lv),h=5+lv,rise=3+lv;
  cabin(v,0,-1,w,d,h,"#ab663c","#bb7549",rise);
  for(let x=-w;x<=w;x+=2){
    const y=h+1+Math.round(rise*(1-Math.abs(x)/w));
    for(let z=-d;z<d;z+=3) v.put(x,y+1,z,(x+z)%3===0?bulbs[Math.abs(x+z)%5]:cream);
    v.put(x,y-1,d,cream);
  }
  const y=h+rise+1;
  if(k===0)for(const x of [-2,0,2])v.sphere(x,y+1,0,1.6,2,1.6,bulbs[Math.abs(x+1)]);
  if(k===1) for(let i=0;i<4;i++)v.box(-3,y+i,-2,3,y+i+1,2,i%2?cream:wood);
  if(k===2){v.sphere(-1.4,y+3,0,2.2,2,1,red).sphere(1.4,y+3,0,2.2,2,1,red);for(let i=0;i<3;i++)v.box(-i,y+i,-1,i+1,y+i+1,1,red);}
  if(k===3) v.ringZ(0,y+3,-1,1,3,0,cream).box(-1,y+1,0,1,y+6,2,red).box(-3,y+3,0,3,y+4,2,red);
  for(const x of [-w+1,w-1])for(let yy=1;yy<h;yy++)v.put(x,yy,d-1,yy%3===0?red:cream);
  if(lv>2)cabin(v,-w,0,3,3,4,"#a76a43",cream,2);
}
function cane(v:PixelVox,x:number,z:number,h:number,r:number,direction:number,alt=false) {
  const size=h>16?2:1, col=(i:number)=>Math.floor(i/2)%2?cream:alt?leaf:red;
  for(let y=1;y<=h;y++)v.box(x,y,z,x+size,y+1,z+size,col(y));
  for(let i=0;i<18;i++) {
    const a=Math.PI*(1-i/17),xx=x+direction*r*(1+Math.cos(a)),yy=h+r*Math.sin(a);
    v.box(xx,yy,z,xx+size,yy+size,z+size,col(h+Math.round(i*r/5)));
  }
}
export function candyWorks(c:Ctx) {
  const {v,hx,hz,lv,variant:k}=c;pad(c);
  const r=Math.min(hx-3,hz-3,3+lv),kettle="#b67849";
  v.cone(0,1,4,0,r*.68,r,kettle).cylinderY(0,0,4,5,r+1,gold).cylinderY(0,0,5,6,r-1,cream);
  v.box(-2,1,r-1,3,4,r+1,wood).box(-1,2,r,2,4,r+1,"#fa9a43",.55);
  for(const side of [-1,1])v.ringZ(side*r,4,0,2,2,1,gold);
  const left=-Math.round(r*.6);
  cane(v,left,0,8+lv*3,2+lv*.2,k===0?-1:1,k===2);
  if(k>0)cane(v,r-1,-2,6+lv*2+(k===3?2:0),k===3?3:2,-1);
  if(k===2)cane(v,0,2,7+lv,1.7,1,true);
  for(let i=1;i<lv;i++){const a=i*tau/lv; cane(v,Math.cos(a)*(hx-5),Math.sin(a)*(hz-4),4+i*2,1.6,i%2?1:-1,i%2===0);}
  if(k===3)v.box(left,8,0,r,9,1,gold);
}
export function market(c:Ctx) {
  const {v,hx,hz,lv,variant:k}=c;pad(c,"#d0c2a5");
  const count=1+lv, rows=Math.ceil(count/2);
  for(let i=0;i<count;i++){
    const row=Math.floor(i/2),x=(i%2?-1:1)*Math.floor(hx*.46)+(k===3?(row%2)*2:0);
    const z=(row-(rows-1)/2)*Math.min(11,(hz*2-8)/rows)+(k===1?(i%2?2:-2):0);
    const eave=6+(k===2?2:0), color=[berry,pine,"#446e89","#bc633d"][(k+i)%4];
    for(const dx of [-3,3])for(const dz of [-2,2])v.box(x+dx,1,z+dz,x+dx+1,eave,z+dz+1,wood);
    v.box(x-3,1,z+2,x+4,3,z+3,wood);
    for(let dx=-4;dx<=4;dx++)for(let dz=-3;dz<=3;dz++){
      const y=eave+Math.round((3-Math.abs(dz))/2);
      v.put(x+dx,y,z+dz,(dx+4)%3===0?cream:color);
    }
    for(let j=0;j<3;j++)v.put(x-2+j*2,3,z+2,bulbs[(i+j)%5]);
  }
  const w=Math.floor(hx*.7),z=-hz+3;
  for(const x of [-w,w])v.box(x,1,z,x+1,9+lv,z+1,wood);
  strand(v,-w,w,9+lv,z,k+1);
  if(k===1)star(v,0,9+lv,z);
}
export function postOffice(c:Ctx) {
  const {v,hx,hz,lv,variant:k}=c;pad(c);
  const w=Math.min(hx-4,4+lv*1.4),d=Math.min(hz-2,4+lv),h=5+lv;
  v.hollowBox(-w,1,-d,w,h,d,"#457888",gold);
  for(let x=-Math.floor(w);x<=w;x++){
    const arch=Math.round(Math.sqrt(Math.max(0,1-(x/w)**2))*w*.62);
    v.box(x,h-1,-d,x+1,h+arch+1,d,"#497f90").put(x,h+arch,d,cream);
  }
  v.box(-w+1,2,d-1,w-1,h,d,cream);
  stroke(v,[-w+1,h-1,d],[0,Math.max(3,h-4),d],berry);stroke(v,[0,Math.max(3,h-4),d],[w-2,h-1,d],berry);
  v.box(-w+2,h,d-1,w-2,h+1,d+1,dark);
  const x=-hx+2,z=-hz+3,top=h+4+lv;
  for(let y=1;y<top;y++)v.box(x,y,z,x+2,y+1,z+2,y%4<2?red:snow);
  v.put(x,top,z,gold);
  if(k===0)v.box(w-1,h-1,0,w+1,top,1,wood).box(w-1,top-1,0,w+4,top+2,1,red);
  if(k===1)v.box(-3,top-2,-1,4,top+2,1,cream).put(0,top-1,1,red);
  if(k===2)v.ringZ(0,top,-1,1,3,1.7,gold).box(1,top+1,-1,5,top+3,1,gold);
  if(k===3){stroke(v,[w,h,0],[w+3,2,3],gold);gift(v,w,1,3,3,red);}
  for(let i=0;i<lv;i++)v.sphere(-w+2+i*3,2,-d-1,1.7,2,1.6,"#b59872");
}
export function iceRink(c:Ctx) {
  const {v,hx,hz,lv,variant:k}=c;pad(c);
  const rx=Math.min(hx-3,8+lv*3),rz=Math.min(hz-3,6+lv*2);
  for(let x=-rx;x<=rx;x++)for(let z=-rz;z<=rz;z++){
    const u=x/rx,w=z/rz;
    const measure=k===2?Math.abs(u)+Math.abs(w):u*u+w*w*(k===1?1+1.45*Math.exp(-10*u*u):1);
    const bound=k===3?1+.1*Math.cos(6*Math.atan2(w,u)):1;
    if(measure>bound)continue;
    const border=measure>bound-.18;
    v.put(x,1,z,border?frost:(x+z)%13===0?"#a4dce1":"#8bcbd7");
    if(border&&Math.abs(z)>2)v.put(x,2,z,snow);
  }
  for(let i=0;i<lv+1;i++){
    const a=(i+.5)*tau/(lv+1),x=Math.cos(a)*rx*.55,z=Math.sin(a)*rz*.42;
    person(v,Math.round(x),2,Math.round(z),bulbs[(i+k)%5],i%2?"#8d5039":"#d49c74",red);
  }
  for(let i=0;i<lv;i++){const x=-rx+2+i*4;v.box(x,2,-rz-1,x+3,3,-rz,wood);}
  for(const s of [-1,1])v.box(s*(rx-1),1,0,s*(rx-1)+1,6+lv,1,wood).put(s*(rx-1),6+lv,0,butter,1);
}
export function nutcracker(c:Ctx) {
  const {v,lv,variant:k}=c;pad(c);
  const y=4+lv*2,w=2+Math.floor(lv/2);
  for(const s of [-1,1]){const x=s*w;v.box(x-1,1,-1,x+1,4,3,dark).box(x-1,4,-1,x+1,y,2,cream);}
  v.box(-w-1,y,-2,w+2,y+6+lv,2,red).box(-w-1,y+1,-2,w+2,y+2,3,dark);
  for(let j=0;j<3;j++)v.put(0,y+3+j,2,gold);
  for(const s of [-1,1])v.box(s*(w+2),y+1,-1,s*(w+2)+1,y+6,2,red).put(s*(w+2),y+6,0,gold);
  const head=y+6+lv;
  v.box(-3,head,-2,4,head+5,3,"#ba865d").put(-2,head+3,3,dark).put(2,head+3,3,dark)
    .box(-2,head,3,3,head+1,4,cream).box(-2,head+1,3,3,head+2,4,dark)
    .box(-3,head+5,-2,4,head+8+k,3,k===3?gold:dark).box(-3,head+5,-2,4,head+6,3,gold);
  for(const side of [-1,1]) {
    const x=side*3;
    v.box(x,head+1,-2,x+1,head+4,1,cream).put(side*2,head+1,3,dark);
    v.box(side*(w+1),y+4,-1,side*(w+1)+1,y+6,3,gold);
  }
  for(const tooth of [-1,1])v.put(tooth,head,3,dark);
  star(v,0,head+7,3,1);
  if(k===0)stroke(v,[2,head+8,0],[3,head+12,0],red);
  const x=Math.min(c.hx-3,w+4);
  if(k===0)v.cylinderY(0,3,y+1,y+4,3,berry).cylinderY(0,3,y+4,y+5,3,gold);
  if(k===1)v.box(x,1,1,x+1,head+7,2,wood).box(x-3,head+4,1,x+1,head+7,2,leaf);
  if(k===2)v.box(0,head+1,3,2,head+2,7,gold).box(-1,head,6,3,head+3,7,gold);
  if(k===3){v.box(x,1,1,x+1,head+2,2,wood);star(v,x,head+2,1);}
}
export function choir(c:Ctx) {
  const {v,hx,hz,lv,variant:k}=c;pad(c);
  const w=Math.min(hx-2,5+lv*2),d=Math.min(hz-2,3+lv);
  v.box(-w,1,-d,w+1,3,d+1,wood).box(-w,3,-d,w+1,5,0,wood);
  for(let i=0;i<lv+2;i++){
    const x=(i%Math.ceil((lv+2)/2))*5-(Math.ceil((lv+2)/2)-1)*2.5,z=i%2===0?-2:2;
    const y=z<0?5:3;
    person(v,Math.round(x),y,z,[berry,pine,"#3f6382","#755074"][k],["#82503b","#cf916d","#ae7654"][i%3],cream);
    v.box(x-1,y+2,z+1,x+1,y+3,z+2,cream).put(x+1,y+2,z+1,k===2?gold:cream)
      .put(x+1,y+2,z,wood).put(x-1,y+1,z+1,cream);
  }
  for(const x of [-w,w])v.box(x,2,-d,x+1,10+lv,-d+1,wood);
  strand(v,-w,w,10+lv,-d,k%3+1);
  const h=10+lv;
  if(k===0||k===3){v.box(0,h-1,-d,1,h+4,-d+1,gold).box(0,h+3,-d,4,h+4,-d+1,gold).put(-1,h-1,-d,gold);if(k===3)v.box(3,h,-d,4,h+4,-d+1,gold);}
  if(k===1)for(const x of [-w,w])v.put(x,h,-d,butter,1);
  if(k===2)v.cone(0,h,h+4,-d,3,1,gold);
}
export function giftHall(c:Ctx) {
  const {v,hx,hz,lv,variant:k}=c;pad(c);
  const w=Math.min(hx-3,4+lv*2),d=Math.min(hz-3,4+lv),h=5+lv*2;
  const color=["#318278",berry,"#45738d",leaf][k];
  v.hollowBox(-w,1,-d,w,h,d,color).box(-w-1,h-1,-d-1,w+1,h+1,d+1,color)
    .box(-1,1,-d-1,1,h+2,d+1,gold).box(-w-1,h,-1,w+1,h+2,1,gold);
  v.box(w-2,1,d-1,w,4,d,dark);
  const n=[2,4,6,2][k],r=2+lv*.65;
  for(let i=0;i<n;i++)for(let j=0;j<=32;j++){
    const a=i*tau/n+(k===3?Math.PI/4:0),t=j/32,dist=Math.sin(t*Math.PI)*r*1.8;
    const lift=h+1+r*Math.sin(t*Math.PI)*(0.5+1.5*t);
    for(let band=-1;band<=1;band++)v.put(dist*Math.cos(a)-band*Math.sin(a),lift,dist*Math.sin(a)+band*Math.cos(a), k===2?cream:gold);
  }
  for(let i=0;i<3;i++){
    v.box(-1,h+1+i,-1,2,h+2+i,2,i===2?butter:gold);
  }
  if(k===3)for(const s of [-1,1])stroke(v,[0,h+2,0],[s*w,h+2,d],gold);
  for(let i=0;i<lv-1;i++)gift(v,-w+i*3,1,d+1,2+i%2,bulbs[i%5],cream);
}
export function nativity(c:Ctx) {
  const {v,hx,hz,lv,variant:k}=c;pad(c,"#e4d6b5");
  const w=Math.min(hx-3,7+lv*2),d=Math.min(hz-3,4+lv),h=7+lv,z=-2;
  for(const x of [-w,w])for(const dz of [-d,d])v.box(x,1,z+dz,x+1,h,z+dz+1,k===1?"#ad957e":wood);
  if(k===0)for(let x=-w;x<=w;x++)v.box(x,h+Math.round((x+w)/4),z-d,x+1,h+1+Math.round((x+w)/4),z+d+1,wood);
  if(k===1){for(let x=-w;x<=w;x++){const yy=h+Math.round(3*(1-(x/w)**2));v.box(x,yy,z-d,x+1,yy+2,z+d+1,"#b8a18b");}}
  if(k===2)for(let x=-w;x<=w;x+=2)stroke(v,[0,h+4,z],[x,h,z+d],pine);
  if(k===3)gable(v,0,z,w,d,h,5,wood,gold);
  const front=z+d+1;
  person(v,-3,1,front,"#548baf","#ae7352",cream);person(v,3,1,front,wood,"#916249",pine);
  v.box(-1,2,front,2,3,front+2,gold).put(0,3,front+1,cream).put(1,3,front+1,"#b17d59");
  for(const x of [-1,1])v.put(x,1,front,wood);
  for(let i=0;i<lv-1;i++)person(v,(i%2===0?-1:1)*(5+Math.floor(i/2)*4),1,Math.min(hz-2,front+2),bulbs[i],i%2?"#825239":"#b7835e",gold);
  v.box(0,h+2,z-d,1,h+8,z-d+1,wood);star(v,0,h+9,z-d,3);
}
export function globe(c:Ctx) {
  const {v,hx,hz,lv,variant:k}=c;pad(c);
  const r=Math.min(hx-2,hz-2,4+lv*2), base=3+Math.floor(lv/2);
  v.cone(0,1,base+1,0,r,r-.8,berry).cylinderY(0,0,base,base+1,r,gold).cylinderY(0,0,base+1,base+2,r-.6,snow);
  for(let rib=0;rib<6;rib++)for(let i=0;i<=r*3;i++){
    const a=rib*tau/6+Math.PI/12,t=i*Math.PI/(6*r);
    v.put(Math.cos(a)*r*Math.cos(t),base+2+Math.sin(t)*r*1.45,Math.sin(a)*r*Math.cos(t),rib%3===0?frost:"#a4d4de");
  }
  const y=base+2;
  if(k===0)fir(v,0,y,0,r*.46,r*.85,3);
  if(k===1)v.sphere(0,y+r*.29,0,r*.3,r*.3,r*.3,snow).sphere(0,y+r*.69,0,r*.23,r*.23,r*.23,snow).put(0,y+r*.72,r*.2,"#db853d");
  if(k===2){v.box(-r*.32,y,-2,r*.32,y+3,2,wood);gable(v,0,0,Math.max(2,Math.floor(r*.42)),2,y+3,3,red,snow);}
  if(k===3)for(const x of [-2,0,2]){const h=4+(x+2)%3+lv;v.box(x,y,-1,x+1,y+h,1,cream).put(x,y+h,0,gold,1);}
  for(let i=0;i<lv+2;i++){const a=i*2.4;v.put(Math.cos(a)*r*.7,y+2+i%4,Math.sin(a)*r*.7,snow);}
}
export function carousel(c:Ctx) {
  const {v,lv,variant:k}=c;pad(c);
  const r=Math.min(c.hx-3,c.hz-3,6+lv*2),eave=10+lv*2, rise=[4,2,6,8][k];
  v.cylinderY(0,0,1,3,r+1,berry).cylinderY(0,0,3,4,r+1,gold).cylinderY(0,0,4,eave,2,wood);
  for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++){
    const dist=Math.hypot(x,z);if(dist>r+.3)continue;
    const stripe=(Math.floor((Math.atan2(z,x)+Math.PI)*12/tau)+12)%2;
    const y=eave+Math.round((1-dist/r)*rise);
    v.put(x,y,z,stripe?cream:k===2?pine:red);if(dist>r-1)v.put(x,y-1,z,gold);
  }
  star(v,0,eave+rise+2,0,k===3?3:2);
  const mounts=new PixelVox(),n=3+lv;
  for(let i=0;i<n;i++){const a=i*tau/n,x=Math.round((r-3)*Math.cos(a)),z=Math.round((r-3)*Math.sin(a));
    mounts.box(x,4,z,x+1,eave,z+1,gold);deer(mounts,x,5+i%2,z,i%2?cream:"#a16845");}
  c.addRotor({vox:mounts,pivot:[0,0,0],axis:"y",speed:0.28});
}
export function bellTower(c:Ctx) {
  const {v,lv,variant:k}=c;pad(c);
  const w=Math.min(c.hx-3,3+lv),d=Math.min(c.hz-3,2+lv),h=10+3*lv;
  v.box(-w-1,1,-d-1,w+2,3,d+2,"#9c9384");
  for(const x of [-w,w])for(const z of [-d,d])v.box(x-1,2,z-1,x+1,h+2,z+1,k===1?"#637f76":wood);
  stroke(v,[-w,3,-d],[w,h-4,-d],wood);
  for(const zz of [-d,d]) {
    v.box(-w,h,zz,w+1,h+2,zz+1,wood);
    for(const side of [-1,1])stroke(v,[side*w,h-4,zz],[side*(w-3),h,zz],wood);
  }
  v.box(-w,h,0,w+1,h+1,1,wood);v.box(0,h-4,0,1,h+1,1,dark);
  const bell=(x:number,y:number,z:number,r:number)=>{v.cone(x,y,y+Math.ceil(r*1.5),z,r,r*.38,gold).cylinderY(x,z,y,y+1,r+.5,butter).put(x,y-1,z,dark);};
  bell(0,h-6,0,2.4+lv*.43);
  if(lv>=3||k===2){v.box(-w,Math.ceil(h*.53),-d,w+1,Math.ceil(h*.53)+1,d+1,wood);bell(-w*.5,Math.ceil(h*.53)-3,0,1.6);bell(w*.5,Math.ceil(h*.53)-3,0,1.6);}
  if(k===1)v.cone(0,h+2,h+10+lv,0,w+1,.5,pine);
  else gable(v,0,0,w+2,d+2,h+2,2+k,berry,snow);
  if(k===3)star(v,0,h+10,0,3);
}
