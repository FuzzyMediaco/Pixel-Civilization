import type { Ctx } from "./kit";
import { beam, entrance, facade, finish as f, loop, oval, plate, planter, shops, slab, storey, TAU } from "./sculpturalKit";

function steppedMarket(c: Ctx) {
  const {v,lv,hx,hz} = c, floors = lv+2;
  const front = hz-3, back = -hz+2;
  for(let i=0;i<floors;i++){
    const z1=front-i*(front-back)*0.61/floors, z=(back+z1)/2;
    // Expose a deep, inhabitable terrace along both the street and one side.
    const left=-hx+2+i*(hx*0.55)/floors, right=hx-2;
    const x=(left+right)/2, rx=(right-left)/2, rz=(z1-back)/2, y=1+i*4;
    storey(v,plate(x,z,rx-0.8,rz-0.8,0.2),plate(x,z,rx,rz,0.2),y,4,"#496f6d","#c37855");
    if(i>0)for(let a=left+3;a<right-2;a+=7){
      planter(v,a,y-1,z1+1,i>2?2:1);
      v.box(a+2,y,z1,a+4,y+1,z1+1,f.limestone);
    }
    if(i===floors-1){
      const top=y+4;
      slab(v,plate(x,z,rx*0.68,rz*0.65),top,1,f.garden);
      for(const a of [-1,1])planter(v,x+a*rx*0.5,top+1,z,1);
      if(lv>=3)for(let a=x-rx*0.65;a<x+rx*0.65;a+=3)beam(v,[a,top+4,z-rz*0.6],[a,top+4,z+rz*0.6],f.cedar);
      if(lv>=3)for(const a of [-1,1])for(const b of [-1,1])beam(v,[x+a*rx*0.65,top,z+b*rz*0.6],[x+a*rx*0.65,top+4,z+b*rz*0.6],f.cedar);
    }
  }
  shops(v,-hx+3,hx-3,front-1,["#cf714b","#f2c983","#7b9c78"]);
  entrance(c,0,front,3);
}

function ribbonMarket(c: Ctx) {
  const {v,lv,hx,hz}=c, rx=hx-2, rz=hz-2, floors=lv+1;
  const crest=(x:number,z:number) => Math.round(6+floors*2+(3+lv)*Math.cos((x/rx+0.24)*Math.PI) + lv*0.17*z/rz);
  for(let x=-rx;x<rx;x++){
    // A white ribbon folds from the entrance soffit up to the peak. Glazing is recessed between folds.
    const roundEnd=Math.pow(Math.abs((x+0.5)/rx),3);
    const depth=Math.max(3,Math.round(rz*(0.96-0.24*roundEnd)));
    for(let z=-depth;z<depth;z++){
      const roof=crest(x,z);
      v.box(x,roof,z,x+1,roof+2,z+1,f.porcelain);
      if(z===-depth+1||z===depth-2||x===-rx+1||x===rx-2){
        v.box(x,1,z,x+1,roof,z+1,f.nightGlass,0.09);
        if(x%5===0||((x===-rx+1||x===rx-2)&&z%4===0))v.box(x,1,z,x+1,roof,z+1,f.glass);
        for(let y=5;y<roof;y+=4)v.put(x,y,z,f.silver);
      }
    }
  }
  const annex=plate(-0.34*rx,-0.1*rz,rx*0.38,rz*0.52);
  for(let i=0;i<lv;i++)storey(v,annex,plate(-0.34*rx,-0.1*rz,rx*0.43,rz*0.58),6+i*4,4,f.glass,f.porcelain);
  if(lv>=3)slab(v,oval(-rx*0.34,-rz*0.13,rx*0.26,rz*0.28),6+lv*4,1,f.pool);
  shops(v,-rx+1,rx-1,rz-2,[f.copper,f.gold,f.glass]); entrance(c,0,rz-2,3);
}

