import { ELEMENT_BY_ID } from "./catalog";
import {
  planConstruction,
  recomputeConnectivityAndMetrics,
  type GameState,
  type PlacedElement,
} from "./simulation";
import { applyInfrastructureStroke } from "./terrain";
import { addLine } from "./mobility";
import {
  defaultFormation,
  assignContract,
  installYardWork,
  railYard,
} from "./railOperations";

function build(s: GameState, ox: number, oz: number) {
  let serial = 0;
  function put(
    id: string,
    x: number,
    z: number,
    level = 1,
    rotation = 0,
    variant = 0,
  ) {
    x += ox;
    z += oz;
    const p = planConstruction(
      s,
      ELEMENT_BY_ID[id],
      x,
      z,
      level,
      rotation,
      true,
    );
    if (!p.valid) throw Error(id + " " + x + "," + z + " " + p.reason);
    const e: PlacedElement = {
      id: "orchard-rail-" + ox + "-" + oz + "-" + ++serial,
      defId: p.def.id,
      gx: x,
      gz: z,
      spanX: p.spanX,
      spanZ: p.spanZ,
      level: p.level,
      rotation: p.rotation,
      variant,
      connected: false,
      onFire: false,
      disrepair: false,
      hasPoliceCover: false,
      hasFireCover: false,
      nuisancePenalty: 0,
      maintTimerSec: 0,
      animKind: "place",
      animProgress: 0,
      overWater: p.overWater,
    };
    s.elements.push(e);
    return e;
  }
  const water = applyInfrastructureStroke(s, { kind: "canal", depth: 1 }, [
    { gx: ox + 4, gz: oz - 4 },
    { gx: ox + 4, gz: oz },
  ]);
  if (!water.valid) throw Error(water.reason);
  const bridge = applyInfrastructureStroke(
    s,
    {
      kind: "bridge",
      mode: "rail",
      shape: "truss",
      railType: "steel",
      height: 2,
    },
    [
      { gx: ox + 3, gz: oz },
      { gx: ox + 5, gz: oz },
    ],
  );
  if (!bridge.valid) throw Error(bridge.reason);
  // A passing loop beside the main line (with its own bridge) lets freight and passenger trains pass.
  const loopBridge = applyInfrastructureStroke(
    s,
    { kind: "bridge", mode: "rail", shape: "truss", railType: "steel", height: 2 },
    [
      { gx: ox + 3, gz: oz - 2 },
      { gx: ox + 5, gz: oz - 2 },
    ],
  );
  if (!loopBridge.valid) throw Error(loopBridge.reason);
  const lay = (x: number, z: number, level = 1) => {
    const at = s.elements.find((e) => e.gx === ox + x && e.gz === oz + z);
    if (!at) put("train_tracks", x, z, level);
    else if (ELEMENT_BY_ID[at.defId]?.isRailNetwork) at.level = Math.max(at.level, level);
  };
  for (let x = -12; x <= 9; x++) lay(x, 0);
  for (let z = -1; z >= -6; z--) lay(9, z);
  for (let x = 8; x >= 4; x--) lay(x, -6);
  for (const x of [-5, 7]) lay(x, -1);
  for (let x = -5; x <= 7; x++) lay(x, -2);
  const depot = put("train_depots", -11, 1, 2, 0, 1),
    // The passenger platform faces the passing loop, so the main line stays free for freight.
    a = put("train_stops", -3, -3, 2, 2, 0),
    b = put("train_stops", 10, -4, 2, 1, 1);
  const from = put("freight_rail_terminal", -6, 1, 1, 0, 0),
    to = put("freight_rail_terminal", 1, 1, 1, 0, 2),
    farm = put("farms", -7, 1),
    shop = put("grocery_store", 3, 1);
  for (let x = -9; x <= 9; x++) put("roads", x, 2);
  for (let x = -9; x <= 2; x++) put("roads", x, -4);
  for (const [i, x] of [-9, -7, -5, -3, -1, 1].entries()) put(i % 3 === 1 ? "shops" : "house", x, -5, 1, 0, i % 4);
  for (let x = -12; x <= -9; x++) put("roads", x, 3);
  for (let z = 3; z >= -4; z--) if (z !== 2 && z !== 0) put("roads", 12, z);
  for (let x = 10; x <= 12; x++) put("roads", x, 2);
  for (const [i, x] of [-8, -6, -4, -2, 0, 2, 4, 6, 8].entries())
    put(i % 3 === 0 ? "shops" : "house", x, 3, 1, 2, i % 4);
  put("fields", -8, 1);
  put("gardens", -8, 4);
  put("wind_turbines", -10, 5, 2);
  put("water_towers", 0, 1, 1);
  put("little_parks", 8, 1);
  put("house", 11, -4, 1, 1);
  put("businesses", 11, -2, 1, 1);
  put("house", 11, 1, 1, 1);
  recomputeConnectivityAndMetrics(s);
  addLine(s, "rail", depot.id, [a.id, b.id], {
    ...defaultFormation(),
    name: "Orchard Valley Local",
    cars: ["coach", "observation", "sleeper"],
    frequency: 6,
    pattern: "shuttle",
  });
  const freight = addLine(s, "rail", depot.id, [from.id, to.id], {
    ...defaultFormation("freight"),
    name: "Harvest Freight",
    engine: "diesel",
    cars: ["hopper", "box", "hopper"],
    frequency: 9,
  });
  const l = s.mobility!.lines.find((l) => l.id === freight)!;
  installYardWork(s, depot, "siding");
  assignContract(s, l, {
    type: "grain",
    pickup: from.id,
    drop: to.id,
    source: farm.id,
    sink: shop.id,
  });

  railYard(s).practice = { depot: depot.id, gx: depot.gx, gz: depot.gz };
  return depot.id;
}

