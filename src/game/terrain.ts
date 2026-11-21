import {corridorConflict,shoulderAt} from "./roadCorridors";
import {roadWidth,standardRoadLanes} from "./roadStandards";
import {FARM_ANCHOR_IDS,FARM_MODULE_IDS} from "./expansionCatalog";
import {railShape,railClearHeight, type RailBridgeKind} from "./bridgeWorks";
import { cellIndex, withinMap as inBounds } from "./mapBounds";
import { buildingCharges, effective, transfer } from "./cityEconomy";
import { ELEMENT_BY_ID,getMaxElementLevel } from "./catalog";
import type { GameState, PlacedElement } from "./simulation";
import { TILE_SIZE, VOXEL_SIZE } from "./voxelCore";
import { networkRoadProfile } from "./designs/networks";
import { buildOccupancyMap, getNetworkConnMask } from "./simulation";

export const SEA = -0.62;
export const DIRECTIONS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;
export const tileKey = (x: number, z: number) => x + "," + z;
const naturalTiles: TerrainCell[][] = [[], []];
const round = (n: number) => Math.round(n * 100) / 100;
export type Material = "grass" | "sand" | "rock" | "clay" | "wetland" | "snow";
export interface TerrainCell {
  elevation: number;
  material: Material;
  waterLevel: number;
  depth: number;
  kind: "land" | "coast" | "water";
  source: number;
  water: "dry" | "fresh" | "salt";
  gate?: "open" | "closed";
  gateKind?: "lock" | "dam";
  gateHead?: number;
  flowDir?: number;
  excavated?: boolean;
  freeLevel?: number;
  form?: "bay" | "canal" | "river" | "lake" | "spring" | "canyon" | "bank";
}
export interface GridPoint {
  gx: number;
  gz: number;
}
export type SpanMode = "foot" | "road" | "rail" | "highway" | "freeway";
export type SpanShape = "arch" | "truss" | "suspension" | "lift" | "beam";
export interface Crossing {
  tier?:number;
  corridorWidth?:number;
  railType?:RailBridgeKind;
  catalog?:boolean;
  run: string;
  axis: "x" | "z";
  shape: SpanShape;
  mode: SpanMode;
  deck: number;
  startHeight: number;
  endHeight: number;
  direction: number;
  end: boolean;
  ramp: boolean;
  lift: "auto" | "open" | "closed";
  requestedAt?: number;
  clearDelay?: number;
}
export interface Conduit {
  height: number;
  outlet: "auto" | "north" | "east" | "south" | "west" | "cap";
  style: number;
}
export interface StreetControl {
  lanes: number;
  signal: "yield" | "auto" | "north" | "east";
  period: number;
  demand?: { cycle: number; north: number; east: number; fraction: number };
  axis?: "x" | "z";
  ports?: number;
  layout?: "diamond" | "trumpet" | "directional";
}
export interface Infrastructure {
  revision: number;
  stamp?: string;
  cells: Record<string, TerrainCell>;
  spans: Record<string, Crossing>;
  conduits: Record<string, Conduit>;
  streets: Record<string, StreetControl>;
  storage: Record<string, number>;
  facilities?: Record<string, { pressure?: number; heldStorage?: number }>;
  undo: UndoStroke[];
}
export interface InfrastructureTool {
  kind:
    | "lock"
    | "dam"
    | "raise"
    | "lower"
    | "smooth"
    | "paint"
    | "pond"
    | "river"
    | "canal"
    | "bay"
    | "peninsula"
    | "spring"
    | "canyon"
    | "mountain"
    | "aqueduct"
    | "bridge"
    | "street"
    | "interchange"
    | "erase";
  radius?: number;
  depth?: number;
  height?: number;
  material?: Material;
  style?: number;
  outlet?: Conduit["outlet"];
  mode?: SpanMode;
  shape?: SpanShape;
  railType?: RailBridgeKind;
  lift?: Crossing["lift"];
  lanes?: number;
  signal?: StreetControl["signal"];
  period?: number;
  layout?: StreetControl["layout"];
  orientation?: number;
  flow?: number;
  waterLevel?: number;
  gate?: "open" | "closed";
  eraseLayer?: "terrain" | "deck" | "aqueduct" | "street";
}
interface Change {
  key: string;
  cell?: TerrainCell;
  span?: Crossing;
  conduit?: Conduit;
  street?: StreetControl;
}
interface UndoStroke {
  before: Change[];
  after: Change[];
  removed: PlacedElement[];
  added: string[];
  cost: number;
}
const newMap = (): Infrastructure => ({
  revision: 0,
  cells: {},
  spans: {},
  conduits: {},
  streets: {},
  storage: {},
  undo: [],
});
export const ensureInfrastructure = (state: GameState) => (state.infrastructure ??= newMap());
function changed(i: Infrastructure) {
  i.revision += 1;
  i.stamp = i.revision.toString(36) + "." + Math.random().toString(36).slice(2, 9);
}
export function setFacilityControl(
  state: GameState,
  id: string,
  key: "pressure" | "heldStorage" | "fill",
  value?: number,
) {
  if (state.mode !== "god") return;
  const el = state.elements.find((e) => e.id === id);
  if (!el) return;
  const i = ensureInfrastructure(state);
  i.facilities ??= {};
  const entry = (i.facilities[id] ??= {});
  if (key === "fill") {
    if (value !== undefined) i.storage[id] = Math.max(0, Math.min(100 * el.level, value));
  } else if (value === undefined) delete entry[key];
  else {
    entry[key] = Math.max(0, Math.min(key === "pressure" ? 40 : 100 * el.level, value));
    if (key === "heldStorage") i.storage[id] = entry[key]!;
  }
  i.facilities[id] = entry;
  changed(i);
}
// The original coast is retained for existing cities. New games add adjoining mainland
// headlands. Both editions can reach the outer islands and the open passage around them.
const outerIslands = [
  [-252, -72, 72, 97, 2.8, 0.68],
  [208, -216, 101, 74, 3.1, 1.4],
  [40, 248, 133, 62, 2.7, 0.8],
  [-244, -264, 57, 40, 2.3, 2.4],
  [280, 176, 43, 63, 2.2, 0.3],
] as const;
const mainHeadlands = [
  [-130, -28, 109, 101, 2.85, 1.7],
  [-18, -107, 102, 92, 2.65, 0.4],
] as const;
function landformMargin(
  x: number,
  z: number,
  cx: number,
  cz: number,
  rx: number,
  rz: number,
  power: number,
  phase: number,
) {
  const ax = (x - cx) / rx,
    az = (z - cz) / rz;
  const angle = Math.atan2(az, ax),
    r = (Math.abs(ax) ** power + Math.abs(az) ** power) ** (1 / power);
  return (1 + 0.052 * Math.sin(3 * angle + phase) + 0.033 * Math.cos(5 * angle - phase) - r) * Math.min(rx, rz);
}
export function islandMargin(x: number, z: number, terrainVersion = 1): number {
  const extent = 108,
    angle = Math.atan2(z, x);
  const r = (Math.abs(x / extent) ** 3.6 + Math.abs(z / extent) ** 3.6) ** (1 / 3.6);
  let margin =
    (1 + 0.045 * Math.sin(angle * 3 + 0.7) + 0.03 * Math.cos(angle * 5 - 1.1) + 0.02 * Math.sin(angle * 7 + 2.2) - r) *
    extent;
  if (terrainVersion < 2 && Math.max(Math.abs(x), Math.abs(z)) <= 128) return margin;
  const test = (shape: readonly [number, number, number, number, number, number]) => {
    const [cx, cz, rx, rz, p, phase] = shape;
    const coastExtent = 1.15 + 37 / Math.min(rx, rz);
    if (Math.abs(x - cx) > rx * coastExtent || Math.abs(z - cz) > rz * coastExtent) return;
    margin = Math.max(margin, landformMargin(x, z, cx, cz, rx, rz, p, phase));
  };
  if (terrainVersion >= 2) for (const shape of mainHeadlands) test(shape);
  for (const shape of outerIslands) test(shape);
  return margin;
}
export function elevationFromMargin(margin: number): number {
  return margin >= 2
    ? 0
    : margin >= -7
      ? Math.round(((-(2 - margin) / 9) * 1.45) / 0.25) * 0.25
      : -1.45 - Math.round(Math.min(1, (-7 - margin) / 26) * 12) * 0.45;
}
export function naturalElevation(x: number, z: number, terrainVersion = 1) {
  return elevationFromMargin(islandMargin(x, z, terrainVersion));
}
export function getTerrainCell(
  state: Pick<GameState, "infrastructure" | "terrainVersion"> | undefined,
  gx: number,
  gz: number,
): TerrainCell {
  const edit = state?.infrastructure?.cells[tileKey(gx, gz)];
  if (edit) return edit;
  const version = state?.terrainVersion ?? 1,
    cache = naturalTiles[version >= 2 ? 1 : 0],
    inside = inBounds(gx, gz),
    index = cellIndex(gx, gz);
  if (inside && cache[index]) return cache[index];
  const x = (gx + 0.5) * TILE_SIZE,
    z = (gz + 0.5) * TILE_SIZE;
  const margin = islandMargin(x, z, version),
    elevation = elevationFromMargin(margin);
  const depth = Math.max(0, SEA - elevation);
  const cell: TerrainCell = {
    elevation,
    material: margin >= 2.2 ? "grass" : "sand",
    waterLevel: SEA,
    depth,
    source: 0,
    kind: margin >= 2.2 ? "land" : margin >= -6.5 ? "coast" : "water",
    water: depth ? "salt" : "dry",
  };
  if (inside) cache[index] = cell;
  return cell;
}
export const TOOL_STAGES: Record<InfrastructureTool["kind"], number> = {
  lock: 9,
  dam: 12,
  raise: 4,
  lower: 4,
  smooth: 4,
  paint: 1,
  pond: 2,
  river: 2,
  canal: 6,
  bay: 9,
  peninsula: 9,
  spring: 12,
  canyon: 12,
  mountain: 12,
  aqueduct: 6,
  bridge: 6,
  street: 2,
  interchange: 12,
  erase: 1,
};
export function requiredToolStage(tool: InfrastructureTool): number {
  return Math.max(
    TOOL_STAGES[tool.kind],
    tool.shape === "suspension" && tool.kind === "bridge"
      ? 16
      : tool.shape === "lift" && tool.kind === "bridge"
        ? 9
        : 0,
    (isTerrain(tool) && (tool.radius ?? 0) > 1) ||
      (["pond", "river", "canal", "bay"].includes(tool.kind) && (tool.depth ?? 0) > 2)
      ? 9
      : 0,
  );
}
function interpolate(points: GridPoint[], line: boolean): GridPoint[] {
  if (!points.length) return [];
  const out = [points[0]];
  const targets = line ? [points[points.length - 1]] : points.slice(1);
  let { gx, gz } = points[0];
  for (const p of targets) {
    const tx = line && Math.abs(p.gx - gx) < Math.abs(p.gz - gz) ? gx : p.gx;
    const tz = line && tx !== gx ? gz : p.gz;
    while (gx !== tx || gz !== tz) {
      if (Math.abs(tx - gx) >= Math.abs(tz - gz) && gx !== tx) gx += Math.sign(tx - gx);
      else gz += Math.sign(tz - gz);
      out.push({ gx, gz });
    }
  }
  return out;
}
function at(elements: PlacedElement[], x: number, z: number) {
  for (let n = elements.length - 1; n >= 0; n--) {
    const e = elements[n];
    if (x >= e.gx && x < e.gx + e.spanX && z >= e.gz && z < e.gz + e.spanZ) return e;
  }
  return undefined;
}
const clip = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export interface WorksPreview {
  valid: boolean;
  reason: string;
  cost: number;
  points: GridPoint[];
  affected: string[];
}
function isTerrain(tool: InfrastructureTool) {
  return !["bridge", "aqueduct", "street", "interchange", "erase"].includes(tool.kind);
}
/** Each painted ramp has two explicit neighbors even where another ramp occupies the adjacent square. */
function interchangePorts(p: GridPoint, tool: InfrastructureTool) {
  const pieces = new Map<string, { gx: number; gz: number; ports: number }>();
  const rotated = (x: number, z: number): GridPoint => {
    for (let n = 0; n < (tool.orientation ?? 0) % 4; n++) [x, z] = [-z, x];
    return { gx: p.gx + x, gz: p.gz + z };
  };
  const port = (a: GridPoint, dx: number, dz: number) => {
    const k = tileKey(a.gx, a.gz),
      v = pieces.get(k) ?? { ...a, ports: 0 };
    v.ports |= 1 << DIRECTIONS.findIndex(([x, z]) => x === dx && z === dz);
    pieces.set(k, v);
  };
  function path(nodes: number[][], entrances = false) {
    const path = nodes.map(([x, z]) => rotated(x, z));
    for (let n = 1; n < path.length; n++) {
      const a = path[n - 1],
        b = path[n],
        dx = b.gx - a.gx,
        dz = b.gz - a.gz;
      port(a, dx, dz);
      port(b, -dx, -dz);
      if (entrances && (n === 1 || n === path.length - 1)) {
        if (n === 1) port(a, -dx, -dz);
        if (n === path.length - 1) port(b, dx, dz);
      }
    }
  }
  const delta = [-3, -2, -1, 0, 1, 2, 3];
  path(
    delta.map((x) => [x, 0]),
    true,
  );
  const full = (tool.layout ?? "diamond") === "diamond";
  path(
    (full ? delta : [0, 1, 2, 3]).map((z) => [0, z]),
    true,
  );
  for (const [x, z] of full
    ? [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]
    : [
        [-1, 1],
        [1, 1],
      ]) {
    path([
      [2 * x, 0],
      [2 * x, z],
      [x, z],
      [x, 2 * z],
      [0, 2 * z],
    ]);
  }
  if (tool.layout === "trumpet")
    path([
      [-2, 0],
      [-2, -1],
      [-1, -1],
      [-1, 0],
    ]);
  return pieces;
}
export function roadPortOpen(state: GameState | undefined, x: number, z: number, dx: number, dz: number): boolean {
  for(const [tx,tz] of [[x,z],[x+dx,z+dz]]){
    const span=state?.infrastructure?.spans[tileKey(tx,tz)];
    if(span&&!span.run.startsWith("junction-")&&(span.mode==="rail" || (span.axis==="x")!==Boolean(dx)))return false;
  }
  const streets = state?.infrastructure?.streets;
  if (!streets) return true;
  const a = streets[tileKey(x, z)]?.ports,
    b = streets[tileKey(x + dx, z + dz)]?.ports;
  if (a === undefined && b === undefined) return true;
  const dir = DIRECTIONS.findIndex(([i, j]) => i === dx && j === dz);
  return dir >= 0 && ((a ?? 15) & (1 << dir)) !== 0 && ((b ?? 15) & (1 << (dir + 2) % 4)) !== 0;
}
export function planInfrastructureStroke(state: GameState, tool: InfrastructureTool, input: GridPoint[]): WorksPreview {
  if (input.some((p) => !inBounds(p.gx, p.gz)))
    return { valid: false, reason: "Choose whole tiles inside the playable map.", cost: 0, points: [], affected: [] };
  let points = interpolate(input, tool.kind === "bridge");
  const fail = (reason: string): WorksPreview => ({ valid: false, reason, cost: 0, points, affected: [] });
  if (!points.length) return fail("Choose a tile.");
  if (tool.kind === "street" && tool.lanes && ![2, 4, 6, 8,10,12].includes(tool.lanes))
    return fail("Choose an even total of 2 to 12 lanes.");
  if (
    (state.mode !== "god" || effective(state, "stageRules", 0) > 0) &&
    state.highestStageReached < requiredToolStage(tool)
  )
    return fail("Available at stage " + requiredToolStage(tool) + ".");
  if (tool.kind === "interchange") points = [...interchangePorts(points[0], tool).values()];
  const selectedSpan =
    tool.kind === "bridge" && points.length === 1
      ? state.infrastructure?.spans[tileKey(points[0].gx, points[0].gz)]
      : undefined;
  let currentRamps = 1;
  if (selectedSpan) {
    const sections = Object.entries(state.infrastructure!.spans).filter(([, s]) => s.run === selectedSpan.run);
    if (sections.length < 3) return fail("Choose a complete bank-to-bank bridge.");
    currentRamps = Math.max(1, sections.filter(([, s]) => s.end).length / 2);
    points = sections.map(([k]) => {
      const [gx, gz] = k.split(",").map(Number);
      return { gx, gz };
    });
    points.sort((a, b) => selectedSpan.direction * (selectedSpan.axis === "x" ? a.gx - b.gx : a.gz - b.gz));
  }
  if (tool.kind === "bridge" && points.length >= 3) {
    const first = points[0],
      last = points.at(-1)!,
      dx = Math.sign(last.gx - first.gx),
      dz = Math.sign(last.gz - first.gz);
    const extra = Math.max(0, Math.ceil((tool.height ?? 2) / 2) - currentRamps);
    for (let n = 1; n <= extra; n++) {
      points.unshift({ gx: first.gx - dx * n, gz: first.gz - dz * n });
      points.push({ gx: last.gx + dx * n, gz: last.gz + dz * n });
    }
  }
  const radius = isTerrain(tool) && tool.kind !== "lock" && tool.kind !== "dam" ? clip(tool.radius ?? 0, 0, 3) : 0,
    seen = new Map<string, GridPoint>();
  for (const { gx, gz } of points)
    for (let dz = -radius; dz <= radius; dz++)
      for (let dx = -radius; dx <= radius; dx++)
        if (dx * dx + dz * dz <= (radius + 0.33) ** 2)
          seen.set(tileKey(gx + dx, gz + dz), { gx: gx + dx, gz: gz + dz });
  points = [...seen.values()];
  const affected = new Set<string>();
  const wideId=tool.kind==="bridge" && (tool.mode==="highway"||tool.mode==="freeway")?(tool.mode==="highway"?"highways":"freeways"):undefined;
  const crossAxis=points[0].gz===points.at(-1)!.gz?"x":"z";
  const corridorOcc=wideId||isTerrain(tool)?buildOccupancyMap(state.elements):undefined;
  for (const p of points) {
    if (!inBounds(p.gx, p.gz)) return fail("Part of this project is outside the island.");
    const el = at(state.elements, p.gx, p.gz),
      def = el && ELEMENT_BY_ID[el.defId],
      k = tileKey(p.gx, p.gz),
      span = state.infrastructure?.spans[k];
    if (el) affected.add(el.id);
    if (tool.kind === "lock" || tool.kind === "dam") {
      if (getTerrainCell(state, p.gx, p.gz).depth <= 0) return fail("Choose a wet channel between opposite banks.");
      if (
        tool.kind === "dam" &&
        (!["river", "canal"].includes(getTerrainCell(state, p.gx, p.gz).form ?? "") ||
          getTerrainCell(state, p.gx, p.gz).water !== "fresh" ||
          !damBanks(state, p.gx, p.gz))
      )
        return fail("The dam needs two dry banks on opposite sides of a flowing channel.");
    }
    if(isTerrain(tool)&&corridorOcc&&tool.kind!=="paint"&&shoulderAt(p.gx,p.gz,corridorOcc))return fail("This work would undermine a carriageway shoulder.");
    if(wideId && corridorOcc){
      const reason=corridorConflict(p.gx,p.gz,1,1,wideId,crossAxis,corridorOcc,()=>true);
      if(reason)return fail(reason);
    }
    if (tool.kind === "bridge" || tool.kind === "interchange") {
      if (span && selectedSpan?.run !== span.run)
        return fail("An existing crossing occupies this cell. Inspect it to change its deck.");
      if (tool.kind === "interchange" && getTerrainCell(state, p.gx, p.gz).depth > 0.1)
        return fail("An interchange needs a dry site. Reclaim the ground or use a bridge.");
      if (def && !def.isRoadNetwork && !def.isRailNetwork && !(def.isNetwork && def.isWaterFeature))
        return fail("The approaches or piers would occupy " + def.name + ".");
      if (
        tool.kind === "bridge" &&
        (tool.height ?? 2) + surfaceAt(state, p.gx, p.gz) + 0.7 >=
          (state.infrastructure?.conduits[k]?.height ?? Infinity)
      )
        return fail("Raise the aqueduct above this deck.");
    } else if (tool.kind === "street") {
      if (!def?.isRoadNetwork) return fail("Select a road or draw along an existing run.");
      if (["paths", "walking_paths", "trails", "side_walks", "boardwalks"].includes(def.id))
        return fail("Pedestrian paths have no traffic lanes.");
      const min = def.id === "freeways" ? 6 : def.id === "highways" || def.id === "over_passes" ? 4 : 2;
      const max=Math.min(12,Math.max(min+2,standardRoadLanes(def.id,el!.level)));
      if (tool.lanes && (tool.lanes < min || tool.lanes > max))
        return fail(def.name + " supports " + min + "–" + max + " lanes.");
      if ((tool.lanes ?? 2) > 4 && points.some((q) => Math.abs(q.gx - p.gx) + Math.abs(q.gz - p.gz) === 1)) {
        const horizontal = points.every((q) => q.gz === p.gz);
        const neighbor = at(state.elements, p.gx + (horizontal ? 0 : 1), p.gz + (horizontal ? 1 : 0));
        if (neighbor && !ELEMENT_BY_ID[neighbor.defId]?.isNetwork)
          return fail("Widening would encroach on " + ELEMENT_BY_ID[neighbor.defId].name + ".");
      }
    } else if (tool.kind === "aqueduct") {
      if (def && !def.isNetwork && !def.passiveNature && !sourceIds.has(def.id) && !receiverIds.has(def.id))
        return fail("An occupied building blocks the aqueduct supports.");
      if (span && span.deck + 0.8 >= conduitHeight(state, p, tool))
        return fail("Choose higher aqueduct supports to clear the bridge.");
    } else if (
      isTerrain(tool) &&
      def?.isRoadNetwork &&
      !span &&
      !["paint", "raise", "smooth"].includes(tool.kind) &&
      !["bridge_span", "bridge_suspension", "road_overpass"].includes(def.archetype)
    ) {
      return fail("Raise the road onto a bridge before cutting water underneath it.");
    } else if (isTerrain(tool) && def && !def.passiveNature && !def.isNetwork && tool.kind !== "paint") {
      return fail("This edit would flood, strand or undermine " + def.name + ".");
    }
  }
  if (tool.kind === "bridge") {
    if(tool.mode==="rail" && tool.railType && (tool.height??2)<railClearHeight[tool.railType])return fail("Choose at least "+railClearHeight[tool.railType]+" m of deck rise for this rail structure.");
    {
      if (points.length < 3) return fail("Start on one bank and end on the opposite bank.");
      const wet = (p: GridPoint) =>
        getTerrainCell(state, p.gx, p.gz).depth > 0.15 ||
        Boolean(ELEMENT_BY_ID[at(state.elements, p.gx, p.gz)?.defId ?? ""]?.isWaterFeature);
      if (wet(points[0]) || wet(points[points.length - 1])) return fail("Both approaches need a dry bank.");
      const ramps = Math.ceil((tool.height ?? 2) / 2);
      if ([...points.slice(0, ramps), ...points.slice(-ramps)].some(wet))
        return fail("The higher deck needs longer dry approaches. Choose lower supports or extend the banks.");
      if (points.length > 24 && tool.shape !== "suspension" && tool.railType !== "highlevel") return fail("Choose a suspension span for this distance.");
    }
  }
  const base =
    tool.kind === "bridge"
      ? 60 + 10 * (tool.height ?? 2)
      : tool.kind === "interchange"
        ? 48
        : tool.kind === "aqueduct"
          ? 28
          : tool.kind === "street"
            ? 12
            : tool.kind === "erase"
              ? 0
              : 3 + 2 * (tool.depth ?? 1);
  const cost = buildingCharges(state) ? Math.ceil(points.length * base) : 0;
  return {
    valid: cost <= state.money,
    reason: cost > state.money ? "Insufficient treasury for this project." : "",
    cost,
    points,
    affected: [...affected],
  };
}
export function editedCell(state: GameState, p: GridPoint, tool: InfrastructureTool): TerrainCell {
  const cell = { ...getTerrainCell(state, p.gx, p.gz) },
    amount = clip(tool.height ?? 0.75, 0.25, 9),
    depth = clip(tool.depth ?? 1, 0.25, 8);
  if (tool.kind === "lock" || tool.kind === "dam") {
    cell.gate = tool.gate ?? "open";
    cell.gateKind = tool.kind;
    cell.gateHead = tool.height ?? 1;
    return cell;
  }
  if (tool.kind === "paint") {
    cell.material = tool.material ?? "sand";
    return cell;
  }
  delete cell.freeLevel;
  if (tool.kind === "raise" || tool.kind === "mountain" || tool.kind === "peninsula")
    cell.elevation =
      tool.kind === "peninsula"
        ? Math.max(0.25, cell.elevation + amount)
        : clip(cell.elevation + (tool.kind === "mountain" ? 2 : 1) * amount, -12, 24);
  else if (tool.kind === "lower" || tool.kind === "canyon")
    cell.elevation = Math.max(-12, cell.elevation - amount * (tool.kind === "canyon" ? 2 : 1));
  else if (tool.kind === "smooth") {
    const near = DIRECTIONS.map(([dx, dz]) => getTerrainCell(state, p.gx + dx, p.gz + dz).elevation);
    cell.elevation = round((cell.elevation + near.reduce((a, b) => a + b, 0)) / 5);
  } else {
    cell.waterLevel =
      tool.waterLevel ??
      (tool.kind === "bay" ? SEA : cell.depth > 0 ? cell.waterLevel : Math.max(SEA, cell.elevation - 0.3));
    cell.elevation = cell.waterLevel - depth;
    cell.water = tool.kind === "bay" ? "salt" : "fresh";
    cell.form =
      tool.kind === "bay"
        ? "bay"
        : tool.kind === "pond"
          ? "lake"
          : tool.kind === "spring"
            ? "spring"
            : tool.kind === "canal"
              ? "canal"
              : "river";
    cell.source = tool.kind === "spring" ? (tool.flow ?? 12) : tool.kind === "river" ? (tool.flow ?? 4) : 0;
    cell.material = tool.kind === "canal" ? "clay" : "sand";
  }
  if (
    tool.kind === "lower" &&
    cell.water === "dry" &&
    cell.elevation < SEA &&
    DIRECTIONS.some(([dx, dz]) => getTerrainCell(state, p.gx + dx, p.gz + dz).water === "salt")
  ) {
    cell.water = "salt";
    cell.waterLevel = SEA;
  }
  if (tool.kind === "lower" || tool.kind === "canyon") cell.excavated = true;
  if (tool.kind === "canyon") {
    cell.form = "canyon";
    cell.water = "dry";
    cell.material = "rock";
    cell.source = 0;
  }
  if (tool.kind === "mountain") {
    cell.form = "bank";
    cell.material = cell.elevation > 7 ? "snow" : "rock";
  }
  if (tool.kind === "peninsula") {
    cell.form = "bank";
    cell.material = tool.material ?? "sand";
    cell.water = "dry";
  }
  cell.depth = cell.water === "dry" ? 0 : round(Math.max(0, cell.waterLevel - cell.elevation));
  if (cell.depth === 0) {
    cell.water = "dry";
    cell.source = 0;
  }
  cell.kind = cell.depth > 0.65 ? "water" : cell.depth > 0 ? "coast" : "land";
  return cell;
}
const surfaceAt = (state: GameState, x: number, z: number) => {
  const c = getTerrainCell(state, x, z);
  return c.depth ? c.waterLevel : c.elevation;
};
export const conduitHeight = (state: GameState, p: GridPoint, tool: InfrastructureTool) =>
  Math.max(0, surfaceAt(state, p.gx, p.gz)) + (tool.height ?? 3);
