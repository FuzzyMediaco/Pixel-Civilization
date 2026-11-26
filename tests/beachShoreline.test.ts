import assert from "node:assert/strict";
import test from "node:test";
import "../src/game/designs/index";
import { beachSurfMask } from "../src/game/coastline";
import { cellIndex, GRID_SIZE } from "../src/game/mapBounds";
import { ELEMENT_BY_ID } from "../src/game/catalog";
import { rememberBuildingEdit, undoBuildingEdit } from "../src/game/constructionHistory";
import { createInitialGameState, type PlacedElement } from "../src/game/simulation";
import { applyLandformPlacement, ensureInfrastructure, getTerrainCell, SEA } from "../src/game/terrain";
import { restoreBeachGround } from "../src/game/terrainInteraction";
import { buildDesignVoxels } from "../src/game/voxelArchitect";
import { sampleTerrainAt, sampleVoxelColumn, voxelToTileLocal, writeVoxelEditsToState } from "../src/game/voxelTerrain";

const site = (id: string, gx: number, gz: number, rotation: number, variant: number, defId = "beaches"): PlacedElement => ({
  id, defId, gx, gz, spanX: 3, spanZ: 2, level: 5, rotation, variant, placedAt: 0,
  connected: true, hasPoliceCover: false, hasFireCover: false, nuisancePenalty: 0,
  maintTimerSec: 0, disrepair: false, onFire: false, animProgress: 0, animKind: "place",
});
const makeWorld = () => {
  const state = createInitialGameState("god");
  state.elements = [];
  return state;
};

test("staggered legacy parcels grade a single dry-to-wet shore independent of order, art and saved orientation", () => {
  const shore = [site("west", -6, 28, 0, 0), site("middle", -3, 27, 1, 3), site("east", 0, 26, 2, 1)];
  const a = makeWorld(), b = makeWorld();
  a.elements = structuredClone(shore);
  b.elements = structuredClone(shore).reverse().map(e => ({ ...e, rotation: (e.rotation + 1) % 4, variant: (e.variant + 1) % 4 }));
  restoreBeachGround(a);
  restoreBeachGround(b);
  assert.deepEqual(a.elements.map(e => e.rotation), [0, 1, 2]);
  let previous = 0;
  for (let x = -23.875; x < 11.9; x += 0.25) {
    let crossing = 0;
    for (let z = 101.125; z < 134; z += 0.25) {
      const s = sampleTerrainAt(a, x, z);
      assert.equal(s.elevation, sampleTerrainAt(b, x, z).elevation);
      if (!crossing && s.depth > 0.01) crossing = z;
      if (crossing) assert.ok(s.depth > 0.01, "An isolated island or strip of painted ocean remains");
    }
    assert.ok(crossing > 108 && crossing < 125);
    if (previous) assert.ok(Math.abs(crossing - previous) <= 0.75, "The waterline jumps at a parcel seam");
    previous = crossing;
  }
  const saved = JSON.stringify(a);
  assert.ok(saved.length < 140_000, "Save should contain only compact height samples");
  const loaded = JSON.parse(saved);
  restoreBeachGround(loaded);
  assert.equal(JSON.stringify(loaded), saved);
});

test("a backwards stamped beach and its overlap with the next old plot both return to the same coast", () => {
  const state = makeWorld();
  state.elements = [
    site("west", -6, 28, 2, 0), site("middle", -3, 27, 2, 1), site("east", 0, 26, 2, 2),
  ].map(e => ({ ...e, sculptsTerrain: true }));
  const clean = structuredClone(state);
  ensureInfrastructure(state);
  // Samples from the old game: an artificial channel at the overlapping ends, and
  // wrongly dry sand at the seaward end of a plot whose saved front pointed inland.
  const old = [[-52, 445, -0.86], [-51, 444, -0.47], [-83, 478, 0.20], [-87, 478, 0.18]];
  for (const [vx, vz, y] of old) {
    const loc = voxelToTileLocal(vx, vz);
    const tidal = y < SEA - 0.02;
    writeVoxelEditsToState(state, [{ ...loc, vx, vz, tileKey: loc.gx + "," + loc.gz,
      col: { y, m: "sand", form: tidal ? "bay" : "bank", w: tidal ? "salt" : "dry", wl: tidal ? SEA : undefined } }]);
  }
  restoreBeachGround(clean);
  restoreBeachGround(state);
  for (const [vx, vz] of old) {
    assert.deepEqual(sampleVoxelColumn(state, vx, vz), sampleVoxelColumn(clean, vx, vz));
  }
});

test("tile-painted beaches merge across old saltwater cells on a southern coast, including a previous repair", () => {
  for (const grade of [undefined, 1] as const) {
    const state = makeWorld();
    const west = { ...site("west", 27, 77, 0, 2), spanX: 1, spanZ: 1, sculptsTerrain: true, beachGrade: grade };
    const east = { ...west, id: "east", gx: 28 };
    state.elements.push(west, east);
    const infra = ensureInfrastructure(state);
    for (const e of state.elements) {
      const natural = getTerrainCell(state, e.gx, e.gz);
      const elevation = natural.elevation + (e.id === "east" ? 0.05 : 0);
      infra.cells[e.gx + "," + e.gz] = { ...natural, material: "sand", elevation, depth: SEA - elevation };
    }
    assert.equal(sampleTerrainAt(state, 114.125, 309.125).water, "salt");
    restoreBeachGround(state);
    assert.equal(sampleTerrainAt(state, 114.125, 309.125).water, "dry");
    for (let x = 108.125; x < 116; x += 0.25) {
      let wet = false;
      for (let z = 302.125; z < 326; z += 0.25) {
        const depth = sampleTerrainAt(state, x, z).depth;
        if (wet) assert.ok(depth > 0.01, "saved tile splits the beach with an inland pool");
        wet ||= depth > 0.01;
      }
      assert.ok(wet);
    }
    const saved = JSON.stringify(state);
    restoreBeachGround(state);
    assert.equal(JSON.stringify(state), saved);
  }
});

