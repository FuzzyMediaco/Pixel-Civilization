import type { GameState, PlacedElement } from "./simulation";
import type { Crossing, SpanShape } from "./terrain";
export type RailBridgeKind = "timber" | "viaduct" | "steel" | "elevated" | "highlevel";
export const RAIL_BRIDGES: Record<RailBridgeKind, string> = {
  timber: "Timber trestle",
  viaduct: "Stone railway viaduct",
  steel: "Riveted railway truss",
  elevated: "Modern elevated railway",
  highlevel: "High-level cable-stayed crossing",
};
export const railShape: Record<RailBridgeKind, SpanShape> = {
  timber: "truss",
  viaduct: "arch",
  steel: "truss",
  elevated: "beam",
  highlevel: "suspension",
};
export const railClearHeight: Record<RailBridgeKind, number> = {
  timber: 1,
  viaduct: 1.5,
  steel: 2,
  elevated: 2.5,
  highlevel: 3.5,
};
export function railSpanAllows(state: GameState | undefined, gx: number, gz: number, dx: number, dz: number): boolean {
  if (Math.abs(dx) + Math.abs(dz) !== 1) return false;
  for (const [x, z] of [
    [gx, gz],
    [gx + dx, gz + dz],
  ]) {
    const s = state?.infrastructure?.spans[x + "," + z];
    if (s && (s.mode !== "rail" || (s.axis === "x") !== Boolean(dx))) return false;
  }
  return true;
}
export function bridgeTier(span: Crossing | undefined) {
  return Math.max(1, Math.min(11, span?.tier ?? 1));
}
export function bridgeFamily(span: Crossing) {
  if (span.mode === "rail") return RAIL_BRIDGES[span.railType ?? (span.shape === "arch" ? "viaduct" : "steel")];
  return {
    truss: "Steel truss",
    arch: "Stone arch",
    lift: "Vertical lift",
    suspension: "Suspension",
    beam: "Concrete viaduct",
  }[span.shape];
}
export function crossingPieces(state: GameState, element: Pick<PlacedElement, "gx" | "gz">) {
  const key = element.gx + "," + element.gz,
    span = state.infrastructure?.spans[key];
  if (!span || span.run.startsWith("junction-")) return [];
  return Object.entries(state.infrastructure!.spans).filter(([, s]) => s.run === span.run);
}
export function crossingUpgradePrice(span: Crossing, tiles: number) {
  return Math.ceil((35 + tiles * (span.mode === "rail" ? 22 : 17)) * (1 + 0.34 * bridgeTier(span)));
}

