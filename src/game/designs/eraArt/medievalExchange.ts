import { person, type PixelVox } from "../kit";
import type { SignatureBuilder } from "../periodArtCatalog";
import { beam } from "../sculpturalKit";
import { ash, candle, chalk, gable, glow, gold, honey, ink, lime, moss, oak, oxblood, slate, stone, tile, timber, turret, vellum } from "./medievalCraft";

function pigeonLoft(v:PixelVox,x:number,z:number,r:number,h:number,round:boolean) {
  if(round) {
    v.cylinderY(x+.5,z+.5,1,h,r,honey);
    v.cylinderY(x+.5,z+.5,h-4,h,r+.5,lime);
    turret(v,x,z,h,r+1,3+r,tile);
  } else {
    for(const dx of [-r+1,r-1]) for(const dz of [-r+1,r-1]) v.box(x+dx,1,z+dz,x+dx+1,h-3,z+dz+1,oak);
    v.hollowBox(x-r,h-5,z-r,x+r+1,h,z+r+1,lime);
    gable(v,x-r-1,z-r-1,x+r+2,z+r+2,h,3,true,tile);
  }
  for(let a=-r+1;a<r;a+=2) for(const y of [h-2,h-4]){
    v.put(x+a,y,z+r,ink);
    v.put(x+r,y,z+a,ink);
    v.put(x+a,y-1,z+r+1,honey);
    v.put(x+r+1,y-1,z+a,honey);
  }
}

function cart(v:PixelVox,x:number,z:number,loaded:boolean) {
  v.box(x-2,2,z-1,x+3,3,z+2,honey);
  for(const dx of [-1,1]) for(const dz of [-1,1]) v.put(x+dx,1,z+dz,ink);
  v.box(x+2,2,z,x+4,3,z+1,oak);
  if(loaded) {
    v.put(x-1,3,z,oxblood);
    v.box(x,3,z-1,x+2,4,z+1,vellum);
  }
}
function pigeon(v:PixelVox,x:number,y:number,z:number) {
  v.put(x,y,z,"#E3DDD1"); v.put(x+1,y,z,"#AAAFAE"); v.put(x+1,y+1,z,"#E3DDD1");
}