/** End-point elevations are shared by the bridge builder and its construction ghost. */
export function bridgeGrade(state: GameState, points: GridPoint[], rise: number) {
  const first = points[0],
    last = points.at(-1)!;
  const startBank = surfaceAt(state, first.gx, first.gz),
    endBank = surfaceAt(state, last.gx, last.gz);
  const deck = Math.max(startBank, endBank) + rise;
  const ramps = Math.max(1, Math.min(Math.ceil(rise / 2), Math.floor((points.length - 1) / 2)));
  const heightAt = (n: number) =>
    n < ramps
      ? startBank + ((deck - startBank) * n) / ramps
      : n > points.length - ramps
        ? endBank + ((deck - endBank) * (points.length - n)) / ramps
        : deck;
  return { deck, ramps, heightAt };
}
function capture(i: Infrastructure, key: string): Change {
  return {
    key,
    cell: i.cells[key],
    span: i.spans[key] && { ...i.spans[key] },
    conduit: i.conduits[key],
    street: i.streets[key],
  };
}
function restore(i: Infrastructure, c: Change) {
  for (const [table, value] of [
    [i.cells, c.cell],
    [i.spans, c.span],
    [i.conduits, c.conduit],
    [i.streets, c.street],
  ] as const)
    if (value) table[c.key] = value as never;
    else delete table[c.key];
}
function networkPiece(id: string, p: GridPoint, uid: string): PlacedElement {
  return {
    id: uid,
    defId: id,
    ...p,
    level: 1,
    variant: 0,
    rotation: 0,
    spanX: 1,
    spanZ: 1,
    connected: true,
    hasPoliceCover: false,
    hasFireCover: false,
    nuisancePenalty: 0,
    maintTimerSec: 0,
    disrepair: false,
    onFire: false,
    animKind: "place",
    animProgress: 0,
  };
}
/** An excavated outlet accepts real stored volume. Grade barriers and occupied lots stop a spill. */
function fillExcavations(state: GameState, before: Map<string, Change>) {
  const i = ensureInfrastructure(state),
    seen = new Set<string>();
  for (const [start, wet] of Object.entries(i.cells)) {
    if (seen.has(start) || wet.water !== "fresh" || wet.gate === "closed" || !wet.depth) continue;
    const queue = [start],
      dry = new Set<string>();
    seen.add(start);
    let volume = 0,
      top = wet.waterLevel,
      source = false;
    for (let n = 0; n < queue.length; n++) {
      const k = queue[n],
        cell = i.cells[k],
        [x, z] = k.split(",").map(Number);
      volume += cell.depth;
      source ||= cell.source > 0;
      if (cell.depth) top = Math.min(top, cell.waterLevel);
      for (const [dx, dz] of DIRECTIONS) {
        const nx = x + dx,
          nz = z + dz,
          nk = tileKey(nx, nz),
          next = i.cells[nk];
        if (seen.has(nk) || !next || next.gate === "closed") continue;
        const samePool = next.water === "fresh" && next.depth > 0 && Math.abs(next.waterLevel - top) < 0.1;
        const building = at(state.elements, nx, nz);
        const accepts =
          !next.depth &&
          next.excavated &&
          next.elevation + 0.08 < top &&
          (!building || building.overWater || building.sculptsTerrain);
        if (!samePool && !accepts) continue;
        if (accepts) dry.add(nk);
        seen.add(nk);
        queue.push(nk);
      }
    }
    if (!dry.size) continue;
    let low = Math.min(...queue.map((k) => i.cells[k].elevation)),
      high = top;
    if (!source)
      for (let step = 0; step < 22; step++) {
        const test = (low + high) / 2,
          retained = queue.reduce((sum, k) => sum + Math.max(0, test - i.cells[k].elevation), 0);
        if (retained > volume) high = test;
        else low = test;
      }
    const level = source ? top : round((low + high) / 2);
    for (const k of queue) {
      const c = i.cells[k],
        depth = round(Math.max(0, level - c.elevation));
      if (!depth && !c.depth) continue;
      if (!before.has(k)) before.set(k, capture(i, k));
      i.cells[k] = {
        ...c,
        depth,
        waterLevel: level,
        water: depth ? "fresh" : "dry",
        kind: depth > 0.65 ? "water" : depth ? "coast" : "land",
      };
    }
  }
}
function accountCoastalWater(state: GameState, before: Map<string, Change>) {
  fillExcavations(state, before);
  const i = ensureInfrastructure(state),
    seen = new Set<string>();
  const retained = new Map<string, number>();
  for (const [k, c] of Object.entries(i.cells))
    if (c.gate === "closed" && c.gateKind === "dam") {
      const [x, z] = k.split(",").map(Number),
        [dx, dz] = DIRECTIONS[c.flowDir ?? 2];
      retained.set(tileKey(x - dx, z - dz), c.waterLevel + (c.gateHead ?? 1));
    }
  for (const [start, first] of Object.entries(i.cells)) {
    if (seen.has(start) || !first.depth || first.gate === "closed") continue;
    const queue = [start];
    const seaEdges: string[] = [];
    seen.add(start);
    let ocean = false,
      lowestBank = Infinity,
      level = first.freeLevel ?? first.waterLevel,
      impounded = -Infinity;
    for (let n = 0; n < queue.length; n++) {
      const [x, z] = queue[n].split(",").map(Number),
        c = i.cells[queue[n]];
      level = Math.min(level, c.freeLevel ?? c.waterLevel);
      impounded = Math.max(impounded, retained.get(queue[n]) ?? -Infinity);
      for (const [dx, dz] of DIRECTIONS) {
        const k = tileKey(x + dx, z + dz),
          nb = i.cells[k];
        if (nb?.depth && nb.gate !== "closed" && !seen.has(k)) {
          seen.add(k);
          queue.push(k);
        } else if (!nb && getTerrainCell(state, x + dx, z + dz).depth > 0.1) {
          ocean = true;
          seaEdges.push(queue[n]);
        } else if (!nb || !nb.depth) {
          lowestBank = Math.min(lowestBank, (nb ?? getTerrainCell(state, x + dx, z + dz)).elevation);
        }
      }
    }
    const brackish = new Set(seaEdges);
    let frontier = [...brackish];
    // Salt reaches the mouth. Flowing fresh branches upstream retain their own surface and source.
    if (ocean) {
      for (let step = 0; step < 2; step++) {
        const next: string[] = [];
        for (const k of frontier) {
          const [x, z] = k.split(",").map(Number);
          for (const [dx, dz] of DIRECTIONS) {
            const nk = tileKey(x + dx, z + dz);
            if (i.cells[nk]?.depth && !brackish.has(nk)) {
              brackish.add(nk);
              next.push(nk);
            }
          }
        }
        frontier = next;
      }
      level = SEA;
    } else if (Number.isFinite(impounded)) level = Math.max(level, Math.min(impounded, lowestBank));
    for (const k of queue) {
      const c = i.cells[k],
        natural = c.freeLevel ?? c.waterLevel,
        freeLevel = Number.isFinite(impounded) && !ocean ? natural : undefined,
        freshReach =
          (c.form === "spring" || (c.form === "river" && (c.source > 0 || c.flowDir !== undefined))) &&
          !brackish.has(k),
        localLevel = freshReach && !Number.isFinite(impounded) ? Math.max(ocean ? SEA : -Infinity, natural) : level,
        depth = round(Math.max(0, localLevel - c.elevation)),
        water = depth ? (ocean && !freshReach ? "salt" : "fresh") : "dry";
      if (c.depth === depth && c.water === water && c.waterLevel === localLevel && c.freeLevel === freeLevel) continue;
      if (!before.has(k)) before.set(k, capture(i, k));
      i.cells[k] = {
        ...c,
        depth,
        water,
        waterLevel: localLevel,
        freeLevel,
        kind: depth > 0.65 ? "water" : depth > 0 ? "coast" : "land",
      };
    }
  }
}
export function applyInfrastructureStroke(
  state: GameState,
  tool: InfrastructureTool,
  input: GridPoint[],
): WorksPreview {
  const plan = planInfrastructureStroke(state, tool, input);
  if (!plan.valid) return plan;
  const i = ensureInfrastructure(state),
    before = new Map<string, Change>(),
    removed: PlacedElement[] = [],
    added: string[] = [];
  let points = plan.points;
  const selection = i.spans[tileKey(input[0].gx, input[0].gz)];
  if (
    (tool.kind === "bridge" || (tool.kind === "erase" && (tool.eraseLayer ?? "deck") === "deck")) &&
    points.length === 1 &&
    selection
  )
    points = Object.entries(i.spans)
      .filter(([, v]) => v.run === selection.run)
      .map(([k]) => {
        const [gx, gz] = k.split(",").map(Number);
        return { gx, gz };
      });
  const axis = points.every((p) => p.gz === points[0].gz) ? "x" : "z";
  const run = selection?.run ?? "cross-" + Date.now().toString(36) + "-" + tileKey(points[0].gx, points[0].gz);
  const grade = bridgeGrade(state, points, tool.height ?? 2);
  const { deck } = grade;
  const junction = tool.kind === "interchange" ? interchangePorts(input[0], tool) : undefined;
  const newCells = new Map<string, TerrainCell>();
  const replaceRoad = (p: GridPoint, id: string, force=false) => {
    const old = at(state.elements, p.gx, p.gz);
    if (old?.defId === id && !force) return old;
    if (old) {
      removed.push(old);
      state.elements = state.elements.filter((e) => e !== old);
    }
    const uid = "works-" + i.revision + "-" + tileKey(p.gx, p.gz) + "-" + Date.now().toString(36);
    const e = networkPiece(id, p, uid);
    if (old && ELEMENT_BY_ID[old.defId]?.isWaterFeature) {
      e.waterUnderlay = old;
      e.overWater = true;
    } else if (old?.waterUnderlay) {
      e.waterUnderlay = old.waterUnderlay;
      e.overWater = true;
    }
    added.push(uid);
    state.elements.push(e);
    return e;
  };
  const sculptLine = isTerrain(tool) && tool.radius ? interpolate(input, false) : [];
  const course = tool.kind === "canal" || tool.kind === "river" ? interpolate(input, false) : [];
  const gradient = new Map<string, { dir: number; level: number }>();
  let upstream = Infinity;
  for (let n = 0; n < course.length; n++) {
    const p = course[n],
      prev = course[n - 1] ?? p,
      next = course[n + 1];
    const dx = next ? next.gx - p.gx : p.gx - prev.gx,
      dz = next ? next.gz - p.gz : p.gz - prev.gz;
    const baseline = editedCell(state, p, tool).waterLevel;
    upstream = Math.min(baseline, upstream - 0.025);
    gradient.set(tileKey(p.gx, p.gz), { dir: DIRECTIONS.findIndex(([x, z]) => dx === x && dz === z), level: upstream });
  }
  points.forEach((p, j) => {
    const k = tileKey(p.gx, p.gz);
    before.set(k, capture(i, k));
    if (isTerrain(tool)) {
      let localTool = tool;
      if (sculptLine.length && ["mountain", "canyon", "raise", "lower", "smooth"].includes(tool.kind)) {
        const distance = Math.min(...sculptLine.map((q) => Math.hypot(p.gx - q.gx, p.gz - q.gz)));
        const strength = Math.max(0.12, 1 - (distance / (tool.radius! + 0.35)) ** 1.25);
        localTool = { ...tool, height: Math.max(0.25, (tool.height ?? 0.75) * strength) };
      }
      const cell = editedCell(state, p, localTool);
      if (course.length) {
        const center = gradient.has(k)
          ? p
          : course.reduce((best, q) =>
              (q.gx - p.gx) ** 2 + (q.gz - p.gz) ** 2 < (best.gx - p.gx) ** 2 + (best.gz - p.gz) ** 2 ? q : best,
            );
        const segment = gradient.get(tileKey(center.gx, center.gz))!;
        if (segment.dir >= 0) cell.flowDir = segment.dir;
        if (tool.kind === "river") {
          cell.waterLevel = segment.level;
          cell.elevation = cell.waterLevel - cell.depth;
        }
      }
      newCells.set(k, cell);
      return;
    }
    if (tool.kind === "erase") {
      const s = i.spans[k],
        el = at(state.elements, p.gx, p.gz);
      if ((tool.eraseLayer ?? "deck") === "deck" && s && el?.id.startsWith("works-")) {
        removed.push(el);
        state.elements = state.elements.filter((e) => e !== el);
        if (el.waterUnderlay) {
          state.elements.push(el.waterUnderlay);
          added.push(el.waterUnderlay.id);
        }
      }
      const layer = tool.eraseLayer ?? (s ? "deck" : i.conduits[k] ? "aqueduct" : "terrain");
      if (layer === "terrain") delete i.cells[k];
      if (layer === "deck") delete i.spans[k];
      if (layer === "aqueduct") delete i.conduits[k];
      if (layer === "street") delete i.streets[k];
      return;
    }
    if (tool.kind === "aqueduct") {
      i.conduits[k] = { height: conduitHeight(state, p, tool), outlet: tool.outlet ?? "auto", style: tool.style ?? 0 };
      return;
    }
    if (tool.kind === "street" || tool.kind === "interchange") {
      if (tool.kind === "interchange") {
        const base = input[0],
          rx = p.gx - base.gx,
          rz = p.gz - base.gz,
          rot = (tool.orientation ?? 0) % 2;
        const center = rx === 0 && rz === 0;
        const mainAxis = rot ? rx === 0 : rz === 0;
        const approach = mainAxis && Math.abs(rx + rz) === 1;
        const road = replaceRoad(p, center || approach ? "over_passes" : mainAxis ? "highways" : "roads");
        if (center) road.crossingAxis = rot ? "z" : "x";
        if (center)
          i.spans[k] = {
            run: "junction-" + k,
            shape: "truss",
            mode: "highway",
            axis: rot ? "z" : "x",
            deck: 1.5,
            startHeight: 1.5,
            endHeight: 1.5,
            direction: 1,
            end: false,
            ramp: false,
            lift: "closed",
          };
      }
      const network = at(state.elements, p.gx, p.gz);
      const laneRange =
        network?.defId === "freeways"
          ? [6, 8]
          : network?.defId === "highways" || network?.defId === "over_passes"
            ? [4, 6]
            : [2, 4];
      const maxLanes=Math.min(12,Math.max(laneRange[1],standardRoadLanes(network?.defId??"roads",network?.level??1)));
      const range = clip(tool.lanes ?? laneRange[0], laneRange[0],maxLanes);
      const longAxis =
        tool.kind === "interchange"
          ? undefined
          : points.length > 1
            ? points.every((q) => q.gz === points[0].gz)
              ? "x"
              : "z"
            : undefined;
      i.streets[k] = {
        ...i.streets[k],
        ports: junction?.get(k)?.ports ?? i.streets[k]?.ports,
        lanes: range,
        signal:
          tool.kind === "interchange" &&
          (tool.signal ?? "auto") === "auto" &&
          DIRECTIONS.filter((_, n) => (junction?.get(k)?.ports ?? 0) & (1 << n)).length < 3
            ? "yield"
            : (tool.signal ?? "auto"),
        period: tool.period ?? 12,
        axis: longAxis,
        layout: tool.kind === "interchange" ? (tool.layout ?? "diamond") : i.streets[k]?.layout,
      };
      return;
    }
    const prev = i.spans[k];
    const direction =
      axis === "x" ? Math.sign(points.at(-1)!.gx - points[0].gx) : Math.sign(points.at(-1)!.gz - points[0].gz);
    const { ramps, heightAt: rampHeight } = grade;
    const mode = tool.mode ?? prev?.mode ?? "road",
      railType=mode==="rail" ? tool.railType??prev?.railType??(tool.shape==="arch"?"viaduct":"steel") : undefined,
      shape = railType ? railShape[railType] : tool.shape ?? prev?.shape ?? "arch";
    const id =
      mode === "foot"
        ? "walking_paths"
        : mode === "rail"
          ? "train_tracks"
          : mode === "highway"
            ? "highways"
            : mode === "freeway"
              ? "freeways"
              : "roads";
    const existing=at(state.elements,p.gx,p.gz);
    const road = replaceRoad(p,id,roadWidth(id)>1&&existing?.roadAxis!==axis);
    if(roadWidth(id)>1)road.roadAxis=axis;
    if (road.id.startsWith("works-"))
      road.overWater = !!road.waterUnderlay || getTerrainCell(state, p.gx, p.gz).depth > 0;
    i.spans[k] = {
      run,
      axis,
      mode,
      shape,
      deck,
      corridorWidth:roadWidth(id)>1?roadWidth(id):undefined,
      tier: Math.min(mode==="foot"||mode==="rail"?5:11,prev?.tier??1),
      railType,
      startHeight: rampHeight(j),
      endHeight: rampHeight(j + 1),
      direction: direction || 1,
      end: j < ramps || j >= points.length - ramps,
      ramp: j < ramps || j >= points.length - ramps,
      lift: tool.lift ?? "auto",
    };
    if(i.spans[k].tier!>1)road.level=Math.min(getMaxElementLevel(id),i.spans[k].tier!);
  });
  for (const [k, c] of newCells) i.cells[k] = c;
  if (newCells.size || tool.kind === "erase") accountCoastalWater(state, before);
  transfer(state, "treasury", "outside", plan.cost, "Public works");
  changed(i);
  i.undo.push({
    before: [...before.values()],
    after: [...before.keys()].map((k) => capture(i, k)),
    removed,
    added,
    cost: plan.cost,
  });
  if (i.undo.length > 20) i.undo.shift();
  return plan;
}
export function undoInfrastructure(state: GameState): boolean {
  const i = state.infrastructure,
    edit = i?.undo.at(-1);
  if (!i || !edit) return false;
  const ids = new Set(edit.added);
  if (edit.added.some((id) => !state.elements.some((e) => e.id === id))) return false;
  const rest = state.elements.filter((e) => !ids.has(e.id));
  if (edit.removed.some((e) => at(rest, e.gx, e.gz))) return false;
  const after = new Map(edit.after.map((c) => [c.key, c]));
  if (
    edit.before.some((c) => {
      const [x, z] = c.key.split(",").map(Number);
      const e = at(rest, x, z);
      return (
        !!e &&
        !ELEMENT_BY_ID[e.defId]?.isNetwork &&
        !ELEMENT_BY_ID[e.defId]?.passiveNature &&
        JSON.stringify(c.cell) !== JSON.stringify(after.get(c.key)?.cell)
      );
    })
  )
    return false;
  state.elements = [...rest, ...edit.removed];
  for (const c of edit.before) restore(i, c);
  transfer(state, "outside", "treasury", edit.cost, "Public works refund");
  i.undo.pop();
  changed(i);
  return true;
}

