import { archway, bush, person, type Ctx } from "./kit";
import { PixelVox, packVoxKey } from "../voxelCore";
import { networkRoadProfile } from "./networks";
import type { EraActivity, RomeDirection, RomeFamily } from "../eraStyles";

const forum = {
  wall:"#efdab1", stone:"#fff0ca", band:"#c1a681", brick:"#bb7554", shade:"#775044", roof:"#bf593e", tile:"#df8153",
  floor:"#d6bd99", grout:"#b49876", accent:"#aa3333", bronze:"#966e37", leaf:"#72884e", water:"#4bafa9",
};
const aqueduct = {
  wall:"#ba7956", stone:"#dbb58a", band:"#b49b7e", brick:"#994d38", shade:"#653e39", roof:"#963e32", tile:"#c16341",
  floor:"#bca38d", grout:"#958375", accent:"#276761", bronze:"#997241", leaf:"#657e48", water:"#54aaaf",
};
type Ink = typeof forum;
const stonework = (direction:RomeDirection) => direction === "rome-aqueduct" ? aqueduct : forum;
const cloth = ["#a73935","#d8a044","#4d7974","#714959"];
const pale = ["#f7dfb8","#f0d4a1","#e0e2c4","#e6cba9"];

function paveYard(c:Ctx,p:Ink) {
  const {v,hx,hz} = c;
  for (let z=-hz+1;z<hz-1;z++) for (let x=-hx+1;x<hx-1;x++) {
    const seam = (z+hz)%5===0 && (x+hx+z)%7<3;
    v.put(x,0,z,seam?p.grout:p.floor);
  }
}

/** Low-pitched tiled roofs retain their eaves even on very narrow street wings. */
function roof(v:PixelVox,x0:number,z0:number,x1:number,z1:number,y:number,p:Ink,axis:"x"|"z"="x") {
  const depth = axis==="x"?z1-z0:x1-x0;
  for(let i=0;i<depth;i++) {
    const yy=y+Math.floor(Math.min(i,depth-1-i)/2);
    if(axis==="x") v.box(x0,yy,z0+i,x1,yy+1,z0+i+1,p.roof);
    else v.box(x0+i,yy,z0,x0+i+1,yy+1,z1,p.roof);
    for(let k=(axis==="x"?x0:z0)+1;k<(axis==="x"?x1:z1);k+=4) {
      v.put(axis==="x"?k:x0+i,yy,axis==="x"?z0+i:k,p.tile);
    }
  }
}

/** Freestanding arches. Openings are actual holes from both sides. */
function arcade(v:PixelVox,x0:number,x1:number,z:number,y:number,h:number,p:Ink,pitch=8,thick=2) {
  const bays=Math.max(1,Math.round((x1-x0)/pitch));
  v.box(x0,y,z,x1,y+h,z+thick,p.wall);
  for(let i=0;i<bays;i++) {
    const a=x0+Math.round((x1-x0)*i/bays),b=x0+Math.round((x1-x0)*(i+1)/bays);
    const centre=Math.floor((a+b)/2),width=Math.max(2,b-a-3);
    archway(v,centre,y,z,z+thick,width,h-1);
    v.put(centre,y+h-1,z+thick-1,p.stone);
    v.box(a,y+1,z,a+1,y+2,z+thick,p.band);
  }
  v.box(x0,y+h,z,x1,y+h+1,z+thick,p.stone);
}

function wing(v:PixelVox,x0:number,z0:number,x1:number,z1:number,h:number,p:Ink,axis:"x"|"z"="x",y=1) {
  if(x1-x0<3 || z1-z0<3) return;
  v.hollowBox(x0,y,z0,x1,h,z1,p.wall);
  v.box(x0,y,z0,x1,y+1,z1,p.brick);
  for(let yy=y+2;yy<h-1;yy+=5) {
    for(let x=x0+2;x<x1-1;x+=4) {
      v.box(x,yy,z1-1,x+1,Math.min(yy+2,h),z1,p.shade);
      v.put(x,yy,z1-1,"warmGlow",.3);
      v.box(x,yy,z0,x+2,Math.min(h-1,yy+2),z0+1,p.shade);
      if(h-y>6) v.put(x+1,yy,z0,"warmGlow",.32);
    }
    for(let z=z0+1;z<z1-1;z+=4){
      v.box(x1-1,yy,z,x1,Math.min(h-1,yy+2),Math.min(z1-1,z+2),p.shade);
      v.box(x0,yy,z,x0+1,Math.min(h-1,yy+2),Math.min(z1-1,z+2),p.shade);
    }
  }
  v.box(x0,h-1,z0,x1,h,z1,p.stone);
  roof(v,x0-1,z0-1,x1+1,z1+1,h,p,axis);
}

function basin(v:PixelVox,x0:number,z0:number,x1:number,z1:number,y:number,p:Ink,wet:boolean) {
  v.box(x0,y,z0,x1,y+1,z1,p.band);
  v.box(x0+1,y,z0+1,x1-1,y+1,z1-1,wet?p.water:p.floor);
  if(wet && x1-x0>=6) v.put(x0+2,y,z0+1,"#a0d8c6");
  for(let x=x0+2;x<x1-1;x+=3) v.put(x,y,z1-1,p.stone);
}

