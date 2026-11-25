import { PERIODS, PRODUCTION_ERAS, type ProductionEra } from "./game/periods";
import { tourId,tourImage } from "./game/periodTours";
const select=document.querySelector<HTMLSelectElement>("#era")!,size=document.querySelector<HTMLSelectElement>("#size")!;
const deck=document.querySelector<HTMLElement>("#periods")!;
for(const key of PRODUCTION_ERAS) {
  select.add(new Option(PERIODS[key].label,key));
  const button=document.createElement("button"), image=document.createElement("img"), name=document.createElement("span");
  image.src=tourImage(key,"skyline");image.loading="lazy";image.alt="";name.textContent=PERIODS[key].label;
  button.type="button";button.dataset.key=key;button.append(image,name);deck.append(button);
  button.onclick=()=>{select.value=key;draw();select.focus();select.scrollIntoView({block:"center"});};
}
const params=new URLSearchParams(location.search),initial=params.get("era") as ProductionEra;
select.value=PRODUCTION_ERAS.includes(initial)?initial:"rome-aqueduct";
if(["starter","district","skyline"].includes(params.get("size")??""))size.value=params.get("size")!;
function draw(){
  const key=select.value as ProductionEra, scene=size.value as "starter"|"district"|"skyline";
  const era=PERIODS[key], place=era.places[scene==="starter"?0:scene==="district"?1:2];
  const img=document.querySelector<HTMLImageElement>("#scene")!;img.src=tourImage(key,scene);img.alt=place+" · "+era.label;
  document.querySelector("#place")!.textContent=place;document.querySelector("#brief")!.textContent=era.description;
  document.querySelector<HTMLAnchorElement>("#play")!.href="./#world="+tourId(key,scene)+"&era="+key+"&view=0";
  const nav=document.querySelector("#learning")!;nav.replaceChildren();
  for(const [label,href] of [["Orbit the models","./field-guide.html?id=house&era="+key],["Practice the waterworks","./handbook.html#course=rome-flow&era="+key]]) {
    const a=document.createElement("a");a.href=href;a.textContent=label;nav.append(a);
  }
  for(const b of deck.querySelectorAll("button"))b.setAttribute("aria-pressed",String(b.dataset.key===key));
  history.replaceState(null,"","?"+new URLSearchParams({era:key,size:scene}));
}
select.onchange=size.onchange=draw;draw();
