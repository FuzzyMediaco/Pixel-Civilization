import { withinMap } from "./mapBounds";
import type { GameState, PlacedElement } from "./simulation";
import { SEA, elevationFromMargin, getTerrainCell, islandMargin, tileKey } from "./terrain";
import { TILE_SIZE } from "./voxelCore";
import { VOXEL_PITCH, VOXELS_PER_TILE, sampleTerrainAt, sampleVoxelColumn, voxelToTileLocal, type VoxelColumnEdit } from "./voxelTerrain";

type BeachWorld = Pick<GameState, "terrainVersion" | "infrastructure" | "elements">;
type Site = Pick<PlacedElement, "defId" | "gx" | "gz" | "spanX" | "spanZ">;

export const isBeachParcel = (id: string) => id === "beaches" || id === "sand" || id === "beach_umbrellas";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const smooth = (t: number) => t * t * (3 - 2 * t);
const backReach = 20;
const toe = 4.5;

// Locate the bank outside the site. On the natural islands the continuous margin gives
// a stable bearing even when the adjacent beach has already extended the shoreline.
function beachAspect(state: BeachWorld, x: number, z: number, half: number, rotation: number) {
  const version = state.terrainVersion;
  const margin = islandMargin(x, z, version);
  rotation = ((rotation % 4) + 4) % 4;
  let nx = [0, 1, 0, -1][rotation], nz = [1, 0, -1, 0][rotation];
  let bank = 0;
  const naturalBelt = Math.abs(margin + 2) < backReach + half;
  let reshaped = false;
  if (naturalBelt && state.infrastructure) {
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, wx = x + Math.sin(a) * (half + 4), wz = z + Math.cos(a) * (half + 4);
      const s = sampleTerrainAt(state, wx, wz);
      if (s.source === "natural" || s.beach || (s.material === "sand" && (s.form === "bay" || s.form === "bank"))) continue;
      if ((s.water === "dry") !== (elevationFromMargin(islandMargin(wx, wz, version)) >= SEA)) { reshaped = true; break; }
    }
  }
  if (naturalBelt && !reshaped) {
    const dx = islandMargin(x - 1, z, version) - islandMargin(x + 1, z, version);
    const dz = islandMargin(x, z - 1, version) - islandMargin(x, z + 1, version);
    const len = Math.hypot(dx, dz);
    if (len > 0.001) { nx = dx / len; nz = dz / len; }
    for (let d = 0; d <= backReach; d += 1) {
      if (islandMargin(x - nx * d, z - nz * d, version) > 1) { bank = d; break; }
    }
    return { nx, nz, bank, coastal: true, natural: true };
  }

  // Engineered coasts can be well outside the original tidal belt.
  let best = -Infinity;
  let coastal = false;
  for (let dir = 0; dir < 8; dir++) {
    const a = dir * Math.PI / 4, dx = Math.sin(a), dz = Math.cos(a);
    const sea = sampleTerrainAt(state, x + dx * (half + 4), z + dz * (half + 4));
    if (sea.water !== "salt") continue;
    for (let d = 0; d <= backReach; d += 2) {
      const land = sampleTerrainAt(state, x - dx * d, z - dz * d);
      if (land.water !== "dry" || land.elevation < SEA + 0.15 || land.beach) continue;
      coastal = true;
      const score = Math.min(sea.depth, 3) - 0.14 * d;
      if (score > best) { best = score; nx = dx; nz = dz; bank = d; }
      break;
    }
  }
  return { nx, nz, bank, coastal, natural: false };
}

/** A world-space sand deposit with a rounded toe, tied back to the nearby bank.
 * Deposits combine by maximum elevation, so overlapping beaches share the same ground
 * across rotations, levels and art variants. No parcel owns a strip of ocean. */