function cypress(v:PixelVox,x:number,z:number,y:number,height:number,p:Ink) {
  v.box(x,y,z,x+1,y+height,z+1,"woodDark");
  v.box(x-1,y+2,z-1,x+2,y+height-1,z+2,p.leaf);
  v.box(x,y+height-1,z,x+1,y+height+2,z+1,"leafDark");
}

/** Brick hillside builders stacked a service court beneath the living rooms and cut stairs up its flank. */
function terraceHome(c:Ctx,p:Ink) {
  const {v,hx,hz,lv,variant:s}=c, x=-hx+2,X=hx-2,z=-hz+2,Z=hz-2;
  paveYard(c,p);
  const ledge=Math.max(z+5,1), split=Math.min(X-3,x+Math.max(4,Math.floor(hx*.78))), lift=2+lv;
  v.box(x,1,z,X,lift+1,ledge,p.brick);
  arcade(v,x,X,ledge-2,1,lift,p,8,2);
  wing(v,x,z,split,ledge-1,lift+6+lv,p,"z",lift+1);
  wing(v,split,z+1,X,Math.min(ledge,z+5),lift+4,p,"x",lift+1);
  for(let k=0;k<lift;k++)v.box(X-3,1,ledge+k,X,Math.max(2,lift+1-k),ledge+k+1,p.band);
  const port=x+2,top=lift+8+lv;
  if(s===0) basin(v,split,0,X,Math.min(Z,4),1,p,true);
  if(s===1) {v.box(port,lift+5,z+1,port+2,top+2,z+3,p.stone);v.put(port,top+2,z+1,p.tile);}
  if(s===2)cypress(v,split+1,Math.min(Z-1,ledge+2),1,5+lv,p);
  if(s===3){arcade(v,x,split,Math.max(ledge+1,Z-3),1,5,p,6);roof(v,x,Math.max(ledge,Z-4),split,Z,6,p);}
  if(lv>=3)wing(v,x+1,z+1,split-1,ledge-2,top+3,p,"z",lift+5);
  if(lv>=4)arcade(v,x,split+2,Z-2,1,4+lv,p,7);
}

function home(c:Ctx,p:Ink,heavy:boolean) {
  if(heavy){terraceHome(c,p);return;}
  const {v,hx,hz,lv,variant:s}=c;
  const a=-hx+2,b=hx-2,back=-hz+2,front=hz-2,wingZ=back+Math.max(4,Math.round(hz*.6));
  const height=5+Math.floor((lv-1)/2)*3+(heavy?1:0);
  paveYard(c,p);
  wing(v,a,back,b,wingZ,height,p);
  const leftWidth=Math.max(3,Math.floor(hx*.42));
  wing(v,a,wingZ,a+leftWidth,front-(lv<=2?3:1),height+(heavy?2:0),p,"z");
  if(lv>=2) wing(v,b-leftWidth,wingZ,b,front-2,height+(lv>=4?4:0),p,"z");
  if(lv>=3) arcade(v,a+leftWidth,b-leftWidth,front-2,1,heavy?6:5,p,heavy?8:6);
  else {
    v.box(a+leftWidth,1,front-1,-1,3,front,p.band);
    v.box(2,1,front-1,b,3,front,p.band);
  }
  const midZ=Math.max(wingZ+2,2);
  if(s===0) basin(v,-2,midZ-2,3,midZ+2,1,p,true);
  if(s===1) {
    v.box(-2,1,midZ-1,3,2,midZ+2,p.shade);
    for(let x=-1;x<2;x++) v.put(x,1,midZ,(x&1)?p.accent:p.stone);
    v.box(b-2,1,front-3,b,4,front-1,p.accent);
  }
  if(s===2) {basin(v,-2,midZ-2,2,midZ+2,1,p,false);cypress(v,0,midZ,2,5,p);}
  if(s===3) {v.box(-2,1,midZ-2,2,2,midZ+1,p.stone);arcade(v,-2,3,midZ,2,4,p,6,1);roof(v,-3,midZ-2,3,midZ+2,7,p);}
  if(lv>=4) arcade(v,a,b,wingZ,1,5,p,6);
  if(lv>=5) {wing(v,a+1,back+1,a+Math.max(4,leftWidth+2),wingZ,height+6,p);cypress(v,b-3,front-4,1,7,p);}
}

