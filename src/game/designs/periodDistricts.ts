import { type Ctx, archway, tree, PixelVox } from "./kit";
import type { Ink, ArtFamily } from "./periodArtCatalog";
import { canopy, wing } from "./periodMasonry";

/** Courtyard structures and service equipment face the street; the center of a station platform stays clear. */
export function districtCraft(c:Ctx,p:Ink,family:ArtFamily,wet:boolean) {
  const {v,hx,hz,lv,variant:s}=c;
  const market=family==="market", home=family==="house"||family==="apartment";
  const water=family==="water", rail=family==="station", civic=family==="hall"||family==="school"||family==="faith";
  if(!market&&!home&&!water&&!rail&&!civic)return;
  if(rail && ["bus_stops","train_stops","tram_station","taxi_ranks"].includes(c.id))return;
  const x=-hx+2,X=hx-2,z=-hz+2,Z=hz-2;
  const cx=market||rail?x+3:Math.max(x+2,Math.min(-2,-Math.round(hx*.43)));
  const cz=rail?z+3:Math.min(Z-4,Math.max(z+4,Math.floor(hz*.24)));
  const sideX=X-3;
  switch(p.era){
    case "ancient-china":{
      if(home||civic){
        // Moon gate and a side court, enclosed on three sides around flowering bamboo.
        const front=Math.max(3,Z-2),h=4+Math.floor(lv/2);
        v.box(x,1,front,X,h+1,front+1,"#a85849");archway(v,0,1,front,front+1,5,h);
        for(const end of [x,X-1]){v.box(end,1,cz,end+1,h,front,p.wall);v.box(end,h,cz,end+1,h+1,front,p.roof);}
        v.box(-4,h+1,front-1,5,h+2,front+2,p.roof);
        v.put(-4,h+2,front,p.sign);v.put(4,h+2,front,p.sign);
        for(const end of [-3,3]){v.put(end,h,front+1,"#d75940",.35);v.put(end,h-1,front+1,p.sign);}
      }
      if(market||rail){
        const y=7+lv;for(const end of [cx,sideX]){
          v.box(end,1,cz,end+1,y+2,cz+1,p.frame);
          v.box(end,y,cz,end+3,y+1,cz+1,p.rim);
          v.box(end+2,y-3,cz,end+3,y,cz+1,p.cloth);v.put(end+2,y-2,cz+1,p.sign,.4);
        }
      }
      if(water){
        v.box(cx,1,cz-2,cx+2,7+lv,cz,p.wall);v.box(cx,6+lv,cz-2,sideX,7+lv,cz,p.rim);
        v.box(cx+1,7+lv,cz-2,sideX,8+lv,cz-1,wet?p.glass:p.shade);
        if(wet)v.box(sideX-1,2,cz-2,sideX,7+lv,cz-1,p.glass);
      }
      break;
    }
    case "ancient-egypt":{
      if(market||home){
        const y=5+lv;const roofs=lv>=3?2:1;
        for(let i=0;i<roofs;i++){
          const a=x+2+i*4;
          v.cylinderY(a+.5,cz+.5,1,y,2.1,p.wall);v.sphere(a,y,cz,2.4,1.5,2.2,p.rim);
          v.put(a,Math.round(y)+1,cz,p.shade);
        }
        canopy(v,p,Math.max(0,X-6),cz,Math.min(X,5+Math.max(0,X-6)),Math.min(Z-1,cz+3),4+Math.floor(lv/2));
      }
      if(civic||rail||water){
        const h=7+lv;
        for(const end of [cx,sideX]){
          for(let k=0;k<h;k++){const t=Math.floor(k/4);v.box(end-2+t/2,1+k,cz-1,end+3-t/2,2+k,cz+2,k===h-2?p.sign:p.wall);}
          v.box(end-2,h+1,cz-1,end+3,h+2,cz+2,p.rim);
          v.box(end,2,cz+2,end+1,h-1,cz+3,p.sign);
        }
        if(water){
          v.box(cx,5,cz,sideX+1,6,cz+1,p.frame);v.box(1,3,cz-1,2,8,cz,p.frame);
          v.box(0,3,cz-2,2,4,cz,wet?p.glass:p.floor);
        }
      }break;
    }
    case "ancient-greece":{
      // Open stoa replaces the street-facing wall; shallow hills of stone lead into the portico.
      const a=market?x:Math.max(x,-Math.floor(hx*.68)),b=market?X:Math.min(X,Math.floor(hx*.68)+1);
      const zz=rail?z+4:Math.min(Z-3,cz+1);
      const h=5+Math.min(3,lv);
      if(home||civic||market){
        v.box(a-1,1,zz-1,b+1,2,zz+4,p.rim);
        for(let xx=a;xx<b;xx+=4){
          v.box(xx-1,2,zz+1,xx+2,3,zz+3,p.wall);
          v.box(xx,3,zz+1,xx+1,h+1,zz+2,p.rim);v.box(xx-1,h,zz+1,xx+2,h+1,zz+2,p.rim);
        }
        v.box(a-1,h+1,zz,b+1,h+2,zz+3,p.rim);v.box(a-1,h+2,zz,b+1,h+3,zz+1,p.sign);
        if(hx>=14)tree(v,X-3,1,Z-3,"round",.48,72+lv);
      }
      if(water){
        v.cylinderY(sideX-.5,cz,1,4,3.5,p.rim);v.cylinderY(sideX-.5,cz,3,4,2.4,wet?p.glass:p.floor);
        for(const a of [x+2,x+5])v.box(a,1,Z-4,a+1,h,Z-3,p.rim);
        v.box(x+1,h,Z-4,x+7,h+1,Z-2,p.sign);
      }
      if(rail){v.box(x,2,Z-3,X,3,Z-2,p.rim);v.box(x+1,3,Z-3,X-1,4,Z-2,p.sign);}
      break;
    }
    case "medieval-europe":{
      if(home||market||civic){
        const a=sideX-1,zz=z+3,h=Math.max(7,lv*3+4);
        v.box(a-2,1,zz-2,a+3,h,zz+3,p.shade);v.box(a-3,h,zz-3,a+4,h+4,zz+4,p.wall);
        for(const xx of [a-3,a,a+3])v.box(xx,h,zz+3,xx+1,h+4,zz+4,p.frame);
        for(let k=0;k<5;k++)v.box(a-4+k,h+4+k,zz-4,a+5-k,h+5+k,zz+5,p.roof);
        v.put(a,h+2,zz+4,p.lamp,.4);
      }
      if(water){
        const a=sideX-2,h=5+lv;v.box(a-2,1,cz-1,a+3,h+2,cz+1,p.frame);
        const wheel=new PixelVox();
        wheel.ringZ(0,0,0,2,4.5,3.1,p.frame);
        for(let i=0;i<8;i++)for(let n=0;n<=4;n++)wheel.put(Math.round(n*Math.cos(i*Math.PI/4)),Math.round(n*Math.sin(i*Math.PI/4)),0,p.rim);
        c.addRotor({vox:wheel,pivot:[a,h-1,cz+2],axis:"z",speed:wet?.55:0});
      }
      if(rail)for(let xx=x+2;xx<X;xx+=6)v.box(xx,2,cz,xx+1,8+lv,cz+1,p.frame);
      break;
    }
    case "renaissance-italy":{
      if(home||market||civic||rail){
        const zz=rail?Math.max(z+2,-3):Math.min(Z-3,cz+1),h=4+Math.min(3,lv);
        v.box(x,1,zz,X,h+1,zz+2,p.rim);
        for(let xx=x+3;xx<X-1;xx+=6)archway(v,xx,1,zz,zz+2,4,h);
        v.box(x-1,h+1,zz-1,X+1,h+2,zz+2,p.wall);v.box(x-1,h+2,zz-1,X+1,h+3,zz+2,p.rim);
        if(hx>8){v.cylinderY(sideX+.5,cz-3.5,h,h+5,2.3,p.wall);v.cylinderY(sideX+.5,cz-3.5,h+5,h+7,2.5,p.roof);}
      }
      if(water){v.cylinderY(1,cz,2,4,3.4,p.rim);v.cylinderY(1,cz,3,4,2.4,wet?p.glass:p.floor);v.cylinderY(1,cz,4,6,1.3,p.rim);if(wet)v.put(1,6,cz,p.glass);}
      break;
    }
    case "world-war-ii":{
      if(home||market){
        const h=6+lv;
        for(let xx=x+2;xx<X-2;xx+=5){
          v.box(xx,2,cz-2,xx+1,h,cz-1,p.wall);v.box(xx-1,h-1,cz-2,xx+2,h,cz,p.shade);
          v.box(xx-1,1,cz,xx+1,2,cz+2,p.rim);
        }
      }
      if(rail||water||civic){
        const a=sideX,h=6+lv;
        for(const k of [-1,2])v.box(a+k,1,z+2,a+k+1,h,z+3,p.frame);
        v.box(a-2,h,z,a+4,h+3,z+4,p.wall);v.box(a-2,h+1,z+3,a+4,h+2,z+4,p.glass);
        v.box(a-3,h+3,z-1,a+5,h+4,z+5,p.roof);
        if(rail){v.box(a+1,h+4,z+1,a+2,h+8,z+2,p.frame);v.put(a+1,h+7,z+2,p.lamp,.3);}
      }break;
    }
    case "art-deco":{
      const a=home||water?sideX:0, zz=rail?Math.max(z+1,-3):cz;
      for(let k=-2;k<=2;k++){
        const h=6+lv+2*(2-Math.abs(k));
        v.box(a+k,1,zz,a+k+1,h,zz+1,k%2?p.rim:p.sign);v.put(a+k,h,zz,p.lamp,.22);
      }
      if(market||rail){v.box(a-4,4,zz-1,a+5,5,zz+4,p.frame);v.box(a-3,5,zz+1,a+4,6,zz+4,p.rim);}
      break;
    }
    case "future-3027":{
      const a=sideX-1, zz=rail?z+4:cz, h=4+Math.min(4,lv);
      v.box(a,1,zz,a+2,h,zz+2,p.frame);
      v.box(a-3,h,zz-2,a+4,h+1,zz+3,p.rim);v.box(a-2,h+1,zz-2,a+3,h+3,zz+3,p.glass);
      v.box(a-3,h+3,zz-1,a+4,h+4,zz+2,p.wall);v.put(a,h+4,zz,p.leaf);
      const end=Math.max(x+3,a-8-lv);v.box(end,h+1,zz,a-2,h+2,zz+2,p.frame);
      v.box(end,h+2,zz,a-2,h+3,zz+1,p.sign,.3);
      if(water){v.cylinderY(1,cz,2,3+lv,2.2,p.glass);v.cylinderY(1,cz,3+lv,4+lv,2.5,p.rim);}
      break;
    }
    case "post-apocalyptic":{
      const a=sideX-1,zz=rail?z+2:cz,h=6+lv;
      for(const xx of [a-2,a+2]){v.box(xx,1,zz,xx+1,h,zz+1,p.frame);}
      v.box(a-3,h,zz-2,a+4,h+1,zz+3,p.frame);
      if(water||home){
        v.cylinderY(a+.5,zz+.5,h+1,h+4,2.2,p.shade);
        v.cylinderY(a+.5,zz+.5,h+4,h+5,2.2,p.sign);
        v.box(a+2,2,zz-1,a+3,h+1,zz,p.rim);
      }else{
        v.box(a-2,h+1,zz-1,a+3,h+4,zz+1,p.cloth);
        for(const xx of [a-1,a+1])v.box(xx,h+2,zz+1,xx+1,h+3,zz+2,p.rim);
      }
      if(lv>=3)v.box(a-2,1,zz+1,a+2,2,zz+3,p.leaf);
      break;
    }
  }
}
