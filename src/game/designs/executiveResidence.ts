import { type Ctx, type PixelVox, bench, column, door, lamp, person, tree } from "./kit";
import { beam, facade, oval, slab } from "./sculpturalKit";

const white = "#f3ecda", stone = "#ddcfb6", shade = "#a79f8d", sandstone = "#c3aa8c";
const slate = "#76818a", tin = "#89969b", frame = "#455760", brass = "#bd915b";
const gravel = "#d9c6a7", brick = "#b48770", leaf = "#54795b", turf = "#87a975";
const glow = "#ffd292";
const heights = [7, 10, 13, 16, 19];
export const WHITE_HOUSE_LEVELS: [string, string, string, string, string] =
  ["President’s Residence", "Executive Mansion", "East & West Wings", "Rose Garden Estate", "Presidential Grounds"];

function flagstaff(v: PixelVox, x: number, y: number, z: number, level: number) {
  const top = y + 4 + Math.floor(level / 2);
  v.box(x, y, z, x + 1, top + 2, z + 1, brass);
  for (let u = 1; u <= 4; u++) for (let h = 0; h < 3; h++) {
    v.put(x + u, top - h, z + (u === 4 ? 1 : 0), u < 3 && h < 2 ? "#53698c" : h % 2 ? white : "#bd665c");
  }
}

/** Pale sandstone, three-over-three sash windows and a shallow, lead-colored hip. */
function residence(v: PixelVox, x: number, z: number, w: number, d: number, top: number, lv: number, flag = false) {
  const x0 = x - w, x1 = x + w, back = z - d, front = z + d - 1;
  v.hollowBox(x0, 1, back, x1, top, front + 1, white);
  for (const px of [x0, x1-1]) for (const pz of [back, front]) {
    for (let y=1; y<top; y+=3) v.box(px, y, pz, px+1, y+1, pz+1, stone);
  }
  const storeys = top <= 8 ? 1 : top <= 15 ? 2 : 3;
  for (let floor = 0; floor < storeys; floor++) {
    const y = 2 + Math.round(floor * (top - 3) / storeys), h = top <= 8 ? 3 : 3 + Number(top >= 15);
    const bays = Math.max(3, 2 * Math.floor(w / 4) + 1);
    for (let i = 0; i < bays; i++) {
      const px = Math.round(x0 + 2 + i * (2 * w - 5) / (bays - 1));
      for (const pz of [back, front]) {
        v.box(px, y, pz, px+2, y+h, pz+1, frame);
        const lit=(floor+i)%3===1;
        v.box(px,y+1,pz,px+2,y+h-1,pz+1,lit?glow:"#8facad",lit?.64:.11);
        v.put(px+1, y+h-1, pz, (floor + i) % 4 === 1 ? "#f2e4b9" : "#b4c9c7", .21);
        v.box(px, y-1, pz, px+2, y, pz+1, stone);
      }
    }
    for (const end of [x0, x1 - 1]) for (let pz=back+2; pz<front-1; pz+=4) {
      v.box(end,y,pz,end+1,y+h,pz+2,frame);
      v.put(end,y+h-2,pz,(pz+floor)%3===0?glow:"#9caaaa",(pz+floor)%3===0?.52:.1);
    }
  }
  v.box(x0-1, top-1, back-1, x1+1, top, front+2, stone);
  const rise = d >= 7 ? 3 : 2;
  for (let i=0; i<rise; i++) {
    const inset = 2 * i;
    v.box(x0-1+inset,top+i,back-1+i,x1+1-inset,top+i+1,front+2-i,i===0?white:slate);
  }
  v.box(x0+rise,top+rise,back+rise-1,x1-rise,top+rise+1,front+2-rise,tin);
  if (top >= 10) {
    const chimney = Math.max(2, w - 3);
    for (const side of [-1,1]) {
      const cx=x+side*chimney;
      v.box(cx,top+1,z-2,cx+2,top+rise+3,z,white);
      v.box(cx,top+rise+3,z-2,cx+2,top+rise+4,z,shade);
    }
  }
  if (lv >= 4 && w>=8) for (let off=-w+5; off<w-3; off+=5) {
    v.box(x+off,top+2,front-1,x+off+3,top+4,front+1,white);
    v.put(x+off+1,top+2,front,frame);
    v.box(x+off,top+4,front-1,x+off+3,top+5,front+1,slate);
  }
  if (flag) flagstaff(v,x,top+rise+1,z,lv);
}

