import { bench, person, tree } from "../kit";
import type { SignatureBuilder } from "../periodArtCatalog";
import { beam } from "../sculpturalKit";
import { ash, bark, book, brace, candle, gable, glow, gold, honey, ink, moss, oak, oxblood, slate, stair, stone, timber, turret, vellum } from "./medievalCraft";

function readingLantern(v: Parameters<SignatureBuilder>[0]["v"], x: number, z: number, r: number, h: number) {
  for(const dx of [-r+1,r-1]) for(const dz of [-r+1,r-1])
    v.box(x+dx,1,z+dz,x+dx+1,h-2,z+dz+1,oak);
  v.box(x-r,h-5,z-r,x+r+1,h-4,z+r+1,honey);
  v.hollowBox(x-r,h-4,z-r,x+r+1,h,z+r+1,"#C6A96B");
  for(let a=-r+1;a<r;a++){
    v.put(x+a,h-2,z+r,glow,.65);
    v.put(x+r,h-2,z+a,glow,.65);
  }
  for(const dx of [-r,r]) for(const dz of [-r,r]) v.box(x+dx,h-4,z+dz,x+dx+1,h+1,z+dz+1,bark);
  turret(v,x,z,h,r+1,3+r,slate);
}

/** A projecting lantern, a splayed vellum roof, chained cloister walks or a manuscript recital theatre. */
export const scriptorium: SignatureBuilder = (c,p,active) => {
  const { v,hx,hz,lv:l,variant:s }=c;
  const X=hx-2,Z=hz-2, back=-Z;
  const r=l<3?2:3;
  if(s===0) {
    const cx=l<=2?X-r-1:-X+r+2, cz=l<=2?1:back+r+2, hallEnd=l===1?-1:Math.min(2,Z-3);
    timber(v,-X,back,X,hallEnd,1,4+(l>=4?2:0));
    gable(v,-X,back-1,X+1,hallEnd+1,5+(l>=4?2:0),2+l,false);
    readingLantern(v,cx,cz,r,8+l*2);
    const stairCount=Math.min(Z-hallEnd+1,4+l);
    stair(v,cx+1,Math.min(Z,hallEnd+stairCount-1),1,stairCount);
    for(let x=-X+2;x<X-2;x+=5) {
      v.box(x,1,hallEnd-1,x+2,3,hallEnd+2,honey);
      v.clear(x,3,hallEnd-1,x+2,5,hallEnd);
      v.put(x,3,hallEnd,vellum);
    }
    if(l>=3) {
      timber(v,X-4,0,X,Z-2,1,4);
      gable(v,X-5,-1,X+1,Z-1,5,3,true);
    }
    if(l>=4) {
      v.box(-X,5,hallEnd,-X+4,6,Z-2,honey);
      for(let z=hallEnd+2;z<Z-2;z+=4) v.box(-X,1,z,-X+1,7,z+1,oak);
    }
    if(l===5) readingLantern(v,X-4,Z-5,2,11);
  } else if(s===1) {
    // A book opens down the spine along the lane; its ribbed covers shelter
    // two copying galleries. The front edge shows the stacked vellum.
    const end=Math.min(Z-3,Math.floor(Z*.35)), wing=X-1, h=4+l;
    for(let x=-wing;x<=wing;x++) {
      const y=h+Math.round(Math.abs(x)/wing*(3+l));
      const cover=x<0?"#52665F":oxblood;
      v.box(x,y-1,back,x+1,y,end+1,vellum);
      v.box(x,y,back-1,x+1,y+1,end+2,cover);
      if(Math.abs(x)>1 && Math.abs(x)<wing-1) v.box(x,y,back+2,x+1,y+1,end-1,vellum);
      if(Math.abs(x)%5===2 && Math.abs(x)<wing-1) v.box(x,y,back+3,x+1,y+1,Math.max(back+4,end-3),oxblood);
      for(let z=back;z<end+1;z+=5) v.put(x,y,z,x%6===0?gold:honey);
      if(Math.abs(x)===wing || x===0)
        for(let z=back;z<=end;z+=4) v.box(x,1,z,x+1,y,z+1,oak);
    }
    v.box(-wing,1,back,wing+1,2,end+1,honey);
    if(l>=2) book(v,Math.floor(wing*.5),2,end,vellum);
    if(l>=3) {
      const x=-X+2;
      timber(v,x-2,end+2,x+3,Z-1,1,4);
      gable(v,x-3,end+1,x+4,Z,5,4,true,oxblood);
    }
    if(l>=4) readingLantern(v,X-3,back+3,2,10+l);
    if(l===5) {
      for(let side=-1;side<=1;side+=2)
        v.box(side*8-2,1,end,side*8+3,2,Z-1,stone);
    }
  } else if(s===2) {
    const far=Z-2, front=back+4, width=3+(l>=3?1:0), high=5+l;
    // Stone arcades hold individual chained books beside a grass garth.
    timber(v,-X,back,X+1,front,1,4);
    gable(v,-X,back-1,X+1,front+1,5,2,false);
    for(const side of [-1,1]) {
      const x=side<0?-X:X-width;
      const end=side<0||l>=3?far:Math.floor(Z/2);
      v.box(x,1,front,x+width+1,2,end+1,stone);
      gable(v,x,front-1,x+width+1,end+1,high,2,true);
      for(let z=front;z<=end;z+=4){
        v.box(x+1,1,z,x+2,high,z+1,stone);
        v.box(x+width-1,1,z,x+width,high,z+1,oak);
        book(v,x+2,2,z+1,side<0?oxblood:"#506F63");
        v.put(x+1,3,z+1,ink);
      }
    }
    if(l>=2) v.box(-2,1,front+2,3,2,Math.max(front+3,far-2),moss);
    if(l>=4) {
      tree(v,-3,1,Math.floor(Z*.2),"round",.55,13);
      bench(v,1,1,Math.floor(Z*.3),"z",oak);
      v.box(-X+2,high,far-1,-1,high+1,far+1,oak);
      brace(v,-X+3,far,3,3,0,high-3);
    }
    if(l===5) readingLantern(v,X-3,back+3,2,12);
  } else {
    const end=back+Math.max(4,Math.floor(Z*.8)), top=6+2*l;
    v.box(-X,1,back,X+1,3,end+2,honey);
    // An accordion manuscript stands open behind the reader's stage.
    const pitch=l<3?4:6;
    for(let x=-X;x<=X;x++){
      const fold=Math.abs((x+X)%(2*pitch)-pitch);
      const z=back+Math.round(fold*.55);
      const crest=top+Math.round(fold*.65);
      v.box(x,3,z,x+1,crest,z+1,vellum);
      v.put(x,crest,z,x===0?gold:oxblood);
      if((x+X)%pitch===0) v.box(x,3,z,x+1,crest+1,z+1,oak);
      else for(let y=5;y<crest-1;y+=3) v.put(x,y,z+1,y%2?ash:oxblood);
    }
    stair(v,0,Math.min(Z-1,end+4),Math.min(X-2,2+l),3);
    if(l>=2) for(const side of [-1,1]) {
      const x=side*(X-1);
      v.box(x,3,back,x+1,top-1,end+2,oak);
      v.box(x-side,top-2,back,x-side+1,top-1,end+2,oxblood);
    }
    if(l>=3) for(let z=end+5;z<Z;z+=4)
      for(const x of [-X+2,X-4]) bench(v,x,1,z,"x",honey);
    if(l>=4) {
      for(const side of [-1,1]) beam(v,[side*X,top,back+2],[side*(X-3),top+4,back],gold);
    }
    if(l===5) readingLantern(v,-X+3,end-2,2,12);
  }
  const readingX=s===2?0:Math.floor(X*.22), readingZ=Z-2;
  v.box(readingX-2,0,Math.max(0,readingZ-4),readingX+3,1,Z+1,"#BAA887");
  v.box(readingX-2,1,readingZ-1,readingX+3,2,readingZ+2,honey);
  book(v,readingX,2,readingZ,p.cloth);
  candle(v,readingX+2,2,readingZ-1);
  if(l>=2) bench(v,Math.max(-X+2,readingX-4),1,readingZ,"z",oak);
  if(active) person(v,readingX-2,1,readingZ+1,p.cloth);
};
