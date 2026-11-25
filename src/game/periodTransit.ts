import type { PixelVox } from "./voxelCore";
import { productionPeriod } from "./periods";
import type { EraKey } from "./eraStyles";

/** Front and rear use local Z; the route renderer supplies the actual heading. */
export function periodCar(v:PixelVox,era:EraKey,kind:string,seed:number) {
  const [body,trim,accent]=productionPeriod(era).materials;
  const half=kind==="bus"?7:kind.includes("truck")?6:4;
  const delivery=kind.includes("truck");
  v.box(-2,1,-half,2,2,half,body);
  if(era==="future-3027"){
    v.box(-1,2,-half+1,1,4,half-2,"#759eae");
    for(const side of [-1,1]){v.box(side*3,1,-half+1,side*3,1,half-1,accent);v.put(side*3,0,-half+2,"#a3eee3",.5);}
    if(delivery)v.box(-2,3,-half+1,2,5,0,trim);
    return;
  }
  for(const x of [-3,3])for(const z of [-half+1,half-1])v.box(x,0,z-1,x,2,z+1,trim);
  if(["world-war-ii","art-deco","post-apocalyptic"].includes(era)){
    v.box(-2,3,half-2,2,4,half,body);v.box(-2,4,half-1,2,4,half-1,"#84999b");
    if(delivery)v.box(-2,3,-half,2,5,0,trim);
    else {v.box(-2,3,-half+1,2,4,half-2,"#718685");v.box(-2,5,-half+1,2,5,half-2,accent);}
    if(era==="art-deco"){v.box(-1,3,half,1,3,half+1,trim);v.box(-1,6,-half+2,1,6,0,body);}
    if(era==="world-war-ii")v.put(-2,4,half+1,"#d4bb81");
    if(era==="post-apocalyptic"){v.box(-3,3,-half,-3,4,-half+3,accent);v.box(2,5,-half,2,7,-half,trim);}
    return;
  }
  for(const x of [-2,2])for(const z of [-half+1,half-1])v.box(x,3,z,x,5,z,trim);
  if(delivery){for(const z of [-half+1,0])v.box(-1,3,z,1,5,z+1,"#bc9054");}
  else {
    v.box(-2,6,-half+1,2,6,half-1,accent);
    switch(era){
      case "ancient-china": for(const x of [-3,3])for(const z of [-half+1,half-1])v.put(x,7,z,trim);break;
      case "ancient-egypt": for(let z=-half+1;z<half;z+=2)v.box(-2,6,z,2,6,z,"#eee0ba");break;
      case "ancient-greece": v.box(-1,7,-half+1,1,7,half-1,body);break;
      case "medieval-europe": v.box(-1,7,-half+1,1,7,half-1,trim);v.box(0,8,-half+1,0,8,half-1,accent);break;
      case "renaissance-italy": v.box(-1,7,-half+2,1,7,half-2,body);v.put(0,8,-half+1,accent);break;
    }
  }
  v.box(0,1,half,0,1,half+2,trim);v.box(-1,1,half+2,1,3,half+4,seed%2?"#956f50":"#725440");v.put(0,4,half+4,trim);
}

export function periodCabin(v:PixelVox,era:EraKey,hull:boolean,freight:boolean) {
  const [body,trim,accent]=productionPeriod(era).materials;
  switch(era){
    case "ancient-china": v.box(-2,7,-4,2,7,4,trim);for(const x of [-3,3])for(const z of [-5,5])v.put(x,8,z,accent);break;
    case "ancient-egypt": if(hull){v.box(0,3,0,0,10,0,trim);v.box(-3,7,0,2,9,0,"#e0d8b5");}else for(const z of [-4,0,4])v.box(-3,6,z,3,6,z,accent);break;
    case "ancient-greece": if(hull)for(let z=-5;z<=5;z+=2){v.put(-4,1,z,trim);v.put(4,1,z,trim);}else v.box(-1,8,-4,1,8,4,body);break;
    case "medieval-europe": v.box(-1,7,-4,1,8,4,trim);if(hull)v.put(0,9,-4,accent);break;
    case "renaissance-italy": for(const z of [-4,4])v.box(-1,7,z,1,8,z,trim);break;
    case "world-war-ii": v.box(-2,4,-5,2,6,-2,trim);v.box(-1,7,-4,0,8,-4,accent);break;
    case "art-deco": v.box(-2,7,-5,2,7,4,body);v.box(0,8,-4,0,8,3,accent);break;
    case "future-3027": for(const x of [-3,3])v.box(x,3,-6,x,3,6,accent,.35);v.box(-1,7,-5,1,8,4,"#a6dedc");break;
    case "post-apocalyptic": v.box(-2,6,-6,1,7,-3,trim);v.box(1,4,4,1,8,4,accent);if(freight)v.box(-2,4,0,2,5,2,body);break;
  }
}
