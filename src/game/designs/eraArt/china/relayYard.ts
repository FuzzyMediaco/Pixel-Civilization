import { type Ctx, type PixelVox } from "../../kit";
import { beam } from "../../sculpturalKit";
import { streetLamp, clerk, courtPath, ink, lantern, timberBay } from "./civicParts";

/** Two spoked wheels share an axle underneath the basket of bamboo message cases. */
function mailCart(v: PixelVox, x: number, z: number) {
  for (const side of [-2, 2]) {
    for (const [dy, dz] of [
      [0, 0],
      [1, -1],
      [1, 1],
      [2, 0],
    ])
      v.put(x + side, 1 + dy, z + dz, ink.sill);
    v.put(x + side, 2, z, ink.bronze);
  }
  v.box(x - 1, 2, z - 1, x + 2, 3, z + 3, ink.sill);
  for (const offset of [-1, 0, 1])
    v.box(
      x + offset,
      3,
      z - 1,
      x + offset + 1,
      4 + Number(offset === 0),
      z + 2,
      offset ? ink.bamboo : ink.cord,
    );
  for (const side of [-1, 1]) beam(v, [x + side, 2, z + 2], [x + side, 3, z + 4], ink.sill);
}

function relayGate(v: PixelVox, x: number, z: number, r: number, height: number) {
  for (const side of [-r, r]) v.box(x + side, 1, z, x + side + 1, height, z + 1, ink.post);
  v.box(x - r - 1, height, z - 1, x + r + 2, height + 1, z + 2, ink.tile);
  v.box(x - 1, height - 1, z, x + 2, height, z + 1, ink.bronze);
  lantern(v, x + r - 1, height - 2, z);
}

function sortingRack(v: PixelVox, x: number, z: number, bays: number) {
  v.box(x, 1, z, x + 2, 4, z + 2 * bays, ink.sill);
  for (let i = 0; i < bays; i++) {
    v.box(x - 1, 3, z + i * 2, x + 3, 4, z + i * 2 + 1, ink.bamboo);
    v.put(x + 2, 3, z + i * 2, ink.cord);
  }
}

function ridersLane(c: Ctx) {
  const { v, hx, hz, lv } = c,
    track = -Math.floor(hx * 0.24);
  courtPath(c, track, -hz + 2, 5);
  const left = -hx + 4;
  timberBay(v, left, -Math.floor(hz * 0.31), 3, Math.max(3, Math.floor(hz * 0.49)), 1, 4);
  sortingRack(v, Math.min(hx - 3, track + 5), -hz + 3, Math.min(5, lv + 1));
  relayGate(v, track, hz - 3, 3, 4 + Number(lv >= 4));
  if (lv >= 2) mailCart(v, hx - 5, 1);
  if (lv >= 3) timberBay(v, hx - 6, -hz + 5, 5, 3, 1, 4);
  if (lv >= 4) {
    clerk(v, track + 1, 1, -hz + 6);
    relayGate(v, track, -hz + 3, 4, 6);
  }
  if (lv === 5) timberBay(v, hx - 6, hz - 6, 5, 3, 1, 6);
}

function turningInn(c: Ctx) {
  const { v, hx, hz, lv } = c,
    turn = -Math.floor(hz * 0.25);
  // The loading porch bends around a turning court so vehicles can reverse onto the street.
  timberBay(v, -Math.floor(hx * 0.28), turn, Math.max(4, Math.floor(hx * 0.52)), 3, 1, 4);
  v.box(-hx + 2, 0, turn, hx - 2, 1, turn + 3, ink.stone);
  v.box(hx - 6, 0, turn, hx - 2, 1, hz, ink.stone);
  mailCart(v, hx - 4, hz - 6);
  if (lv >= 2) timberBay(v, -hx + 4, turn + 4, 3, 3, 1, 4);
  if (lv >= 3) {
    timberBay(v, -hx + 5, hz - 5, 4, 3, 1, 5);
    sortingRack(v, 0, turn - 3, 4);
  }
  if (lv >= 4) {
    relayGate(v, hx - 6, hz - 3, 4, 5);
    mailCart(v, 4, turn - 3);
    // A high dispatch gallery spans the exit lane while porters work the loading porch below.
    timberBay(v, hx - 7, turn, 5, 3, 6, 4);
    for (const s of [-1, 1]) v.box(hx - 7 + s * 4, 1, turn + 1, hx - 6 + s * 4, 7, turn + 2, ink.post);
    v.box(hx - 11, 1, turn - 2, hx - 10, 7, turn - 1, ink.post);
  }
  if (lv === 5) {
    timberBay(v, hx - 6, -hz + 5, 5, 4, 1, 5);
    clerk(v, 1, 1, turn + 3);
  }
}