const sourceIds = new Set([
  "wells",
  "water_pumping_station",
  "desalination_plant",
  "municipal_reservoir",
  "mountains",
  "rivers",
  "wide_rivers",
]);
const receiverIds = new Set([
  ...FARM_ANCHOR_IDS,...FARM_MODULE_IDS,
  "data_centers",
  "factories",
  "water_treatment_plant",
  "water_towers",
  "municipal_reservoir",
  "farms",
  "farm_houses",
  "fields",
  "orchards",
  "gardens",
  "hydro_electric_power_plants",
  "terraced_glasshouses",
  "solar_canopy_orchard",
  "ocean_habitat_ring",
  "materials_foundry",
  "open_pit_mine",
  "freight_rail_terminal",
  "spaceport",
  "pumped_storage_station",
  "fire_department",
  "water_reuse_works",
  "rainwater_cathedral",
  "aqueduct",
]);
const sourcePressure = (id: string) =>
  id === "water_pumping_station" || id === "desalination_plant" ? 20 : id === "mountains" ? 12 : 5;
function occupiedMap(state: GameState) {
  const m = new Map<string, PlacedElement>();
  for (const e of state.elements)
    for (let x = e.gx; x < e.gx + e.spanX; x++) for (let z = e.gz; z < e.gz + e.spanZ; z++) m.set(tileKey(x, z), e);
  return m;
}
export interface VesselEnvelope {
  draft: number;
  beam: number;
  height: number;
}
export interface NavigationCell {
  depth: number;
  width: number;
  clearance: number;
  waterLevel: number;
  ports: number;
  salt: boolean;
  opening: boolean;
  blockedBy?: string;
}
function liftChamber(state: GameState, e: PlacedElement, x: number, z: number) {
  const lateralIsZ = e.rotation % 2 !== 0;
  const crossWidth = (lateralIsZ ? e.spanZ : e.spanX) * TILE_SIZE;
  const relativeSide = lateralIsZ ? z - e.gz + 0.5 : x - e.gx + 0.5;
  const sideOffset = Math.abs(relativeSide * TILE_SIZE - crossWidth / 2);
  const longitudinal = lateralIsZ ? x - e.gx + 0.5 : z - e.gz + 0.5;
  const length = lateralIsZ ? e.spanX : e.spanZ;
  const first = getTerrainCell(state, lateralIsZ ? e.gx - 1 : x, lateralIsZ ? z : e.gz - 1);
  const last = getTerrainCell(state, lateralIsZ ? e.gx + e.spanX : x, lateralIsZ ? z : e.gz + e.spanZ);
  const usable =
    sideOffset <= crossWidth / 2 - 0.7 &&
    first.depth > 0.15 &&
    last.depth > 0.15 &&
    !e.onFire &&
    (!e.disrepair || e.level > 2) &&
    (state.mode === "god" || (state.metrics.powerSupply > 0 && state.metrics.powerSupply >= state.metrics.powerDemand));
  return {
    depth: usable ? Math.min(1.3 + 0.45 * e.level, first.depth, last.depth) : 0,
    width: crossWidth - 2.15,
    level: first.waterLevel + ((last.waterLevel - first.waterLevel) * longitudinal) / length,
    ports: lateralIsZ ? 10 : 5,
    clearance: 1.05 + 0.51 * e.level,
  };
}
function ringBerthPorts(e: PlacedElement, x: number, z: number) {
  const left = x === e.gx,
    right = x === e.gx + e.spanX - 1,
    top = z === e.gz,
    bottom = z === e.gz + e.spanZ - 1;
  return (left || right) && (top || bottom) ? (left ? 8 : 2) | (top ? 1 : 4) : 0;
}
export const LIFT_TRAVEL = 5;
function bridgeHeadroom(s: Crossing, water: number, open = false) {
  return s.deck - water - (s.railType==="timber"?.5:s.shape === "arch" ? 0.55 : 0.25) + (open && s.shape === "lift" ? LIFT_TRAVEL : 0);
}
export function buildWaterNavigation(state: GameState) {
  const spans = new Map<string, { min: number; max: number }>();
  for (const [k, s] of Object.entries(state.infrastructure?.spans ?? {})) {
    if (s.end || s.shape !== "arch") continue;
    const pos = Number(k.split(",")[s.axis === "x" ? 0 : 1]),
      r = spans.get(s.run) ?? { min: pos, max: pos };
    r.min = Math.min(r.min, pos);
    r.max = Math.max(r.max, pos);
    spans.set(s.run, r);
  }
  const occ = occupiedMap(state),
    cells = new Map<string, NavigationCell>(),
    wet = new Map<string, { depth: number; level: number; salt: boolean }>();
  function water(x: number, z: number) {
    const k = tileKey(x, z),
      cached = wet.get(k);
    if (cached) return cached;
    const ground = getTerrainCell(state, x, z),
      e = occ.get(k),
      d = e && ELEMENT_BY_ID[e.defId],
      feature = e?.waterUnderlay ?? (d?.isWaterFeature ? e : undefined);
    let depth = inBounds(x, z) ? ground.depth : 0,
      level = ground.waterLevel;
    if (feature && !state.infrastructure?.cells[k]) {
      depth = Math.max(depth, feature.defId === "wide_rivers" || feature.defId === "lakes" ? 3.2 : 1.2);
      level = ground.depth ? level : ground.elevation + 0.03;
    }
    // A quay leaves an approach alongside its seaward face. Interior building lots stay closed.
    if (e && d && !feature && !d.isNetwork && !d.isWaterFeature) {
      if (d.domain === "land" && !d.passiveNature) depth = 0;
      else if (d.domain === "coast_or_water") {
        const u = (x + 0.5 - e.gx) / e.spanX,
          v = (z + 0.5 - e.gz) / e.spanZ;
        const front = [v, u, 1 - v, 1 - u][e.rotation % 4];
        const intake =
          d.id === "water_pumping_station" || d.id === "desalination_plant" || d.id === "hydro_electric_power_plants";
        if (intake ? front > 0.3 : front < 0.34) depth = 0;
      }
    }
    if (e?.defId === "canal_boat_lift") {
      const c = liftChamber(state, e, x, z);
      depth = c.depth;
      level = c.level;
    }
    if (e?.defId === "ocean_habitat_ring") depth = ringBerthPorts(e, x, z) ? ground.depth : 0;
    if (ground.gate === "closed") depth = 0;
    const result = { depth, level, salt: ground.water === "salt" };
    wet.set(k, result);
    return result;
  }
  function cell(x: number, z: number): NavigationCell {
    const k = tileKey(x, z),
      cached = cells.get(k);
    if (cached) return cached;
    const w = water(x, z),
      e = occ.get(k),
      span = state.infrastructure?.spans[k],
      duct = state.infrastructure?.conduits[k];
    let ports = 0;
    for (let d = 0; d < 4; d++)
      if (w.depth > 0.05 && water(x + DIRECTIONS[d][0], z + DIRECTIONS[d][1]).depth > 0.05) ports |= 1 << d;
    let wx = 1,
      wz = 1;
    if (w.depth > 0.05)
      for (const [dx, dz] of DIRECTIONS)
        for (let n = 1; n <= 4 && water(x + dx * n, z + dz * n).depth > 0.1; n++)
          if (dx) wx++;
          else wz++;
    // The short cross-section limits beam. At an elbow all four bank distances can be short.
    let width = w.depth ? TILE_SIZE * Math.min(wx, wz) - 0.55 : 0,
      clearance = Infinity;
    const opening = span?.shape === "lift" && !span.end && span.lift !== "closed";
    let blockedBy: string | undefined;
    if (span && !span.end) {
      clearance = bridgeHeadroom(span, w.level, opening);
      if(span.railType==="timber" || span.railType==="viaduct")width=Math.min(width,3.45);
      const arch = spans.get(span.run);
      if (arch) {
        const length = arch.max - arch.min + 1,
          center = (arch.min + arch.max) / 2;
        const ratio = Math.min(1, Math.abs((span.axis === "x" ? x : z) - center) / (length / 2));
        width = Math.min(width, length * TILE_SIZE - 0.6);
        clearance -= (span.deck - w.level - 0.4) * (1 - Math.sqrt(1 - ratio * ratio));
      }
      blockedBy = e?.id ?? span.run;
    } else if (e && !span && w.depth > 0) {
      const id = e.defId;
      if (["stone_bridges", "bridges", "suspension_bridges", "boardwalks", "train_tracks"].includes(id)) {
        clearance = id === "suspension_bridges" ? 2.55 : id === "stone_bridges" ? 1.15 : id === "bridges" ? 1.4 : 0.65;
        blockedBy = e.id;
      }
    }
    if (e?.defId === "canal_boat_lift") {
      const c = liftChamber(state, e, x, z);
      ports &= c.ports;
      width = Math.min(width, c.width);
      clearance = Math.min(clearance, c.clearance);
      blockedBy = e.id;
    }
    if (e?.defId === "ocean_habitat_ring") {
      ports &= ringBerthPorts(e, x, z);
      width = Math.min(width, 3 + e.level * 0.8);
    }
    if (duct && duct.height - 0.45 - w.level < clearance) {
      clearance = duct.height - 0.45 - w.level;
      blockedBy = "aqueduct:" + k;
    }
    const value = {
      ...w,
      depth: w.depth,
      width,
      clearance,
      waterLevel: w.level,
      ports,
      salt: w.salt,
      opening: Boolean(opening),
      blockedBy,
    };
    cells.set(k, value);
    return value;
  }
  function canPass(x: number, z: number, v: VesselEnvelope) {
    const c = cell(x, z);
    return c.depth >= v.draft && c.width >= v.beam && c.clearance >= v.height;
  }
  return {
    cell,
    canPass,
    canStep(x: number, z: number, nx: number, nz: number, v: VesselEnvelope) {
      const d = DIRECTIONS.findIndex(([dx, dz]) => dx === nx - x && dz === nz - z);
      if (d < 0 || !canPass(x, z, v) || !canPass(nx, nz, v)) return false;
      const from = cell(x, z),
        to = cell(nx, nz);
      if (!(from.ports & (1 << d)) || !(to.ports & (1 << (d + 2) % 4))) return false;
      if (Math.abs(from.waterLevel - to.waterLevel) <= 0.7) return true;
      return (
        [occ.get(tileKey(x, z)), occ.get(tileKey(nx, nz))].some((e) => e?.defId === "canal_boat_lift") ||
        [getTerrainCell(state, x, z), getTerrainCell(state, nx, nz)].some(
          (c) => c.gateKind === "lock" && c.gate === "open",
        )
      );
    },
  };
}
export function liftProgress(state: GameState, s: Crossing): number {
  if (s.shape !== "lift" || s.end) return 0;
  if (s.lift === "open") return 1;
  if (s.lift === "closed" || s.requestedAt === undefined) return 0;
  const age = state.activePlaySec - s.requestedAt;
  const clear = s.clearDelay ?? 2;
  if (age < clear || age > clear + 14) return 0;
  return Math.max(0, Math.min(1, (age - clear) / 3, (clear + 14 - age) / 3));
}
export function requestVesselPassage(state: GameState, gx: number, gz: number, height: number): boolean {
  const k = tileKey(gx, gz),
    s = state.infrastructure?.spans[k];
  if (!s || s.end) {
    const lift = state.elements.find(
      (e) => e.defId === "canal_boat_lift" && gx >= e.gx && gx < e.gx + e.spanX && gz >= e.gz && gz < e.gz + e.spanZ,
    );
    if (!lift) return true;
    const c = liftChamber(state, lift, gx, gz);
    if (c.clearance < height || !c.depth) return false;
    if (lift.lockCycleAt === undefined || state.activePlaySec - lift.lockCycleAt > 14) {
      lift.lockCycleAt = state.activePlaySec;
      return false;
    }
    return state.activePlaySec - lift.lockCycleAt >= Math.max(2, 6 - lift.level);
  }
  const water = getTerrainCell(state, gx, gz).waterLevel;
  if (bridgeHeadroom(s, water) >= height) return true;
  if (bridgeHeadroom(s, water, true) < height) return false;
  if (s.shape !== "lift" || s.lift === "closed") return false;
  if (s.lift === "open") return true;
  const peers = Object.values(state.infrastructure!.spans).filter((p) => p.run === s.run && !p.end);
  if (s.requestedAt === undefined || state.activePlaySec - s.requestedAt > (s.clearDelay ?? 2) + 14) {
    for (const p of peers) {
      p.requestedAt = state.activePlaySec;
      p.clearDelay = 2 + (peers.length - 1) * 1.1;
    }
  }
  // Keep the deck up while a hull is passing, then allow traffic to clear.
  if (liftProgress(state, s) >= 0.98) {
    for (const p of peers) p.requestedAt = Math.max(p.requestedAt ?? 0, state.activePlaySec - (p.clearDelay ?? 2) - 7);
    return true;
  }
  return false;
}
function signalPlan(state: GameState, x: number, z: number, s: StreetControl) {
  const elapsed = state.activePlaySec + Math.abs(x * 3 + z * 5),
    period = Math.max(4, s.period),
    cycle = Math.floor(elapsed / period);
  if (!s.demand) s.demand = { cycle, north: 0, east: 0, fraction: 0.5 };
  if (s.demand.cycle !== cycle) {
    const { north, east } = s.demand;
    s.demand = { cycle, north: 0, east: 0, fraction: clip((north + 4) / (north + east + 8), 0.28, 0.72) };
  }
  return { plan: s.demand, phase: (elapsed % period) / period };
}
export function registerRoadDemand(state: GameState, gx: number, gz: number, dx: number, dz: number, weight = 1) {
  const s = state.infrastructure?.streets[tileKey(gx, gz)];
  if (!s || s.signal !== "auto" || !Number.isFinite(weight)) return;
  const { plan } = signalPlan(state, gx, gz, s);
  if (dx !== 0) plan.east += weight;
  else if (dz !== 0) plan.north += weight;
}
export function roadTravelOpen(state: GameState, gx: number, gz: number, dx: number, dz: number): boolean {
  const i = state.infrastructure,
    k = tileKey(gx, gz),
    s = i?.spans[k],
    street = i?.streets[k];
  if (
    s?.shape === "lift" &&
    !s.end &&
    (s.lift === "open" ||
      (s.lift === "auto" &&
        s.requestedAt !== undefined &&
        state.activePlaySec - s.requestedAt < (s.clearDelay ?? 2) + 14))
  ) {
    const previous = i?.spans[tileKey(gx - dx, gz - dz)];
    return s.lift === "auto" && previous?.run === s.run && !previous.end && liftProgress(state, s) === 0;
  }
  if (!street || street.signal === "yield") return true;
  if (street.signal === "north") return dz !== 0;
  if (street.signal === "east") return dx !== 0;
  const { plan, phase } = signalPlan(state, gx, gz, street);
  return dz !== 0 ? phase < plan.fraction - 0.04 : phase >= plan.fraction && phase < 0.96;
}
const roadProfiles = new Map<string, ReturnType<typeof networkRoadProfile>>();
const streetOccupancy = new WeakMap<
  PlacedElement[],
  {
    revision: number;
    length: number;
    map: Map<string, PlacedElement>;
    profiles: Map<string, ReturnType<typeof networkRoadProfile>>;
  }
