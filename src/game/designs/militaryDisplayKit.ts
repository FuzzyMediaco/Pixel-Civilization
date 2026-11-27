import { PixelVox, type Ctx } from "./kit";

/** Parcel-local design voxels. The moving art shares its rest pose with all static illustrations. */
export type VoxelPoint = [number, number, number];
export type DefenseArtMotion =
  | { kind: "hatch"; travel: VoxelPoint }
  | {
      kind: "drone";
      index: number;
      count: number;
      variant: number;
      hx: number;
      hz: number;
    };

export function siloHatchLayout(c: Ctx) {
  const axis: "x" | "z" = c.variant % 2 === 0 ? "x" : "z";
  const center: VoxelPoint = [0, c.variant === 2 && c.lv >= 3 ? 3 : 2, -1];
  const rx = Math.max(4, Math.floor(c.hx * (c.variant === 3 ? 0.53 : 0.57)));
  const rz = Math.max(3, Math.floor(c.hz * (c.variant === 1 ? 0.51 : 0.55)));
  const travel = Math.max(2, Math.floor((axis === "x" ? rx : rz) * 0.45));
  return { center, rx, rz, axis, travel };
}

/** The caller paints each original leaf around origin; its full-open travel is a local vector. */
export function siloHatchPlate(
  c: Ctx,
  origin: VoxelPoint,
  travel: VoxelPoint,
): PixelVox {
  const vox = new PixelVox();
  c.addRotor({
    vox,
    pivot: origin,
    axis: "y",
    speed: 0,
    display: { kind: "hatch", travel },
  });
  return vox;
}

// Half-extents are scaled to leave space for the wing tips even on a 1×1 berth.
// The four arrangements leave a central plaza, a diagonal lane, a colonnade and a crescent respectively.
const dockFractions = [
  [
    [-0.8, 0.8],
    [0.8, 0.8],
    [0.8, -0.8],
    [-0.8, -0.8],
    [0, 0.8],
    [0, -0.8],
  ],
  [
    [-0.9, 0.8],
    [0.9, -0.8],
    [-0.9, -0.25],
    [0.9, 0.3],
    [-0.05, 0.8],
    [0.05, -0.8],
  ],
  [
    [-0.9, -0.9],
    [0.9, -0.9],
    [-0.9, 0.05],
    [0.9, 0.05],
    [-0.9, 0.95],
    [0.9, 0.95],
  ],
  [
    [-0.95, 0.5],
    [0.95, 0.5],
    [-0.8, -0.55],
    [0.8, -0.55],
    [-0.3, -0.9],
    [0.3, -0.9],
  ],
] as const;

/** Deck-top positions for each level, before parcel rotation. Artists may raise a berth onto a roof. */
export function swarmDockLayout(c: Ctx): VoxelPoint[] {
  return dockFractions[c.variant]
    .slice(0, c.lv + 1)
    .map(([u, w]) => [
      Math.round(u * (c.hx - 4)),
      2,
      Math.round(w * (c.hz - 4)),
    ]);
}

/** Pixel-scale four-wing lantern drones have colored hulls, pale wing tips and one steady forward light. */
export function parkDisplayDrone(
  c: Ctx,
  dock: VoxelPoint,
  index: number,
): void {
  const vox = new PixelVox();
  const color = c.vpick(["teal", "orange", "indigo", "sky"]);
  vox.box(-1, 0, -1, 1, 1, 1, "steelDark");
  vox.box(-1, 1, -1, 1, 2, 2, color);
  vox.put(0, 1, 2, "warmGlow", 0.85);
  for (const x of [-2, 1])
    for (const z of [-2, 1]) {
      vox.box(x, 1, z, x + 1, 2, z + 2, "steelDark");
      const tip = x < 0 ? x - 1 : x + 1;
      vox.box(tip, 1, z, tip + 1, 2, z + 2, "cream");
    }
  c.addRotor({
    vox,
    pivot: dock,
    axis: "y",
    speed: 0,
    display: {
      kind: "drone",
      index,
      count: c.lv + 1,
      variant: c.variant,
      hx: c.hx,
      hz: c.hz,
    },
  });
}
