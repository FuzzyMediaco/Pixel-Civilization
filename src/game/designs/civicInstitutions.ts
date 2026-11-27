import type { Ctx } from "./kit";
import { beam, entrance, facade, finish as f, loop, oval, plate, planter, shops, slab, storey, TAU, type Point3 } from "./sculpturalKit";

function forum(c: Ctx,x: number,z: number,rx: number,rz: number,opening: number, sweep: number) {
  const {v,lv}=c, tiers=2+lv;
  // The tiers are open to the sky. Leave out a wedge for the public entrance.
  slab(v,oval(x,z,rx,rz),0,1,"#c5b38b");
  for(let i=0;i<tiers;i++){
    const r=0.49+0.46*i/(tiers-1),y=1+i;
    let previous:Point3|undefined;
    for(let j=0;j<=50;j++){
      const a=opening+sweep/2+(TAU-sweep)*j/50;
      const p:Point3=[x+rx*r*Math.cos(a),y,z+rz*r*Math.sin(a)];
      if(previous)beam(v,previous,p,i%2?f.cedar:f.limestone,2);
      if(i===tiers-1 && j%8===0){
        const base=Math.round(y)+2;
        v.box(p[0],base,p[2],p[0]+1,base+2+lv,p[2]+1,f.bronze);
        v.put(p[0],base+2+lv,p[2],f.amber,0.5);
      }
      previous=p;
    }
  }
  const dais=oval(x,z,Math.max(2,rx*0.25),Math.max(2,rz*0.23),8);
  slab(v,dais,1,2,f.porcelain);
  v.box(x-1,3,z-1,x+2,5,z+1,f.cedar);
}

export function boroughAssembly(c: Ctx) {
  const {v,lv,variant:s,hx,hz}=c,rx=hx-3,rz=hz-3;
  if(s===0||s===2){
    forum(c,0,rz*0.15,rx*0.92,rz*0.77,s===0?Math.PI/2:0.28,s===0?1.04:2.38);
    const back=plate(0,-rz*0.55,rx*(s===2?0.82:0.54),rz*0.3,0.44);
    storey(v,back,back,1,4+lv,f.glass,f.limestone);
    if(s===2)for(let j=-3;j<=3;j++){
      const x=rx*j/4;
      beam(v,[0,6+lv,-rz*0.72],[x,7+lv+Math.abs(j),-rz*0.22],f.copper,2);
    }
  }else if(s===1){
    for(const side of [-1,1]){
      const p=plate(side*rx*0.52,-rz*0.11,rx*0.39,rz*0.71,0.45,side*0.12);
      for(let i=0;i<2+Math.floor(lv/2);i++)storey(v,p,p,1+4*i,4,"#778674",f.limestone);
    }
    forum(c,0,rz*0.37,rx*0.48,rz*0.47,Math.PI/2,1.5);
  }else{
    forum(c,-rx*0.38,-rz*0.18,rx*0.54,rz*0.65,0.5,0.98);
    forum(c,rx*0.42,rz*0.19,rx*0.43,rz*0.54,2.1,1.34);
    const roof=oval(rx*0.25,-rz*0.51,rx*0.36,rz*0.27);
    storey(v,roof,roof,1,5+lv,f.glass,f.gold);
  }
  entrance(c,0,rz*0.65,2+Math.floor(lv/2));
  if(lv>=3)for(const side of [-1,1])planter(v,side*rx*0.83,0,rz*0.8,1);
}

