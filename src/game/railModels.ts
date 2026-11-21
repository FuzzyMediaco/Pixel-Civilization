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
  box(-3, 2, -7, 3, 2, 7, steel);
  box(-2, 1, -7, 2, 1, 7, steel);
  for (const z of [-5, -3, 3, 5])
    for (const x of [-3, 3]) v.put(x, 1, z, rubber);
  const windows = (y: number, color: string) => {
    for (const x of [-3, 3])
      for (let z = -5; z <= 5; z += 2) v.put(x, y, z, color, 0.25);
  };
  const door = (z: number, color: string) => {
    for (const x of [-3, 3]) box(x, 3, z, x, 5, z, color);
  };
  if (name === "steam") {
    box(-2, 3, -2, 2, 6, 5, "#303d3e");
    box(-1, 7, -2, 1, 7, 5, "#465556");
    box(-3, 3, -6, 3, 6, -3, "#365348");
    box(-3, 7, -6, 3, 7, -3, "#26393b");
    for (const x of [-3, 3]) v.put(x, 5, -4, glass, 0.3);
    box(-1, 7, 4, 1, 9, 5, rubber);
    box(-2, 10, 4, 2, 10, 5, steel);
    box(0, 7, 0, 0, 8, 1, cream);
    box(-2, 3, 6, 2, 4, 6, red);
    for (const x of [-3, 3]) box(x, 2, -4, x, 2, 4, "#c1a36b");
    v.put(0, 6, 6, "#ffe8a0", 1);
  } else if (name === "diesel") {
    box(-2, 3, -6, 2, 5, 5, "#ce9947");
    box(-3, 3, 1, 3, 6, 4, blue);
    box(-3, 6, 2, 3, 6, 4, glass);
    box(-3, 7, 1, 3, 7, 4, blue);
    for (const x of [-2, 2])
      for (const z of [-5, -3, -1]) box(x, 4, z, x, 5, z, steel);
    for (const z of [-7, 7]) box(-3, 2, z, 3, 2, z, "#f2cb69");
    v.put(0, 5, 6, "#fff2b3", 1.2);
  } else if (name === "electric" || name === "commuter" || name === "express") {
    const body =
      name === "express"
        ? "#e8e6da"
        : name === "electric"
          ? "#3e7970"
          : "#354e7c";
    const tall = name === "commuter" ? 8 : 6,
      nose = name === "express" ? 3 : 1;
    box(-3, 3, -6, 3, tall - 1, 6 - nose, body);
    box(-2, tall, -5, 2, tall, 5 - nose, body);
    windows(5, glass);
    box(-2, 3, 7 - nose, 2, 4, 7, body);
    box(-2, 5, 6 - nose, 2, 5, 6 - nose, glass);
    if (name === "commuter") windows(7, "#a2c8d2");
    for (const x of [-3, 3])
      box(x, 3, -6, x, 3, 5 - nose, name === "express" ? "#ad5146" : cream);
    if (name === "electric") {
      box(-2, 7, -3, 2, 7, -3, steel);
      box(-1, 8, -2, 1, 8, -2, steel);
      box(-2, 9, -1, 2, 9, -1, steel);
    }
    for (const x of [-2, 2]) v.put(x, 4, 7, "#fff2bb", 1.2);
  } else if (["coach", "sleeper", "observation"].includes(name)) {
    const color =
      name === "coach" ? "#476b5b" : name === "sleeper" ? "#34536c" : "#994c38";
    box(-3, 3, -6, 3, 6, 6, color);
    box(-2, 7, -6, 2, 7, 6, cream);
    windows(5, name === "sleeper" ? "#b5a59d" : glass);
    for (const x of [-3, 3]) box(x, 3, -6, x, 3, 6, cream);
    door(-5, "#a68b5e");
    if (name === "sleeper") {
      for (const z of [-4, 0, 4]) box(-1, 8, z, 1, 8, z + 1, "#6b7577");
      box(-3, 4, 5, 3, 5, 5, "#c3a36d");
    }
    if (name === "observation") {
      box(-2, 8, -2, 2, 8, 3, glass);
      box(-1, 9, -2, 1, 9, 3, cream);
    }
  } else if (name === "tanker") {
    box(-2, 3, -5, 2, 7, 5, "#75949a");
    box(-3, 4, -5, 3, 6, 5, "#91aaab");
    box(-2, 4, -6, 2, 6, 6, "#658187");
    box(0, 8, 0, 1, 8, 1, steel);
    for (const z of [-3, 3]) box(-3, 6, z, 3, 6, z, steel);
  } else if (name === "hopper" || name === "gondola" || name === "waste") {
    const color =
      name === "hopper" ? "#a6814c" : name === "waste" ? "#55755e" : "#6f6a64";
    for (const x of [-3, 3]) box(x, 4, -6, x, 6, 6, color);
    for (const z of [-6, 6]) box(-3, 4, z, 3, 6, z, color);
    box(-2, 3, -5, 2, 3, 5, color);
    if (load)
      for (let z = -5; z <= (load === "full" ? 5 : 0); z++)
        box(
          -2,
          4,
          z,
          2,
          5 + Number(z % 3 === 0),
          z,
          name === "hopper"
            ? "#d8b863"
            : name === "waste"
              ? "#918867"
              : "#343234",
        );
  } else if (name === "flat") {
    box(-3, 3, -6, 3, 3, 6, "#977353");
    for (const x of [-3, 3])
      for (const z of [-5, 0, 5]) box(x, 4, z, x, 6, z, steel);
    if (load)
      for (const x of load === "full" ? [-2, 0, 2] : [0])
        box(x, 4, -5, x + 1, 5, 5, "#b38b5e");
  } else if (name === "container") {
    box(-3, 3, -6, 3, 3, 6, red);
    if (load) {
      box(-3, 4, -6, 3, 7, -1, "#bd6a46");
      if (load === "full") box(-3, 4, 1, 3, 7, 6, "#47868a");
    }
  } else {
    const color =
      name === "reefer"
        ? "#dfddc7"
        : name === "livestock"
          ? "#ad8b5f"
          : "#a75945";
    box(-3, 3, -6, 3, 6, 6, color);
    box(-3, 7, -6, 3, 7, 6, name === "reefer" ? "#e6e9d9" : steel);
    for (const x of [-3, 3]) {
      box(x, 3, -1, x, 6, 2, name === "reefer" ? "#95aeb0" : "#816651");
      if (name === "livestock")
        for (let z = -5; z < 6; z += 2) v.put(x, 5, z, steel);
    }
    if (name === "reefer") box(-1, 6, -7, 1, 7, -7, blue);
  }
  return v;
}

export function buildRailModel(kind: string) {
  return buildVoxelGeometry(
    railVoxels(kind),
    kind === "steam-puff" ? 0.11 : 0.13,
  );
}
