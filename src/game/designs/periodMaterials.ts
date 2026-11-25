import { PALETTE, PixelVox } from "../voxelCore";
import type { Ink } from "./periodArtCatalog";

const groups = {
  wall: "brick plaster concrete brick2 cream limestone camoTan",
  rim: "white chrome steelLight silver mortar marble marbleShade concrete2",
  frame: "woodDark iron steelDark charcoal slateDark",
  shade: "brickDark steel basalt concreteDark asphaltDark granite",
  roof: "terracotta slate slateLight steel roof redDark",
  floor: "asphalt path path2",
  sign: "gold goldDark brass copper hazard amber",
  cloth: "red crimson indigo purple",
  leaf: "olive moss leafDark",
  glass: "glass glassDark solarBlue",
} as const;
const probe = new PixelVox();
const single = (color:string) => {
  probe.put(0,0,0,color);
  return probe.v.values().next().value!;
};
const cache = new WeakMap<Ink, Map<number,number>>();
function materials(p:Ink) {
  let result=cache.get(p);
  if(result)return result;
  result=new Map<number,number>();
  for(const [role,names] of Object.entries(groups)){
    const to=single(p[role as keyof typeof groups]);
    for(const name of names.split(" "))if(PALETTE[name])result.set(single(name),to);
  }
  // These survey colors belong to the double-resolution highway kit.
  for(const name of ["#a5a394","#aab7b6","#bcbcb2","#9baaa7"])result.set(single(name),single(p.rim));
  for(const name of ["#81918f","#51666b","#825c49","#536780","#52665c","#466b73"])result.set(single(name),single(p.frame));
  cache.set(p,result);
  return result;
}
export function periodFinish(v:PixelVox,p:Ink) {
  const mapping=materials(p);
  for(const [key,old] of v.v){
    const style=mapping.get(old);
    if(style!==undefined)v.v.set(key,style);
  }
}
const roadStyles = new Set("asphalt asphaltDark slate slateLight concrete concrete2 concreteDark path path2 stone wood woodLight charcoal #485158 #665550 #4b5663 #495350".split(" ").map(single));

function mix(a:string,b:string,weight:number) {
  const value=(hex:string,start:number)=>Number.parseInt(hex.slice(start,start+2),16);
  return "#"+[1,3,5].map(i=>Math.round(value(a,i)*(1-weight)+value(b,i)*weight).toString(16).padStart(2,"0")).join("");
}
const streetFinish=new WeakMap<Ink,{floor:number;grout:number;rim:number;inlay:number}>();
function paving(p:Ink){
  let style=streetFinish.get(p);
  if(!style){
    style={floor:single(p.floor),grout:single(mix(p.floor,p.shade,.26)),rim:single(mix(p.floor,p.rim,.52)),inlay:single(mix(p.floor,p.sign,.28))};
    streetFinish.set(p,style);
  }
  return style;
}

/** Paint only existing deck cells. All four approach arms, lane markings, and deck elevations survive. */
export function pavePeriod(v:PixelVox,p:Ink,variant:number,level:number) {
  const {floor,grout,rim,inlay:sign}=paving(p);
  const mapping=materials(p);
  for(const [key,old] of v.v){
    if(!roadStyles.has(old)){
      const next=mapping.get(old);if(next!==undefined)v.v.set(key,next);
      continue;
    }
    const x=((key>>>20)&1023)-512,z=(key&1023)-512;
    const a=Math.abs(x),b=Math.abs(z),stride=4+variant;
    let seam=false;
    switch(p.era){
      case "ancient-china": seam=(x+z+128)%stride===0 && (b%4<2);break;
      case "ancient-egypt": seam=(b%stride===1 && a%3===0);break;
      case "rome-aqueduct": seam=(b%4===0 || (a+Math.floor(b/4)*2)%8===variant);break;
      case "ancient-greece": seam=(a+b+variant)%7===0;break;
      case "medieval-europe": seam=(a+2*b)%stride===1;break;
      case "renaissance-italy": seam=(a+b+variant)%9===0 || (a-b+99)%9===0;break;
      case "world-war-ii": seam=b%9===variant && a%5<2;break;
      case "art-deco": seam=(a===b+variant+2 || b%12===2 && a%8<4);break;
      case "future-3027": seam=a%9===variant+1 && b%4!==0;break;
      case "post-apocalyptic": seam=(a+Math.floor(b/3))%11===variant && b%7<5;break;
    }
    const wear=(a+b+variant)%Math.max(3,13-level)===1;
    v.v.set(key,seam?(wear?sign:grout):wear && (a+2*b)%6===variant?rim:floor);
  }
}
