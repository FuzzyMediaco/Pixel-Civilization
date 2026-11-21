import { ELEMENT_BY_ID, getStandardFootprintForLevel } from "./catalog";
import { addLine } from "./mobility";
import {
  createInitialGameState,
  makeElementId,
  planConstruction,
  recomputeConnectivityAndMetrics,
  stepSimulation,
  type PlacedElement,
} from "./simulation";
import {
  applyInfrastructureStroke,
  applyLandformPlacement,
  getTerrainCell,
  type InfrastructureTool,
} from "./terrain";

/** A playable, editable sandbox built with the same placement and engineering rules as the player. */
export function createCanalDistrict() {
  const s = createInitialGameState("god");
  const works = (tool: InfrastructureTool, points: [number, number][]) => {
    const result = applyInfrastructureStroke(
      s,
      tool,
      points.map(([gx, gz]) => ({ gx, gz })),
    );
    if (!result.valid) throw new Error("Canal district: " + result.reason);
  };
  function place(id: string, x: number, z: number, level = 1, rotation = 0, variant = 0) {
    const p = planConstruction(s, ELEMENT_BY_ID[id], x, z, level, rotation);
    if (!p.valid) throw new Error(ELEMENT_BY_ID[id].name + " at " + x + ", " + z + ": " + p.reason);
    const e: PlacedElement = {
      id: makeElementId(),
      defId: p.def.id,
      gx: x,
      gz: z,
      level: p.level,
      variant,
      rotation: p.rotation,
      spanX: p.spanX,
      spanZ: p.spanZ,
      hasPoliceCover: false,
      hasFireCover: false,
      nuisancePenalty: 0,
      connected: true,
      maintTimerSec: 0,
      disrepair: false,
      onFire: false,
      animProgress: 0,
      animKind: "place",
      overWater: p.overWater,
    };
    if (p.replaceId) {
      e.waterUnderlay = s.elements.find((b) => b.id === p.replaceId);
      s.elements = s.elements.filter((b) => b.id !== p.replaceId);
    }
    s.elements.push(e);
    applyLandformPlacement(s, e);
    return e;
  }
  works({ kind: "canal", radius: 1, depth: 2 }, [
    [-8, 0],
    [30, 0],
  ]);
  works({ kind: "river", radius: 1, depth: 2 }, [
    [-6, 0],
    [-6, 8],
    [1, 8],
  ]);
  works({ kind: "bridge", shape: "lift", mode: "road", height: 1.4, lift: "auto" }, [
    [0, -2],
    [0, 2],
  ]);
  works({ kind: "mountain", radius: 2, height: 4 }, [[8, -8]]);
  works({ kind: "spring", flow: 24, height: 1 }, [[8, -7]]);
  works({ kind: "aqueduct", height: 3, style: 1 }, [
    [8, -6],
    [8, -3],
    [6, -3],
    [6, 3],
  ]);
  const west = place("ferry_landings", -4, -1),
    east = place("ferry_landings", 5, 1);
  for (let x = -5; x <= 5; x++)
    if (x !== 0) {
      place("pretty_roads", x, -2);
      place("walking_paths", x, 2);
    }
  place("grocery_store", 3, 3);
  place("businesses", 5, 3);
  place("gardens", 2, 3);
  for (const x of [-5, -4, -3]) place("townhomes", x, -3, 1, 0, 1);
  place("restaurants", 2, -3);
  place("solar_panels", 3, -3);
  place("water_treatment_plant", 4, -3);
  place("municipal_reservoir", 6, 4);
  place("farm_houses", 8, 5);
  place("fields", 9, 5);
  place("farms", 8, 6);
  // The long quays carry workers to the harbor. Back streets feed the market and the station.
  for (let x = -10; x <= 13; x++) {
    if (x < -5 || x > 5) {
      if (x !== 6 && x !== 8) place("pretty_roads", x, -2);
      if (x > 7 || x < -7) place("boardwalks", x, 2);
    }
    place("roads", x, -5);
  }
  const frontage: [string, number, number, number, number][] = [
    ["churches", -8, -5, 3, 2],
    ["graveyards", -10, -6, 2, 1],
    ["townhomes", -10, -3, 2, 3],
    ["townhomes", -8, -3, 2, 1],
    ["townhomes", -2, -3, 1, 3],
    ["townhomes", -1, -3, 1, 1],
    ["banks", 0, -4, 2, 1],
    ["thrift_stores", 5, -4, 2, 2],
    ["restaurants", 9, -4, 2, 0],
    ["medium_sized_homes", 11, -4, 2, 0],
    ["atms", 4, -4, 2, 1],
    ["cheesesteak_restaurants", -3, -8, 5, 0],
    ["churches", -8, -9, 3, 0],
    ["graveyards", -10, -9, 2, 0],
    ["shops", 0, -8, 3, 1],
    ["school", 3, -8, 2, 1],
    ["bus_depots", -11, -5, 1, 1],
    ["bus_stops", -4, -6, 1, 1],
    ["bus_stops", 2, -6, 2, 0],
    ["villas", -4, 3, 2, 1],
    ["grocery_store", -2, 3, 2, 0],
    ["beach_houses", -1, 4, 2, 2],
    ["townhomes", 4, 3, 1, 3],
    ["townhomes", 1, 3, 1, 0],
    ["restaurants", 9, 3, 2, 1],
    ["orchards", 11, 4, 2, 1],
    ["windmills", 10, 6, 2, 2],
    ["little_parks", 12, -6, 2, 3],
    ["city_offices", -1, -10, 2, 2],
    ["fire_department", 0, -11, 2, 1],
    ["water_towers", 5, -10, 3, 0],
    ["trees", -7, -4, 2, 0],
    ["trees", 11, -7, 2, 1],
    ["trees", 3, -7, 2, 3],
    ["gardens", -3, -10, 2, 3],
    ["trees", 2, 6, 2, 0],
    ["groves_of_olives", 11, 7, 2, 0],
    ["sail_boats", 18, 0, 2, 1],
  ];
  for (const [id, x, z, level, variant] of frontage) {
    if (planConstruction(s, ELEMENT_BY_ID[id], x, z, level, 0).valid) place(id, x, z, level, 0, variant);
  }
  // North of the market, one service street supplies the schools, shops and harbor works.
  const lane = (x: number, z: number, id = "country_roads") => {
    const road = ELEMENT_BY_ID[id] ?? ELEMENT_BY_ID.roads;
    if (getTerrainCell(s, x, z).depth <= 0.1 && planConstruction(s, road, x, z, 1, 0).valid)
      place(road.id, x, z);
  };
  for (let x = -14; x <= 13; x++) lane(x, -13, "roads");
  for (let z = -13; z <= -2; z++) {
    lane(-6, z, "roads");
    lane(6, z, "roads");
  }
  for (let x = -11; x <= 5; x++) {
    lane(x, -7, "walking_paths");
    lane(x, -10, "walking_paths");
  }
  for (let z = -13; z <= -6; z++) {
    lane(-11, z, "walking_paths");
    lane(2, z, "walking_paths");
  }
  for (let z = -8; z <= -6; z++) lane(-1, z, "walking_paths");
  // South-bank paths continue to the farmhouse gates, reservoir, windmill and orchard.
  for (let x = 5; x <= 15; x++) {
    lane(x, 2, "boardwalks");
    lane(x, 3, "walking_paths");
    lane(x, 6, "walking_paths");
  }
  for (let z = 3; z <= 10; z++) lane(14, z, "country_roads");
  for (let z = 2; z <= 8; z++) {
    lane(10, z, "walking_paths");
    lane(12, z, "walking_paths");
  }
  for (let x = 7; x <= 14; x++) lane(x, 9, "country_roads");
  const onStreet = (id: string, x: number, roadZ: number, side: -1 | 1, level: number, style: number) => {
    const def = ELEMENT_BY_ID[id],
      size = getStandardFootprintForLevel(def, level),
      z = side < 0 ? roadZ - size[1] : roadZ + 1;
    if (planConstruction(s, def, x, z, level, side < 0 ? 0 : 2).valid)
      place(id, x, z, level, side < 0 ? 0 : 2, style);
  };
  onStreet("geothermal_power_plants", -13, -13, -1, 2, 2);
  onStreet("trash_burning_plants", -10, -13, -1, 3, 2);
  onStreet("maritime_college", -6, -13, -1, 4, 1);
  onStreet("businesses", -2, -13, -1, 5, 2);
  onStreet("banks", 1, -13, -1, 3, 0);
  onStreet("grocery_store", 4, -13, -1, 5, 1);
  onStreet("businesses", 8, -13, -1, 5, 3);
  onStreet("businesses", 11, -13, -1, 5, 1);
  onStreet("terraced_glasshouses", 8, -13, 1, 5, 0);
  onStreet("wells", -14, -13, 1, 4, 0);
  onStreet("businesses", -12, -13, 1, 4, 0);
  onStreet("floodplain_park", 8, 9, 1, 3, 1);
  onStreet("terraced_glasshouses", 12, 9, 1, 4, 1);
  onStreet("bakery_coop", 14, 3, 1, 3, 0);
  const facing: [string, number, number, number][] = [
    ["grocery_store", -2, 3, 2],
    ["businesses", 5, 3, 2],
    ["municipal_reservoir", 6, 4, 2],
    ["cheesesteak_restaurants", -3, -8, 1],
    ["shops", 0, -8, 1],
    ["restaurants", 9, 3, 2],
    ["orchards", 11, 4, 2],
    ["water_towers", 5, -10, 1],
    ["bakery_coop", 14, 4, 3],
  ];
  for (const [defId, x, z, rotation] of facing) {
    const e = s.elements.find((el) => el.defId === defId && el.gx === x && el.gz === z);
    if (e && (e.spanX === e.spanZ || e.rotation % 2 === rotation % 2)) e.rotation = rotation;
  }
  works({ kind: "aqueduct", height: 3, style: 1 }, [
    [8, -6],
    [8, -11],
    [9, -11],
  ]);
  works({ kind: "aqueduct", height: 3, style: 1 }, [
    [6, -3],
    [5, -3],
  ]);
  works({ kind: "aqueduct", height: 2, style: 1 }, [
    [6, 3],
    [7, 3],
    [7, 6],
    [9, 6],
  ]);
  // The west promenade has its own market and a kitchen garden behind the villas.
  place("gardens", -2, 4, 2, 1);
  place("sail_boats", 11, 0);
  place("boats", 15, 0);
  recomputeConnectivityAndMetrics(s);
  addLine(s, "gondola", west.id, [west.id, east.id]);
  addLine(s, "ferry", east.id, [east.id, west.id]);
  const depot = s.elements.find((e) => e.defId === "bus_depots"),
    stops = s.elements.filter((e) => e.defId === "bus_stops");
  if (depot && stops.length > 1)
    addLine(
      s,
      "bus",
      depot.id,
      stops.map((e) => e.id),
    );
  // Open on a working morning. Shops have bought stock and residents have taken real trips.
  s.timeOfDay = 8.1;
  for (let sec = 0; sec < 12; sec++) stepSimulation(s, 1, true);
  s.infrastructure!.undo = [];
  return s;
}