/** End dovecote, crossing diagonal dispatch shed, raised cross-lane loft and split pigeon mews. */
export const courierYard:SignatureBuilder=(c,p,active)=>{
  const {v,hx,hz,lv:l,variant:s}=c, X=hx-2,Z=hz-2, end=Math.floor(Z*.08);
  let loftX=0,loftZ=0,loftH=8+l;
  if(s===0) {
    const deep=Math.max(4,Math.min(9,Z));
    timber(v,-X,-Z,X+1,-Z+deep,1,4+(l>=4?1:0));
    gable(v,-X,-Z-1,X+1,-Z+deep+1,l>=4?6:5,2+l,false,tile);
    loftX=-X+3;loftZ=-Z+3;loftH=7+2*l;
    pigeonLoft(v,loftX,loftZ,l>=3?3:2,loftH,true);
    if(l>=3){
      timber(v,-X,-Z+deep,-X+5,end+4,1,4);
      gable(v,-X-1,-Z+deep,-X+6,end+5,5,2,true,tile);
    }
    if(l>=4){
      // A roofed relay lane faces the street at right angles to the original shed.
      gable(v,X-7,-Z+deep,X+1,Z-2,7,3,true,tile);
      for(let z=-Z+deep;z<Z-2;z+=4){
        v.box(X,1,z,X+1,8,z+1,oak);
        v.box(X-6,1,z,X-5,8,z+1,oak);
        cart(v,X-3,z,false);
      }
    }
    if(l===5){
      const z=Z-5;
      v.box(-X+4,7,z-2,2,8,z+3,honey);
      gable(v,-X+3,z-3,3,z+4,11,3,false,tile);
      for(let x=-X+4;x<2;x+=4){
        v.box(x,1,z,x+1,11,z+1,oak);
        v.box(x,8,z-2,x+3,10,z+2,lime);
        v.put(x+1,9,z+1,ink);
      }
      pigeonLoft(v,X-4,-Z+3,2,11,false);
    }
  } else if(s===1) {
    // The sorting table and its lean-to run on the same diagonal, from the
    // public hatch at street level to the loft at the far dispatch end.
    for(let x=-X;x<=X;x++){
      const z=Math.round(-Z+2+(x+X)/(2*X)*Math.max(3,Z-1));
      v.box(x,1,z-1,x+1,2,z+4,stone);
      v.box(x,2,z+1,x+1,3,z+3,honey);
      for(let d=-2;d<=3;d++) v.put(x,5+Math.floor((d+2)/2),z+d,d===3?oak:slate);
      if((x+X)%4===0) {
        v.box(x,1,z-1,x+1,6,z,oak);
        v.box(x,1,z+3,x+1,8,z+4,oak);
        v.put(x,3,z+1,vellum);
      }
    }
    loftX=X-3;loftZ=end;loftH=9+2*l;
    pigeonLoft(v,loftX,loftZ,l>=3?3:2,loftH,false);
    if(l>=3) cart(v,-X+4,end+3,true);
    if(l>=4) pigeonLoft(v,-X+3,-Z+3,2,8,true);
    if(l===5) {
      timber(v,-X+1,Z-6,-1,Z-2,1,4);
      gable(v,-X,Z-7,0,Z-1,5,3,false,tile);
    }
  } else if(s===2) {
    const gap=l===1?2:3, front=Z-2;
    for(const x of [-X,X-3]) {
      timber(v,x,-Z,x+3,front,1,3);
      gable(v,x-1,-Z,x+4,front+1,4,2,true);
    }
    const z=l===1?-1:-Math.floor(Z*.3), width=Math.min(4,Math.floor(X*.55));
    for(const x of [-gap,gap]) {
      v.box(x,1,z-2,x+1,8+l,z+3,oak);
      beam(v,[x,4,z],[Math.sign(x)*(X-1),7+l,z],honey);
    }
    v.box(-X,7+l,z-2,X+1,8+l,z+3,honey);
    v.box(-width,8+l,z-2,width+1,11+l,z+3,lime);
    gable(v,-width-1,z-3,width+2,z+4,11+l,3+l,false,tile);
    for(let x=-width+1;x<width;x+=2) {v.put(x,10+l,z+2,ink);v.put(x,9+l,z+3,honey);}
    loftX=0;loftZ=z;loftH=11+l;
    if(l>=2) cart(v,0,z+3,active);
    if(l>=4) pigeonLoft(v,-X+3,front-3,2,10,true);
    if(l===5) pigeonLoft(v,X-3,-Z+3,3,13,false);
  } else {
    const long=Z-2;
    // Short rows of shelter boxes are separated by an uncovered cart drive.
    for(let z=-Z;z<long;z+=5) {
      const endZ=Math.min(long,z+4);
      timber(v,-X,z,-X+4,endZ,1,3);
      gable(v,-X,z,-X+5,endZ+1,4,2,true,tile);
    }
    const rearZ=-Z+4;
    timber(v,-X+3,-Z,X-1,rearZ,1,4);
    gable(v,-X+2,-Z,X,rearZ+1,5,3,false);
    loftX=X-3;loftZ=Z-3;loftH=8+l;
    pigeonLoft(v,loftX,loftZ,2,loftH,true);
    if(l>=2) cart(v,Math.floor(X*.25),-Z+5,true);
    if(l>=3) pigeonLoft(v,X-3,-Z+3,2,9+l,true);
    if(l>=4) {
      for(let z=-Z+7;z<Z-5;z+=5) {
        v.box(X-3,1,z,X,5,z+3,honey);
        v.put(X-1,3,z+2,ink);
      }
    }
    if(l===5) {
      gable(v,X-5,-Z+5,X+1,Z-5,7,3,true,tile);
      const cx=-Math.floor(X*.32);
      timber(v,cx-5,1,cx+6,Z-2,1,6);
      gable(v,cx-6,0,cx+7,Z-1,7,5,true,slate);
      v.clear(cx-2,1,Z-3,cx+3,5,Z-2);
      cart(v,cx,Z-1,true);
      for(let z=-Z+6;z<Z-6;z+=4) v.box(X-4,1,z,X-3,7,z+1,oak);
    }
  }
  const deskX=s===3?-1:Math.round(X*.12), deskZ=Z-1;
  for(let z=deskZ;z>=-Z+3;z--){
    const t=(deskZ-z)/(deskZ+Z-3), x=Math.round(deskX+(loftX-deskX)*t);
    v.box(x-1,0,z,x+2,1,z+1,"#B79A75");
    if((z+Z)%3===0) v.put(x-1,0,z,stone);
  }
  if(l>=3) {
    cart(v,Math.floor(X*.45),Z-4,true);
    v.box(-X+3,1,Math.floor(Z*.25),-X+6,3,Math.floor(Z*.25)+2,honey);
  }
  v.box(deskX-2,1,deskZ-1,deskX+2,3,deskZ+1,honey);
  v.put(deskX,3,deskZ,vellum);
  candle(v,deskX-2,3,deskZ);
  if(s!==2) cart(v,Math.max(-X+2,deskX-4),Math.max(0,Z-4),active);
  if(l>=2) pigeon(v,loftX,loftH-2,loftZ+3);
  if(active) { pigeon(v,loftX-1,loftH-2,loftZ+3); person(v,deskX+2,1,deskZ,p.cloth); }
};