function lanternMarket(c: Ctx) {
  const {v,lv,hx,hz}=c, rx=hx-2, rz=hz-2;
  for(const side of [-1,1]){
    const x=side*rx*0.49,z=side*rz*0.19, floors=lv+(side<0?2:0);
    for(let i=0;i<floors;i++){
      const turn=0.15+i*0.27*side, y=1+i*4;
      storey(v,oval(x,z,rx*0.43,rz*0.59,6,turn),oval(x,z,rx*0.5,rz*0.72,6,turn),y,4,"#486e75",side<0?"#dc965f":"#e4c69e");
      if(i===floors-1){
        slab(v,oval(x,z,rx*0.34,rz*0.44,6,turn),y+4,1,f.garden);
        planter(v,x,y+5,z,lv>=3?2:1);
      }
    }
  }
  if(lv>=2){
    const y=1+4*Math.max(1,lv-2);
    storey(v,plate(0,0,rx*0.52,2),plate(0,0,rx*0.54,3),y,4,f.glass,f.gold);
  }
  shops(v,-rx*0.8,rx*0.8,rz*0.48,[f.copper,f.garden]); entrance(c,0,rz*0.4,2);
}

function parasolMarket(c: Ctx) {
  const {v,lv,hx,hz}=c, rx=hx-2, rz=hz-2;
  const rearZ=-rz*0.38;
  for(let i=0;i<lv+1;i++){
    const x=0.16*rx*Math.sin(i*0.85), y=1+i*4;
    storey(v,oval(x,rearZ,rx*0.71,rz*0.42,10),oval(x,rearZ,rx*0.82,rz*0.48,10),y,4,"#457982",f.cedar);
  }
  const deck=5+lv;
  for(const side of [-1,1]){
    const x=side*rx*0.46,z=rz*0.31, capX=rx*0.53, capZ=rz*0.61;
    v.cylinderY(x,z,0,deck,1+lv*0.32,f.cedar);
    for(let X=Math.floor(x-capX);X<=x+capX;X++)for(let Z=Math.floor(z-capZ);Z<=z+capZ;Z++){
      const d=((X-x)/capX)**2+((Z-z)/capZ)**2;
      if(d>1)continue;
      const y=Math.round(deck+Math.sqrt(d)*(4+lv*0.55));
      if(X%3===0||Z%3===0||d>0.79)v.box(X,y-2,Z,X+1,y+1,Z+1,(X+Z)%3===0?f.limestone:"#d7995f");
    }
  }
  shops(v,-rx*0.78,rx*0.78,rz*0.37,["#38968c","#eaac59","#ae5a4c"]); entrance(c,0,rz*0.39,3);
  if(lv>=3)for(const side of [-1,1])planter(v,side*rx*0.8,1,rz*0.72,2);
}

export function buildMixedUseMidrise(c: Ctx) {
  [steppedMarket,ribbonMarket,lanternMarket,parasolMarket][c.variant](c);
}

function pivotResidence(c: Ctx) {
  const {v,lv,hx,hz}=c, rx=hx-2, rz=hz-2, n=4+lv*2;
  for(let i=0;i<n;i++){
    const a=i*0.215, y=1+i*4;
    const x=Math.cos(a)*rx*0.09, z=Math.sin(a)*rz*0.12;
    storey(v,oval(x,z,rx*0.67,rz*0.65,5,a),oval(x,z,rx*0.89,rz*0.92,5,a),y,4,f.nightGlass,f.porcelain);
    const [px,pz]=oval(x,z,rx*0.76,rz*0.76,5,a)[i%5];
    if(i%2===1)planter(v,px,y+4,pz);
  }
  const top=1+n*4;
  storey(v,oval(0,0,rx*0.46,rz*0.48,5,0.3),oval(0,0,rx*0.58,rz*0.63,5,0.3),top,3+lv,f.glass,f.silver);
  if(lv>=2)slab(v,oval(0,0,rx*0.34,rz*0.33),top+3+lv,1,f.pool);
}

