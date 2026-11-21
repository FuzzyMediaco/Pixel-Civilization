import { ELEMENT_BY_ID } from "./catalog";
import { transfer, siteOf } from "./cityEconomy";
import type { Run } from "./mobility";
import type { GameState, PlacedElement } from "./simulation";
import {
  getTravelNetwork,
  type Point,
  type TravelNetwork,
} from "./travelNetwork";
import { levelMultiplier } from "./levelScaling";

export type RailService = "passenger" | "freight";
export const LOCOMOTIVES = {
  steam: {
    name: "Prairie steam",
    level: 1,
    speed: 1.3,
    price: 240,
    freight: true,
  },
  diesel: {
    name: "Road diesel",
    level: 2,
    speed: 1.72,
    price: 440,
    freight: true,
  },
  commuter: {
    name: "Double-deck commuter",
    level: 3,
    speed: 1.96,
    price: 670,
    freight: false,
  },
  electric: {
    name: "Electric locomotive",
    level: 4,
    speed: 2.26,
    price: 900,
    freight: true,
  },
  express: {
    name: "High-speed express",
    level: 5,
    speed: 2.88,
    price: 1420,
    freight: false,
  },
} as const;
export type Engine = keyof typeof LOCOMOTIVES;
export const CARS = {
  coach: {
    name: "Passenger coach",
    service: "passenger",
    capacity: 24,
    cost: 65,
  },
  observation: {
    name: "Observation car",
    service: "passenger",
    capacity: 18,
    cost: 78,
  },
  sleeper: { name: "Sleeper", service: "passenger", capacity: 16, cost: 84 },
  hopper: { name: "Grain hopper", service: "freight", capacity: 22, cost: 80 },
  gondola: { name: "Coal gondola", service: "freight", capacity: 26, cost: 88 },
  reefer: {
    name: "Refrigerated car",
    service: "freight",
    capacity: 18,
    cost: 100,
  },
  livestock: {
    name: "Livestock wagon",
    service: "freight",
    capacity: 16,
    cost: 82,
  },
  waste: {
    name: "Waste container",
    service: "freight",
    capacity: 24,
    cost: 84,
  },
  flat: { name: "Timber flat", service: "freight", capacity: 24, cost: 74 },
  tanker: { name: "Fuel tanker", service: "freight", capacity: 23, cost: 98 },
  container: {
    name: "Intermodal well car",
    service: "freight",
    capacity: 30,
    cost: 108,
  },
  box: { name: "Boxcar", service: "freight", capacity: 20, cost: 70 },
} as const;
export type RailCar = keyof typeof CARS;
const foodMarkets =
  "grocery_store growers_exchange bakery_coop shops restaurants malls cheesesteak_restaurants";
export const CARGO = {
  grain: {
    name: "Grain & produce",
    cars: ["hopper", "box"],
    from: "farms farm_houses fields grain_farm grain_fields vegetable_farm vegetable_fields rice_farm orchards orchard_block orchard_farm vineyard vertical_farm greenhouse_farm greenhouse_bay terraced_glasshouses apiary",
    to: foodMarkets,
  },
  dairy: {
    name: "Cold-chain food",
    cars: ["reefer"],
    from: "dairy_farm poultry_farm chicken_coop cattle_ranch livestock_pen orchards",
    to: foodMarkets,
  },
  livestock: {
    name: "Livestock",
    cars: ["livestock"],
    from: "cattle_ranch horse_ranch grazing_pasture poultry_farm livestock_pen",
    to: "growers_exchange factories grocery_store",
  },
  coal: {
    name: "Coal",
    cars: ["gondola"],
    from: "open_pit_mine",
    to: "coal_powerplants",
  },
  waste: {
    name: "Waste & recycling",
    cars: ["waste"],
    from: "trash_compacting_plants factories malls businesses",
    to: "landfill trash_burning_plants",
  },
  timber: {
    name: "Timber",
    cars: ["flat"],
    from: "pine_trees redwood_trees trees",
    to: "factories blacksmiths ship_building_areas",
  },
  fuel: {
    name: "Fuel",
    cars: ["tanker"],
    from: "gas_stations docks shipyards",
    to: "gas_stations natural_gas_power_plants regional_airport",
  },
  goods: {
    name: "Manufactured goods",
    cars: ["box", "container"],
    from: "factories blacksmiths shipyards",
    to: "malls shops grocery_store businesses",
  },
} satisfies Record<
  string,
  { name: string; cars: RailCar[]; from: string; to: string }