>();
function builtStreet(state: GameState, x: number, z: number) {
  let cached = streetOccupancy.get(state.elements);
  if (!cached || cached.length !== state.elements.length || cached.revision !== (state.infrastructure?.revision ?? 0)) {
    cached = {
      revision: state.infrastructure?.revision ?? 0,
      length: state.elements.length,
      map: occupiedMap(state),
      profiles: new Map(),
    };
    streetOccupancy.set(state.elements, cached);
  }
  const key = tileKey(x, z);
  if (cached.profiles.has(key)) return cached.profiles.get(key);
  const e = cached.map.get(key);
  if (!e || !["bridges", "stone_bridges", "suspension_bridges", "over_passes", "underpasses"].includes(e.defId)) return;
  const mask = getNetworkConnMask(state.elements, e, cached.map, state),
    variant = e.defId + ":" + mask;
  if (!roadProfiles.has(variant)) roadProfiles.set(variant, networkRoadProfile(e.defId, mask));
  const p = roadProfiles.get(variant);
  cached.profiles.set(key, p);
  return p;
}
export function surfaceTravelHeight(
  state: GameState,
  gx: number,
  gz: number,
  axis: "x" | "z",
  fraction: number,
): number {
  const s = state.infrastructure?.spans[tileKey(gx, gz)];
  if (!s || s.axis !== axis || s.run.startsWith("junction-")) {
    const c = getTerrainCell(state, gx, gz),
      profile = builtStreet(state, gx, gz);
    if (!profile) return c.elevation;
    const v = Math.max(0, Math.min(15, Math.floor(fraction * 16)));
    const idx = axis === "x" ? v * 16 + 8 : 8 * 16 + v;
    const offset =
      profile.elevatedAxis < 0 || profile.elevatedAxis === (axis === "x" ? 1 : 0)
        ? profile.heights[idx] * VOXEL_SIZE
        : 0;
    return (c.depth ? c.waterLevel + 0.25 : c.elevation + 0.025) + offset;
  }
  const progress = clip(s.direction < 0 ? 1 - fraction : fraction, 0, 1);
  return s.startHeight + (s.endHeight - s.startHeight) * progress + liftProgress(state, s) * LIFT_TRAVEL;
}
export interface WaterService {
  freshwater: number;
  potable: number;
  irrigation: number;
  stored: number;
}
export interface ConduitFlow {
  flow: number;
  head: number;
  ports: number;
  spill: boolean;
  inlet?: number;
  upstream?: number;
  deliveries?: number;
  waterOutlets?: number;
  target?: string;
  source?: string;
}
type Hydro = {
  runs: Map<string, ConduitFlow>;
  services: Map<string, WaterService>;
  channels: Map<string, number>;
  channelDelivery: number;
};
const hydraulicCache = new WeakMap<GameState, { key: string; value: Hydro }>();
const pumpPowered = (s: GameState) =>
  s.mode === "god" || (s.metrics.powerSupply > 0 && s.metrics.powerSupply >= s.metrics.powerDemand);