/** The circular South Portico has an upper balcony and paired stairs down to the drive. */
function southBow(v: PixelVox, x: number, front: number, w: number, reach: number, top: number) {
  const floor = top >= 12 ? 4 : 2;
  const edge = (dx: number) => front + Math.round(reach * Math.sqrt(Math.max(0,1-(dx/w)**2)));
  for (let dx=-w; dx<=w; dx++) {
    const z=edge(dx);
    v.box(x+dx,0,front,x+dx+1,floor,z+1,stone);
    v.box(x+dx,top-1,front-1,x+dx+1,top,z+1,white);
    v.box(x+dx,top,front-1,x+dx+1,top+1,z,z===front?white:tin);
    v.put(x+dx,top,z,stone);
    if (top >= 12) v.put(x+dx,top+1,z,dx%2?white:shade);
  }
  const count = top >= 12 ? 7 : 5;
  for (let i=0;i<count;i++) {
    const dx=Math.round(Math.cos(i*Math.PI/(count-1))*w);
    column(v,x+dx,edge(dx),floor,top-1,white,stone);
    if(i%2===0) v.box(x+dx,floor+1,edge(dx),x+dx+1,top-2,edge(dx)+1,white,.18);
  }
  door(v,x-1,floor,front,frame,3,3);
  for (const side of [-1,1]) for (let n=0;n<floor;n++) {
    const sx=x+side*(w+n);
    v.box(sx,0,front+1,sx+1,floor-n,front+reach+1,stone);
  }
}

/** The North Portico projects a gabled carriage porch beyond the residence wall. */
function northPorch(v: PixelVox, x: number, front: number, w: number, reach: number, y: number) {
  const end=front+reach;
  v.box(x-w-1,0,front,x+w+2,2,end+2,stone);
  for (const z of [front+1,end]) for (let i=0;i<4;i++) {
    const px=x+Math.round(-w+i*2*w/3);
    column(v,px,z,2,y,white,stone);
    if(z===end) v.box(px,3,z,px+1,y-1,z+1,white,.18);
    if (w>=6) v.put(px,y-2,z+1,stone);
  }
  v.box(x-w-1,y-1,front-1,x+w+2,y,end+2,stone);
  const rise = Math.max(2,Math.round(w*.55));
  for (let i=-w-1;i<=w+1;i++) {
    const h=Math.round(rise*(1-Math.abs(i)/(w+1)));
    v.box(x+i,y,front,x+i+1,y+h+1,end+2,white);
    v.put(x+i,y+h,end+1,stone);
    v.box(x+i,y+h+1,front-1,x+i+1,y+h+2,end+1,slate);
  }
  door(v,x-1,2,front,frame,3,3);
}

/** Open roofed walks link the residence and offices. */
function colonnade(v: PixelVox,x0: number,z0: number,x1: number,z1: number,h: number) {
  v.box(x0,0,z0,x1,1,z1,gravel);
  v.box(x0-1,h,z0-1,x1+1,h+1,z1+1,white);
  v.box(x0,h+1,z0,x1,h+2,z1,tin);
  const horizontal=x1-x0 >= z1-z0;
  for (let a=horizontal?x0:z0;a<(horizontal?x1:z1);a+=3) {
    for (const b of horizontal?[z0,z1-1]:[x0,x1-1]) column(v,horizontal?a:b,horizontal?b:a,1,h,white,stone);
    const px=horizontal?a:Math.floor((x0+x1)/2), pz=horizontal?Math.floor((z0+z1)/2):a;
    if((a-(horizontal?x0:z0))%6===0) v.put(px,h-1,pz,glow,.64);
  }
}

