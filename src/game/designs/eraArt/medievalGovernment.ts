import { bench, person } from "../kit";
import type { SignatureBuilder } from "../periodArtCatalog";
import { beam, oval, slab } from "../sculpturalKit";
import { ash, banner, bell, brace, candle, chalk, gable, glow, gold, honey, ink, lime, oak, oxblood, slate, stair, stone, tile, timber, turret, vellum } from "./medievalCraft";

/** A hammer-beam great hall, an octagonal moot, an open assize gate and a deep lancet tribunal. */
export const assizes:SignatureBuilder=(c,p,active)=>{
  const {v,hx,hz,lv:l,variant:s}=c, X=hx-2,Z=hz-2;
  const landing= Math.min(7,2+l), stepsZ=s===3?Z:Math.min(Z,Math.max(3,Math.floor(Z*.58)));
  const doorZ=stepsZ-landing+1;
  const width=Math.min(X-1,2+l);
  stair(v,0,stepsZ,width,landing);
  v.box(-width,1,doorZ-3,width+1,landing+1,doorZ+1,stone);
  const rear=-Z+1, eave=landing+3+l;
  const hallW=s===0 && l===2?4:Math.max(3,Math.round(X*(s===2?(l===2?.24:.39):s===3?.60:.72)));
  if(s===0) {
    const front=doorZ;
    // Exposed hammer-beams make the open end of the steep roof the front
    // door. From the stair one can see past the witness rail to the bench.
    v.box(-hallW,1,rear,hallW+1,landing+1,front+1,ash);
    timber(v,-hallW,rear,hallW+1,front+1,landing+1,3+l);
    v.clear(-Math.max(2,hallW-2),landing+1,front,Math.max(2,hallW-2)+1,eave+1,front+1);
    gable(v,-hallW-1,rear-1,hallW+2,front+2,eave+1,4+2*l,true);
    for(let z=rear+1;z<=front+1;z+=Math.max(4,Math.round((front-rear)/3))) for(const side of [-1,1]) {
      beam(v,[side*hallW,eave,z],[side*Math.floor(hallW*.43),eave+4,z],honey);
      v.box(side*(hallW-1),landing+1,z,side*(hallW-1)+1,eave+1,z+1,oak);
    }
    if(l===2) for(const side of [-1,1]){
      const x=side*(X-3);
      v.box(x-2,1,rear+1,x+3,3,front+3,stone);
      bench(v,x,3,rear+3,"z",oak);
    }
    if(l>=3) for(const side of [-1,1]) {
      const x=side*(hallW+1);
      v.box(x-1,1,rear,x+2,landing+2,front+3,stone);
      for(let z=rear+1;z<=front;z+=4) v.put(x,landing+2,z,oak);
    }
    if(l===5) for(const side of [-1,1]) timber(v,side*(hallW-3)-2,rear,side*(hallW-3)+3,rear+5,eave+1,3);
  } else if(s===1) {
    const rz=Math.max(3,Math.floor((doorZ-rear)/2)), cz=rear+rz;
    const ring=oval(0,cz,hallW,rz,8,Math.PI/8);
    slab(v,ring,1,landing,stone);
    const raised=eave+1;
    for(let i=0;i<8;i++){
      const [x,z]=ring[i];
      v.box(x,landing,z,x+1,raised,z+1,oak);
      brace(v,x,z,-Math.sign(x)*2,2,-Math.sign(z-cz),raised-2);
    }
    for(let y=0;y<5+l;y++) {
      const t=1-y/(5+l);
      slab(v,oval(0,cz,(hallW+1)*t+1,(rz+1)*t+1,8,Math.PI/8),raised+y,1,y%3?honey:oxblood);
    }
    v.put(0,raised+5+l,cz,gold);
    for(const side of [-1,1]) {
      const x=side*(X-1);
      v.box(x-1,1,cz,x+2,landing+1,doorZ+3,ash);
      if(l>=3) gable(v,x-2,cz,x+3,doorZ+3,landing+4,2,true,slate);
      else bench(v,x,landing+1,doorZ+1,"z",oak);
    }
    if(l>=4) {
      const z=cz+rz;
      v.box(-3,landing+1,z,4,eave+2,z+1,lime);
      v.clear(-1,landing+1,z,2,eave,z+1);
    }
    if(l===5) for(const side of [-1,1]) turret(v,side*(X-2),doorZ,landing+5,2,4,slate);
  } else if(s===2) {
    const front=doorZ-1, gateRear=Math.max(rear,front-3-l);
    // The narrow cross-hall spans the stair. A two-storey judge's oriel
    // projects from its centre, above witness courts open to the sky.
    v.box(-hallW-1,1,gateRear,hallW+2,landing+1,front+1,stone);
    v.box(-hallW,1,rear,hallW+1,2,gateRear,stone);
    for(const side of [-1,1]){
      const x=side*hallW;
      v.box(x-1,landing,gateRear,x+2,eave+5,front+1,stone);
      const far=side*(X-2);
      v.box(Math.min(x,far),1,rear,Math.max(x,far)+1,landing+1,front,ash);
      gable(v,Math.min(x,far)-1,rear-1,Math.max(x,far)+2,Math.max(rear+4,gateRear+1),landing+3,3,false,tile);
      for(let z=rear+2;z<gateRear;z+=3) bench(v,x,landing+1,z,"x",oak);
      if(l>=2){
        const witness=side*(X-3);
        timber(v,witness-2,rear,witness+3,rear+4,landing+1,4);
        gable(v,witness-2,rear-1,witness+3,rear+5,landing+5,3,true,slate);
      }
    }
    gable(v,-hallW-2,gateRear-1,hallW+3,front+2,eave+5,3+l,false,tile);
    const oriel=l>=3?3:2;
    timber(v,-oriel,front-2,oriel+1,front+2,eave+4,4);
    turret(v,0,front,eave+8,oriel+1,3+l,slate);
    v.box(-hallW,eave+3,front,hallW+1,eave+5,front+1,honey);
    for(const side of [-1,1]) {
      brace(v,side*hallW,front,-side*Math.max(2,hallW-1),3,0,eave);
      if(l>=3) v.box(side*(X-2),1,front+1,side*(X-2)+1,landing+3,Math.min(Z,front+8),stone);
    }
    if(l>=4) for(const side of [-1,1]) turret(v,side*(X-2),rear+3,landing+6,2,4,slate);
    if(l===5) {
      for(const x of [-3,3]) for(const z of [rear+1,rear+6]){
        v.box(x-1,1,z-1,x+2,landing+2,z+2,stone);
        v.box(x,landing+2,z,x+1,eave+8,z+1,oak);
        brace(v,x,z,-Math.sign(x)*2,3,0,eave+3);
      }
      v.box(-3,eave+6,rear+1,4,eave+7,rear+7,honey);
      v.box(-3,eave+7,rear+1,4,eave+10,rear+7,lime);
      gable(v,-4,rear,5,rear+8,eave+10,4,true,tile);
    }
  } else {
    // A tall, pierced stone screen frames the hall. The central void stays
    // open even at the first level, down to the raised hearing platform.
    const front=doorZ, roof=eave+7+l, r=hallW;
    timber(v,-r,rear,r+1,front,landing+1,4+l);
    const middle=Math.round((front+rear)/2);
    gable(v,-r-1,rear-1,r+2,middle+1,landing+5+l,2+l,false,slate);
    for(const side of [-1,1]) {
      const x=side*r;
      v.box(x-1,landing+2,middle,x+2,landing+3,front,oak);
      for(let z=middle+1;z<front;z+=3) v.put(x,landing+3,z,honey);
    }
    for(let x=-r;x<=r;x++){
      const arch=eave+Math.round((1-Math.abs(x)/r)*(3+l));
      const low=Math.abs(x)>=r-1?1:arch;
      const cap=roof+Math.round((1-Math.abs(x)/r)*4);
      v.box(x,low,front,x+1,cap,front+2,stone);
      v.put(x,Math.max(low,landing+1),front+2,chalk);
      v.box(x,cap,front,x+1,cap+1,front+2,ash);
    }
    if(l>=2) for(const side of [-1,1]) {
      const x=side*(r+1);
      v.box(x-1,1,front-1,x+2,landing+5,front+3,stone);
    }
    if(l>=4) for(const side of [-1,1]) gable(v,side*(X-3)-2,rear,side*(X-3)+3,front+3,landing+4,3,true,tile);
    if(l===5) v.box(-1,roof+2,front,2,roof+6,front+1,ash);
  }
  const y=landing+1;
  v.box(-2,y,rear+1,3,y+2,rear+3,oak);
  v.box(-1,y+2,rear+1,2,y+4,rear+2,oxblood);
  const rail=Math.min(doorZ-1,rear+5);
  v.box(-Math.min(3,hallW-1),y+1,rail,Math.min(3,hallW-1)+1,y+2,rail+1,honey);
  for(const side of [-1,1]) candle(v,side*Math.min(width,2),y,doorZ);
  if(l>=3) for(const side of [-1,1]) {
    v.box(side*(width+1),1,stepsZ-2,side*(width+1)+1,4,stepsZ+1,stone);
    v.put(side*(width+1),4,stepsZ-2,gold);
  }
  const scaleY=eave+1;
  v.box(-2,scaleY,doorZ+1,3,scaleY+1,doorZ+2,gold);
  v.put(0,scaleY+1,doorZ+1,gold);
  for(const side of [-1,1]){
    v.put(side*2,scaleY-1,doorZ+1,oak);
    v.box(side*2-1,scaleY-2,doorZ+1,side*2+1,scaleY-1,doorZ+2,gold);
  }
  if(active) person(v,0,y,rear+3,p.cloth);
};