function insula(c:Ctx,p:Ink,heavy:boolean) {
  const {v,hx,hz,lv,variant:s}=c;
  const x=-hx+2,X=hx-2,z=-hz+2,Z=hz-2;
  const front=Z-4, apron=heavy?3:4;
  paveYard(c,p);
  // The street shops support the galleries above. A through passage still opens behind the front arcade.
  v.hollowBox(x,1,z,X,7,front,p.brick);
  archway(v,0,1,front-1,front,3,5);
  arcade(v,x,X,z,1,5,p,6,2);
  if(heavy) {
    const split=Math.min(X-3,x+Math.max(5,Math.floor((X-x)*.46)));
    const baseH=8+lv*2,towerH=baseH+4+lv*3;
    wing(v,x,z,X,Math.max(z+4,front-1),baseH,p);
    wing(v,x+1,z,split,front+1,towerH,p,"z",baseH-1);
    arcade(v,x,X,front,1,6,p,8);
    for(let floor=baseH+2;floor<towerH-1;floor+=4)v.box(x,floor,z,split+1,floor+1,front+1,p.band);
    if(s===0){v.cylinderY(split-2,z+3,towerH,towerH+4,2,p.wall);v.dome(split-2,towerH+4,z+3,2,p.roof);}
    if(s===1)wing(v,X-4,z+1,X,front-1,baseH+4,p,"z",baseH-1);
    if(s===2)cypress(v,X-3,z+3,baseH+2,5,p);
    if(s===3){v.box(x+1,1,z+1,x+4,towerH+5,z+5,p.brick);roof(v,x,z,x+5,z+6,towerH+5,p);}
    if(lv>=4)arcade(v,split,X,front-1,baseH-1,4,p,6,1);
    return;
  }
  arcade(v,x,X,front,1,5,p,heavy?8:6);
  const missing=(s===1||s===3) ? Math.max(4,Math.floor((X-x)/4)):0;
  for(let i=0;i<lv+1;i++) {
    const y=7+i*4, upper=i===lv, left=x+(upper?s%3+1:0), right=X-(upper?missing:0);
    v.hollowBox(left,y,z,right,y+4,front+2,p.wall);
    v.box(left,y,z,right,y+1,front+2,upper?p.band:p.brick);
    for(let xx=left+2;xx<right-2;xx+=4) {
      v.box(xx,y+1,front+1,xx+2,y+3,front+2,heavy?p.shade:p.accent);
      v.put(xx,y+1,front+1,"warmGlow",.36);
      v.box(xx,y+1,z,xx+2,y+3,z+1,p.shade);
      v.put(xx,y+1,z,"warmGlow",.3);
      if(s===0||s===2) v.box(xx-1,y,z-1,xx+2,y+1,z,p.band);
    }
    for(let zz=z+2;zz<front;zz+=5){
      v.box(right-1,y+1,zz,right,y+3,zz+2,p.shade);
      v.box(left,y+1,zz,left+1,y+3,zz+2,p.shade);
    }
    if(i%2===1 && s===1) {v.box(left,y,z-1,right,y+1,z,p.stone);for(let xx=left;xx<right;xx+=3)v.put(xx,y+1,z-1,p.accent);}
    if(upper) {
      // A shaded roof court is still visible above adjoining blocks.
      const ridge=lv>=3? z+Math.max(4,Math.floor((front-z)*.48)):front+apron-1;
      roof(v,left-1,z-1,right+1,ridge,y+4,p);
      if(lv>=3){v.box(left,y+3,ridge,right,y+4,front+2,p.floor);arcade(v,left,right,front, y+4,3,p,6,1);}
      if(s===0||s===3) wing(v,left+1,z+1,left+Math.min(7,right-left-1),z+5,y+(s===3?12:9),p,"x",y+4);
      if(s===2) {v.box(left+1,y+6,z+3,right-1,y+7,z+6,p.stone);cypress(v,left+3,z+4,y+7,4,p);}
      if(s===1) {for(const xx of [left+2,Math.max(left+3,right-2)])v.box(xx,y+4,z,xx+1,y+10,z+1,p.bronze);
        v.box(left+2,y+9,z,right-1,y+10,z+3,p.accent);}
    }
  }
  if(lv>=4) for(let xx=x+2;xx<X;xx+=7) bush(v,xx,1,Z-1,1,p.leaf);
}

function amphora(v:PixelVox,x:number,y:number,z:number,col:string) {
  v.put(x,y,z,col);v.box(x-1,y+1,z-1,x+2,y+3,z+2,col);v.put(x,y+3,z,"#b07b52");
  v.put(x,y+4,z,"#e3a374");
}