function roseBed(v: PixelVox, x: number, z: number, w: number, d: number, pink=false) {
  v.box(x,0,z,x+w,1,z+d,brick);
  v.box(x+1,1,z+1,x+w-1,2,z+d-1,leaf);
  for (let xx=x+1;xx<x+w-1;xx+=2) for(let zz=z+1;zz<z+d-1;zz+=2) {
    v.put(xx,2,zz,(xx+zz)%3 ? pink?"#d995a3":"#cc6559" : "#f1d9bf");
  }
}

function drive(v: PixelVox,x: number,z: number,rx: number,rz: number) {
  for(let dx=-rx;dx<=rx;dx++) for(let dz=-rz;dz<=rz;dz++){
    const ratio=(dx/rx)**2+(dz/rz)**2;
    if(ratio<=1.1 && ratio>=.68) v.put(x+dx,0,z+dz,gravel);
  }
}

function entryLamps(v: PixelVox, x: number, z: number, w: number) {
  for(const side of [-1,1]) lamp(v,x+side*w,1,z,3,frame,glow);
}

function southLawn(c: Ctx) {
  const {v,hx,hz,lv}=c, w=Math.round(hx*(lv<3?.61:.48));
  const d=Math.max(3,Math.round(hz*.33)), z=-Math.floor(hz*.34), front=z+d-1;
  const h=heights[lv-1], bow=Math.max(4,Math.round(w*.43)), depth=lv===1?4:Math.max(3,Math.floor(d*.67));
  v.box(-2,0,front,3,1,hz,gravel);
  if(lv>=2) drive(v,0,Math.floor((front+hz)/2),Math.min(hx-3,w+2),Math.max(3,Math.floor((hz-front)*.42)));
  residence(v,0,z,w,d,h,lv,lv>=2);
  if(lv===1) for(const side of [-1,1]) {
    const x=side*(w-3);
    v.box(x,h+1,z-1,x+2,h+5,z+1,white);
    v.box(x,h+5,z-1,x+2,h+6,z+1,shade);
  }
  southBow(v,0,front,bow,depth,h);
  entryLamps(v,0,Math.min(hz-2,front+depth+2),bow+1);
  if(lv===2) for(const side of [-1,1]) {
    const start=side*w, end=side*(hx-2);
    colonnade(v,Math.min(start,end),z,Math.max(start,end),z+4,4);
  }
  if(lv>=3) for(const side of [-1,1]){
    const far=side*(hx-5), a=side*w;
    colonnade(v,Math.min(a,far),z-1,Math.max(a,far),z+3,5);
    residence(v,far,z-1,3,3,6,2);
  }
  if(lv>=4) {
    const cz=hz-6;
    slab(v,oval(0,cz,5,3),1,1,stone); slab(v,oval(0,cz,4,2),2,1,"#75aca9");
    v.put(0,3,cz,"#bbdcd0");
    for(const side of [-1,1]) roseBed(v,side*(w-2)-2,front+depth+2,5,5);
  }
  if(lv===5) for (const side of [-1,1]) tree(v,side*(hx-7),1,hz-7,"oak",1.15,42+side);
}