>;
export type Cargo = keyof typeof CARGO;
export type SwitchSetting = "auto" | "east-west" | "north-south" | "closed";
export interface FreightContract {
  type: Cargo;
  source: string;
  sink: string;
  pickup: string;
  drop: string;
  loaded: number;
  delivered: number;
}
export interface RailFormation {
  name: string;
  service: RailService;
  engine: Engine;
  cars: RailCar[];
  frequency: number;
  schedule: "all" | "day" | "night";
  pattern: "circuit" | "shuttle";
  priority: "normal" | "express";
}
export interface RailRun extends RailFormation {
  trainId: string;
  trail: Point[];
  rearCab?: boolean;
  blockPlan?: string[];
  reservation?: string[];
  waitingSince?: number;
  contract?: FreightContract;
}
export const YARD_WORKS = {
  platform: {
    name: "Platform extension",
    cost: 180,
    level: 1,
    detail: "One extra car at this platform, up to eight.",
  },
  siding: {
    name: "Yard siding",
    cost: 220,
    level: 1,
    detail: "Two additional trains can be based here.",
  },
  signal: {
    name: "Block signals",
    cost: 240,
    level: 2,
    detail: "Depot dispatch layovers are 20% shorter.",
  },
  wire: {
    name: "Overhead catenary",
    cost: 450,
    level: 2,
    detail: "Electric locomotives can be based at this depot.",
  },
  crane: {
    name: "Loading crane",
    cost: 310,
    level: 2,
    detail: "Freight platform dwell is 30% shorter.",
  },
  sorting: {
    name: "Sorting shed",
    cost: 380,
    level: 3,
    detail: "Delivered freight benefits last 75 seconds.",
  },
} as const;
export type YardWork = keyof typeof YARD_WORKS;
export interface RailState {
  stock?: Record<string, Partial<Record<Cargo, number>>>;
  received?: Record<string, Partial<Record<Cargo, number>>>;
  practice?: { depot: string; gx: number; gz: number };
  works?: Record<string, Partial<Record<YardWork, true>>>;
  turnouts: Record<string, SwitchSetting>;
  revision: number;
  benefits: Record<string, { line: string; until: number; type: Cargo }[]>;
}
export function railYard(s: GameState): RailState {
  return (s.railYard ??= { turnouts: {}, revision: 0, benefits: {} });
}
export const isRailStation = (id: string) =>
  ["train_depots", "train_stops", "freight_rail_terminal"].includes(id);
export const carLimit = (level: number) =>
  [3, 4, 5, 6, 8][Math.max(0, Math.min(4, level - 1))];