function market(c:Ctx,p:Ink,heavy:boolean,active:boolean) {
  const {v,hx,hz,lv,variant:s}=c;
  const x=-hx+2,X=hx-2,z=-hz+2,Z=hz-2, height=heavy?7+lv:5+lv;
  paveYard(c,p);
  const rear=z+Math.max(3,Math.floor(hz*.4));
  wing(v,x,z,X,rear,height,p);
  const width=Math.max(3,Math.floor((X-x)/4));
  // Shoppers approach from +z. Sheltered counters face inward on both flanks.
  for(const side of [0,1]) {
    const ax=side?X-width:x,bx=side?X:x+width;
    for(let zz=rear+1;zz<Z-1;zz+=6) {
      const end=Math.min(Z,zz+5);
      v.box(ax,1,zz,bx,3,end,p.brick);
      for(const xx of [ax,bx-1]) v.box(xx,2,zz,xx+1,height,zz+1,p.bronze);
      for(let xx=ax-1;xx<=bx;xx++) {
        const yy=height-Math.floor(Math.abs(xx-(side?bx:ax))/3);
        for(let k=zz;k<end;k++) v.put(xx,yy,k,(Math.floor((k-zz)/2)%2)?pale[s]:cloth[s]);
      }
      if(active) {
        const mx=Math.floor((ax+bx)/2);
        if(s===0||s===2) amphora(v,mx,3,zz+2,s===0?p.roof:p.leaf);
        else v.box(ax,3,zz+1,bx,4,Math.min(end,zz+3),s===1?"#c5a64d":cloth[s]);
      }
    }
  }
  if(lv>=2) {const sx=heavy?x:X-3;v.box(sx,1,Z-2,sx+2,height+2,Z,p.wall);v.box(sx-1,height,Z-2,sx+3,height+2,Z,p.accent);}
  if(lv>=3) arcade(v,x,X,rear+1,1,height-1,p,heavy?9:6,1);
  if(lv>=4) {wing(v,x+1,z+1,x+Math.max(5,width+1),rear+1,height+5,p); cypress(v,X-2,Z-2,1,5,p);}
  if(lv===5) {const mx=Math.floor((x+X)/2);v.box(mx-2,1,1,mx+3,2,5,p.stone);v.box(mx,2,2,mx+1,height,3,p.bronze);v.dome(mx,height,2,3,cloth[s]);}
  if(heavy){
    // Keep one open shed for carts. The high horreum and raised grain doors change the whole roofline.
    const broad=Math.min(X-3,x+Math.max(4,Math.round((X-x)*.36)));
    wing(v,x,z,broad,Math.min(Z-1,rear+Math.max(4,hz*.55|0)),height+3+lv,p,"z");
    v.box(x,1,Z-2,broad,3,Z,p.brick);
    arcade(v,x,broad,Z-2,2,5+lv,p,6,1);
    v.box(x,7+lv,Z-2,broad,8+lv,Z,p.stone);
    if(lv>=2){v.box(x+1,height+lv+3,z+1,x+3,height+lv+6,z+3,p.brick);v.put(x+1,height+lv+6,z+1,p.bronze);}
  }else if(lv>=2){
    const radius=Math.max(2,Math.min(4,hx/4|0)),cz=Math.floor((Z+rear)/2);
    v.cylinderY(0,cz,1,2,radius+1,p.stone);
    for(const dx of [-radius+1,radius-1]) for(const dz of [-1,1])v.box(dx,2,cz+dz,dx+1,6,cz+dz+1,p.wall);
    // The covered round scale-house has a tiled drum and a brass finial.
    v.cylinderY(0,cz,5,6,radius,p.stone);
    v.dome(0,6,cz,radius,p.roof);v.put(0,7+radius,cz,p.bronze);
  }
  // At the delivery side, a raised balance and full amphorae make an occupied market legible at dusk.
  const post=X-2,gate=Z-2;
  v.box(post,1,gate,post+1,7,gate+1,p.bronze);
  v.box(post-2,5,gate,post+2,6,gate+1,active?p.stone:p.shade);
  if(active) {
    for(const dx of [-2,1]){v.put(post+dx,4,gate,p.bronze);v.put(post+dx,3,gate,"#eabc68",.68);}
    amphora(v,Math.max(x+2,post-4),1,gate-1,"#ad673d");
  } else {
    v.box(post-2,2,gate,post+1,3,gate+1,"woodDark");
  }
}

function farm(c:Ctx,p:Ink,heavy:boolean,wet:boolean) {
  const {v,hx,hz,lv,variant:s}=c;
  const x=-hx+1,X=hx-1,z=-hz+1,Z=hz-1;
  v.box(x,0,z,X,1,Z,"soil");
  const building=c.id!=="fields";
  const end=building? Math.min(2,z+Math.max(5,Math.round(hz*.77))):z;
  const step=s===2?5:s===1?4:3;
  for(let xx=x+1;xx<X-1;xx+=step) {
    v.box(xx,0,end+1,xx+1,1,Z,"soilDark");
    for(let zz=end+2;zz<Z-1;zz+=s===2?5:3) {
      if(s===2){v.box(xx,1,zz,xx+1,3,zz+1,"woodDark");bush(v,xx,3,zz,1.5,p.leaf);}
      else if(s===1){v.box(xx,1,zz,xx+1,4,zz+1,"oak");v.box(xx,3,zz,xx+1,4,Math.min(Z,zz+3),p.leaf);v.put(xx,2,zz+1,"#735068");}
      else {v.box(xx,1,zz,xx+1,s===0?3:2,zz+2,s===0?"#d4ac52":"#72954a");if(s===0)v.put(xx,3,zz,"#e6c571");}
    }
  }
  v.box(x,0,z,x+1,1,Z,wet?p.water:p.grout);
  if(building) {
    const split=Math.max(x+4,Math.floor((x+X)/2));
    wing(v,x+2,z+1,split,end+1,4+lv+(c.id==="farm_houses"?2:0),p);
    if(lv>=2||heavy){v.cylinderY(X-3,z+3,1,4+lv,2,p.wall);v.dome(X-3,4+lv,z+3,2,p.roof);}
    if(lv>=3) arcade(v,split+1,X,end,1,4,p,6,1);
    if(lv>=4){v.box(split-1,1,end+2,split+2,4,end+5,p.bronze);v.box(split,4,end+3,split+1,7,end+4,"oak");}
  }
  if(lv>=2&&c.id==="fields") v.box(x,1,z,X,2,z+1,p.band);
  if(lv>=4&&c.id==="fields") cypress(v,X-2,z+2,1,lv,p);
}