function chest(v:PixelVox,x0:number,z0:number,x1:number,z1:number,h:number) {
  timber(v,x0,z0,x1,z1,1,h,honey);
  const mid=(z0+z1-1)/2, rz=(z1-z0)/2;
  for(let z=z0;z<z1;z++){
    const y=h+1+Math.round(2.8*Math.sqrt(Math.max(0,1-((z-mid)/rz)**2)));
    for(let x=x0;x<x1;x++) {
      const band=x===x0+1 || x===x1-2 || ((x-x0)%8===2 && x1-x0>9);
      v.put(x,y,z,band?ink:((z-z0)%3?honey:oak));
      if(x===x0||x===x1-1) v.box(x,h,z,x+1,y,z+1,oak);
      if(band && (z===z0||z===z1-1)) v.box(x,2,z,x+1,y+1,z+1,ink);
    }
  }
  const x=Math.floor((x0+x1)/2);
  v.box(x-1,3,z1-1,x+2,h+2,z1,gold);
  v.put(x,4,z1-1,ink);
}
function vaultDrum(v:PixelVox,x:number,z:number,r:number,height:number,roof:boolean){
  v.cylinderY(x+.5,z+.5,1,height,r,stone);
  v.cylinderY(x+.5,z+.5,height-2,height-1,r+.5,ash);
  v.cylinderY(x+.5,z+.5,height,height+1,r+.5,chalk);
  for(const s of [-1,1]) {
    v.box(x+r,2,z+s,x+r+1,height-2,z+s+1,ash);
    v.put(x+s,height-1,z+r,ink);
  }
  if(roof) turret(v,x,z,height+1,r,Math.max(2,r-1),slate);
  else for(const side of [-1,1]){
    v.put(x+side*(r-1),height+1,z,gold);
    v.put(x,height+1,z+side*(r-1),ash);
  }
}
function hatch(v:PixelVox,x:number,z:number,y:number) {
  v.box(x-2,y,z,x+3,y+4,z+1,chalk);
  v.box(x-1,y,z,x+2,y+3,z+1,ink);
  for(const dx of [-1,1]) v.box(x+dx,y+1,z,x+dx+1,y+3,z+1,gold);
  v.put(x,y+2,z+1,glow,.45);
}