test("repairing a tile-painted beach retains excavated cells and water controls", () => {
  const state = makeWorld(), infra = ensureInfrastructure(state);
  const beach = { ...site("edited", 27, 77, 0, 1), sculptsTerrain: true };
  state.elements.push(beach);
  const key = "27,77", existing = getTerrainCell(state, 27, 77);
  infra.cells[key] = { ...existing, material: "sand", gate: "closed", gateKind: "lock", freeLevel: SEA + 0.1 };
  infra.cells["28,77"] = { ...getTerrainCell(state, 28, 77), material: "sand", elevation: -3, excavated: true };
  const left = sampleTerrainAt(state, 109, 309), right = sampleTerrainAt(state, 113, 309);
  restoreBeachGround(state);
  assert.deepEqual(sampleTerrainAt(state, 109, 309), left);
  assert.deepEqual(sampleTerrainAt(state, 113, 309), right);
  assert.equal(infra.cells[key].gate, "closed");
});

test("an isolated offshore beach has a rounded tidal edge and an inland beach remains dry", () => {
  const state = makeWorld();
  const inland = site("inland", 0, 0, 0, 3);
  state.elements.push(inland);
  applyLandformPlacement(state, inland);
  assert.equal(sampleTerrainAt(state, 6, 4).water, "dry");
  const island = site("island", 34, 34, 0, 1);
  state.elements.push(island);
  applyLandformPlacement(state, island);
  assert.equal(sampleTerrainAt(state, 142, 140).water, "dry");
  for (const [x, z] of [[127, 140], [157, 140], [142, 156], [142, 122]]) {
    assert.equal(sampleTerrainAt(state, x, z).water, "salt");
  }
  // Across the outer shoulder, the coast turns inland instead of ending at a square corner.
  const crossing = (x: number) => {
    for (let z = 139; z < 155; z += 0.25) if (sampleTerrainAt(state, x, z).depth > 0.01) return z;
    throw new Error("missing cay shoreline");
  };
  assert.ok(Math.max(crossing(134), crossing(150)) + 0.5 < crossing(142));
});

test("legacy repair and reload retain a player's later sand excavation, rock and a freshwater channel", () => {
  const state = makeWorld();
  state.elements.push({...site("old", -3, 27, 0, 1), sculptsTerrain:true});
  ensureInfrastructure(state);
  const columns = [{y:-0.41,m:"sand",form:"bank",w:"dry"}, {y:2.25,m:"rock",form:"bank",w:"dry"},
    {y:-1.5,m:"sand",form:"canal",w:"fresh",wl:-0.2}] as const;
  for (const [n, col] of columns.entries()) {
    const vx = -43 + n, vz = 438, loc = voxelToTileLocal(vx, vz);
    writeVoxelEditsToState(state, [{...loc,vx,vz,tileKey:loc.gx + "," + loc.gz,col}]);
  }
  const original = columns.map((_, n) => sampleVoxelColumn(state, -43 + n, 438));
  restoreBeachGround(state);
  assert.deepEqual(columns.map((_, n) => sampleVoxelColumn(state, -43 + n, 438)), original);
});

test("normal placement beside an existing boardwalk is tidal, undoable, and restores the prior coast", () => {
  const state = makeWorld();
  const boardwalk = {...site("boardwalk", -1, 26, 0, 0, "boardwalks"), level:1, spanX:1, spanZ:1};
  state.elements.push(boardwalk);
  const before = structuredClone(state), e = site("cove", -2, 28, 0, 2);
  const old = sampleTerrainAt(state, -3, 115);
  state.elements.push(e);
  applyLandformPlacement(state, e);
  assert.ok(sampleTerrainAt(state, -3, 115).elevation > old.elevation + 0.25);
  const offshore = sampleTerrainAt(state, -3, 122);
  assert.equal(offshore.water, "salt");
  assert.equal(offshore.waterLevel, SEA);
  rememberBuildingEdit(before, state, "Place Beach");
  const stamp = state.infrastructure!.coastlineStamp;
  assert.equal(undoBuildingEdit(state).ok, true);
  assert.deepEqual(sampleTerrainAt(state, -3, 115), old);
  assert.notEqual(state.infrastructure!.coastlineStamp, stamp);
  assert.equal(state.elements[0].id, "boardwalk");
});

test("beach surf fades locally and ordinary coasts keep their original water", () => {
  const state = makeWorld();
  const mask = new Uint8Array(GRID_SIZE ** 2);
  const e = site("beach", -3, 27, 0, 0);
  state.elements.push(e);
  applyLandformPlacement(state, e);
  beachSurfMask(state, mask);
  assert.equal(mask[cellIndex(-3, 27)], 255);
  assert.equal(mask[cellIndex(32, 27)], 0);
  assert.ok(mask.some(value => value > 0 && value < 255));
  beachSurfMask(makeWorld(), mask);
  assert.ok(mask.every(value => value === 0));
});

test("decorations never repaint the sea-facing join or restore the catalog tile in a placed beach", () => {
  for (let variant = 0; variant < 4; variant++) {
    const model = (worldSculpted: boolean, edges = false) => buildDesignVoxels(ELEMENT_BY_ID.beaches, 5, variant, 3, 2, 0,
      {worldSculpted, edges: edges ? [{side:"front",slot:1,kind:"beach",neighbor:"sea"}] : []}).v.v;
    assert.deepEqual(model(true, true), model(true));
    assert.ok(model(false).size > model(true).size + 300);
  }
});
