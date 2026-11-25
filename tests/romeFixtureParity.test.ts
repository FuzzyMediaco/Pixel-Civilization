import assert from "node:assert/strict";
import test from "node:test";
import { createExampleWorld, EXAMPLE_WORLDS } from "../src/game/exampleWorlds";
import { ROME_WORLDS } from "../src/game/romeFixtures";
import { islandSaveKey, readExampleRoute } from "../src/game/activeIsland";
import { normalizeEra } from "../src/game/eraStyles";
import { recomputeConnectivityAndMetrics, stepSimulation, type GameState } from "../src/game/simulation";
import { hydraulics, readWaterService } from "../src/game/terrain";
import { getTravelNetwork, travelSignature } from "../src/game/travelNetwork";

function canonical(state: GameState) {
  const {appearanceEra, ...simulation} = state;
  const copy=JSON.parse(JSON.stringify(simulation)) as GameState;
  // A loaded terrain gets a fresh process-local cache number. The route,
  // geometry, stops, train positions, passengers and fares stay in the comparison.
  for (const line of copy.mobility?.lines ?? []) delete (line as {version?:number}).version;
  return copy;
}

test("Rome tours have separate save slots, stage bookmarks and working transport and water", () => {
  const keys = new Set<string>();
  for (const [i,world] of ROME_WORLDS.entries()) {
    assert.ok(EXAMPLE_WORLDS.includes(world));
    assert.deepEqual(readExampleRoute("#world="+world.id+"&view=0"), {id:world.id,mode:"god",viewIndex:0});
    const state = createExampleWorld(world.id);
    keys.add(islandSaveKey(state));
    assert.equal(state.currentStage, [1,8,20][i]);
    if (!i) continue;
    const waterworks = state.elements.find(e=>e.defId==="water_treatment_plant")!;
    assert.ok(readWaterService(state, waterworks).potable>0);
    assert.ok([...hydraulics(state).runs.values()].some(run=>run.target===waterworks.id && run.flow>0));
    const span = state.infrastructure!.spans["8,0"];
    assert.equal(span.mode,"road");
    assert.equal(span.shape,"arch");
    const line = state.mobility!.lines[0];
    assert.equal(line.mode,"rail");
    assert.ok(line.stops.length>=2);
    const delivered = line.delivered;
    for(let seconds=0;seconds<55;seconds++) stepSimulation(state,1,true);
    assert.ok(line.delivered>delivered);
  }
  assert.equal(keys.size,3);
});

test("both Rome directions replay identically to Original through a save round trip, transport, water and economy", t => {
  const initial = createExampleWorld("rome-district","real");
  const initialPorts = initial.elements.filter(e=>e.defId==="train_depots" || e.defId==="train_stops")
    .map(e=>getTravelNetwork(initial).connectors(e,"rail"));
  let now=0, seed=1;
  t.mock.method(Date,"now",()=>now);
  t.mock.method(Math,"random",()=>{ seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; });
  function replay(era: string) {
    now=1700000000000;seed=0x524f4d45;
    const state:GameState=JSON.parse(JSON.stringify(initial));
    const sig=travelSignature(state);
    state.appearanceEra=era;
    assert.equal(travelSignature(state),sig);
    assert.deepEqual(state.elements.filter(e=>e.defId==="train_depots" || e.defId==="train_stops")
      .map(e=>getTravelNetwork(state).connectors(e,"rail")), initialPorts);
    const cash=state.money, deliveries=state.mobility!.lines[0].delivered;
    recomputeConnectivityAndMetrics(state);
    for(let tick=0;tick<80;tick++){ now+=1000;stepSimulation(state,1,true); }
    assert.notEqual(state.money,cash);
    assert.ok(state.mobility!.lines[0].delivered>deliveries);
    state.appearanceEra="original";
    return canonical(state);
  }
  const expected=replay("original");
  for(const era of ["rome-forum","rome-aqueduct"]) assert.deepEqual(replay(era),expected);
  assert.equal(normalizeEra(undefined),"original");
  assert.equal(normalizeEra("future-removed-pack"),"original");
});