function northCourt(c: Ctx) {
  const {v,hx,hz,lv}=c, w=lv===1?6:Math.round(hx*(lv===5?.61:.45));
  const d=lv===1?3:Math.round(hz*(lv===5?.26:.35)), z=-Math.round(hz*(lv===5?.46:.34)), front=z+d-1;
  const h=heights[lv-1]+2, wPorch=3+lv, reach=lv===1?3:Math.round(hz*.30);
  v.box(-3,0,front,4,1,hz,gravel);
  drive(v,0,front+reach,Math.min(hx-2,w+2),Math.min(hz-front-reach-1,lv===5?12:3+lv));
  residence(v,0,z,w,d,h,lv,true);
  northPorch(v,0,front,wPorch,reach,h-1);
  entryLamps(v,0,Math.min(hz-2,front+reach+2),wPorch+1);
  for(const side of [-1,1]) {
    if(lv>=2) {
      const end=side*Math.min(hx-3,w+3+lv);
      colonnade(v,Math.min(side*w,end),z-2,Math.max(side*w,end),z+2,4+lv);
    }
    if(lv>=3) {
      const wing=side*(hx-5);
      residence(v,wing,z-3,3,4,7+Math.floor(lv/2),2);
    }
    if(lv>=4) {
      const p=side*(hx-7);
      roseBed(v,p-2,hz-10,5,7,true);
      tree(v,p,1,front+1,"cypress",1.1);
    }
    if(lv===5) {
      lamp(v,side*8,1,hz-4,5,frame,glow);
      v.box(side*10-1,1,hz-3,side*10+2,4,hz-1,stone);
    }
  }
}

function westWing(c: Ctx) {
  const {v,hx,hz,lv}=c;
  const x=-Math.round(hx*.37), z=lv===1?-1:-Math.round(hz*.33), w=Math.max(4,Math.round(hx*(lv===1?.38:.29))), d=Math.max(3,Math.round(hz*.32));
  const h=heights[lv-1], ovalX=Math.round(hx*.39), ovalZ=lv===1?-1:Math.round(hz*.2);
  const rad=lv===5?9:Math.max(4,2+lv), ovalH=lv===5?13:lv<3?5:7+Math.floor(lv/2);
  const back=ovalZ-rad, front=z+d-1;
  residence(v,x,z,w,d,h,lv,lv>=3);
  southBow(v,x,front,Math.min(4,w-1),2,h-1);
  v.box(x-1,0,front,x+2,1,hz,gravel);
  colonnade(v,x+w-1,z-1,ovalX+1,z+2,4+Math.floor(lv/2));
  if(z<back) {
    const join=lv>=3?rad-1:2;
    v.hollowBox(ovalX-join,1,z,ovalX+join,ovalH,ovalZ,white,stone);
    v.box(ovalX-join-1,ovalH-1,z,ovalX+join+1,ovalH,ovalZ,white);
    v.box(ovalX-join,ovalH,z,ovalX+join,ovalH+1,ovalZ,tin);
  }
  const plan=oval(ovalX,ovalZ,rad+1,rad,18);
  facade(v,plan,1,ovalH-1,white,stone,4);
  slab(v,plan,0,1,sandstone);slab(v,oval(ovalX,ovalZ,rad+2,rad+1,18),ovalH-1,1,white);slab(v,plan,ovalH,1,slate);
  // Tall sash windows follow the south curve, with a broad white pier between every pair.
  const bays=lv<3?5:7;
  for(let i=0;i<bays;i++) {
    const a=-Math.PI*.50+i*Math.PI/(bays-1);
    const px=ovalX+Math.round(Math.sin(a)*rad), pz=ovalZ+Math.round(Math.cos(a)*rad)-1;
    v.box(px,2,pz,px+1,ovalH-1,pz+1,frame);
    v.put(px,Math.max(2,ovalH-3),pz,i%3===1?glow:"#9caeae",i%3===1?.72:.16);
  }
  if(lv>=4) {
    const skylight=oval(ovalX,ovalZ-2,rad*.39,rad*.21,12);
    slab(v,skylight,ovalH+1,1,tin);
    slab(v,oval(ovalX,ovalZ-2,rad*.28,rad*.14,10),ovalH+2,1,"#9bbab9",.12);
  }
  const fy=ovalZ+rad-1;
  for(const side of [-1,1]) {
    v.put(ovalX+2*side,3,fy,glow,.7);
    column(v,ovalX+3*side,fy,1,ovalH,white,stone);
  }
  if(lv===1) roseBed(v,ovalX-4,hz-4,8,3,true);
  if(lv>=2) {
    const gardenX=x+w, rz=Math.max(4,Math.floor(hz*.37));
    roseBed(v,gardenX,Math.floor(hz*.25),Math.max(5,Math.floor(hx*.45)),rz);
    v.box(gardenX-1,0,front,gardenX+1,1,hz,brick);
  }
  if(lv>=3) {
    residence(v,ovalX,z-rad+1,rad,Math.max(3,d-1),ovalH,2);
    roseBed(v,-hx+3,hz-6,Math.min(w+2,10),4,true);
  }
  if(lv>=4) for(const side of [-1,1]) {
    const gx=side*(hx-6);tree(v,gx,1,hz-7,side<0?"oak":"blossom",.85,20+side);
    bench(v,gx+1,1,hz-4,"x",brass);
  }
  if(lv===5) {
    const length=ovalX-x;
    colonnade(v,x,z-d-2,x+length,z-d+1,7);
    roseBed(v,-5,hz-8,14,5,true);
    v.box(-6,0,hz-9,10,1,hz-8,brick);
    for(let px=x+2;px<ovalX-1;px+=5) person(v,px,1,z+3,"#4d747e");
  }
}

