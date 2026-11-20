import assert from "node:assert/strict";
import { test } from "node:test";
import "../src/game/designs/index";
import { ELEMENT_BY_ID } from "../src/game/catalog";
import { buildDesignVoxels } from "../src/game/voxelArchitect";
import { cellBeyondEdge, getParcelEdges, roadSiteAccess } from "../src/game/parcelEdges";
import { encodeRoadSitePort, roadPortalWidth, roadSitePortKind } from "../src/game/roadTopology";
import {
  buildOccupancyMap,
  createInitialGameState,
  getNetworkConnMask,
  type PlacedElement,
} from "../src/game/simulation";
import { applyInfrastructureStroke } from "../src/game/terrain";
import { packVoxKey } from "../src/game/voxelCore";

function site(defId: string, gx: number, gz: number): PlacedElement {
  return {
    id: defId + "@" + gx + "," + gz,
    defId,
    gx,
    gz,
    spanX: 1,
    spanZ: 1,
    level: 3,
    variant: 0,
    rotation: 0,
    connected: true,
    hasPoliceCover: false,
    hasFireCover: false,
    nuisancePenalty: 0,
    maintTimerSec: 0,
    disrepair: false,
    onFire: false,
    animProgress: 0,
    animKind: "place",
  };
}
const offsets = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

test("curb cuts follow the rotated garage slot, both gates, workable grade and road class", () => {
  const st = createInitialGameState("god");
  for (let rotation = 0; rotation < 4; rotation++) {
    const home = {
      ...site("medium_sized_homes", 2, 2),
      rotation,
      spanX: rotation % 2 ? 2 : 3,
      spanZ: rotation % 2 ? 3 : 2,
    };
    const [x, z] = cellBeyondEdge(home, "front", 1),
      street = site("roads", x, z);
    const [a, b] = cellBeyondEdge(home, "front", 0),
      extra = site("roads", a, b);
    st.elements = [home, street, extra];
    const occ = buildOccupancyMap(st.elements);
    const [gate] = roadSiteAccess(street, occ, st);
    assert.ok(gate);
    assert.equal(gate.side, "front");
    assert.equal(gate.slot, 1);
    assert.equal(gate.site, home);
    assert.equal(gate.kind, "drive");
    assert.equal(roadSiteAccess(extra, occ, st).length, 0);
    const dir = offsets.findIndex(([dx, dz]) => dx === gate.dx && dz === gate.dz);
    const mask = () => getNetworkConnMask(st.elements, street, occ, st);
    assert.equal(roadSitePortKind(mask(), dir), "drive");
    street.edgeOverrides = { [(["back", "right", "front", "left"] as const)[dir]]: "closed" };
    assert.equal(roadSitePortKind(mask(), dir), undefined);
    delete street.edgeOverrides;
    home.edgeOverrides = { front: "closed" };
    assert.equal(roadSiteAccess(street, occ, st).length, 0);
    delete home.edgeOverrides;
    for (const defId of ["freeways", "highways", "walking_paths", "train_tracks"])
      assert.equal(roadSiteAccess({ ...street, defId }, occ, st).length, 0, defId);
  }
  const road = site("roads", 0, 1),
    home = site("house", 0, 0);
  st.elements = [];
  const works = applyInfrastructureStroke(st, { kind: "raise", height: 3 }, [{ gx: 0, gz: 1 }]);
  assert.ok(works.valid);
  st.elements = [home, road];
  const occ = buildOccupancyMap(st.elements);
  assert.equal(roadSiteAccess(road, occ, st).length, 0);
  assert.equal(
    getParcelEdges(home, occ, st).some((e) => e.kind === "drive"),
    false,
  );
});