function villaResidence(c: Ctx) {
  const {v,lv,hx,hz}=c, rx=hx-2,rz=hz-2, pods=2+lv, height=7+lv;
  const shaft=plate(0,-rz*0.18,Math.max(2,rx*0.24),rz*0.35,0.24);
  facade(v,shaft,0,height*pods+1,f.cedar,f.bronze);
  for(let i=0;i<pods;i++){
    const side=i%2===0?-1:1, x=side*rx*0.31, z=rz*(i%3-1)*0.15, y=2+i*height;
    const terrace=plate(x,z,rx*0.64,rz*0.69,0.19);
    slab(v,terrace,y,2,f.porcelain);
    storey(v,plate(x-side*rx*0.12,z-1,rx*0.46,rz*0.48),plate(x-side*rx*0.12,z-1,rx*0.53,rz*0.56),y+2,height-3,f.nightGlass,f.porcelain);
    const pool=plate(x+side*rx*0.41,z,Math.max(1,rx*0.13),rz*0.43);
    slab(v,pool,y+2,1,f.pool,0.14);
    planter(v,x-side*rx*0.29,y+height-1,z+rz*0.35,lv>=3?2:1);
    for(const sideZ of [-1,1]){
      const postZ=sideZ*rz*0.28;
      beam(v,[side*rx*0.13,Math.max(1,y-4),postZ],[x+side*rx*0.49,y,postZ],f.bronze,lv>=3?2:1);
    }
  }
}

function gateResidence(c: Ctx) {
  const {v,lv,hx,hz}=c,rx=hx-2,rz=hz-2, floors=5+lv*2;
  for(const side of [-1,1]){
    const n=floors-(side===1?2:0);
    for(let i=0;i<n;i++){
      const t=i/n, x=side*rx*(0.5+0.13*Math.sin(t*Math.PI)), z=side*rz*0.16;
      const width=rx*(0.31-0.09*t), depth=rz*(0.7-0.22*t), y=1+4*i;
      storey(v,oval(x,z,width,depth,6,Math.PI/6),oval(x,z,width+1,depth+1,6,Math.PI/6),y,4,"#276475",f.gold);
    }
    const top=1+4*n;
    planter(v,side*rx*0.5,top,side*rz*0.16,lv>=3?2:1);
  }
  for(const index of (lv>=3?[2, floors-4]:[floors-4])){
    const y=1+4*index;
    storey(v,plate(0,0,rx*0.53,Math.max(2,rz*0.2)),plate(0,0,rx*0.56,Math.max(2,rz*0.26)),y,4,f.glass,f.gold);
    if(lv>=4)planter(v,0,y+4,0);
  }
}

function haloResidence(c: Ctx) {
  const {v,lv,hx,hz}=c, rx=hx-2, rz=hz-2, floors=5+lv*2, height=floors*4;
  // The stacked elliptic sections create a freestanding ovoid on a small entry plinth.
  for(let i=0;i<floors;i++){
    const t=(i+0.5)/floors, width=0.37+0.59*Math.sin(Math.PI*t)**0.7, depth=width*0.84;
    storey(v,oval(0,0,rx*width,rz*depth),oval(0,0,rx*width,rz*depth),1+i*4,4,f.nightGlass,"#456b7b");
  }
  for(let j=0;j<8;j++){
    const a=j*TAU/8;
    let prev: [number,number,number]|undefined;
    for(let y=1;y<=height+1;y++){
      const width=0.38+0.6*Math.sin(Math.PI*(y-1)/height)**0.7;
      const p:[number,number,number]=[Math.cos(a)*rx*width,y,Math.sin(a)*rz*width*0.87];
      if(prev)beam(v,prev,p,f.pearl); prev=p;
    }
  }
  // Nested facade reveals echo the upright, concentric oval in the reference.
  for(let j=1;j<=(lv>=3?2:1);j++){
    let prev:[number,number,number]|undefined;
    for(let i=0;i<=96;i++){
      const a=i*TAU/96, t=0.51+(0.46-j*0.085)*Math.sin(a);
      const width=0.37+0.59*Math.sin(Math.PI*t)**0.7;
      const x=(0.8-j*0.18)*Math.cos(a);
      const p:[number,number,number]=[rx*width*x,1+t*height,rz*width*0.84*Math.sqrt(1-x*x)];
      if(prev)beam(v,prev,p,f.porcelain); prev=p;
    }
  }
  slab(v,oval(0,0,rx*0.32,rz*0.3),height+1,1,f.pool);
  if(lv>=4)loop(v,oval(0,0,rx*0.36,rz*0.34),height+2,f.gold);
}

export function buildPenthouseTower(c: Ctx) {
  entrance(c,0,0,2);
  [pivotResidence,villaResidence,gateResidence,haloResidence][c.variant](c);
}
