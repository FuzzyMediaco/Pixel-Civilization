import type { Ctx } from "./kit";
import type { Ink, ArtFamily } from "./periodArtCatalog";
import { canopy, wing } from "./periodMasonry";

/** What happens at the entrance distinguishes civic, commercial and residential neighbors sharing local materials. */
export function parcelFront(c:Ctx,p:Ink,family:ArtFamily) {
  const {v,lv,hx,hz,id}=c,x=-hx+3,z=hz-4,side=hx-4;
  switch(id){
    case "tiny_homes": case "trailer_home":
      v.box(side-1,1,z-1,side+2,2,z+2,p.frame);v.put(side,2,z,p.cloth);return;
    case "rowhouse_duplex": case "townhomes":
      for(const xx of [-3,3]){v.box(xx-1,1,z,xx+1,2,z+2,p.rim);v.put(xx,2,z,p.sign);}return;
    case "cottages": case "country_schoolhouse":
      v.box(x,1,z,x+3,2,z+2,p.rim);
      for(let i=0;i<3;i++)v.put(x+i,2,z,p.cloth);return;
    case "beach_houses": case "courtyard_villa": case "villas": case "mansions":
      if(hx>8){
        v.box(side-5,1,z-3,side+1,2,z+1,p.rim);
        v.box(side-4,1,z-2,side,2,z,id==="beach_houses"?p.frame:p.glass);
        if(id==="villas"||id==="mansions")v.put(side-2,2,z-1,p.rim);
      }return;
    case "banks":case "tax_collecting_office":
      v.box(side-2,1,z-1,side+2,4+Math.floor(lv/2),z+2,p.frame);
      v.box(side-1,2,z+1,side+1,4,z+2,p.sign);v.put(side,3,z+2,p.rim);return;
    case "post_offices":
      v.box(x,1,z-2,x+1,5,z-1,p.frame);v.box(x-1,4,z-3,x+3,6,z-1,p.wall);
      v.put(x,4,z-1,p.shade);v.put(x+2,5,z-2,p.cloth);return;
    case "courthouses":case "government_buildings":case "city_offices":
      for(let i=0;i<(id==="courthouses"?3:2);i++)v.box(-3+i,1+i,z-i,4-i,2+i,z+1,p.rim);
      if(id==="government_buildings")v.box(side,1,z-2,side+1,7+lv,z-1,p.frame);return;
    case "community_centers":case "preschool":case "elementary_school":
      for(let xx=x;xx<x+5;xx+=2)v.box(xx,1,z,xx+1,3,z+1,p.frame);
      v.box(x,3,z,x+5,4,z+1,p.cloth);v.box(x+1,1,z+1,x+4,2,z+2,p.sign);return;
    case "high_school":case "middle_school":
      v.box(x,1,z-2,x+1,6,z-1,p.frame);v.box(x-1,5,z-2,x+3,7,z-1,p.rim);
      v.put(x+1,5,z-1,p.cloth);return;
    case "research_university":case "research_institute":
      v.cylinderY(side-1,z-2,1,5,2,p.rim);v.sphere(side-1,5,z-2,2.3,2.5,2.3,p.glass);return;
    case "public_library":case "indie_bookstore":
      v.box(x,1,z-2,x+4,5,z,p.frame);for(let k=0;k<3;k++)v.put(x+k,3,z,k%2?p.sign:p.cloth);
      return;
    case "art_gallery":
      v.box(side-2,1,z-2,side+1,2,z+1,p.rim);v.box(side-1,2,z-1,side,5,z,p.sign);v.put(side,5,z-1,p.frame);return;
    case "businesses":case "shops":case "clothing_stores":case "shoe_stores":case "thrift_stores":
      v.box(x,1,z-2,x+1,4+lv,z-1,p.frame);
      v.box(x+1,4,z-2,x+3,5+lv,z-1,id==="shops"?p.rim:p.cloth);return;
    case "grocery_store":case "bakeries":case "growers_exchange":case "bakery_coop":
      v.box(side-2,1,z-2,side+1,2,z,p.frame);
      v.cylinderY(side-1,z-1,2,3,1.2,p.sign);return;
    case "university":case "community_college":case "trade_school":
      if(hx>10)canopy(v,p,side-5,z-3,side,z,4+lv);
      return;
  }
  if(family==="school"&&hx>13){
    wing(v,p,{x,z:z-4,X:x+5,Z:z-1},1,4+Math.floor(lv/2));
  }
}