export function planBeachGround(state: BeachWorld, site: Site, rotation: number, preserveEdits = false,
  paintedBeds?: ReadonlyMap<string, number>) {
  const { gx, gz, spanX, spanZ } = site;
  const hx = spanX * TILE_SIZE / 2, hz = spanZ * TILE_SIZE / 2;
  const cx = gx * TILE_SIZE + hx, cz = gz * TILE_SIZE + hz;
  const { nx, nz, bank, coastal, natural } = beachAspect(state, cx, cz, Math.max(hx, hz), rotation);
  if (site.defId !== "beaches" && !coastal) return null;

  const halfWidth = Math.abs(nz) * hx + Math.abs(nx) * hz;
  const halfDepth = Math.abs(nx) * hx + Math.abs(nz) * hz;
  const marginAtCenter = islandMargin(cx, cz, state.terrainVersion);
  const waterlineMargin = -1.88; // Midpoint of the last dry and first submerged natural terraces.
  const centerDistance = marginAtCenter - waterlineMargin;
  const front = site.defId === "beaches" ? halfDepth * 0.69 + 0.35 : halfDepth + 1.2;
  const extension = Math.max(0, front - centerDistance);
  const width = natural ? halfWidth + Math.max(5.5, extension * 1.25) : halfWidth + 2.5;
  let back = Math.max(halfDepth + 3.5, bank + 3.6);
  for (const e of state.elements) {
    if (e.defId !== "boardwalks") continue;
    const x = (e.gx + e.spanX / 2) * TILE_SIZE - cx, z = (e.gz + e.spanZ / 2) * TILE_SIZE - cz;
    const inland = -(x * nx + z * nz);
    if (inland > 0 && inland <= backReach && Math.abs(x * nz - z * nx) <= halfWidth + 2)
      back = Math.max(back, inland + 2.6);
  }
  const radius = Math.min(width, (back + front) / 2) * 0.79;
  const shift = (front - back) / 2, length = (front + back) / 2;
  const bx = cx + nx * shift, bz = cz + nz * shift;
  const ex = Math.abs(nz) * width + Math.abs(nx) * length + toe + 1;
  const ez = Math.abs(nx) * width + Math.abs(nz) * length + toe + 1;
  const edits = new Map<string, VoxelColumnEdit>();
  const touchedTiles = new Set<string>();
  // Do not extend an apron into a neighboring building, pier, shipping berth or a waterwork.
  const occupied = new Set<string>();
  for (const e of state.elements) {
    if (isBeachParcel(e.defId) || e.defId === "boardwalks" || e.defId === "beach_houses") continue;
    if ((e.gx + e.spanX) * TILE_SIZE < bx - ex || e.gx * TILE_SIZE > bx + ex ||
        (e.gz + e.spanZ) * TILE_SIZE < bz - ez || e.gz * TILE_SIZE > bz + ez) continue;
    for (let tz = e.gz; tz < e.gz + e.spanZ; tz++)
      for (let tx = e.gx; tx < e.gx + e.spanX; tx++) occupied.add(tileKey(tx, tz));
  }
  for (let vz = Math.floor((bz - ez) / VOXEL_PITCH); vz <= Math.ceil((bz + ez) / VOXEL_PITCH); vz++) {
    const z = (vz + 0.5) * VOXEL_PITCH;
    for (let vx = Math.floor((bx - ex) / VOXEL_PITCH); vx <= Math.ceil((bx + ex) / VOXEL_PITCH); vx++) {
      const x = (vx + 0.5) * VOXEL_PITCH;
      const across = (x - cx) * nz - (z - cz) * nx, along = (x - cx) * nx + (z - cz) * nz;
      const detail = 0.32 * Math.sin(x * 0.25 + z * 0.13) + 0.21 * Math.cos(x * 0.11 - z * 0.26);
      let d: number, strength = 1, nativeY = SEA - 2.1;
      if (natural) {
        // Widen the island's own curved waterline. The taper runs several metres
        // past a plot's ends, carrying the shore gradually between staggered rows.
        const shoulder = smooth(clamp((width - Math.abs(across)) / (width - halfWidth * 0.66), 0, 1));
        strength = shoulder * smooth(clamp((along + back + detail) / 2.8, 0, 1));
        if (strength < 0.015 || along > front + toe + 2) continue;
        const margin = islandMargin(x, z, state.terrainVersion);
        d = margin - waterlineMargin + strength * (extension + detail);
        nativeY = elevationFromMargin(margin);
      } else {
        const u = Math.abs(across) - width + radius;
        const v = Math.abs(along - shift) - length + radius;
        d = radius - Math.hypot(Math.max(0, u), Math.max(0, v)) - Math.min(0, Math.max(u, v)) + detail;
      }
      if (d <= -toe) continue;
      const loc = voxelToTileLocal(vx, vz);
      if (!withinMap(loc.gx, loc.gz)) continue;
      const key = tileKey(loc.gx, loc.gz);
      if (occupied.has(key) || state.infrastructure?.spans?.[key] || state.infrastructure?.conduits?.[key]) continue;
      const cur = sampleVoxelColumn(state, vx, vz, "deposit");
      if (cur.water === "fresh" || (cur.form && cur.form !== "bank" && cur.form !== "bay")) continue;
      if (preserveEdits && cur.source !== "natural" && !cur.beach) {
        // The first deposit in a coarse tile expands its untouched bed into ordinary
        // columns. Neighbors may still cover those same original heights in this pass.
        if (paintedBeds?.get(key) !== cur.elevation || cur.material !== "sand" || cur.form) continue;
      }
      const dryCap = 0.035 + 0.045 * Math.sin(x * 0.22 - z * 0.14);
      const grade = Math.min(dryCap, SEA + d * 0.19);
      // At the submerged toe blend with a fixed seabed baseline. Never raise a second
      // time when a neighbor overlaps the same column or a beach is loaded again.
      const weight = smooth(clamp((d + toe) / 2.5, 0, 1));
      const base = Math.min(grade, nativeY);
      const y = Math.max(cur.elevation, Math.round((base + (grade - base) * weight * strength) * 100) / 100);
      const paint = d >= -0.35 && strength > 0.15 && cur.elevation <= 0.55;
      if (y <= cur.elevation && (!paint || (cur.material === "sand" && cur.beach))) continue;
      const salt = y < SEA - 0.01;
      const col = { y, m: "sand" as const, w: salt ? "salt" as const : "dry" as const,
        ...(salt ? {wl: SEA} : {}), wet: y <= SEA + 0.30, form: salt ? "bay" as const : "bank" as const, beach: true as const };
      edits.set(vx + "," + vz, { vx, vz, gx: loc.gx, gz: loc.gz, idx: loc.idx, tileKey: key, col });
      touchedTiles.add(key);
    }
  }
  const autoRotation = coastal ? (Math.round(Math.atan2(nx, nz) / (Math.PI / 2)) + 4) % 4 : rotation;
  return { edits, touchedTiles, autoRotation };
}