export function recordsArchive(c: Ctx) {
  const {v,lv,variant:s,hx,hz}=c,rx=hx-2,rz=hz-2;
  const piles=s===2?2:1, n=2+lv;
  for(let k=0;k<piles;k++)for(let i=0;i<n-(k===1?1:0);i++){
    const t=i/(n-1), y=1+i*4;
    const x=s===0?Math.sin(i*1.4)*rx*0.16:s===2?(k?0.45:-0.46)*rx:s===3?(t-0.5)*rx*0.52:0;
    const z=s===2?(k?0.12:-0.17)*rz:s===3?Math.sin(i*0.9)*rz*0.17:0;
    const a=s===1?(t-0.5)*0.83:s===2?(k?0.15:-0.15):0;
    const w=rx*(s===2?0.42:s===1?0.7:s===3?0.71-0.22*t:0.81), d=rz*(s===1?0.56:0.7);
    const p=plate(x,z,w,d,0.13,a), glass=plate(x,z,w*0.9,d*0.88,0.13,a);
    slab(v,p,y,1,s===1?f.bronze:f.copper);
    facade(v,glass,y+1,2,"#637979",f.ink);
    slab(v,p,y+3,1,s===3?f.silver:f.limestone);
    // A bronze pull and an ivory index tab make the deep stacks read as archival drawers.
    const front=z+d*0.92;
    v.box(x-2,y+1,front,x+2,y+2,front+1,f.gold);
    v.put(x+w*0.52,y+2,front-1,f.porcelain);
    if(i===n-1 && lv>=2){
      const skylight=oval(x,z,w*0.45,d*0.45,8,a);
      storey(v,skylight,skylight,y+4,3,f.glass,f.gold);
    }
  }
  entrance(c,0,0,3);
  if(lv>=3){
    const reading=plate(-rx*0.49,rz*0.59,rx*0.37,rz*0.27);
    storey(v,reading,reading,1,5,"#518987",f.porcelain);
    planter(v,rx*0.68,1,rz*0.7,1);
  }
}

export function planningBureau(c: Ctx) {
  const {v,lv,variant:s,hx,hz}=c,rx=hx-2,rz=hz-2;
  const backs = [[0,-0.4],[-0.41,-0.15],[0.39,-0.37],[-0.07,-0.37]];
  const [a,b]=backs[s], x=a*rx,z=b*rz;
  for(let i=0;i<lv+1;i++){
    const t=i/(lv+1), k=1-0.38*t, y=1+4*i;
    const p=s===1?oval(x,z,rx*0.49*k,rz*0.57*k,8,i*0.08):
      s===2?oval(x,z,rx*0.58*k,rz*0.47*k,3,0.6):
      plate(x+rx*(s===3?0.25*t:0),z,rx*(s===0?0.76:0.64)*k,rz*0.46*k,s===3?0.61:0.16);
    storey(v,p,p,y,4,"#3d7580",i%2===0?f.porcelain:f.copper);
  }
  // A walkable city model and giant survey instrument identify the bureau from the air.
  const board=plate(0,rz*0.42,rx*0.81,rz*0.39,0.15);
  slab(v,board,0,2,"#3b7f83");
  for(let X=Math.ceil(-rx*0.69);X<rx*0.7;X+=4)for(let Z=Math.ceil(rz*0.16);Z<rz*0.72;Z+=4){
    v.box(X,2,Z,X+2,3+Math.abs((X*3+Z)%5),Z+2,(X+Z)%3?f.porcelain:f.limestone);
  }
  const pivot:Point3=[x,7+(lv+1)*4,z], spread=rx*(s===1?0.78:0.58);
  for(const side of [-1,1])beam(v,[x+side*spread,2,rz*0.63],pivot,s===2?f.silver:f.gold,2);
  if(s===0||s===2)beam(v,[x,2,-rz*0.81],pivot,f.copper,2);
  if(s===1||s===3){
    let last:Point3|undefined;
    for(let i=0;i<=48;i++){
      const ang=i*TAU/48;
      const p:Point3=[pivot[0]+Math.cos(ang)*(4+lv),pivot[1]+Math.sin(ang)*(4+lv),pivot[2]+Math.sin(ang)*(s===1?2:0)];
      if(last)beam(v,last,p,f.gold); last=p;
    }
  }else{
    beam(v,[x-4,pivot[1]-1,z+1],[x+4,pivot[1]+3,z-2],f.ink,2);
    v.put(x+5,pivot[1]+4,z-2,f.pool,0.55);
  }
  entrance(c,0,rz*0.72,2);
}