function eastWalk(c: Ctx) {
  const {v,hx,hz,lv}=c, w=Math.max(4,Math.round(hx*.25));
  const d=Math.max(2,Math.round(hz*.22)), rear=-hz+3+d;
  const endX=-Math.round(hx*.48), pavilionX=Math.round(hx*.42);
  const front=lv===1?1:Math.round(hz*.38);
  // A perpendicular public arcade turns the corner at the visitor pavilion; the lawn stays open.
  colonnade(v,endX+w-1,rear-1,pavilionX+1,rear+2,4+Math.floor(lv/2));
  colonnade(v,pavilionX-2,rear,pavilionX+2,front+1,4+Math.floor(lv/2));
  residence(v,endX,rear,w,d,heights[lv-1],lv,lv>=3);
  northPorch(v,endX,rear+d-1,Math.min(4,w-1),2,heights[lv-1]-1);
  const wing=Math.max(3,lv+1), wingDepth=Math.min(4,2+Math.floor(lv/2)), h=lv>=3?9:5;
  residence(v,pavilionX,front,wing,wingDepth,h,2);
  door(v,pavilionX-1,1,front+wingDepth-1,frame,2,3);
  v.box(pavilionX-2,0,front+wingDepth-1,pavilionX+2,1,hz,gravel);
  entryLamps(v,pavilionX,Math.min(hz-2,front+wingDepth+1),wing);
  if(lv>=2) {
    const gardenZ=front+1;
    drive(v,endX+3,gardenZ,Math.min(w+2,8),Math.max(2,Math.round(hz*.22)));
    tree(v,endX+4,1,gardenZ,"blossom",.75);
  }
  if(lv>=3) {
    colonnade(v,pavilionX-wing-3,front,pavilionX-wing,front+3,4);
    roseBed(v,endX-2,hz-5,Math.min(9,w+1),4,true);
  }
  if(lv>=4) {
    const gx=pavilionX-5;
    for(let zz=rear+4;zz<front-2;zz+=6) tree(v,gx-2,1,zz,"blossom",.65,zz+hz);
    for(const side of [-1,1]) bench(v,endX+3+side*5,1,front+2,"z",brass);
  }
  if(lv===5) {
    const porch=oval(endX+4,hz-8,5,3,16);
    slab(v,porch,1,1,stone);slab(v,oval(endX+4,hz-8,4,2,16),2,1,"#83b3ab");
    beam(v,[pavilionX-2,h+4,front],[pavilionX+2,h+4,front],white);
  }
}

export function buildExecutiveResidence(c: Ctx) {
  const {v,hx,hz}=c;
  v.box(-hx+1,0,-hz+1,hx-1,1,hz-1,turf);
  [southLawn,northCourt,westWing,eastWalk][c.variant%4](c);
}
