import { createInitialGameState, recomputeConnectivityAndMetrics, upgradeElementDirect, type GameState } from "../game/simulation";
import { addLine, stepMobility } from "../game/mobility";
import { hydraulics } from "../game/terrain";
import { applyCourseAction } from "./course";

export const ROME_LESSONS = [
  {id:"rome-access",name:"A door on the street",element:"house",goal:"Give a courtyard house street access.",hint:"Build the house on the parcel beside the stone street.",action:"Build beside the street",world:"rome-starter"},
  {id:"rome-transit",name:"The passenger terminus",element:"train_stops",goal:"Dispatch a train and follow it to its first passenger platform.",hint:"Select a platform to make it the line’s first stop. Follow the train’s dispatch and arrival.",action:"Dispatch train",world:"rome-district"},
  {id:"rome-flow",name:"Water from the hills",element:"aqueduct",goal:"Restore flow from a hillside spring to a receiving pool.",hint:"The middle span is too high for this supply. Lower it to meet the neighboring channel.",action:"Lower the middle span",world:"rome-district"},
  {id:"rome-upgrade",name:"Room for another family",element:"house",goal:"Compare two residential tiers, then increase housing capacity.",hint:"Look at the house in the Atlas, compare levels 1 and 2, then upgrade this parcel.",action:"Upgrade the house",world:"rome-skyline"},
] as const;
export type RomeLesson = (typeof ROME_LESSONS)[number];
export type RomeExercise = RomeLesson["id"];

export function createRomePractice(id: RomeExercise) {
  const s=createInitialGameState("god");
  s.timeOfDay=12;
  const place=(element:string,x:number,z:number) => {
    const result=applyCourseAction(s,{element,at:[x,z]});
    if (!result.ok) throw Error(result.detail ?? "Practice parcel unavailable.");
    return s.elements.at(-1)!;
  };
  const works=(tool:Parameters<typeof applyCourseAction>[1]) => {
    const result=applyCourseAction(s,tool);
    if (!result.ok) throw Error(result.detail ?? "Practice channel unavailable.");
  };
  if (id === "rome-transit") {
    for (let x=-6;x<=6;x++) place("train_tracks",x,0);
    place("train_depots",-6,1);
    place("train_stops",-2,1); place("train_stops",5,1);
    s.population=45;
  } else if (id === "rome-flow") {
    works({tool:{kind:"mountain",height:3},at:[-2,0]});
    works({tool:{kind:"pond",depth:2},at:[2,0],end:[3,0]});
    works({tool:{kind:"aqueduct",height:2,style:1},at:[-1,0],end:[1,0]});
    works({tool:{kind:"aqueduct",height:9,style:1},at:[0,0]});
  } else {
    place("roads",0,0);
    place("roads",-1,0);
    place("grocery_store",-1,1);
    if (id === "rome-upgrade") place("house",0,1);
  }
  recomputeConnectivityAndMetrics(s);
  return s;
}

export const outletFlow = (s:GameState) => hydraulics(s).channels.get("2,0") ?? 0;

export function dispatchPracticeTrain(s:GameState, firstStop:number) {
  const depot=s.elements.find(e=>e.defId==="train_depots")!;
  const stops=s.elements.filter(e=>e.defId==="train_stops").map(e=>e.id);
  if (firstStop===1) stops.reverse();
  return addLine(s,"rail",depot.id,stops);
}
export function followPracticeTrain(s:GameState) {
  s.activePlaySec+=.25;
  stepMobility(s,.25);
  const line=s.mobility!.lines[0];
  return {ok:line.at===line.stops[0] && line.dwell>0, detail:line.status, blocked:line.blocked};
}
export function takeRomeAction(s:GameState,id:Exclude<RomeExercise,"rome-transit">) {
  if (id === "rome-flow") {
    const result=applyCourseAction(s,{tool:{kind:"aqueduct",height:2,style:1},at:[0,0]});
    const flow=outletFlow(s);
    return {ok:result.ok && flow>0,detail:flow>0 ? "The hillside now supplies the receiving pool." : result.detail ?? "The pool is still dry."};
  }
  if(id === "rome-upgrade") {
    const home=s.elements.find(e=>e.defId==="house")!;
    const previous=s.metrics.housingBase;
    const result=upgradeElementDirect(s,home.id);
    return {ok:result.ok && s.metrics.housingBase>previous,detail:result.reason ?? "Housing capacity rose from " + previous + " to " + s.metrics.housingBase + "."};
  }
  const result=applyCourseAction(s,{element:"house",at:[0,1]});
  const home=s.elements.find(e=>e.defId==="house");
  return {ok:!!home?.connected,detail:home?.connected ? "The new house has access to the stone street." : result.detail ?? "The house needs street access."};
}