export function hydraulics(state: GameState): Hydro {
  const i = state.infrastructure,
    weather = state.weather;
  const key =
    (i?.revision ?? 0) +
    "|" +
    weather +
    "|" +
    pumpPowered(state) +
    "|" +
    Object.entries(i?.storage ?? {})
      .map(([k, v]) => k + ":" + Math.floor(v))
      .join(";") +
    "|" +
    state.elements
      .map((e) =>
        [e.id, e.defId, e.gx, e.gz, e.level, e.spanX, e.spanZ, e.onFire ? 1 : 0, e.disrepair ? 1 : 0].join("/"),
      )
      .join(";");
  const cached = hydraulicCache.get(state);
  if (cached?.key === key) return cached.value;
  const occ = occupiedMap(state),
    ducts = i?.conduits ?? {},
    runs = new Map<string, ConduitFlow>(),
    services = new Map<string, WaterService>();
  const queue: string[] = [];
  for (const [k, c] of Object.entries(ducts)) {
    const [x, z] = k.split(",").map(Number);
    let ports = 0,
      head = -Infinity,
      flow = 0,
      inlet: number | undefined,
      source: string | undefined;
    for (const [dx, dz] of [[0, 0], ...DIRECTIONS]) {
      const a = x + dx,
        b = z + dz,
        nk = tileKey(a, b),
        base = getTerrainCell(state, a, b),
        el = occ.get(nk);
      const d = DIRECTIONS.findIndex(([tx, tz]) => dx === tx && dz === tz);
      if (d >= 0 && ducts[nk]) ports |= 1 << d;
      const runoff =
        base.form === "bank" && (base.material === "rock" || base.material === "snow") && base.elevation >= 2.8;
      let available = runoff ? Math.min(16, 1 + base.elevation * 0.9) : base.water !== "salt" ? base.source : 0,
        pressure = runoff ? base.elevation + 0.15 : base.waterLevel + 7,
        provider = "spring:" + nk;
      if (el && sourceIds.has(el.defId) && !el.onFire) {
        let supplied = true;
        if (el.defId === "municipal_reservoir") supplied = (i?.storage[el.id] ?? 0) > 0;
        if (el.defId === "water_pumping_station" || el.defId === "desalination_plant") {
          const wantsSalt = el.defId === "desalination_plant";
          supplied =
            pumpPowered(state) &&
            DIRECTIONS.some(([u, v]) => {
              const sample = getTerrainCell(state, a + u, b + v);
              return sample.depth > 0 && (wantsSalt ? sample.water === "salt" : sample.water !== "salt");
            });
        }
        if (supplied) {
          available = Math.max(
            available,
            el.defId === "municipal_reservoir" ? Math.min(12 * el.level, i?.storage[el.id] ?? 0) : 12 * el.level,
          );
          pressure = base.elevation + (i?.facilities?.[el.id]?.pressure ?? sourcePressure(el.defId));
          provider = el.id;
        }
      }
      if (available > 0 && pressure >= c.height && (source === undefined || pressure > head)) {
        flow = available;
        source = provider;
        inlet = d;
        head = pressure;
      }
    }
    runs.set(k, { flow, head, ports, spill: false, source, inlet });
    if (flow) queue.push(k);
  }
  // A finite source is allocated once across its reachable outlets; circular runs never add capacity.
  for (let n = 0; n < queue.length; n++) {
    const k = queue[n],
      [x, z] = k.split(",").map(Number),
      r = runs.get(k)!;
    for (const [dx, dz] of DIRECTIONS) {
      const nk = tileKey(x + dx, z + dz),
        dest = runs.get(nk);
      if (!dest || r.head <= dest.head || r.head < ducts[nk].height || ducts[k].outlet === "cap") continue;
      dest.flow = r.flow;
      dest.head = r.head;
      dest.source = r.source;
      dest.inlet = undefined;
      dest.upstream = DIRECTIONS.findIndex(([a, b]) => a === -dx && b === -dz);
      queue.push(nk);
    }
  }
  const users = new Map<string, Set<string>>(),
    sourceCapacity = new Map<string, number>();
  const receivingBasins = new Map<string, { source: string; flow: number }>();
  for (const [k, r] of runs) {
    if (!r.source) continue;
    sourceCapacity.set(r.source, Math.max(sourceCapacity.get(r.source) ?? 0, r.flow));
    const [x, z] = k.split(",").map(Number);
    const count = DIRECTIONS.filter(([dx, dz]) => ducts[tileKey(x + dx, z + dz)]).length;
    const linked = new Set<string>();
    const dir = ["north", "east", "south", "west"].indexOf(ducts[k].outlet);
    if (ducts[k].outlet !== "cap")
      for (const [dx, dz] of dir >= 0 ? [DIRECTIONS[dir]] : [[0, 0], ...DIRECTIONS]) {
        const nk = tileKey(x + dx, z + dz),
          el = occ.get(nk),
          def = el && ELEMENT_BY_ID[el.defId];
        const receiving = getTerrainCell(state, x + dx, z + dz),
          side = DIRECTIONS.findIndex(([a, b]) => a === dx && b === dz);
        if (
          side >= 0 &&
          receiving.depth > 0.15 &&
          !ducts[nk] &&
          r.inlet !== side &&
          (dir >= 0 || (count <= 1 && r.inlet === undefined))
        ) {
          r.waterOutlets = (r.waterOutlets ?? 0) | (1 << side);
          linked.add("basin:" + nk);
          if (receiving.water === "fresh" && (receivingBasins.get(nk)?.flow ?? 0) < r.flow)
            receivingBasins.set(nk, { source: r.source, flow: r.flow });
        }
        if (
          el &&
          el.id !== r.source &&
          def &&
          !def.isNetwork &&
          !def.passiveNature &&
          (receiverIds.has(def.id) || def.category === "agriculture" || def.category === "housing")
        ) {
          linked.add(el.id);
          const side = DIRECTIONS.findIndex(([a, b]) => a === dx && b === dz);
          if (side >= 0) r.deliveries = (r.deliveries ?? 0) | (1 << side);
        }
      }
    const set = users.get(r.source) ?? new Set<string>();
    for (const id of linked) set.add(id);
    if (linked.size) r.target = [...linked][0];
    else if ((dir >= 0 || (count <= 1 && r.inlet === undefined)) && ducts[k].outlet !== "cap") {
      r.spill = true;
      set.add("spill:" + k);
    }
    users.set(r.source, set);
  }
  const channels = new Map<string, number>(),
    seenWater = new Set<string>();
  const bankUsers = new Map<string, Set<string>>();
  for (const [start, first] of Object.entries(i?.cells ?? {})) {
    if (seenWater.has(start) || first.water !== "fresh" || !first.depth || first.gate === "closed") continue;
    const queue = [start],
      recipients = new Set<string>();
    let capacity = 0,
      source = "";
    seenWater.add(start);
    for (let j = 0; j < queue.length; j++) {
      const k = queue[j],
        c = i!.cells[k],
        [x, z] = k.split(",").map(Number);
      if (c.source > capacity) {
        capacity = c.source;
        source = "spring:" + k;
      }
      const fed = receivingBasins.get(k);
      if (fed && fed.flow > capacity) {
        capacity = fed.flow;
        source = fed.source;
      }
      for (const [dx, dz] of [[0, 0], ...DIRECTIONS]) {
        const nx = x + dx,
          nz = z + dz,
          nk = tileKey(nx, nz),
          neighbor = i!.cells[nk],
          el = occ.get(nk),
          def = el && ELEMENT_BY_ID[el.defId];
        if (
          !seenWater.has(nk) &&
          neighbor?.water === "fresh" &&
          neighbor.depth &&
          neighbor.gate !== "closed" &&
          (Math.abs(neighbor.waterLevel - c.waterLevel) <= 0.72 ||
            neighbor.gateKind === "lock" ||
            c.gateKind === "lock")
        ) {
          queue.push(nk);
          seenWater.add(nk);
        }
        if (!el || !def || el.onFire) continue;
        if (
          el.defId === "water_pumping_station" &&
          !el.disrepair &&
          (state.mode === "god" ||
            (state.metrics.powerSupply > 0 && state.metrics.powerSupply >= state.metrics.powerDemand)) &&
          12 * el.level > capacity
        ) {
          capacity = 12 * el.level;
          source = el.id;
        }
        if (
          def.category === "agriculture" ||
          ["terraced_glasshouses", "solar_canopy_orchard", "water_treatment_plant", "municipal_reservoir"].includes(
            el.defId,
          )
        )
          recipients.add(el.id);
      }
    }
    if (!capacity) continue;
    for (const k of queue) channels.set(k, capacity);
    const all = users.get(source) ?? new Set(),
      banks = bankUsers.get(source) ?? new Set();
    if (recipients.size) for (const k of queue) all.delete("basin:" + k);
    for (const id of recipients) {
      all.add(id);
      banks.add(id);
    }
    users.set(source, all);
    bankUsers.set(source, banks);
    sourceCapacity.set(source, Math.max(sourceCapacity.get(source) ?? 0, capacity));
  }
  let channelDelivery = 0;
  for (const [source, targets] of users) {
    const treated = [...targets].some((id) =>
      state.elements.some((el) => el.id === id && el.defId === "water_treatment_plant" && !el.onFire),
    );
    const available = (sourceCapacity.get(source) ?? 0) * (weather === "rain" || weather === "storm" ? 1.18 : 1),
      share = available / Math.max(1, targets.size);
    for (const id of targets) {
      if (id.startsWith("spill:") || id.startsWith("basin:")) continue;
      const el = state.elements.find((e) => e.id === id);
      if (!el) continue;
      const service = services.get(id) ?? { freshwater: 0, potable: 0, irrigation: 0, stored: i?.storage[id] ?? 0 };
      service.freshwater += share;
      service.irrigation += share;
      const clean =
        treated ||
        el.defId === "water_treatment_plant" ||
        state.elements.some((e) => e.id === source && ["wells", "desalination_plant"].includes(e.defId));
      if (clean) service.potable += share;
      else if (bankUsers.get(source)?.has(id)) channelDelivery += share;
      services.set(id, service);
    }
  }
  const value = { runs, services, channels, channelDelivery };
  hydraulicCache.set(state, { key, value });
  return value;
}
export function readWaterService(state: GameState, e: PlacedElement): WaterService {
  return (
    hydraulics(state).services.get(e.id) ?? {
      freshwater: 0,
      potable: 0,
      irrigation: 0,
      stored: state.infrastructure?.storage[e.id] ?? 0,
    }
  );
}
export function advanceReservoirs(state: GameState, dt: number) {
  if (!state.infrastructure || dt <= 0) return;
  for (const e of state.elements)
    if (e.defId === "municipal_reservoir" || e.defId === "water_towers") {
      const held = state.mode === "god" ? state.infrastructure.facilities?.[e.id]?.heldStorage : undefined;
      if (held !== undefined) {
        state.infrastructure.storage[e.id] = held;
        continue;
      }
      const service = readWaterService(state, e),
        current = state.infrastructure.storage[e.id] ?? 0;
      state.infrastructure.storage[e.id] = clip(current + dt * (service.freshwater * 0.025 - 0.035), 0, 100 * e.level);
    }
}
export function applyLandformPlacement(state: GameState, e: PlacedElement) {
  const kinds: Record<string, InfrastructureTool["kind"]> = {
    beaches: "paint",
    deserts: "paint",
    mountains: "mountain",
    hills: "raise",
    canyons: "canyon",
    rivers: "river",
    wide_rivers: "river",
    lakes: "pond",
    ponds: "pond",
    canals: "canal",
    water_tile: "pond",
    swamps: "pond",
  };
  const kind = kinds[e.defId];
  if (!kind) return;
  e.sculptsTerrain = true;
  const i = ensureInfrastructure(state),
    before = new Map<string, Change>();
  for (let x = e.gx; x < e.gx + e.spanX; x++)
    for (let z = e.gz; z < e.gz + e.spanZ; z++) {
      const k = tileKey(x, z);
      const tool: InfrastructureTool = {
        kind,
        material: e.defId === "swamps" ? "wetland" : "sand",
        height: 0.8 * e.level,
        depth: e.defId === "wide_rivers" ? 2.8 : e.defId === "lakes" ? 2.2 : 1.1,
      };
      before.set(k, capture(i, k));
      i.cells[k] = editedCell(state, { gx: x, gz: z }, tool);
    }
  accountCoastalWater(state, before);
  changed(i);
}