export function platformLimit(s: GameState, e: PlacedElement) {
  return Math.min(
    8,
    carLimit(e.level) + Number(!!s.railYard?.works?.[e.id]?.platform),
  );
}
export function yardCapacity(s: GameState, depot: PlacedElement) {
  return depot.level + (s.railYard?.works?.[depot.id]?.siding ? 2 : 0);
}
export function installYardWork(
  s: GameState,
  e: PlacedElement,
  kind: YardWork,
) {
  const w = YARD_WORKS[kind];
  if (!isRailStation(e.defId) || e.level < w.level)
    throw Error("Upgrade the site to level " + w.level + " first.");
  if (["wire", "siding", "signal"].includes(kind) && e.defId !== "train_depots")
    throw Error("Fit this improvement at a train depot.");
  if (
    ["crane", "sorting"].includes(kind) &&
    e.defId !== "freight_rail_terminal"
  )
    throw Error("Fit this improvement at a freight terminal.");
  const yard = railYard(s);
  const improvements = ((yard.works ??= {})[e.id] ??= {});
  if (improvements[kind]) throw Error("Already installed.");
  railPurchase(s, w.cost, w.name);
  improvements[kind] = true;
}
export function defaultFormation(
  service: RailService = "passenger",
): RailFormation {
  return {
    name: service === "passenger" ? "Local passenger" : "Local freight",
    service,
    engine: "steam",
    cars: service === "passenger" ? ["coach", "coach"] : ["box"],
    frequency: 8,
    schedule: "all",
    priority: "normal",
    pattern: "circuit",
  };
}
export function trainFor(line: Run): RailRun {
  return (line.rail ??= {
    ...defaultFormation(),
    frequency: line.interval,
    schedule: line.schedule,
    trainId: "T-" + line.id,
    trail: [],
  });
}
export function formationPrice(f: RailFormation) {
  return (
    LOCOMOTIVES[f.engine].price + f.cars.reduce((n, c) => n + CARS[c].cost, 0)
  );
}
export function formationChangePrice(old: RailFormation, f: RailFormation) {
  const remaining = [...old.cars];
  let purchase = old.engine === f.engine ? 0 : LOCOMOTIVES[f.engine].price;
  for (const c of f.cars) {
    const i = remaining.indexOf(c);
    if (i >= 0) remaining.splice(i, 1);
    else purchase += CARS[c].cost;
  }
  return purchase;
}
export function railCapacity(f: RailFormation) {
  return f.cars.reduce((n, c) => n + CARS[c].capacity, 0);
}
export function stationLabel(e: PlacedElement) {
  return ELEMENT_BY_ID[e.defId].name + " (" + e.gx + ", " + e.gz + ")";
}
export function stationWorks(e: PlacedElement) {
  return !e.onFire && !e.disrepair;
}
export function validateFormation(
  s: GameState,
  depot: PlacedElement,
  stops: PlacedElement[],
  f: RailFormation,
) {
  if (!f.name.trim()) throw Error("Give the line a name.");
  if (
    !LOCOMOTIVES[f.engine] ||
    f.cars.some((c) => !CARS[c] || CARS[c].service !== f.service)
  )
    throw Error("Choose cars matching the service.");
  if (f.service === "freight" && !LOCOMOTIVES[f.engine].freight)
    throw Error("Choose a freight-capable locomotive.");
  if (
    depot.level < LOCOMOTIVES[f.engine].level &&
    !(f.engine === "electric" && s.railYard?.works?.[depot.id]?.wire)
  )
    throw Error(
      "This locomotive needs a level " +
        LOCOMOTIVES[f.engine].level +
        " depot.",
    );
  if (
    f.cars.length < 1 ||
    f.cars.length >
      Math.min(...[depot, ...stops].map((e) => platformLimit(s, e)))
  )
    throw Error(
      "The shortest platform limits this formation to " +
        Math.min(...[depot, ...stops].map((e) => platformLimit(s, e))) +
        " cars.",
    );
  if (!Number.isFinite(f.frequency) || f.frequency < 2 || f.frequency > 90)
    throw Error("Choose a dispatch interval from 2 to 90 seconds.");
  for (const site of [depot, ...stops])
    if (!stationWorks(site))
      throw Error("Repair " + stationLabel(site) + " before dispatch.");
}
export function railPurchase(s: GameState, price: number, label: string) {
  if (s.mode === "god" || price <= 0) return;
  if (s.money < price)
    throw Error("Treasury needs $" + price + " for " + label + ".");
  transfer(s, "treasury", "outside", price, label);
}
export function changeFormation(s: GameState, id: string, f: RailFormation) {
  const l = s.mobility?.lines.find((l) => l.id === id && l.mode === "rail");
  if (!l) throw Error("Select an existing train.");
  const depot = s.elements.find((e) => e.id === l.depot),
    stops = l.stops.map((id) => s.elements.find((e) => e.id === id));
  if (!depot || stops.some((e) => !e))
    throw Error("Restore the line's missing facilities first.");
  validateFormation(s, depot, stops as PlacedElement[], f);
  const old = trainFor(l);
  if (old.service !== f.service)
    throw Error("Create a line of the matching service.");
  if (
    (old.contract?.loaded &&
      (old.engine !== f.engine || old.cars.join(",") !== f.cars.join(","))) ||
    l.riders.reduce((n, r) => n + r.count, 0) > railCapacity(f)
  )
    throw Error("Unload the train before changing this formation.");
  if (
    old.contract &&
    !f.cars.some((c) =>
      (CARGO[old.contract!.type].cars as RailCar[]).includes(c),
    )
  )
    throw Error("The contract still needs a matching freight car.");
  const purchase = formationChangePrice(old, f);
  railPurchase(s, purchase, "Rail equipment");
  // A form can stay open across arrivals and deliveries. Never copy its runtime snapshot back into the train.
  Object.assign(old, {
    name: f.name.trim(),
    engine: f.engine,
    cars: [...f.cars],
    frequency: f.frequency,
    schedule: f.schedule,
    pattern: f.pattern,
    priority: f.priority,
  });
  l.interval = f.frequency;
  l.schedule = f.schedule;
}
export function exchangeEngines(s: GameState, a: Run, b: Run) {
  if (a === b || a.depot !== b.depot || a.mode !== "rail" || b.mode !== "rail")
    throw Error("Choose two trains based in the same depot.");
  if (a.at !== a.depot || b.at !== b.depot)
    throw Error("Both trains must be at their depot to exchange assignments.");
  const x = trainFor(a),
    y = trainFor(b);
  if (
    x.service !== y.service ||
    x.contract?.loaded ||
    y.contract?.loaded ||
    a.riders.length ||
    b.riders.length
  )
    throw Error("Exchange empty trains of the same service.");
  for (const [l, r] of [
    [a, y],
    [b, x],
  ] as const) {
    const net = getTravelNetwork(s);
    validateFormation(
      s,
      net.byId.get(l.depot)!,
      l.stops.map((id) => net.byId.get(id)!),
      r,
    );
  }
  if (
    (x.contract &&
      !y.cars.some((c) =>
        (CARGO[x.contract!.type].cars as RailCar[]).includes(c),
      )) ||
    (y.contract &&
      !x.cars.some((c) =>
        (CARGO[y.contract!.type].cars as RailCar[]).includes(c),
      ))
  )
    throw Error("The replacement consist needs the contracted car type.");
  const saved = { trainId: x.trainId, engine: x.engine, cars: x.cars };
  Object.assign(x, { trainId: y.trainId, engine: y.engine, cars: y.cars });
  Object.assign(y, saved);
}
export function switchAllows(
  s: GameState,
  x: number,
  z: number,
  dx: number,
  dz: number,
) {
  const v = s.railYard?.turnouts[x + "," + z];
  return (
    !v ||
    v === "auto" ||
    (v === "east-west" && dx !== 0) ||
    (v === "north-south" && dz !== 0)
  );
}
export function setTurnout(
  s: GameState,
  x: number,
  z: number,
  v: SwitchSetting,
) {
  const e = getTravelNetwork(s).occupancy.get(x + "," + z);
  if (!e || !ELEMENT_BY_ID[e.defId].isRailNetwork)
    throw Error("Select a laid railway tile.");
  const yard = railYard(s),
    key = x + "," + z;
  if ((yard.turnouts[key] ?? "auto") === v) return;
  if (s.mobility?.lines.some((l) => l.rail?.reservation?.includes(key)))
    throw Error("Wait for the train to clear this reserved block.");
  if (v === "auto") delete yard.turnouts[key];
  else yard.turnouts[key] = v;
  yard.revision++;
}
function adjacent(a: PlacedElement, b: PlacedElement) {
  const dx = Math.max(0, a.gx - b.gx - b.spanX, b.gx - a.gx - a.spanX),
    dz = Math.max(0, a.gz - b.gz - b.spanZ, b.gz - a.gz - a.spanZ);
  return (
    dx === 0 &&
    dz === 0 &&
    ((a.gx < b.gx + b.spanX && b.gx < a.gx + a.spanX) ||
      (a.gz < b.gz + b.spanZ && b.gz < a.gz + a.spanZ))
  );
}
export function freightSites(
  net: TravelNetwork,
  terminal: PlacedElement,
  type: Cargo,
  loading: boolean,
) {
  const ids = (loading ? CARGO[type].from : CARGO[type].to).split(" ");
  return [...net.byId.values()].filter(
    (e) =>
      ids.includes(e.defId) &&
      stationWorks(e) &&
      (e.connected || ELEMENT_BY_ID[e.defId].passiveNature) &&
      (adjacent(terminal, e) || net.catchment(terminal).has(e.id)),
  );
}
export function assignContract(
  s: GameState,
  l: Run,
  proposal: Omit<FreightContract, "loaded" | "delivered">,
) {
  if (l.mode !== "rail" || trainFor(l).service !== "freight")
    throw Error("Assign a freight railway first.");
  const r = trainFor(l),
    net = getTravelNetwork(s),
    a = net.byId.get(proposal.pickup),
    b = net.byId.get(proposal.drop);
  if (
    !a ||
    !b ||
    a === b ||
    a.defId !== "freight_rail_terminal" ||
    b.defId !== "freight_rail_terminal" ||
    !l.stops.includes(a.id) ||
    !l.stops.includes(b.id)
  )
    throw Error("Choose two different freight platforms served by this train.");
  if (!r.cars.some((c) => (CARGO[proposal.type].cars as RailCar[]).includes(c)))
    throw Error(
      "Attach a compatible " + CARS[CARGO[proposal.type].cars[0]].name + ".",
    );
  if (
    !freightSites(net, a, proposal.type, true).some(
      (e) => e.id === proposal.source,
    ) ||
    !freightSites(net, b, proposal.type, false).some(
      (e) => e.id === proposal.sink,
    ) ||
    proposal.source === proposal.sink
  )
    throw Error(
      "Each platform needs a different eligible industry beside it or within its street catchment.",
    );
  if (!net.path(net.connectors(a, "rail"), net.connectors(b, "rail"), "rail"))
    throw Error(
      "Reconnect the freight terminals before assigning this contract.",
    );
  if (r.contract?.loaded)
    throw Error("Unload the current shipment before reassigning.");
  r.contract = { ...proposal, loaded: 0, delivered: 0 };
}
const foodCargo = (cargo: Cargo) =>
  cargo === "grain" || cargo === "dairy" || cargo === "livestock";
