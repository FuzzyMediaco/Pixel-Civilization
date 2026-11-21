import { PixelVox, buildVoxelGeometry } from "./voxelCore";
import { solidVoxels } from "./designs/kit";

/** Models are centred on their bogies, facing +Z; the standard coupling pitch is 2.24 m. */
export function railVoxels(kind: string) {
  const [name, load] = kind.split("/"),
    v = new PixelVox(77),
    box = solidVoxels(v);
  const steel = "#374750",
    rubber = "#20292d",
    cream = "#f1dcac",
    glass = "#70b3bd",
    red = "#9b453c",
    blue = "#32576e";
  if (name === "coupler") {
    box(0, 0, -1, 0, 0, 1, steel);
    return v;
  }
  if (name === "steam-puff") {
    box(-1, 0, -1, 1, 1, 1, "#d4d3be");
    return v;
  }
  if (name === "points") {
    box(-1, 0, -4, -1, 0, 2, "#d8c779");
    box(0, 0, 3, 0, 0, 4, "#d8c779");
    box(1, 0, 5, 1, 0, 6, "#d8c779");
    box(2, 0, 7, 2, 0, 7, "#d8c779");
    return v;
  }
  if (name.startsWith("loader-")) {
    const commodity = name.slice(7);
    if (commodity === "grain" || commodity === "coal") {
      for (const x of [-3, 3]) {
        box(
          x - 2,
          0,
          -2,
          x + 2,
          8,
          2,
          commodity === "coal" ? "#67676d" : "#d9bd82",
        );
        box(x - 1, 9, -1, x + 1, 10, 1, "#946f4a");
      }
      box(-4, 7, 1, 4, 8, 2, steel);
    } else if (commodity === "fuel") {
      box(-3, 0, -2, 3, 5, 2, "#93b3aa");
      box(-2, 6, -1, 2, 7, 1, "#d0b66d");
      box(3, 2, 0, 6, 3, 0, steel);
    } else if (commodity === "livestock" || commodity === "timber") {
      for (const x of [-4, 4])
        for (const z of [-3, 3]) box(x, 0, z, x, 4, z, "#957552");
      for (const z of [-3, 3]) box(-4, 3, z, 4, 3, z, "#b8996c");
    } else {
      box(
        -3,
        0,
        -2,
        3,
        5,
        2,
        commodity === "dairy"
          ? "#cae1df"
          : commodity === "waste"
            ? "#6e8568"
            : "#b76c4a",
      );
      box(-4, 6, -3, 4, 6, 3, steel);
      box(-1, 0, 2, 1, 3, 2, "#788c88");
    }
    return v;
  }
  if (name.startsWith("signal-")) {
    box(-1, 0, -1, 1, 0, 1, steel);
    box(0, 1, 0, 0, 9, 0, "#a49770");
    box(-1, 7, 0, 1, 11, 0, steel);
    v.put(
      0,
      10,
      1,
      name.endsWith("red") ? "#ff5846" : "#5d3932",
      name.endsWith("red") ? 1.4 : 0,
    );
    v.put(
      0,
      8,
      1,
      name.endsWith("red") ? "#374a38" : "#84ff9c",
      name.endsWith("red") ? 0 : 1.2,
    );
    return v;
  }
  return v;
}

/* ============================================================================================
 * Rolling stock on the world voxel grid (0.25 m, 16 voxels per tile). Bodies are 7 voxels wide
 * (a little wider than the 5-voxel gauge drawn by buildRails), lengths come from the stock tables
 * in railOperations.ts. Kind strings: "<model>[/<load>][/<#line colour>]", load = full | partial.
 * ============================================================================================ */