function damBanks(state: GameState, x: number, z: number): boolean {
  return [
    [0, 1],
    [1, 0],
  ].some(
    ([dx, dz]) =>
      [-1, 1].every((sign) => {
        for (let r = 1; r <= 3; r++)
          if (getTerrainCell(state, x + dx * r * sign, z + dz * r * sign).depth <= 0.1) return true;
        return false;
      }) &&
      [-1, 1].some((sign) =>
        [1, 0].some((dx) => getTerrainCell(state, x + sign * dx, z + sign * (1 - dx)).depth > 0.05),
      ),
  );
}
export function hydroHead(state: GameState, e: Pick<PlacedElement, "gx" | "gz" | "spanX" | "spanZ">): number {
  let top = -Infinity,
    bottom = Infinity,
    gates = 0,
    flow = false,
    banks = false;
  for (let x = e.gx - 1; x <= e.gx + e.spanX; x++)
    for (let z = e.gz - 1; z <= e.gz + e.spanZ; z++) {
      const c = getTerrainCell(state, x, z);
      if (c.depth <= 0.1 || c.water !== "fresh" || !["river", "canal", "spring"].includes(c.form ?? "")) continue;
      top = Math.max(top, c.waterLevel);
      bottom = Math.min(bottom, c.waterLevel);
      if (c.gateKind === "dam" && c.gate === "closed") {
        const [dx, dz] = DIRECTIONS[c.flowDir ?? 2];
        const upstream = getTerrainCell(state, x - dx, z - dz),
          downstream = getTerrainCell(state, x + dx, z + dz);
        if (upstream.depth && downstream.depth) gates = Math.max(gates, upstream.waterLevel - downstream.waterLevel);
      }
      flow ||= c.source > 0 || (c.form === "canal" && Boolean(hydraulics(state).channels.get(tileKey(x, z))));
      banks ||= damBanks(state, x, z);
    }
  return flow && banks ? Math.max(gates, top - bottom) : 0;
}
export function freshWaterFactor(state: GameState, e: PlacedElement): number {
  const d = ELEMENT_BY_ID[e.defId];
  if (!state.infrastructure || !d) return 1;
  const service = readWaterService(state, e);
  if (d.id === "water_places") return 0;
  if (d.id === "aqueduct") return service.freshwater > 0 ? 1 : 0;
  // Without a river the treatment plant still pumps groundwater, at half output.
  if (d.id === "water_treatment_plant") return service.freshwater > 0 ? 1 : 0.5;
  if (d.id === "water_towers" || d.id === "municipal_reservoir")
    return service.freshwater > 0 || service.stored > 0 ? 1 : 0;
  if (d.id === "desalination_plant" || d.id === "water_pumping_station") {
    for (let x = e.gx - 1; x <= e.gx + e.spanX; x++)
      for (let z = e.gz - 1; z <= e.gz + e.spanZ; z++) {
        const c = getTerrainCell(state, x, z);
        if (c.depth > 0.1 && (d.id === "desalination_plant" ? c.water === "salt" : c.water === "fresh"))
          return pumpPowered(state) ? 1 : 0;
      }
    return 0;
  }
  if (d.isWaterFeature) {
    const c = getTerrainCell(state, e.gx, e.gz);
    return c.water === "fresh" && c.source > 0 ? 1 : 0;
  }
  return 1;
}
export function streetLaneFactor(state: GameState, e: PlacedElement): number {
  const control = state.infrastructure?.streets[tileKey(e.gx, e.gz)];
  if (!control) return 1;
  const defaultLanes = standardRoadLanes(e.defId,e.level);
  return Math.max(0.25, control.lanes / defaultLanes);
}

export { changed as markInfrastructureChanged };