export function freightAvailable(s: GameState, id: string, type: Cargo) {
  return Math.floor(
    Math.max(
      0,
      foodCargo(type)
        ? (s.economy?.sites[id]?.food ?? 0)
        : (s.railYard?.stock?.[id]?.[type] ?? 0),
    ),
  );
}
/** Non-food consignments accrue once per working source and commodity, irrespective of the number of trains. */
export function advanceRailFreightStock(
  s: GameState,
  net: TravelNetwork,
  dt: number,
) {
  if (!s.railYard || dt <= 0) return;
  const seen = new Set<string>();
  for (const line of s.mobility?.lines ?? []) {
    const c = line.rail?.contract;
    if (!line.enabled || !c || foodCargo(c.type)) continue;
    const key = c.source + "|" + c.type;
    if (seen.has(key)) continue;
    seen.add(key);
    const source = net.byId.get(c.source);
    if (!source || !stationWorks(source)) continue;
    const def = ELEMENT_BY_ID[source.defId];
    if (!source.connected && !def.passiveNature) continue;
    const site = s.economy?.sites[source.id];
    const staffed = def.jobs
      ? Math.min(
          1,
          (site?.workers ?? 0) / Math.max(1, (site?.jobs ?? 0) * 0.65),
        )
      : 1;
    if (!staffed) continue;
    const available = ((s.railYard.stock ??= {})[source.id] ??= {});
    available[c.type] = Math.min(
      48 * levelMultiplier("storage", source.level),
      (available[c.type] ?? 0) +
        dt * levelMultiplier("storage", source.level) * staffed * (def.passiveNature ? 0.22 : 0.65),
    );
  }
}
export function cargoByCar(train: RailRun) {
  const contract = train.contract;
  let remaining = contract?.loaded ?? 0;
  return train.cars.map((car) => {
    if (
      !contract ||
      remaining <= 0 ||
      !(CARGO[contract.type].cars as RailCar[]).includes(car)
    )
      return 0;
    const quantity = Math.min(remaining, CARS[car].capacity);
    remaining -= quantity;
    return quantity / CARS[car].capacity;
  });
}
export function freightCall(
  s: GameState,
  l: Run,
  stop: PlacedElement,
  net: TravelNetwork,
) {
  const r = trainFor(l),
    c = r.contract;
  if (!c) return;
  const a = net.byId.get(c.pickup),
    b = net.byId.get(c.drop);
  if (!a || !b) return;
  if (stop.id === a.id && !c.loaded) {
    const source = freightSites(net, a, c.type, true).find(
      (e) => e.id === c.source,
    );
    if (
      !source ||
      !freightSites(net, b, c.type, false).some((e) => e.id === c.sink)
    )
      return;
    if (
      foodCargo(c.type) &&
      !(
        s.economy?.sites[source.id]?.yieldRate &&
        s.economy.sites[source.id].yieldRate > 0
      )
    )
      return;
    const capacity = r.cars.reduce(
      (n, car) =>
        n +
        ((CARGO[c.type].cars as RailCar[]).includes(car)
          ? CARS[car].capacity
          : 0),
      0,
    );
    c.loaded = Math.min(capacity, freightAvailable(s, c.source, c.type));
    if (!c.loaded) return;
    if (foodCargo(c.type)) siteOf(s, source).food -= c.loaded;
    else s.railYard!.stock![source.id][c.type]! -= c.loaded;
    return;
  }
  if (stop.id !== b.id || !c.loaded) return;
  const sink = freightSites(net, b, c.type, false).find((e) => e.id === c.sink);
  if (!sink) return;
  const quantity = c.loaded;
  const yard = railYard(s),
    receipts = ((yard.received ??= {})[sink.id] ??= {});
  receipts[c.type] = (receipts[c.type] ?? 0) + quantity;
  if (foodCargo(c.type)) siteOf(s, sink).food += quantity;
  c.loaded = 0;
  c.delivered += quantity;
  l.delivered += quantity;
  s.mobility!.deliveries.push({
    time: s.activePlaySec,
    count: quantity,
    stop: stop.id,
    wait: 0,
    freight: true,
  });
  transfer(
    s,
    "outside",
    "businesses",
    quantity * 0.09,
    "Rail freight delivery",
  );
  for (const id of [c.source, c.sink]) {
    const benefits = (yard.benefits[id] ??= []).filter(
      (x) =>
        x.until > s.activePlaySec && !(x.line === l.id && x.type === c.type),
    );
    yard.benefits[id] = [
      ...benefits,
      {
        type: c.type,
        line: l.id,
        until: s.activePlaySec + (s.railYard?.works?.[b.id]?.sorting ? 75 : 60),
      },
    ];
  }
}
const contractRoutes = new WeakMap<TravelNetwork, Map<string, boolean>>();
function readyContract(s: GameState, l: Run) {
  const c = l.rail?.contract;
  if (!c) return false;
  const net = getTravelNetwork(s),
    cache = contractRoutes.get(net) ?? new Map<string, boolean>();
  contractRoutes.set(net, cache);
  const key = [
    l.depot,
    ...l.stops,
    c.type,
    c.source,
    c.sink,
    c.pickup,
    c.drop,
  ].join("|");
  const saved = cache.get(key);
  if (saved !== undefined) return saved;
  const cycle = [l.depot, ...l.stops, l.depot],
    sites = cycle.map((id) => net.byId.get(id));
  const ready =
    sites.every((site) => site && stationWorks(site)) &&
    sites
      .slice(1)
      .every(
        (to, i) =>
          !!net.path(
            net.connectors(sites[i]!, "rail"),
            net.connectors(to!, "rail"),
            "rail",
          ),
      ) &&
    !!net.byId.get(c.pickup) &&
    !!net.byId.get(c.drop) &&
    freightSites(net, net.byId.get(c.pickup)!, c.type, true).some(
      (e) => e.id === c.source,
    ) &&
    freightSites(net, net.byId.get(c.drop)!, c.type, false).some(
      (e) => e.id === c.sink,
    );
  cache.set(key, !!ready);
  return !!ready;
}
export function railFreightBonus(s: GameState, site: string, type: Cargo) {
  const list = s.railYard?.benefits[site];
  if (!list) return 1;
  return list.some(
    (b) =>
      b.type === type &&
      b.until > s.activePlaySec &&
      s.mobility?.lines.some(
        (l) =>
          l.id === b.line &&
          l.enabled &&
          !l.blocked &&
          l.rail?.contract?.type === type &&
          readyContract(s, l),
      ),
  )
    ? 1.08
    : 1;
}