function baths(c:Ctx,p:Ink,heavy:boolean,wet:boolean) {
  const {v,hx,hz,lv,variant:s}=c;
  const x=-hx+1,X=hx-1,z=-hz+1,Z=hz-1,r=Math.max(2,Math.floor(Math.min(hx,hz)*.32));
  paveYard(c,p);
  const end=z+Math.max(4,Math.floor(hz*.72)), h=4+lv+(heavy?2:0);
  wing(v,x+1,z+1,X-1,end,h,p);
  arcade(v,x+1,X-1,end,1,h-1,p,heavy?7:5,2);
  const px=x+Math.max(3,Math.floor(hx*.54)),pz=Math.max(end+4,Math.floor((end+Z)/2));
  if(s===0) {
    v.cylinderY(px,pz,1,3,r,p.stone);v.cylinderY(px,pz,2,3,Math.max(1,r-1),wet?p.water:p.floor);
  } else {
    basin(v,x+1,end+3,X-2,Z-1,1,p,wet);
    if(s===1) v.box(x+2,2,Z-3,X-3,3,Z-2,p.stone);
    if(s===2) v.box(0,1,end+3,2,3,Z-1,p.stone);
    if(s===3) for(let xx=x+3;xx<X-2;xx+=3) v.put(xx,1,Z-1,p.accent);
  }
  const cx=X-2;
  for(let zz=z+1;zz<Z;zz++) {
    const y=2+Math.floor((Z-zz)/(heavy?5:8));
    v.box(cx-1,1,zz,cx+2,y+1,zz+1,p.brick);
    v.put(cx,y,zz,wet?p.water:p.floor);
    v.put(cx-1,y+1,zz,p.stone);v.put(cx+1,y+1,zz,p.stone);
  }
  if(lv>=2 || heavy) {
    const rr=Math.max(2,Math.min(5,Math.floor(hx/3))),xx=x+rr+1,zz=z+rr+1;
    v.cylinderY(xx,zz,h-1,h+3,rr,p.wall);v.dome(xx,h+3,zz,rr,heavy?p.roof:p.stone);
    v.put(xx,h+rr+3,zz,p.bronze);
  }
  if(lv>=3) {v.box(X-4,1,z+2,X-2,h+4,z+4,p.brick);if(wet)c.smoke(X-3,h+4,z+3,"steam");}
  if(lv>=4) cypress(v,x+2,Z-3,1,6,p);
  if(lv===5) {v.cylinderY(0,z+3,h,h+4,r,p.band);v.dome(0,h+4,z+3,r,p.tile);}
  // Stepping down from the civic hall makes even a drained bath read as a basin.
  for(let xx=x+2;xx<X-3;xx+=3) {v.put(xx,1,Z-2,p.band);v.put(xx,1,Z-3,wet?p.water:p.grout);}
  if(heavy){
    const width=Math.max(4,Math.min(9,Math.floor(hx*.58))),xx=X-width,zz=z+1,top=7+lv*2;
    v.hollowBox(xx,1,zz,X,top,zz+width,p.brick);
    v.box(xx-1,top-1,zz-1,X+1,top,zz+width+1,p.stone);
    basin(v,xx-1,zz-1,X+1,zz+width+1,top,p,wet);
    archway(v,xx+Math.floor(width/2),1,zz,zz+width,width-2,top-3);
    for(let k=0;k<top-2;k++)v.put(xx+1,2+k,zz+width-1,k%3?p.band:p.stone);
  } else if(lv===1) {
    v.cylinderY(x+3,z+3,h,h+2,2.5,p.wall);v.dome(x+3,h+2,z+3,2.5,p.stone);
  }
}

function mirror(v:PixelVox,x:number,z:number,y:number,r:number,s:number,p:Ink) {
  v.cylinderY(x,z,1,y,1.5,p.wall);
  v.box(x-1,y,z-1,x+2,y+2,z+2,p.bronze);
  for(let dx=-r;dx<=r;dx++) for(let dz=-r;dz<=r;dz++) {
    if(dx*dx+dz*dz>r*r+.25 || (s===2 && dz<0 && Math.abs(dx)>r/2))continue;
    const yy=y+3+Math.floor((dz+r)/2);
    const rim=dx*dx+dz*dz>(r-1)*(r-1);
    const col=rim?p.bronze:(s===1?"#d2d1b4":(dx===0||dz===0?"#f2d386":"#d5aa5a"));
    v.put(x+dx,yy,z+dz,col);
  }
  if(s===2) {v.box(x,y+2,z-r-1,x+1,y+6,z-r,p.bronze);v.put(x,y+6,z-r-1,p.stone);}
}