export function visitPracticeRailway(city: GameState): {
  state: GameState;
  depot: string;
} {
  if (city.exampleWorldId !== "switchyard-city")
    throw Error("Open the Switchyard City example first.");
  const previous = city.railYard?.practice;
  if (previous) {
    const depot =
      city.elements.find((e) => e.id === previous.depot) ||
      city.elements.find(
        (e) =>
          e.gx === previous.gx &&
          e.gz === previous.gz &&
          e.defId === "train_depots",
      );
    if (!depot)
      throw Error(
        "The practice depot was removed. Rebuild it on its original lot at " +
          previous.gx +
          ", " +
          previous.gz +
          " to reopen the yard.",
      );
    return { state: city, depot: depot.id };
  }
  for (const [ox, oz] of [
    [0, 0],
    [-56, -48],
    [56, -50],
    [-53, 50],
    [60, 40],
  ]) {
    const inDistrict = (x: number, z: number) =>
      x >= ox - 13 && x <= ox + 13 && z >= oz - 7 && z <= oz + 7;
    if (
      city.elements.some(
        (e) =>
          e.gx <= ox + 13 &&
          e.gx + e.spanX > ox - 13 &&
          e.gz <= oz + 7 &&
          e.gz + e.spanZ > oz - 7,
      )
    )
      continue;
    if (
      Object.keys(city.infrastructure?.cells ?? {}).some((k) => {
        const [x, z] = k.split(",").map(Number);
        return inDistrict(x, z);
      })
    )
      continue;
    const next = structuredClone(city);
    try {
      // Visiting reveals the authored example district, just like opening the island's original neighbourhood.
      // Its existing bridges and stock should neither require a player's unlocks nor charge their treasury.
      next.mode = "god";
      const depot = build(next, ox, oz);
      next.mode = city.mode;
      recomputeConnectivityAndMetrics(next);
      return { state: next, depot };
    } catch {
      continue;
    }
  }
  throw Error(
    "The practice yard needs an undeveloped district with dry approaches. Your existing buildings and public works are preserved.",
  );
}