function canalPost(c: Ctx) {
  const { v, hx, hz, lv } = c,
    canal = Math.floor(hx * 0.26),
    z = -Math.floor(hz * 0.23);
  v.box(canal - 1, 0, -hz + 1, hx - 1, 1, hz - 1, "#598681");
  v.box(canal - 3, 0, -hz + 2, canal - 1, 2, hz - 2, ink.brick);
  // The section boat has pointed ends, a raised stern and tied packets beside the oar.
  const len = Math.min(hz - 3, 4 + lv),
    x = Math.min(hx - 4, canal + 2);
  v.box(x - 1, 1, z - len + 1, x + 2, 2, z + len, ink.sill);
  for (const side of [-2, 2]) {
    v.box(x + side, 2, z - len + 2, x + side + 1, 3, z + len - 1, ink.bamboo);
    beam(v, [x + side, 2, z - len + 2], [x, 3, z - len], ink.sill);
    beam(v, [x + side, 2, z + len - 1], [x, 3, z + len], ink.sill);
  }
  sortingRack(v, x, z - 1, 2);
  beam(v, [x, 3, z + 3], [x + 3, 2, z + 6], ink.sill);
  if (lv >= 3) {
    // A battened linen awning lifts over the bundles; the quay remains visible next to the boat.
    v.box(x, 2, z - len + 2, x + 1, 7 + lv, z - len + 3, ink.sill);
    for (let strip = 0; strip < 2 + lv; strip++) {
      const bend = Math.round(Math.sin((strip / (lv + 1)) * Math.PI) * 2);
      v.box(
        x - 1,
        5 + bend,
        z - len + 2 + strip,
        x + 3,
        6 + bend,
        z - len + 3 + strip,
        strip % 2 ? "#d9b17d" : ink.cord,
      );
    }
    for (let pier = -hz + 4; pier < hz - 3; pier += 5)
      v.box(canal - 2, 1, pier, canal - 1, 4, pier + 1, ink.sill);
  }
  timberBay(v, -hx + 5, z, 4, Math.min(6, hz - 3), 1, 4);
  courtPath(c, canal - 3, z);
  if (lv >= 2) clerk(v, canal - 3, 2, z + 1);
  if (lv >= 3) {
    relayGate(v, canal - 4, hz - 4, 3, 5);
    mailCart(v, -hx + 5, hz - 6);
  }
  if (lv >= 4) timberBay(v, -hx + 6, -hz + 5, 5, 3, 1, 5);
  if (lv === 5) {
    v.box(canal - 4, 2, hz - 7, hx - 2, 3, hz - 5, ink.sill);
    timberBay(v, canal - 4, -hz + 5, 4, 3, 1, 5);
  }
}

function scaffoldPost(c: Ctx) {
  const { v, hx, hz, lv } = c,
    axle = -Math.floor(hx * 0.25),
    back = -Math.floor(hz * 0.3);
  // A pivoting packet lift spans the change in level at the inland relay station.
  for (const side of [-2, 2]) {
    beam(v, [axle + side - 1, 1, back + 2], [axle + side, 7 + lv, back], ink.post);
    beam(v, [axle + side + 1, 1, back - 2], [axle + side, 7 + lv, back], ink.post);
  }
  beam(v, [axle - 3, 6 + lv, back], [axle + 3, 6 + lv, back], ink.bronze);
  const tip = Math.min(hx - 3, axle + 4 + lv);
  beam(v, [axle - 4, 5 + lv, back], [tip, 8 + lv, back], ink.sill);
  beam(v, [tip, 8 + lv, back], [tip, 4, back], ink.cord);
  v.box(tip - 1, 3, back - 1, tip + 2, 5, back + 2, ink.bamboo);
  timberBay(v, axle, hz - 4, 4, 3, 1, 3);
  courtPath(c, axle + 3, back + 2);
  if (lv >= 2) sortingRack(v, hx - 5, back + 3, 2 + Number(lv >= 4));
  if (lv >= 3) {
    mailCart(v, -hx + 5, -hz + 5);
    relayGate(v, hx - 5, hz - 4, 3, 5);
  }
  if (lv >= 4) timberBay(v, -hx + 6, -hz + 5, 4, 3, 1, 4);
  if (lv === 5) {
    timberBay(v, hx - 7, hz - 6, 6, 4, 1, 6);
    clerk(v, tip, 1, back + 2);
  }
}

export function buildCourierYard(c: Ctx) {
  [ridersLane, turningInn, canalPost, scaffoldPost][c.variant](c);
  const [x, z] = [
    [Math.floor(-c.hx * 0.24) + 3, c.hz - 3],
    [c.hx - 2, c.hz - 3],
    [Math.floor(c.hx * 0.26) - 2, c.hz - 3],
    [-c.hx + 4, c.hz - 3],
  ][c.variant];
  streetLamp(c.v, x, z, 4 + Number(c.lv >= 3));
}