/** Ironbound guild chest, four-corner counting keep, treasury drums and terraced turf strongroom. */
export const guildBank:SignatureBuilder=(c,p,active)=>{
  const {v,hx,hz,lv:l,variant:s}=c, X=hx-2,Z=hz-2;
  let gate=0;
  if(s===0){
    const end=l===1?2:Math.floor(Z*.45), left=-X+1, right=X;
    chest(v,left,-Z+1,right,end+1,4+l);
    if(l>=2) vaultDrum(v,-X+3,end,2,5,false);
    if(l>=3) vaultDrum(v,X-3,end,3,7,false);
    if(l>=4) {
      const x=left+2;
      v.hollowBox(x,6,-Z+1,x+Math.floor((right-left)*.55),12,-Z+9,stone,ash);
      chest(v,x,-Z+2,x+Math.floor((right-left)*.55),-Z+8,13);
    }
    if(l===5) {
      const wide=Math.floor(X*.58);
      v.box(-wide,1,end,wide+1,5,Z-1,stone);
      gable(v,-wide-1,end-1,wide+2,Z,5,3,false,oak);
      gate=Z-1;
    } else gate=end+1;
  } else if(s===1) {
    const r=l===1?2:3, end=l<=3?Math.floor(Z*.32):Math.floor(Z*.74), left=-X+2,right=X-2;
    v.hollowBox(left,1,-Z+2,right+1,5+l,end,stone);
    if(l>=2){
      // An interior counting yard is visible through the stone enclosure.
      const inset=l===2?2:3;
      v.clear(left+inset,2,-Z+4,right-inset+1,5+l,end-2);
      v.box(left+inset,1,-Z+4,right-inset+1,2,end-2,honey);
      const tallyX=Math.floor((left+right)/2);
      v.box(tallyX-2,2,-Z+5,tallyX+3,4,-Z+7,oak);
      for(const dx of [-1,1]) v.put(tallyX+dx,4,-Z+6,gold);
    }
    for(let x=left;x<=right;x+=3) v.put(x,5+l,end-1,chalk);
    vaultDrum(v,left,-Z+3,r,6+l,true);
    vaultDrum(v,right,end-1,r,6+l,false);
    if(l>=2) vaultDrum(v,right,-Z+3,r,5+l,false);
    if(l>=3) vaultDrum(v,left,end-1,r,6+l,true);
    if(l>=4) {
      chest(v,-4,-Z+3,5,-Z+8,8);
      v.box(left+3,5+l,-Z+5,right-2,6+l,-Z+7,honey);
    }
    if(l===5) {
      v.hollowBox(-3,1,end-1,4,10,Z,ash);
      for(let x=-3;x<=3;x+=2) v.put(x,10,Z-1,chalk);
      gable(v,-5,end-2,6,Z+1,10,4,true,slate);
      gate=Z;
    }else gate=end;
  } else if(s===2){
    const r=Math.max(3,Math.floor(Math.min(X,Z)*.42)), masterX=l===1?-1:-Math.round(X*.35);
    vaultDrum(v,masterX,-Math.floor(Z*.25),r,5+l,true);
    const x2=X-r, z2=Math.floor(Z*.4);
    vaultDrum(v,x2,z2,Math.max(2,r-1),4+l,false);
    if(l>=2) vaultDrum(v,x2,-Z+r,r-1,6+l,true);
    if(l>=3) {vaultDrum(v,-X+3,Z-4,3,5,false);v.box(-X+2,1,-1,X-1,4,2,ash);}
    if(l>=4) {
      const y=5+l;
      const z=-Math.floor(Z*.25);
      v.cylinderY(masterX+.5,z+.5,y,y+7,r-1,stone);
      v.cylinderY(masterX+.5,z+.5,y+5,y+6,r,ash);
      turret(v,masterX,z,y+7,r,4,tile);
      chest(v,1,Z-8,8,Z-3,6);
    }
    if(l===5) {chest(v,-4,Z-7,4,Z-1,6);gate=Z-1;}
    else {
      gate=z2+Math.max(2,r-1);
      v.hollowBox(-2,1,z2-2,x2+1,5,gate+1,ash);
    }
  } else {
    // A sunken treasury reads as cut sod and rough, battered masonry from
    // above. Its one guarded door sits in a deep notch through the banks.
    const end=Math.max(3,Math.floor(Z*(l>=4?.8:.43))), rows=3+(l>=3?1:0);
    for(let k=0;k<rows;k++){
      const x=-X+k*2,z=-Z+k,xx=X-k*2+1,zz=end-k;
      if(xx-x<2||zz-z<2) break;
      v.box(x,1+k*2,z,xx,3+k*2,zz,k%2?stone:moss);
      v.clear(-1,1+k*2,Math.max(z,end-4-k),2,3+k*2,zz);
    }
    if(l>=3){
      for(let z=-Z+5;z<end-4;z+=3){
        const offset=((z+Z)%5)-2;
        v.box(-4+offset,8,z,4+offset,9,z+2,moss);
      }
      v.box(-1,8,-Z+4,2,11,-Z+7,ash);
      v.box(-2,11,-Z+5,3,12,-Z+6,oak);
    }
    if(l>=2) chest(v,-X+2,-Z+1,-X+7,-Z+5,6);
    if(l>=3) vaultDrum(v,X-4,-Z+4,3,8,false);
    if(l>=4) {
      for(const x of [-X+3,X-3]) v.box(x-1,1,end-3,x+2,7,Z-1,ash);
    }
    if(l===5) { vaultDrum(v,-X+4,-Z+5,4,10,true); chest(v,-4,-Z+1,6,-Z+7,9); }
    gate=end-2;
  }
  hatch(v,0,gate,1);
  v.box(-1,0,gate+1,2,1,Z+1,stone);
  if(active) person(v,3,1,Math.min(Z,gate+1),p.frame);
  if(l>=3){v.put(-2,1,gate+1,gold);v.put(-2,2,gate+1,honey);}
};