const LENGTH: Record<string, number> = {
  steam: 15, diesel: 14, commuter: 14, electric: 14, express: 17,
  coach: 12, observation: 12, sleeper: 13, hopper: 11, gondola: 11, reefer: 12, livestock: 11, waste: 10,
  flat: 12, tanker: 11, container: 13, box: 11,
};
export const ROLLING_STOCK = Object.keys(LENGTH);
export function isRollingStock(kind: string) {
  return kind.split("/")[0] in LENGTH;
}
export function rollingVoxels(kind: string) {
  const parts = kind.split("/");
  const name = parts[0],
    load = parts.find((p) => p === "full" || p === "partial"),
    livery = parts.find((p) => p.startsWith("#")) ?? "#c8553d";
  const v = new PixelVox(91),
    box = solidVoxels(v);
  const L = LENGTH[name] ?? 12,
    z0 = -Math.floor(L / 2),
    z1 = z0 + L - 1;
  const steel = "#3b464c",
    dark = "#22292d",
    brass = "#d6a84c",
    glass = "#7fc0cc",
    cream = "#f2e2b8",
    roofGrey = "#8c969a",
    lamp = "#ffe9a8",
    tail = "#ff4b3a";
  // Underframe, bogies (2 axles each, dark frame + wheels) and brass couplers.
  const bogie = (zc: number) => {
    box(-3, 0, zc - 1, 3, 0, zc + 1, dark);
    for (const x of [-3, 3]) for (const z of [zc - 1, zc + 1]) v.put(x, 0, z, "#121618");
    for (const x of [-3, 3]) v.put(x, 1, zc, steel);
  };
  const frame = (y = 1) => box(-3, y, z0, 3, y, z1, steel);
  const couplers = () => {
    v.put(0, 1, z0 - 1, brass);
    v.put(0, 1, z1 + 1, brass);
  };
  const bogies = () => {
    bogie(z0 + 2);
    bogie(z1 - 2);
  };
  const windows = (y: number, from: number, to: number, step = 2, color = glass) => {
    for (const x of [-3, 3]) for (let z = from; z <= to; z += step) v.put(x, y, z, color, 0.35);
  };
  const lamps = (front: number, back: number, y: number) => {
    for (const x of [-2, 2]) {
      v.put(x, y, front, lamp, 1.3);
      v.put(x, y, back, tail, 0.9);
    }
  };
  if (name === "steam") {
    // 2-6-0 with spoked red drivers, side rods, cylinders, cowcatcher, brass dome and a green cab at the rear.
    frame();
    box(-2, 2, z0 + 3, 2, 5, z1 - 1, "#2a3133");
    box(-1, 6, z0 + 4, 1, 6, z1 - 2, "#384346");
    box(-2, 2, z1, 2, 5, z1, "#1c2122");
    v.put(0, 4, z1 + 1, lamp, 1.3);
    box(-1, 6, z1 - 3, 1, 8, z1 - 2, dark);
    box(-2, 9, z1 - 3, 2, 9, z1 - 2, "#2d3436");
    box(-1, 7, z1 - 7, 1, 7, z1 - 6, brass);
    v.put(0, 8, z1 - 7, brass);
    box(-3, 2, z0, 3, 7, z0 + 3, "#3d5f4c");
    box(-3, 8, z0, 3, 8, z0 + 3, "#2a2f30");
    for (const x of [-3, 3]) {
      v.put(x, 5, z0 + 1, glass, 0.4);
      v.put(x, 5, z0 + 2, glass, 0.4);
      for (const z of [z0 + 5, z0 + 8, z0 + 11]) {
        box(x, 0, z - 1, x, 2, z + 1, "#a3392b");
        v.put(x, 1, z, brass);
      }
      box(x, 1, z0 + 5, x, 1, z0 + 11, "#c4cacc");
      box(x, 2, z1 - 3, x, 3, z1 - 2, steel);
    }
    box(-2, 0, z1 + 1, 2, 1, z1 + 1, "#b0412f");
    box(-3, 2, z1 + 1, 3, 2, z1 + 1, "#b0412f");
    v.put(0, 0, z1 + 2, steel);
  } else if (name === "diesel") {
    // Streamlined bulldog-nose diesel in the line colour with a cream band and roof fans.
    frame();
    bogies();
    couplers();
    box(-3, 2, z0, 3, 6, z1 - 3, livery);
    box(-3, 4, z0, 3, 4, z1 - 3, cream);
    box(-2, 7, z0 + 1, 2, 7, z1 - 4, roofGrey);
    for (const z of [z0 + 3, z0 + 7]) box(-1, 8, z, 1, 8, z + 1, dark);
    box(-3, 2, z1 - 2, 3, 5, z1, livery);
    box(-2, 6, z1 - 2, 2, 6, z1 - 1, livery);
    box(-2, 5, z1 - 2, 2, 5, z1 - 2, glass, 0.4);
    for (const x of [-3, 3]) box(x, 5, z1 - 3, x, 5, z1 - 2, glass, 0.4);
    box(-3, 4, z1 - 2, 3, 4, z1, cream);
    lamps(z1 + 1, z0 - 1, 3);
  } else if (name === "commuter") {
    // Double-deck push-pull unit: two window rows, line-colour doors, sloped cab.
    frame();
    bogies();
    couplers();
    box(-3, 2, z0, 3, 9, z1 - 1, "#e9e4d6");
    box(-2, 10, z0 + 1, 2, 10, z1 - 2, roofGrey);
    windows(4, z0 + 1, z1 - 3);
    windows(7, z0 + 1, z1 - 3);
    for (const x of [-3, 3]) for (const z of [z0 + 4, z1 - 5]) box(x, 2, z, x, 5, z, livery);
    box(-3, 2, z0, 3, 2, z1 - 1, livery);
    box(-3, 2, z1, 3, 6, z1, "#e9e4d6");
    box(-2, 7, z1, 2, 8, z1, glass, 0.4);
    box(-2, 3, z1 + 1, 2, 4, z1 + 1, livery);
    lamps(z1 + 1, z0 - 1, 3);
  } else if (name === "electric") {
    // Box-cab electric with a raised pantograph and cab windows at both ends.
    frame();
    bogies();
    couplers();
    box(-3, 2, z0, 3, 7, z1, "#2f6f68");
    box(-3, 3, z0, 3, 3, z1, livery);
    box(-2, 8, z0 + 1, 2, 8, z1 - 1, roofGrey);
    for (const z of [z0, z1]) box(-2, 5, z, 2, 6, z, glass, 0.4);
    for (const x of [-3, 3]) for (const z of [z0 + 4, z0 + 7, z0 + 10]) box(x, 5, z, x, 6, z, "#a8c7c2");
    box(-1, 9, -2, 1, 9, 2, steel);
    box(0, 10, -1, 0, 11, 1, "#b9c3c6");
    box(-2, 12, -2, 2, 12, 2, "#c7cfd2");
    lamps(z1 + 1, z0 - 1, 3);
  } else if (name === "express") {
    // High-speed bullet: white body, long tapered nose, dark window band and a line-colour stripe.
    frame();
    bogies();
    couplers();
    box(-3, 2, z0, 3, 6, z1 - 6, "#efeee6");
    box(-3, 5, z0 + 1, 3, 5, z1 - 6, "#28343b", 0.15);
    box(-3, 3, z0, 3, 3, z1 - 6, livery);
    box(-2, 7, z0 + 1, 2, 7, z1 - 7, "#d9d8cf");
    for (let i = 0; i < 6; i++) {
      const w = i < 2 ? 3 : i < 4 ? 2 : 1,
        top = 6 - Math.floor(i * 0.7);
      box(-w, 2, z1 - 5 + i, w, top, z1 - 5 + i, "#efeee6");
      v.put(-w, 3, z1 - 5 + i, livery);
      v.put(w, 3, z1 - 5 + i, livery);
    }
    box(-1, 5, z1 - 4, 1, 5, z1 - 3, "#1f2b32", 0.2);
    box(-2, 2, z1 + 1, 2, 2, z1 + 1, lamp, 1.2);
    for (const x of [-2, 2]) v.put(x, 3, z0 - 1, tail, 0.9);
  } else if (name === "coach" || name === "observation" || name === "sleeper") {
    frame();
    bogies();
    couplers();
    const body = name === "sleeper" ? "#2e4a68" : name === "observation" ? "#8a4632" : "#40624f";
    box(-3, 2, z0, 3, 6, z1, body);
    box(-3, 3, z0, 3, 3, z1, livery);
    box(-2, 7, z0, 2, 7, z1, roofGrey);
    box(-1, 8, z0 + 1, 1, 8, z1 - 1, "#a6aeb1");
    windows(5, z0 + 1, z1 - 1, name === "sleeper" ? 3 : 2, name === "sleeper" ? "#e6c98e" : glass);
    for (const x of [-3, 3]) box(x, 2, z0 + 1, x, 6, z0 + 1, "#b08a54");
    if (name === "observation") {
      box(-2, 8, z0 + 3, 2, 9, z1 - 3, glass, 0.35);
      box(-1, 10, z0 + 3, 1, 10, z1 - 3, cream);
    }
  } else if (name === "hopper") {
    frame();
    bogies();
    couplers();
    const c = "#a6814c";
    for (let z = z0; z <= z1; z++) {
      const bay = (z - z0) % 4;
      const low = bay === 0 ? 2 : 1;
      box(-3, low + 1, z, 3, 6, z, c);
    }
    box(-2, 6, z0 + 1, 2, 6, z1 - 1, null as unknown as string);
    if (load) for (let z = z0 + 1; z <= z1 - 1; z++) box(-2, 5, z, 2, load === "full" ? 6 + Number(z % 3 === 0) : 5, z, "#e1bf62");
    for (const x of [-3, 3]) box(x, 7, z0, x, 7, z1, steel);
  } else if (name === "gondola" || name === "waste") {
    frame();
    bogies();
    couplers();
    const c = name === "waste" ? "#4f7a58" : "#5e5955";
    box(-3, 2, z0, 3, 2, z1, c);
    for (const x of [-3, 3]) box(x, 3, z0, x, 5, z1, c);
    for (const z of [z0, z1]) box(-3, 3, z, 3, 5, z, c);
    for (const x of [-3, 3]) for (let z = z0 + 2; z < z1; z += 3) v.put(x, 4, z, steel);
    if (name === "waste") for (const z of [z0 + 1, z0 + 6]) box(-2, 3, z, 2, 3, z + 3, "#3d6146");
    if (load)
      for (let z = z0 + 1; z <= z1 - 1; z++)
        for (let x = -2; x <= 2; x++) {
          const h = (load === "full" ? 5 : 3) + (((x * 7 + z * 3) & 3) === 0 ? 1 : 0);
          box(x, 3, z, x, h, z, name === "waste" ? ((x + z) & 1 ? "#8a8466" : "#6f7b5d") : (x + z) & 1 ? "#1e1e22" : "#34343a");
        }
  } else if (name === "flat") {
    frame();
    bogies();
    couplers();
    box(-3, 2, z0, 3, 2, z1, "#8a6646");
    for (const x of [-3, 3]) for (const z of [z0 + 1, 0, z1 - 1]) box(x, 3, z, x, 6, z, steel);
    if (load)
      for (const [x, y] of load === "full" ? [[-2, 3], [0, 3], [2, 3], [-1, 5], [1, 5]] : [[-1, 3], [1, 3]])
        box(x, y, z0, x, y + 1, z1, (x + y) & 1 ? "#b8875a" : "#9c6e45");
  } else if (name === "tanker") {
    frame();
    bogies();
    couplers();
    box(-2, 2, z0 + 1, 2, 6, z1 - 1, "#7f9ea4");
    box(-3, 3, z0 + 1, 3, 5, z1 - 1, "#94b0b3");
    box(-1, 7, z0 + 1, 1, 7, z1 - 1, "#7f9ea4");
    for (const z of [z0, z1]) box(-1, 3, z, 1, 5, z, "#6b878d");
    box(-1, 8, 0, 1, 8, 1, steel);
    for (let y = 2; y <= 6; y++) v.put(3, y, 0, "#c9d1d3");
    box(-3, 4, z0 + 1, 3, 4, z1 - 1, livery);
  } else if (name === "container") {
    frame();
    bogies();
    couplers();
    box(-3, 1, z0 + 2, 3, 1, z1 - 2, "#8f3a2c");
    for (const z of [z0, z0 + 1, z1 - 1, z1]) box(-3, 2, z, 3, 2, z, "#8f3a2c");
    if (load) {
      box(-3, 2, z0 + 1, 3, 5, -1, "#c96b44");
      box(-3, 2, 1, 3, 5, z1 - 1, "#3f8288");
      if (load === "full") box(-3, 6, z0 + 2, 3, 9, z1 - 2, "#e0b84a");
      for (const z of [-1, 1]) box(-3, 2, z, 3, load === "full" ? 9 : 5, z, "#2c3438");
    }
  } else {
    // box, reefer, livestock
    frame();
    bogies();
    couplers();
    const c = name === "reefer" ? "#e8e6d6" : name === "livestock" ? "#a5824f" : "#a34e3c";
    box(-3, 2, z0, 3, 6, z1, c);
    box(-3, 7, z0, 3, 7, z1, name === "reefer" ? "#d9dccd" : "#5d6266");
    if (name === "box") for (const x of [-3, 3]) box(x, 2, -1, x, 6, 1, "#7b3a2d");
    if (name === "reefer") {
      box(-2, 8, z0 + 1, 2, 9, z0 + 3, "#5f7f8c");
      for (const x of [-3, 3]) box(x, 4, z0 + 1, x, 4, z1 - 1, "#9fc6d6");
    }
    if (name === "livestock") {
      for (const x of [-3, 3]) for (let z = z0; z <= z1; z++) if ((z - z0) % 2 === 1) box(x, 3, z, x, 6, z, null as unknown as string);
      if (load)
        for (const x of [-3, 3])
          for (let z = z0 + 1; z <= z1; z += load === "full" ? 2 : 4) {
            v.put(x, 5, z, (z & 2) ? "#f2efe6" : "#2c2826");
            v.put(x, 4, z, "#5b4130");
          }
    }
  }
  return v;
}
export function buildRollingStock(kind: string) {
  const g = buildVoxelGeometry(rollingVoxels(kind));
  g.translate(-0.125, 0, -0.125);
  return g;
}

export function buildRailModel(kind: string) {
  if (isRollingStock(kind)) return buildRollingStock(kind);
  return buildVoxelGeometry(
    railVoxels(kind),
    kind === "steam-puff" ? 0.11 : 0.13,
  );
}