/** Early beach builds painted an entire 4 m cell. The saved sand and tide can be
 * virtually identical to the native tile even when the water crosses the individual
 * columns. Hand-sculpted ground, freshwater and hydraulic structures stay authoritative. */
export function legacyPaintedBeachBeds(state: BeachWorld, sites: PlacedElement[]) {
  const beds = new Map<string, number>();
  const infra = state.infrastructure;
  if (!infra) return beds;
  const natural = { terrainVersion: state.terrainVersion };
  for (const e of sites) {
    if (e.defId !== "beaches" || !e.sculptsTerrain) continue;
    for (let z = e.gz; z < e.gz + e.spanZ; z++) for (let x = e.gx; x < e.gx + e.spanX; x++) {
      const key = tileKey(x, z), cell = infra.cells[key];
      if (!cell || infra.voxels?.[key] || cell.material !== "sand" || cell.form || cell.excavated ||
        cell.gate || cell.gateKind || cell.gateHead != null || cell.freeLevel != null ||
        cell.flowDir != null || cell.source !== 0 || cell.water === "fresh" ||
        infra.spans?.[key] || infra.conduits?.[key]) continue;
      const original = getTerrainCell(natural, x, z);
      // Tile-scale smoothing in old saves could shift the painted bed by a few
      // centimetres. Use its recorded height as the floor wherever sand is added.
      if (cell.water === original.water && cell.waterLevel === SEA &&
        Math.abs(cell.elevation - original.elevation) <= 0.051) beds.set(key, cell.elevation);
    }
  }
  return beds;
}

/** Locate old beach stamps by their original height equation. Matching the sand/bank
 * label alone would also select terrain the player sculpted after placing the beach. */
export function legacyBeachColumns(state: BeachWorld, sites: PlacedElement[]) {
  const recognized = new Set<string>();
  const prior = new Map<string, number>();
  if (!state.infrastructure?.voxels) return recognized;
  for (const e of sites) {
    if (e.defId !== "beaches" || !e.sculptsTerrain) continue;
    const x0 = e.gx * VOXELS_PER_TILE, z0 = e.gz * VOXELS_PER_TILE;
    const w = e.spanX * VOXELS_PER_TILE, h = e.spanZ * VOXELS_PER_TILE;
    for (let z = -4; z < h + 4; z++) for (let x = -4; x < w + 4; x++) {
      const vx = x0 + x, vz = z0 + z, { gx, gz, idx } = voxelToTileLocal(vx, vz);
      const col = state.infrastructure.voxels[tileKey(gx, gz)]?.cols[idx];
      if (!col || (col.m !== "sand" && col.m !== "grass") || col.w === "fresh" ||
        (col.form !== "bank" && col.form !== "bay")) continue;
      const key = vx + "," + vz;
      const u = clamp((x + 0.5) / w, 0, 1), v = clamp((z + 0.5) / h, 0, 1);
      const across = [u, 1-v, 1-u, v][e.rotation], along = [v, u, 1-v, 1-u][e.rotation];
      const line = 0.62 + 0.08 * Math.sin(across * 2 * Math.PI + e.variant * 1.4);
      const noise = (Math.sin(vx * 0.28 + vz * 0.17 + e.variant * 1.3) + Math.cos(vx * 0.14 - vz * 0.31 + e.variant * 0.7)) / 2;
      let y = along < line - 0.14 ? 0.25 - 0.45 * along / (line - 0.14) + 0.04 * noise
        : along < line + 0.04 ? -0.2 - 0.42 * (along - line + 0.14) / 0.18
        : SEA - 0.06 - 0.58 * (along - line - 0.04) / (1 - line - 0.04);
      const outside = Math.hypot(Math.max(0, -x, x - w + 1), Math.max(0, -z, z - h + 1));
      if (outside > 4) continue;
      if (outside) {
        const native = elevationFromMargin(islandMargin((vx + 0.5) * VOXEL_PITCH, (vz + 0.5) * VOXEL_PITCH, state.terrainVersion));
        const below = prior.get(key) ?? native; // Old adjacent stamps blended into one another in placement order.
        y = below + (y - below) * (0.5 + 0.5 * Math.cos(Math.PI * outside / 4.5));
      }
      y = Math.round(y * 100) / 100;
      prior.set(key, y);
      if (col.y === y && (col.m === "sand" || outside > 2.6)) recognized.add(key);
    }
  }
  return recognized;
}