export function bridgeLandmark(span: Crossing, length: number) {
  const tier = bridgeTier(span);
  if (span.mode === "rail" || span.shape === "lift" || length < 4 || tier < 4) return bridgeFamily(span);
  if (span.shape === "arch") return tier >= 8 ? "Twin-towered stone crossing" : "Fortified stone viaduct";
  if (span.shape === "suspension") return tier >= 8 ? "Vermilion suspension landmark" : "Harbor suspension span";
  if (span.shape === "truss") return tier >= 8 ? "Blue lattice suspension hybrid" : "Harbor through-truss";
  return tier >= 8 ? "Cable-stayed motorway" : "Elevated concrete flyover";
}
type Part = (u: number, y: number, v: number, du: number, dy: number, dv: number, color: number) => void;
/** The bridge grammar describes one continuous structure in its longitudinal frame. */
export function bridgeDetails(
  s: Crossing,
  coord: number,
  lo: number,
  hi: number,
  width: number,
  bed: number,
  part: Part,
  cable: (u: number, a: number, v: number, b: number, h: number, thick: number, col: number) => void,
) {
  const l = bridgeTier(s),
    rail = s.mode === "rail",
    k = s.railType,
    length = hi - lo + 1,
    n = coord - lo;
  const tower =
    n === Math.min(1, Math.floor((length - 1) / 3)) || n === length - 1 - Math.min(1, Math.floor((length - 1) / 3));
  const side = width / 2 - 0.12,
    y = s.deck;
  if (s.end) return;
  for (const sign of [-1, 1]) {
    const b = sign * side;
    if (l >= 2) part(-2, y - 0.19, b - 0.12, 4, 0.18, 0.23, rail ? 0x45505a : 0xd9bd87);
    if (l >= 3)
      for (const pos of [-1.65, 0.35]) {
        part(pos, y + 0.28, b - 0.09, 0.16, 0.13, 0.18, 0x7b8486);
        part(pos, y + 0.42, b - 0.08, 0.12, 0.06, 0.15, 0xf7cf76);
      }
    if (rail && k === "timber") {
      for (const u of [-1.5, 1.35]) part(u, bed - 0.12, b - 0.13, 0.24, Math.max(0.2, y - bed), 0.26, 0x68462e);
      part(-2, y - 0.48, b - 0.16, 4, 0.24, 0.32, 0x9d7043);
      for (let j = 0; j < 8; j++)
        part(-1.5 + j * 0.36, bed + 0.1 + ((y - bed - 0.6) * j) / 8, b - 0.07, 0.45, 0.22, 0.14, 0xb38452);
    }
    if (rail && k === "viaduct") {
      for (let j = 0; j < 12; j++) {
        const t = ((j + 0.5) / 12) * 2 - 1;
        const h = 0.28 + (y - bed - 0.55) * (1 - Math.sqrt(Math.max(0, 1 - t * t)));
        part(-2 + j / 3, y - h - 0.15, b - 0.17, 0.35, h, 0.34, j % 3 ? 0xb09a78 : 0xcdb694);
        part(-2 + j / 3, y - h - 0.21, b - 0.22, 0.35, 0.14, 0.44, 0xebd6af);
      }
    }
    if (rail && k === "steel") {
      part(-2, y + 1.64, b - 0.12, 4, 0.17, 0.24, 0x536c77);
      for (const u of [-1.94, -0.02, 1.88]) {
        part(u, y + 0.15, b - 0.15, 0.14, 1.64, 0.29, 0x5d7680);
        part(u - 0.06, y + 1.38, b - 0.18, 0.27, 0.2, 0.36, 0xc68b51);
      }
    }
    if (((rail && k === "elevated") || (!rail && s.shape === "beam")) && n % 2 === 0) {
      part(-0.25, bed - 0.15, -0.29, 0.5, y - bed - 0.66, 0.58, 0xa5a69e);
      for (let j = 0; j < 4; j++)
        part(-0.32, y - 0.96 + j * 0.16, (sign * side * j) / 4 - 0.18, 0.65, 0.25, 0.4, 0xc8c4b0);
      part(-0.39, y - 0.39, -side, 0.78, 0.18, 2 * side, 0xb6b2a4);
    }
    const stayed = (rail && k === "highlevel") || (!rail && s.shape === "beam" && l >= 8 && length >= 4);
    const ornate = length >= 4 && l >= 4 && !rail && s.shape !== "lift";
    const red = s.shape === "suspension",
      stone = s.shape === "arch",
      blue = s.shape === "truss";
    const color = stayed ? 0xd1cfb7 : red ? 0xb64d35 : stone ? 0xb8a07f : blue ? 0x496a81 : 0xd4d5c5;
    const towerHeight = 2.1 + Math.min(12, length) * 0.135 + l * 0.19;
    if ((stayed || ornate) && tower) {
      const thickness = stone ? 0.7 : 0.43;
      part(-0.38, bed - 0.15, b - thickness / 2, 0.76, y + towerHeight - bed, thickness, color);
      for (let h = 1; h < towerHeight; h += 1.1)
        part(-0.48, y + h, b - thickness / 2 - 0.07, 0.96, 0.15, thickness + 0.14, stone ? 0xe2cda6 : 0xabad9c);
      if (stone) {
        part(-0.52, y + towerHeight - 0.22, b - 0.48, 1.04, 0.34, 0.96, 0xd3bd98);
        part(-0.44, y + towerHeight + 0.12, b - 0.39, 0.88, 0.33, 0.78, 0x647b80);
        part(-0.26, y + towerHeight + 0.45, b - 0.23, 0.52, 0.32, 0.46, 0x435e67);
      }
      if (sign < 0) {
        part(-0.32, y + towerHeight - 0.7, -side, 0.65, 0.29, side * 2, stone ? 0xaf9273 : color);
        if (l >= 6) part(-0.27, y + towerHeight - 0.08, -side, 0.54, 0.21, side * 2, color);
      }
    }
    if (stayed || (ornate && (!stone || l >= 9))) {
      const ti = Math.min(1, Math.floor((length - 1) / 3)),
        towerCenters = [ti + 0.5, length - ti - 0.5];
      const distance = (u: number) => {
        const nearest = towerCenters.reduce((a, b) => (Math.abs(a - u) <= Math.abs(b - u) ? a : b));
        const reach =
          u < towerCenters[0] || u > towerCenters[1]
            ? Math.max(0.5, ti + 0.5)
            : Math.max(0.5, (length - 2 * ti - 1) / 2);
        return Math.min(1, Math.abs(u - nearest) / reach);
      };
      for (let j = 0; j < 12; j++) {
        const d = distance(n + j / 12),
          e = distance(n + (j + 1) / 12),
          u = -2 + j / 3;
        if (stayed) {
          for (const scale of [0.55, 0.78, 1]) {
            const h = towerHeight * (1 - d / scale),
              end = towerHeight * (1 - e / scale);
            if (Math.max(h, end) > 0.1)
              cable(u, y + Math.max(0.12, h), b, u + 1 / 3, y + Math.max(0.12, end), 0.09, 0xd1d1b7);
          }
        } else {
          const h = 0.65 + (towerHeight - 0.8) * (1 - d) ** 2,
            end = 0.65 + (towerHeight - 0.8) * (1 - e) ** 2;
          cable(u, y + h, b, u + 1 / 3, y + end, 0.105, red ? 0xb9573e : color);
          if (j % 4 === 0) part(u, y + 0.27, b - 0.04, 0.07, Math.max(0.12, h - 0.27), 0.08, 0x828c86);
        }
      }
    }
    if (l >= 5) {
      part(-2, y - 0.44, b - 0.08, 4, 0.11, 0.16, color);
      if (n % 2 === 0) {
        part(-1.2, y + 0.27, b - 0.06, 0.1, 0.42 + l * 0.045, 0.12, color);
        part(-1.24, y + 0.69 + l * 0.045, b - 0.1, 0.18, 0.12, 0.2, 0xffd385);
      }
    }
    if (l >= 7) part(-2, y - 0.56, b - 0.13, 4, 0.12, 0.26, 0x626d72);
    if (l >= 10)
      for (let j = 0; j < 8; j++) part(-2 + j * 0.5, y - 0.53 + (j % 4) * 0.07, b - 0.13, 0.53, 0.13, 0.27, color);
    if (l >= 11) {
      part(-2, y + 0.39, b - 0.04, 4, 0.065, 0.08, 0xffdf9b);
      part(-2, y - 0.68, b - 0.12, 4, 0.13, 0.24, color);
    }
  }
}
