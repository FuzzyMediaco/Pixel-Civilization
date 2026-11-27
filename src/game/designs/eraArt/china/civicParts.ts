import { person, type Ctx, type PixelVox } from "../../kit";
import { beam } from "../../sculpturalKit";

export const ink = {
  bamboo: "#d6ad68",
  inside: "#e6cd94",
  cord: "#753d35",
  tile: "#436964",
  ridge: "#78928a",
  post: "#944735",
  sill: "#5e4436",
  stone: "#b5a990",
  brick: "#8a7761",
  paper: "#e4d4ac",
  bronze: "#927b40",
  lamp: "#ffcc74",
};

/** Overhanging rows of clay tiles, a ridge cap and lifted corners over a timber bay. */
export function tileRoof(v: PixelVox, x: number, z: number, rx: number, rz: number, y: number, rise: number) {
  for (let dx = -rx; dx <= rx; dx++) {
    for (let dz = -rz; dz <= rz; dz++) {
      const nx = Math.abs(dx) / Math.max(rx, 1),
        nz = Math.abs(dz) / Math.max(rz, 1);
      const ridge = Math.max(nz, Math.max(0, (nx - 0.58) / 0.42));
      const curl = nx > 0.75 && nz > 0.7 ? 1 + Number(nx > 0.91 && nz > 0.9) : 0;
      const h = y + Math.round((1 - ridge) * rise) + curl;
      v.box(
        x + dx,
        h,
        z + dz,
        x + dx + 1,
        h + 2,
        z + dz + 1,
        dz === 0 || Math.abs(dz) === rz ? ink.ridge : (dx + 2 * rx) % 3 === 0 ? "#557775" : ink.tile,
      );
    }
  }
}

/** Open reading, hearing or work bay. The clear front is always the street side. */
export function timberBay(
  v: PixelVox,
  x: number,
  z: number,
  rx: number,
  rz: number,
  floor: number,
  height: number,
) {
  v.box(x - rx, floor, z - rz, x + rx + 1, floor + 1, z + rz + 1, ink.stone);
  for (const px of [x - rx + 1, x + rx - 1])
    for (const pz of [z - rz + 1, z + rz - 1]) {
      v.box(px, floor + 1, pz, px + 1, floor + height, pz + 1, ink.post);
      v.box(px - 1, floor + height - 1, pz, px + 2, floor + height, pz + 1, ink.sill);
    }
  v.box(x - rx + 2, floor + 1, z - rz + 1, x + rx - 1, floor + height - 1, z - rz + 2, ink.paper);
  tileRoof(v, x, z, rx, rz, floor + height, Math.max(2, Math.round(rz * 0.6)));
}

export function courtPath(c: Ctx, x: number, z: number, width = 3) {
  const w = Math.floor(width / 2);
  c.v.box(x - w, 0, z, x + w + 1, 1, c.hz, ink.stone);
}

export function lantern(v: PixelVox, x: number, y: number, z: number) {
  v.put(x, y + 2, z, ink.sill);
  v.box(x - 1, y, z, x + 2, y + 2, z + 1, ink.lamp, 0.72);
  v.put(x, y - 1, z, ink.post);
}

export function clerk(v: PixelVox, x: number, y: number, z: number) {
  person(v, x, y, z, "#467674", "#4c4657", "#b88363");
}

export function stairs(
  v: PixelVox,
  x: number,
  front: number,
  halfWidth: number,
  height: number,
  run: number,
) {
  for (let n = 0; n < run; n++) {
    const top = 1 + Math.ceil(((n + 1) * height) / run);
    v.box(x - halfWidth, 1, front - n, x + halfWidth + 1, top, front - n + 1, n % 3 ? ink.stone : "#c6b79c");
  }
}

/** A real slip of bamboo with paired bindings and legible dark marks on its upper face. */
export function slip(v: PixelVox, a: [number, number, number], b: [number, number, number], width: number) {
  beam(v, a, b, ink.bamboo, width);
  for (const f of [0.19, 0.37, 0.52, 0.62, 0.83]) {
    const [x, y, z] = a.map((n, i) => Math.round(n + (b[i] - n) * f));
    v.put(x, y + width, z, f === 0.19 || f === 0.83 ? ink.cord : ink.sill);
  }
}

export function cypress(v: PixelVox, x: number, z: number, h: number) {
  v.box(x, 1, z, x + 1, h - 1, z + 1, ink.sill);
  for (let i = 0; i < 3; i++)
    v.cylinderY(x, z, h - 3 + i, h - 1 + i, Math.max(0.6, (3 - i) * 0.8), i % 2 ? "#759367" : "#4f7350");
}

/** A hanging street lantern with a visible crossarm and a pair of tassels. */
export function streetLamp(v: PixelVox, x: number, z: number, height = 6) {
  v.box(x, 1, z, x + 1, height + 2, z + 1, ink.sill);
  v.box(x - 2, height + 1, z, x + 1, height + 2, z + 1, ink.sill);
  v.box(x - 3, height - 1, z - 1, x, height + 1, z + 1, "#ffd48d", 0.84);
  for (const end of [-3, -1]) v.put(x + end, height - 2, z, ink.post);
}