test("dead-end islands clear for real car, freight and bus entrances, while unattached termini survive", () => {
  const road = site("roads", 0, 1),
    incoming = site("roads", 0, 2);
  const mask = (building?: PlacedElement) => {
    const elements = building ? [road, incoming, building] : [road, incoming];
    return getNetworkConnMask(elements, road, buildOccupancyMap(elements));
  };
  const make = (defId: string, conn: number) => buildDesignVoxels(ELEMENT_BY_ID[defId], 5, 0, 1, 1, conn).v;
  const end = make("roads", mask());
  assert.ok(end.v.has(packVoxKey(-1, 2, -1)), "the real cul-de-sac lost its island");
  for (const [id, kind, rot] of [
    ["house", "drive", 0],
    ["factories", "freight", 2],
    ["bus_stops", "bus", 0],
  ] as const) {
    const el = { ...site(id, 0, 0), rotation: rot };
    const conn = mask(el);
    assert.equal(conn & 15, 4);
    assert.equal(roadSitePortKind(conn, 0), kind);
    for (const roadId of ["roads", "two_lane_roads", "pretty_roads", "dirt_roads"]) {
      const vox = make(roadId, conn);
      for (let z = -8; z <= 1; z++)
        for (let x = -2; x < 2; x++) {
          assert.ok(vox.v.has(packVoxKey(x, 0, z)), roadId + " gap at " + x + "," + z);
          for (let y = 1; y <= 4; y++)
            assert.equal(
              vox.v.has(packVoxKey(x, y, z)),
              false,
              roadId + " blocked at " + x + "," + y + "," + z,
            );
        }
      const width = roadPortalWidth[kind],
        center = vox.v.get(packVoxKey(0, 0, -8));
      for (let x = -width / 2; x < width / 2; x++)
        assert.equal(vox.v.get(packVoxKey(x, 0, -8)), center, "ragged gate edge");
    }
  }
  const hw = make("highways", 4);
  assert.ok(hw.v.has(packVoxKey(0, 1, 4)), "unattached highway lost its end barrier");
});

test("a side entrance drops the curb without repainting a through lane, and different gate kinds have distinct asset keys", () => {
  const road = (mask: number) => buildDesignVoxels(ELEMENT_BY_ID.roads, 4, 0, 1, 1, mask).v;
  const bare = road(5),
    opened = road(5 | encodeRoadSitePort(1, "drive"));
  for (let z = -8; z < 8; z++)
    for (let x = -2; x < 2; x++)
      assert.equal(
        opened.v.get(packVoxKey(x, 0, z)),
        bare.v.get(packVoxKey(x, 0, z)),
        "through-lane stripe changed",
      );
  assert.equal(opened.v.has(packVoxKey(7, 1, 0)), false);
  assert.notEqual(encodeRoadSitePort(1, "drive"), encodeRoadSitePort(1, "freight"));
});

test("a bridge abutment admits a driveway and a utility can have stairs without gaining a motor gate", () => {
  const st = createInitialGameState("god");
  st.elements = [];
  assert.ok(
    applyInfrastructureStroke(st, { kind: "bridge", mode: "road", shape: "truss", height: 2 }, [
      { gx: 0, gz: -1 },
      { gx: 0, gz: 1 },
    ]).valid,
  );
  const home = { ...site("house", 0, 2), rotation: 2 },
    other = { ...site("house", 1, 0), rotation: 3 };
  st.elements.push(home, other);
  let occ = buildOccupancyMap(st.elements);
  const outer = occ.get("0,1")!,
    deck = occ.get("0,0")!;
  assert.equal(roadSiteAccess(outer, occ, st)[0].site.id, home.id);
  assert.equal(roadSiteAccess(deck, occ, st).length, 0);
  assert.ok(applyInfrastructureStroke(st, { kind: "lower", height: 2 }, [{ gx: 4, gz: 1 }]).valid);
  const hydro = site("hydro_electric_power_plants", 4, 1),
    curb = site("roads", 4, 2);
  st.elements.push(hydro, curb);
  occ = buildOccupancyMap(st.elements);
  const [stairs] = getParcelEdges(hydro, occ, st);
  assert.equal(stairs.kind, "walk");
  assert.equal(stairs.stairRise, 2);
  assert.equal(roadSiteAccess(curb, occ, st).length, 0);
});