function sunworks(c:Ctx,p:Ink,heavy:boolean,active:boolean) {
  const {v,hx,hz,lv,variant:s}=c;
  paveYard(c,p);
  const x=-hx+2,X=hx-2,z=-hz+2,Z=hz-2;
  const tx=heavy?x+2:0,tz=z+2,h=6+lv*2;
  v.box(tx-2,1,tz-2,tx+3,3,tz+3,p.stone);
  v.box(tx-1,3,tz-1,tx+2,h,tz+2,p.brick);
  v.box(tx-2,h-1,tz-2,tx+3,h,tz+3,p.bronze);
  v.cylinderY(tx,tz,h,h+2,1.5,active?"warmGlow":p.shade,active ? .8 : 0);
  const cols=lv>=3?3:2,rows=Math.ceil(lv/2), r=s===3?2:Math.max(2,Math.min(4,Math.floor((X-x)/(cols*2))-1));
  for(let row=0;row<rows;row++) for(let col=0;col<cols;col++) {
    const mx=Math.floor(x+(X-x)*(col+.5)/cols),mz=Math.floor(z+4+(Z-z-4)*(row+.5)/rows);
    mirror(v,mx,mz,2+(heavy?row+1:0),r,s,p);
    if(s===3) mirror(v,mx+2,mz-2,2,1,0,p);
  }
  if(lv>=3 || heavy) arcade(v,x,X,z,1,4,p,7,1);
  if(lv===5) wing(v,X-6,z,X,z+5,9,p);
}

function station(c:Ctx,p:Ink,heavy:boolean,active:boolean) {
  const {v,hx,hz,lv,variant:s}=c;
  const x=-hx+1,X=hx-1,z=-hz,Z=hz-1;
  const platformEnd=z+(lv>=3?5:4);
  if(c.id==="train_depots") {
    // Real depot trains park and leave along x at these exact track centers.
    v.box(-hx,0,z,hx,1,Z,p.floor);
    const trackCount=[1,2,3,3,4][lv-1];
    for(let n=0;n<trackCount;n++) {
      const tz=z+4+n*8;
      if(tz+3>hz)break;
      for(let xx=-hx;xx<hx;xx+=3)v.box(xx,1,tz-3,xx+1,2,tz+4,"woodDark");
      for(const dz of [-2,2])v.box(-hx,2,tz+dz,hx,3,tz+dz+1,p.bronze);
      const last=Math.min(X-4,x+5+lv*3);
      for(const pos of [z+n*8,z+n*8+7]) {
        for(let xx=x+1;xx<last;xx+=5)v.box(xx,1,pos,xx+1,10+lv,pos+1,p.wall);
      }
      roof(v,x,z+n*8,last,z+n*8+8,10+lv,p);
    }
    wing(v,x+1,Z-5,X-2,Z-1,5+lv,p);
    if(active)person(v,X-3,1,Z-3,cloth[s],p.shade);
  } else {
    paveYard(c,p);
    v.box(-hx,0,z,hx,2,platformEnd,p.floor);
    v.box(-hx,2,z,hx,3,z+1,p.stone);
    for(let xx=x;xx<X;xx+=4)v.put(xx,2,z,p.accent);
    const h=5+lv+(heavy?2:0);
    const canopyZ=platformEnd+1;
    arcade(v,x,X,canopyZ,1,h,p,heavy?8:6,1);
    if(s===0) {
      for(let xx=x;xx<X;xx++)v.box(xx,h+1,z+1,xx+1,h+2,canopyZ+2,(Math.floor((xx-x)/3)&1)?pale[s]:cloth[s]);
    } else roof(v,x,z+1,X,canopyZ+2,h+1,p);
    if(s===1) wing(v,x+2,canopyZ+1,Math.min(X,x+8),Math.min(Z,canopyZ+6),5+lv,p,"z");
    if(s===2) for(let xx=x+2;xx<X-1;xx+=6){v.box(xx,1,canopyZ+2,xx+2,4,canopyZ+4,p.bronze);v.put(xx,4,canopyZ+3,p.stone);}
    if(s===3) v.ringZ(0,h+2,canopyZ,canopyZ+2,3,2,p.stone);
    if(lv>=2 || heavy) wing(v,x,Z-Math.max(3,hz/3|0),X,Z,5+lv,p);
    if(lv>=4) {const xx=X-3;v.box(xx-1,1,Z-4,xx+2,h+6,Z-1,p.brick);v.dome(xx,h+6,Z-3,2,p.bronze);}
    if(active) for(let xx=x+2;xx<X-1;xx+=7)person(v,xx,2,z+2,cloth[s],"woodDark");
  }
  // The four terminal types have distinct skyline markers even at the smallest tier.
  // Passengers can see the near-side stairs and a clear path through the public hall to the boarding edge.
  const gateWidth=Math.min(7,Math.max(4,Math.floor(hx*.52)));
  archway(v,0,1,Math.max(platformEnd,Z-Math.max(4,Math.floor(hz/3))-1),Z,gateWidth,5);
  for(let zz=Math.max(platformEnd,Z-6);zz<Z;zz++)v.box(-1,0,zz,2,1,zz+1,p.stone);
  const bx=X-2,bz=Z-1;
  v.box(bx,1,bz,bx+1,5+s,bz+1,p.bronze);
  if(active) {
    v.put(bx+1,5+s,bz,p.stone);v.put(bx+2,6+s,bz,"#ffe8a3",.9);
    v.box(bx-1,2,bz,bx,5,bz+1,cloth[s]);
  } else v.box(bx-1,4+s,bz,bx+2,5+s,bz+1,p.shade);
}