export function publicWorks(c: Ctx) {
  const {v,lv,variant:s,hx,hz}=c, rx=hx-2,rz=hz-2, bays=2+lv;
  const y=5+lv, depth=rz*0.72;
  // An open service shed exposes the inspection lanes and the machinery beneath each roof.
  for(let i=0;i<=bays;i++){
    const x=-rx+(2*rx*i/bays);
    for(const side of [-1,1])v.box(x,1,side*depth,x+1,y+1,side*depth+1,f.ink);
  }
  for(let x=-rx;x<rx;x++)for(let z=Math.ceil(-depth);z<=depth;z++){
    const t=(x+rx)/(2*rx), saw=t*bays%1;
    let rise:number;
    if(s===0)rise=(1-saw)*(3+lv*0.62);
    else if(s===1)rise=(1-((z/depth)**2))*(3+lv*0.7);
    else if(s===2)rise=(1-Math.abs(x/rx))*(5+lv);
    else rise=(0.5+0.48*Math.cos(t*Math.PI*2))*(4+lv);
    const top=Math.round(y+rise);
    v.put(x,top,z,x%5===0?f.gold:s===0&&saw<0.22?f.glass:"#568480");
    if(z===Math.ceil(-depth)||z===Math.floor(depth))v.box(x,y,z,x+1,top+1,z+1,f.cedar);
    if(z%5===0)v.put(x,top-1,z,f.bronze);
  }
  for(let i=0;i<bays;i++){
    const x=-rx+rx*(2*i+1)/bays;
    v.box(x-2,1,depth-2,x+2,2,depth+2,f.copper);
    v.put(x,2,depth,f.gold);
  }
  const x=rx*0.62,z=-rz*0.36, tower=y+4+lv*2;
  if(s===1){
    v.cylinderY(x,z,y,tower,2,f.ink);
    v.cylinderY(x,z,tower,tower+3+lv,3+lv*0.45,f.pool);
    slab(v,oval(x,z,4+lv*0.45,4+lv*0.45),tower+3+lv,1,f.porcelain);
  }else if(s===2||s===3){
    beam(v,[x,y,z],[x,tower+3,z],f.gold,2);
    beam(v,[x,tower+2,z],[-rx*0.64,tower+6,z+rz*0.24],f.copper,2);
    beam(v,[-rx*0.55,tower+6,z+rz*0.24],[-rx*0.55,tower-1,z+rz*0.24],f.ink);
  }else{
    const office=plate(-rx*0.45,-rz*0.44,rx*0.37,rz*0.36);
    storey(v,office,office,y,4+lv,f.glass,f.porcelain);
  }
  entrance(c,0,depth,3);
}

export function nationalParliament(c: Ctx) {
  const {v,lv,variant:s,hx,hz}=c,rx=hx-2,rz=hz-2;
  const wings=s===0?2:s===1?3:s===2?2:4;
  for(let i=0;i<wings;i++){
    const a=s===0?i*Math.PI:s===2?i*Math.PI+0.54:i*TAU/wings+0.3;
    const x=Math.cos(a)*rx*0.4,z=Math.sin(a)*rz*0.36, co=Math.cos(a),si=Math.sin(a);
    const h=8+lv*2+(s===2&&i===0?3:0);
    for(let X=-rx;X<rx;X++)for(let Z=-rz;Z<rz;Z++){
      const along=((X-x)*co+(Z-z)*si)/(rx*(s===3?0.48:0.59));
      const across=(-(X-x)*si+(Z-z)*co)/(rz*(s===1?0.39:0.51));
      if(along*along+across*across>1)continue;
      const top=Math.round(4+h*(0.26+0.63*(0.5+along/2)**2+0.53*Math.abs(across)**1.4));
      // Deep blue glass closes the end of a white shell. Curved roof ribs remain visible from above.
      v.box(X,1,Z,X+1,top,Z+1,"#405f70");
      v.box(X,top,Z,X+1,top+2,Z+1,Math.round(along*rx)%7===0?"#d7d3bf":f.porcelain);
    }
  }
  const dome=oval(0,-rz*0.08,rx*(s===3?0.42:0.31),rz*0.36,16);
  const base=7+lv;
  facade(v,dome,1,base,f.glass,f.bronze,4);
  for(let y=0;y<4+lv;y++){
    const r=Math.sqrt(1-(y/(4+lv))**2);
    slab(v,oval(0,-rz*0.08,rx*(s===3?0.42:0.31)*r,rz*0.36*r,16),base+y,1,y%3===0?f.gold:f.glass);
  }
  const pole=base+4+lv;
  beam(v,[0,pole,-rz*0.08],[0,pole+4+lv,-rz*0.08],f.bronze);
  v.box(0,pole+2+lv,-rz*0.08,4,pole+4+lv,-rz*0.08+1,"#bb5f4a");
  entrance(c,0,rz*0.28,3+lv);
  for(let i=0;i<3;i++)v.box(-lv-3+i,i,rz*0.45-i,lv+4-i,i+1,rz*0.61-i,f.limestone);
  if(lv>=3)for(const side of [-1,1])planter(v,side*rx*0.63,1,rz*0.73,2);
}