function marketCross(v:Parameters<SignatureBuilder>[0]["v"],x:number,z:number,h:number){
  v.box(x-1,1,z-1,x+2,2,z+2,stone);
  v.box(x,2,z,x+1,h,z+1,stone);
  v.box(x-1,h-2,z,x+2,h-1,z+1,chalk);
  v.put(x,h,z,gold);
}

/** A detached octagonal belfry, jettied guild hall, open cruck bell frame and stepped watch stair. */
export const guildOffices:SignatureBuilder=(c,p,active)=>{
  const {v,hx,hz,lv:l,variant:s}=c, X=hx-2,Z=hz-2;
  const low=-Z+1,h=14+4*l, x=s===0||s===2?-X+3:X-(l>=3?4:3), z=s===1?Math.floor(-Z*.22):low+3;
  const r=l>=3?3:2;
  let clerkX=0,clerkZ=low+3;
  if(s===0) {
    v.cylinderY(x+.5,z+.5,1,h-6,r+.5,stone);
    for(let y=4;y<h-6;y+=4) v.put(x+r,y,z,glow,.4);
    v.cylinderY(x+.5,z+.5,h-7,h-6,r+1.5,oak);
    for(const dx of [-r,r]) for(const dz of [-r,r]) v.box(x+dx,h-6,z+dz,x+dx+1,h+1,z+dz+1,oak);
    bell(v,x,h-4,z,l>=3?2:1);
    turret(v,x,z,h,r+2,5+l,slate);
    clerkX=Math.min(X-2,1);clerkZ=low+4;
    timber(v,0,low,X+1,clerkZ+1,1,4+l);
    gable(v,-1,low-1,X+1,clerkZ+2,5+l,3,false,tile);
    if(l>=3) v.box(-X+3,5,z-1,X-3,6,z+1,honey);
    if(l>=4) {
      timber(v,X-4,clerkZ,X+1,Math.floor(Z*.4),1,7);
      gable(v,X-5,clerkZ,X+1,Math.floor(Z*.4)+1,8,4,true,tile);
    }
    if(l===5) gable(v,-2,clerkZ-1,6,Math.floor(Z*.5),7,4,true,slate);
  } else if(s===1) {
    const base=r-1;
    timber(v,x-base,z-base,x+base+1,z+base+1,1,h-5,stone);
    for(let y=5;y<h-7;y+=5){
      v.box(x-base,y,z-base,x+base+1,y+1,z+base+1,honey);
      v.put(x,y+2,z+base,glow,.4);
      v.put(x+base,y+2,z,ink);
    }
    timber(v,x-r-1,z-r-1,x+r+2,z+r+2,h-6,6,lime);
    for(const dx of [-r,r]) {
      v.box(x+dx,h-4,z+r,x+dx+1,h-1,z+r+2,ink);
      v.put(x+dx,h-4,z+r+1,gold);
    }
    gable(v,x-r-2,z-r-2,x+r+3,z+r+3,h,5+l,true,tile);
    bell(v,x,h-3,z+r+1,1);
    clerkX=-X+3; clerkZ=Math.min(1,low+6);
    timber(v,-X,low,-X+5,clerkZ+2,1,5);
    gable(v,-X-1,low-1,-X+6,clerkZ+2,6,4,true,tile);
    if(l>=2) stair(v,-X+3,clerkZ+5,1,4);
    if(l>=3) {
      v.box(-X+2,6,low+1,x,7,low+3,honey);
      for(let xx=-X+3;xx<x;xx+=4) v.box(xx,1,low+1,xx+1,6,low+2,oak);
    }
    if(l>=4) {
      timber(v,-X,Z-8,-X+6,Z-3,1,6);
      gable(v,-X-1,Z-9,-X+7,Z-2,7,3,true,slate);
    }
    if(l===5) banner(v,x-r,h-2,z,5,oxblood);
  } else if(s===2) {
    // Massive cruck timbers stand over an entirely open bell frame.
    const dx=Math.min(l>=3?6:4,X-2),center=l===1?-1:l>=3?-Math.round(X*.17):x+1,depth=l>=3?4:2;
    for(const d of [-1,1]) for(const t of [-1,1]) {
      const xx=center+d*dx, zz=z+t*depth;
      v.box(xx-1,1,zz-1,xx+2,4,zz+2,stone);
      beam(v,[xx,4,zz],[center+d,h+2,z+t],oak,2);
      beam(v,[xx,5,zz],[center-d*2,Math.round(h*.65),z+t],honey);
    }
    v.box(center-3,h-2,z-depth,center+4,h,z+depth+1,oak);
    bell(v,center,h-6,z,2);
    gable(v,center-3,z-depth-1,center+4,z+depth+2,h,3,true,slate);
    clerkX=l===1?2:X-3;clerkZ=Math.floor(Z*.24);
    timber(v,clerkX-2,low,clerkX+3,clerkZ,1,4+l);
    gable(v,clerkX-3,low-1,clerkX+4,clerkZ+1,5+l,2,true,slate);
    if(l>=3) {
      v.box(-X,1,Z-5,0,3,Z-1,stone);
      for(let i=-X+1;i<0;i+=4) v.put(i,3,Z-4,honey);
    }
    if(l>=4) gable(v,-X,low-1,X-3,low+5,6,3,false,tile);
    if(l===5) banner(v,center,h,z,6,oxblood);
  } else {
    v.hollowBox(x-r,1,z-r,x+r+1,h-6,z+r+1,stone,ash);
    for(let y=3;y<h-7;y+=3) {
      const u=Math.round((y/(h-6))*6)%6;
      const zz=z-r+Math.min(2*r,u);
      v.box(x+r,y,zz,x+r+2,y+1,zz+2,chalk);
    }
    v.hollowBox(x-r-1,h-7,z-r-1,x+r+1,h-1,z+r+1,lime,oak);
    v.clear(x-1,h-6,z+r,x+2,h-2,z+r+1);
    bell(v,x,h-5,z+r-1,1);
    turret(v,x-1,z,h-1,r+1,6+l,tile);
    if(l>=2) { v.cylinderY(x+r+.5,z-r+.5,h-10,h-4,1.4,stone);turret(v,x+r,z-r,h-4,2,4,slate); }
    clerkX=-X+3;clerkZ=low+4;
    timber(v,-X,low,x-r-1,clerkZ+1,1,4+l);
    gable(v,-X-1,low-1,x-r,clerkZ+2,5+l,3,false,slate);
    if(l>=3) marketCross(v,-X+3,Math.floor(Z*.3),6);
    if(l>=4) {
      timber(v,-X,clerkZ,-X+4,Math.floor(Z*.6),1,5);
      gable(v,-X-1,clerkZ,-X+5,Math.floor(Z*.6)+1,6,3,true,tile);
    }
    if(l===5) {v.box(-3,1,Z-6,6,3,Z-2,honey);banner(v,5,3,Z-4,5,oxblood);}
  }
  const cz=Math.max(2,Z-4);
  // A planted edge and a band of worn market pavers lead from the road
  // to the service counter. The central square stays clear for assemblies.
  const ex=Math.min(X-1,3+l), ez=Math.min(Z-1,3+l);
  slab(v,oval(0,cz-2,ex,ez,8,Math.PI/8),0,1,"#BCAF93");
  for(let zz=clerkZ;zz<=cz;zz++) {
    const xx=Math.round(clerkX*(cz-zz)/Math.max(1,cz-clerkZ));
    v.box(xx-1,0,zz,xx+2,1,zz+1,stone);
  }
  v.box(-2,0,cz-2,3,1,cz+2,stone);
  if(l>=2){
    const tableX=-Math.min(X-2,5);
    v.box(tableX,1,cz-1,tableX+3,3,cz+1,oak);
    v.put(tableX+1,3,cz,p.cloth);
  }
  if(l>=4){
    const halt=Math.min(X-2,6);
    for(let i=0;i<3;i++) v.box(halt-2,1,cz-6+i,halt+3,2+i,cz-5+i,stone);
    banner(v,halt+1,3,cz-4,4,oxblood);
  }
  marketCross(v,-1,cz,4+(l>=3?2:0));
  candle(v,clerkX,2,clerkZ);
  v.box(2,1,cz+1,3,4,cz+2,oak);
  v.box(1,3,cz+1,4,5,cz+2,honey);
  v.put(2,4,cz+1,vellum);
  if(l>=3) bench(v,3,1,Z-2,"x",oak);
  if(active) person(v,1,1,cz,p.cloth);
};