function observatory(c:Ctx,p:Ink,heavy:boolean,active:boolean) {
  const {v,hx,hz,lv,variant:s}=c;
  const r=Math.min(hx-3,hz-3,4+lv*2);
  const cy=7+lv*2+(heavy?8+lv*2:0);
  paveYard(c,p);
  for(let i=0;i<3;i++)v.cylinderY(0,-1,i,i+1,r+2-i,p.stone);
  if(heavy) {
    for(let i=0;i<3;i++){
      const half=Math.max(2,r-i-1), from=3+Math.floor((cy-3)*i/3), to=3+Math.floor((cy-3)*(i+1)/3);
      v.hollowBox(-half,from,-1-half,half+1,to,half,p.brick);
      arcade(v,-half,half+1,half-2,from,Math.max(3,to-from-1),p,7,2);
      v.box(-half-1,to-1,-half-2,half+2,to,half+1,p.band);
    }
  }else v.cylinderY(0,-1,3,cy,r-2,p.brick);
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6,xx=Math.round(Math.cos(a)*(r-2)),zz=Math.round(Math.sin(a)*(r-2))-1;
    v.box(xx,3,zz,xx+1,cy,zz+1,heavy?p.band:p.stone);
  }
  v.cylinderY(0,-1,cy,cy+1,r,p.stone);
  const rings=new PixelVox(1);
  const sphereY=cy+r+2;
  for(let i=0;i<240;i++){
    const t=i/240*Math.PI*2,dx=Math.cos(t)*r,dz=Math.sin(t)*r;
    rings.put(dx,dz,0,p.bronze);
    rings.put(dx*.45,dz*.7,dx*.9-dz*.3,s===1?"#cfccc0":"#e5bb63");
    rings.put(dx,0,dz,p.tile);
    if(s>=2)rings.put(dx*.2+dz*.7,dx,-dz*.58,p.stone);
  }
  const globe=s===3?Math.max(2,r*.35):1.5;
  rings.sphere(0,0,0,globe,globe,globe,"#72a3a5");
  c.addRotor({vox:rings,pivot:[0,sphereY,-1],axis:"y",speed:active ? .3 : 0});
  if(lv>=2){arcade(v,-hx+2,hx-2,hz-5,1,5+lv,p,6);roof(v,-hx+2,hz-6,hx-2,hz-2,6+lv,p);}
  if(lv>=3)for(const xx of [-hx+4,hx-4])cypress(v,xx,hz-6,1,6+lv,p);
  if(lv>=4 || heavy) {wing(v,-hx+1,-hz+2,-hx+7,-hz+8,cy-1,p);v.put(-hx+3,cy+2,-hz+4,p.bronze);}
}

type PavingFamily = "road"|"track"|"bridge"|"aqueduct";
const decode = (k:number,shift:number) => ((k >> shift)&1023)-512;
const repaves = new Map<string,Map<number,number>>();
function stamp(color:string,emit=0) {
  const sample=new PixelVox();sample.put(0,0,0,color,emit);return sample.v.get(packVoxKey(0,0,0))!;
}
function swaps(direction:RomeDirection,family:PavingFamily,wet:boolean,s:number) {
  const key=[direction,family,wet,s].join("/");
  let map=repaves.get(key);
  if(map)return map;
  const p=stonework(direction), road=["#7f776e","#997d72","#bcac90","#8c8681"][s];
  map=new Map();
  const palettes: [string,string][]=[
    ["asphalt",road],["asphaltDark",p.shade],["#485158",road],["#665550",road],["#4b5663",road],["#495350",road],
    ["concrete",p.floor],["concrete2",p.band],["concreteDark",p.grout],["granite",p.shade],["stone",p.band],
    ["limestone",p.wall],["marble",p.stone],["sand",p.wall],["sandDark",p.brick],["brickDark",p.shade],
    ["steelDark",family==="track"?p.bronze:p.brick],["steel",family==="track"?"#a5916d":p.band],
    ["steelLight",p.stone],["white",p.stone],["hazard",p.bronze],["yellow",p.band],["#a5a394",p.band],["#acaa96",p.grout],
    ["#d4d1be",p.floor],["#e5e1cd",p.stone],["#d3ab59",p.bronze],
  ];
  for(const [from,to] of palettes)map.set(stamp(from),stamp(to));
  if(family==="aqueduct") for(const col of ["water","foam","waterDeep","cyan","sky"]) {
    for(const e of [0,.1,.15,.2,.25,.3,.4])map.set(stamp(col,e),stamp(wet?p.water:p.grout));
  }
  repaves.set(key,map);return map;
}

function dressNetwork(v:PixelVox,direction:RomeDirection,s:number,family:PavingFamily,wet:boolean) {
  const map=swaps(direction,family,wet,s), p=stonework(direction);
  const seam=stamp(p.grout), stripe=stamp(p.floor);
  for(const [k,style] of v.v) {
    const target=map.get(style);
    if(target===undefined)continue;
    const x=decode(k,20),y=decode(k,10),z=decode(k,0);
    const masonryJoint=(x+Math.floor(z/3)*2+s+96)%5===0 && (z+96)%3!==2;
    if((family==="road"||family==="bridge") && y<=2 && masonryJoint)v.v.set(k,seam);
    else if(family==="aqueduct" && y>2 && y%5===0 && (x+32)%4<3)v.v.set(k,stripe);
    else v.v.set(k,target);
  }
}

/** A divided carriageway is generated at twice the base voxel resolution; keep all survey geometry. */
export function paveCorridor(deck:PixelVox,direction:RomeDirection,variant:number) {
  dressNetwork(deck,direction,variant,"road",false);
}

/** Replace modern overhead trusses without moving a single voxel of the traveled deck or its ramps. */
function bridge(c:Ctx,p:Ink,heavy:boolean) {
  const profile=networkRoadProfile(c.id,c.conn);
  if(!profile)return;
  const rim=new Set<number>(), {v,variant:s,lv}=c;
  for(const key of v.v.keys()){
    const x=decode(key,20),y=decode(key,10),z=decode(key,0);
    if(x< -8 || x>=8 || z< -8 || z>=8)continue;
    const cell=(x+8)*16+z+8,h=profile.heights[cell];
    if(y<=h)continue;
    if(y===h+1 && (Math.abs(x+.5)>=5.5||Math.abs(z+.5)>=5.5))rim.add(cell);
    v.v.delete(key);
  }
  for(const cell of rim) {
    const x=Math.floor(cell/16)-8,z=cell%16-8,h=profile.heights[cell];
    // Omit stripes over the ground-level crossing and preserve every open approach.
    if(!v.v.has(packVoxKey(x,h,z))) continue;
    const col=(x+z+s+32)%5===0?p.stone:p.wall;
    v.put(x,h+1,z,col);
    if(lv>=2 && ((x+z+32)%4===0 || heavy))v.put(x,h+2,z,p.band);
    if(x===-8||x===7||z===-8||z===7)continue;
    if(((x+z+35+s)%9===0) && lv>=3){
      v.box(x,h+2,z,x+1,h+lv+2,z+1,p.wall);
      v.put(x,h+lv+2,z,s===2?"#dfb86f":p.stone,s===2 ? .3 : 0);
    }
  }
}

function waterArcade(c:Ctx,p:Ink,heavy:boolean,wet:boolean) {
  const {v,hx,hz,lv,variant:s}=c;
  const tiers=lv<3?1:lv<5?2:3;
  let base=1;
  for(let i=0;i<tiers;i++){
    const h=(heavy?8:6)+(lv%2===0?2:0);
    const thick=heavy && i===0?5:3, z=-Math.floor(thick/2);
    arcade(v,-hx,hx,z,base,h,p,heavy?(s===1?8:11):(s===1?5:7),thick);
    if(s===2)for(let x=-hx+1;x<hx;x+=3)v.put(x,base+h-1,z+thick-1,p.brick);
    base+=h+1;
  }
  v.box(-hx,base,-2,hx,base+1,3,p.band);
  for(const z of [-2,2])v.box(-hx,base+1,z,hx,base+2,z+1,p.stone);
  v.box(-hx,base, -1,hx,base+1,2,wet?p.water:p.grout);
  // Control gate rises off its dry sill when a supply becomes available.
  const gate=-hx+3+s;
  for(const z of [-2,2])v.box(gate,base+1,z,gate+1,base+5,z+1,p.bronze);
  v.box(gate,base+(wet?4:1),-2,gate+1,base+(wet?5:2),3,wet?"#e4c076":"woodDark",wet ? .45 : 0);
  if(s===1 || s===3)cypress(v,hx-3,hz-3,1,s===1?5:8,p);
  if(lv>=3)basin(v,-hx+1,3,-hx+Math.min(hx,8),hz-1,1,p,wet);
  if(lv>=4) {
    const wheel=new PixelVox();wheel.ringZ(0,0,0,1,3.5,2.5,"woodDark");
    for(let i=0;i<8;i++) for(let k=0;k<4;k++)wheel.put(Math.round(k*Math.cos(i*Math.PI/4)),Math.round(k*Math.sin(i*Math.PI/4)),0,p.bronze);
    c.addRotor({vox:wheel,pivot:[hx-6,4,4],axis:"z",speed:wet?-1:0});
  }
}

export function buildRome(c:Ctx,direction:RomeDirection,family:RomeFamily,activity:EraActivity,original:()=>void) {
  const p=stonework(direction),heavy=direction==="rome-aqueduct",active=activity==="active";
  switch(family) {
    case "house": home(c,p,heavy);break;
    case "apartment": insula(c,p,heavy);break;
    case "market": market(c,p,heavy,active);break;
    case "farm": farm(c,p,heavy,active);break;
    case "water": baths(c,p,heavy,active);break;
    case "power": sunworks(c,p,heavy,active);break;
    case "station": station(c,p,heavy,active);break;
    case "landmark": observatory(c,p,heavy,active);break;
    case "aqueduct": waterArcade(c,p,heavy,active);break;
    default:
      original();
      dressNetwork(c.v,direction,c.variant,family,active);
      if(family==="bridge") bridge(c,p,heavy);
      if(family==="road" && c.lv>=6) {
        // Inlaid drainage stones keep high-tier paving distinct on short segments.
        const axisX=Boolean(c.conn&10)&&!(c.conn&5);
        for(let i=0;i<c.lv-5;i++){
          const along=-5+i*2,across=c.variant%2===0?-2:2;
          const x=axisX?along:across,z=axisX?across:along;
          for(let y=3;y>=0;y--){
            if(!c.v.v.has(packVoxKey(x,y,z)))continue;
            c.v.put(x,y,z,i%2===0?p.brick:p.band);break;
          }
        }
      }
      break;
  }
}
